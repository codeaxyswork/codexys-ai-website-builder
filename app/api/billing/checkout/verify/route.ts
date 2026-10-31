import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { PLANS } from "@/lib/constants";
import { getPaymentProvider } from "@/lib/payment-providers";
import { invalidateUserCache } from "@/lib/cache";
import {
  calculatePlanPrice,
  calculatePeriodEndDate,
  normalizeBillingInterval,
} from "@/lib/billing-periods";
import { generateInvoiceRecord, generateSequentialInvoiceNumber } from "@/lib/billing-invoices";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const orderId = String(body.orderId || body.razorpay_order_id || "").trim();
    const paymentId = String(body.paymentId || body.razorpay_payment_id || "").trim();
    const signature = String(body.signature || body.razorpay_signature || "").trim();

    if (!orderId || !paymentId) {
      return NextResponse.json(
        { error: "Payment verification requires valid orderId and paymentId." },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // 1. Idempotency Check on Completed Payment
    const { data: existingCompletedTx } = await adminSupabase
      .from("billing_transactions")
      .select("id, status, user_id")
      .eq("provider_payment_id", paymentId)
      .eq("status", "completed")
      .maybeSingle();

    if (existingCompletedTx) {
      if (existingCompletedTx.user_id !== user.id) {
        console.error(
          `[Billing Security] User ${user.id} attempted to claim completed payment ${paymentId} belonging to user ${existingCompletedTx.user_id}`
        );
        return NextResponse.json(
          {
            error: "Payment verification ownership mismatch. Payment already attributed to another user.",
            code: "PAYMENT_OWNERSHIP_MISMATCH",
          },
          { status: 403 }
        );
      }
      return NextResponse.json({
        success: true,
        message: "Payment has already been verified and processed.",
        idempotent: true,
      });
    }

    // 2. Fetch Stored Pending Transaction Using Provider Order ID
    const { data: pendingTx, error: pendingErr } = await adminSupabase
      .from("billing_transactions")
      .select("*")
      .eq("provider_payment_id", orderId)
      .eq("transaction_type", "checkout_order_created")
      .maybeSingle();

    if (pendingErr) {
      console.error("[Billing Verification] Error finding pending order:", orderId, pendingErr);
      return NextResponse.json({ error: "Failed to query order records." }, { status: 500 });
    }

    if (!pendingTx) {
      return NextResponse.json(
        {
          error: "Pending order not found or invalid order identifier.",
          code: "ORDER_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // 3. Verify Order Ownership: Ensure Transaction Belongs to Authenticated User
    if (pendingTx.user_id !== user.id) {
      console.error(
        `[Billing Security] User ${user.id} attempted to claim order ${orderId} belonging to user ${pendingTx.user_id}`
      );
      return NextResponse.json(
        {
          error: "Payment verification ownership mismatch. Order does not belong to authenticated user.",
          code: "ORDER_OWNERSHIP_MISMATCH",
        },
        { status: 403 }
      );
    }

    // 4. Validate Order State
    if (pendingTx.status !== "pending") {
      return NextResponse.json(
        {
          error: `Order is in invalid state '${pendingTx.status}'. Only pending orders can be verified.`,
          code: "INVALID_ORDER_STATE",
        },
        { status: 400 }
      );
    }

    // 5. Derive Plan, Interval, Amount, and Metadata Exclusively from Stored Order Record
    const planId = (pendingTx.plan_id || "").toLowerCase().trim();
    const interval = normalizeBillingInterval(pendingTx.billing_interval || "monthly");
    const trustedAmount = Number(pendingTx.amount);
    const trustedCurrency = pendingTx.currency || "INR";
    const txMeta = (pendingTx.metadata as Record<string, any>) || {};
    const optInDomain = Boolean(txMeta.domain_offer_opted_in);
    const websiteId = txMeta.website_id ? String(txMeta.website_id).trim() : null;
    const requestedDomain = txMeta.custom_domain ? String(txMeta.custom_domain).toLowerCase().trim() : null;
    const flowType = txMeta.flow_type || (websiteId ? "flow_a_website_publish" : "flow_b_direct_plan");

    // Enforce parameter tamper-proofing: reject client attempts to manipulate plan, interval, or amount
    if (body.planId && String(body.planId).toLowerCase().trim() !== planId) {
      return NextResponse.json(
        {
          error: "Client supplied plan ID does not match verified server order.",
          code: "PLAN_TAMPERING_REJECTED",
        },
        { status: 400 }
      );
    }

    if (body.interval && normalizeBillingInterval(String(body.interval)) !== interval) {
      return NextResponse.json(
        {
          error: "Client supplied billing interval does not match verified server order.",
          code: "INTERVAL_TAMPERING_REJECTED",
        },
        { status: 400 }
      );
    }

    if (body.amount !== undefined && Number(body.amount) !== trustedAmount) {
      return NextResponse.json(
        {
          error: "Client supplied payment amount does not match verified server order.",
          code: "AMOUNT_TAMPERING_REJECTED",
        },
        { status: 400 }
      );
    }

    const plan = PLANS[planId];
    if (!plan) {
      return NextResponse.json(
        { error: "Plan referenced in order record is invalid.", code: "INVALID_PLAN" },
        { status: 400 }
      );
    }

    // Re-verify catalog price integrity against trusted server calculation
    const calculation = calculatePlanPrice(plan.id, interval, { optInDomainOffer: optInDomain });
    if (calculation.finalTotal !== trustedAmount || calculation.currency !== trustedCurrency) {
      console.error(
        `[Billing Security] Stored order amount mismatch: order=${trustedAmount} ${trustedCurrency}, catalog=${calculation.finalTotal} ${calculation.currency}`
      );
      return NextResponse.json(
        {
          error: "Stored order amount does not match catalog pricing.",
          code: "PRICE_INTEGRITY_MISMATCH",
        },
        { status: 400 }
      );
    }

    // 6. Cryptographic Signature Verification
    const provider = getPaymentProvider(pendingTx.provider || undefined);
    const verifyResult = await provider.verifyPayment({
      orderId,
      paymentId,
      signature,
    });

    const isVerified =
      typeof verifyResult === "boolean" ? verifyResult : Boolean(verifyResult.verified);

    if (!isVerified) {
      console.error(
        `[Billing Security] Cryptographic payment signature mismatch for order ${orderId}, payment ${paymentId}`
      );

      await adminSupabase.from("billing_transactions").insert({
        user_id: user.id,
        provider: provider.name,
        provider_payment_id: paymentId,
        transaction_type: "payment_verification_failed",
        plan_id: plan.id,
        amount: calculation.finalTotal,
        currency: calculation.currency,
        status: "failed",
        metadata: {
          order_id: orderId,
          error: "Signature mismatch or tampering detected.",
          flow_type: flowType,
        },
      });

      return NextResponse.json(
        {
          error: "Payment verification failed. Security signature could not be verified.",
          code: "SIGNATURE_VERIFICATION_FAILED",
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const periodEnd = calculatePeriodEndDate(now, calculation.interval);

    // 7. Upsert Active Subscription
    const { data: subData, error: subErr } = await adminSupabase
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan_id: plan.id,
          status: "active",
          billing_provider: provider.name,
          billing_interval: calculation.interval,
          duration_months: calculation.durationMonths,
          discount_percent: calculation.discountPercent,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          last_credit_refreshed_at: now.toISOString(),
          cancel_at_period_end: false,
          canceled_at: null,
          updated_at: now.toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (subErr) {
      console.error("[Billing] Failed to upsert verified subscription:", subErr);
      return NextResponse.json({ error: "Failed to activate subscription record." }, { status: 500 });
    }

    // 8. Replenish User Credits to Plan Allowance (Rule: 1 month upfront, no rollover)
    await adminSupabase
      .from("user_credits")
      .upsert(
        {
          user_id: user.id,
          balance: plan.monthlyCredits,
          monthly_used: 0,
          last_refreshed_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
        { onConflict: "user_id" }
      );

    // 9. Generate Concurrency-Safe Sequential Tax Invoice
    const invoiceNumber = await generateSequentialInvoiceNumber(adminSupabase);
    const invoice = generateInvoiceRecord({
      userId: user.id,
      userEmail: user.email || undefined,
      planId: plan.id,
      planName: plan.name,
      interval: calculation.interval,
      durationMonths: calculation.durationMonths,
      grossAmount: calculation.grossTotal,
      discountAmount: calculation.discountAmount,
      finalTotal: calculation.finalTotal,
      provider: provider.name,
      orderId,
      paymentId,
      invoiceNumber,
      domainOfferDetails: {
        optedIn: calculation.domainOfferDetails.optedIn,
        domainName: requestedDomain || undefined,
        freeYears: calculation.domainOfferDetails.freeYears,
      },
    });

    // 10. Record Completed Billing Transaction (Idempotent Insertion)
    const { data: transData, error: transErr } = await adminSupabase
      .from("billing_transactions")
      .insert({
        user_id: user.id,
        subscription_id: subData?.id || null,
        provider: provider.name,
        provider_payment_id: paymentId,
        transaction_type: "subscription_payment_verified",
        plan_id: plan.id,
        amount: calculation.finalTotal,
        currency: calculation.currency,
        status: "completed",
        billing_interval: calculation.interval,
        duration_months: calculation.durationMonths,
        discount_percent: calculation.discountPercent,
        discount_amount: calculation.discountAmount,
        original_amount: calculation.grossTotal,
        metadata: {
          plan_name: plan.name,
          order_id: orderId,
          payment_id: paymentId,
          provider: provider.name,
          flow_type: flowType,
          website_id: websiteId,
          custom_domain: requestedDomain,
          domain_offer_opted_in: calculation.domainOfferDetails.optedIn,
          free_domains_granted: calculation.freeDomainRegistrationCount,
          custom_domain_connections_limit: calculation.customDomainConnectionLimit,
          invoice,
        },
      })
      .select()
      .single();

    if (transErr) {
      if ((transErr as any).code === "23505" || transErr.message?.includes("unique")) {
        console.log(`[Billing] Concurrent duplicate completion handled gracefully for payment ${paymentId}`);
        return NextResponse.json({
          success: true,
          message: "Payment processed concurrently and confirmed.",
          idempotent: true,
        });
      }
      console.error("[Billing] Failed to record completed transaction:", transErr);
    }

    // 11. Mark Pending Order As Completed to Prevent Reuse
    await adminSupabase
      .from("billing_transactions")
      .update({
        status: "completed",
        updated_at: now.toISOString(),
      })
      .eq("id", pendingTx.id);

    // 12. FLOW A: If associated with a website publish flow, record domain intent
    if (websiteId && requestedDomain) {
      try {
        await adminSupabase
          .from("websites")
          .update({
            custom_domain: requestedDomain,
            custom_domain_status: "pending_registration_or_dns",
            updated_at: now.toISOString(),
          })
          .eq("id", websiteId)
          .eq("user_id", user.id);
      } catch (domainUpdateErr) {
        console.warn("[Billing] Non-fatal website domain intent update warning:", domainUpdateErr);
      }
    }

    // 13. Invalidate User Cache
    await invalidateUserCache(user.id);

    return NextResponse.json({
      success: true,
      subscription: subData,
      transaction: transData,
      invoice,
      message: `Payment verified! You are now subscribed to the ${plan.name} plan.`,
    });
  } catch (err: any) {
    console.error("POST Billing Checkout Verify Error:", err);
    return NextResponse.json(
      { error: err?.message || "Payment verification failed." },
      { status: 500 }
    );
  }
}
