import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { getPaymentProvider, PaymentProvider } from "@/lib/payment-providers";
import { PLANS } from "@/lib/constants";
import { invalidateUserCache } from "@/lib/cache";
import {
  calculatePlanPrice,
  calculatePeriodEndDate,
  normalizeBillingInterval,
} from "@/lib/billing-periods";
import { generateInvoiceRecord, generateSequentialInvoiceNumber } from "@/lib/billing-invoices";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const headersList = request.headers;

    // Convert headers to record for signature validation
    const headerMap: Record<string, string> = {};
    headersList.forEach((value, key) => {
      headerMap[key.toLowerCase()] = value;
    });

    // Detect provider based on signature headers or active configuration
    let providerName: "razorpay" | "stripe" | "mock" = "mock";
    if (headerMap["x-razorpay-signature"]) {
      providerName = "razorpay";
    } else if (headerMap["stripe-signature"]) {
      providerName = "stripe";
    } else {
      providerName = (process.env.PAYMENT_PROVIDER as any) || "mock";
    }

    const provider: PaymentProvider = getPaymentProvider(providerName);

    // 1. Process webhook and verify signature
    const webhookResult = await provider.handleWebhook(rawBody, headerMap);

    if (!webhookResult.handled) {
      console.warn(`[Webhook] Rejected ${provider.name} webhook: ${webhookResult.error || "Unknown error"}`);
      return NextResponse.json(
        { error: webhookResult.error || "Webhook signature validation failed" },
        { status: 400 }
      );
    }

    // Ignore non-actionable notification events
    if (webhookResult.status === "ignored") {
      return NextResponse.json({ received: true, ignored: true });
    }

    const adminSupabase = createAdminClient();
    const now = new Date();

    // 2. Handle Subscription Cancellation Events
    if (webhookResult.status === "cancelled") {
      const subId = webhookResult.subscriptionId;
      if (subId) {
        await adminSupabase
          .from("subscriptions")
          .update({
            status: "canceled",
            canceled_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq("id", subId);
      }
      return NextResponse.json({ received: true, event: webhookResult.eventType, status: "canceled" });
    }

    // 3. Handle Payment Failed Events
    if (webhookResult.status === "failed") {
      const paymentId = webhookResult.paymentId || `fail_${Date.now()}`;
      await adminSupabase.from("billing_transactions").insert({
        user_id: webhookResult.metadata?.userId || null,
        provider: provider.name,
        provider_payment_id: paymentId,
        transaction_type: "webhook_payment_failed",
        status: "failed",
        amount: 0,
        currency: "INR",
        metadata: {
          event: webhookResult.eventType,
          error: webhookResult.error,
          gateway_order_id: webhookResult.orderId,
        },
      });

      return NextResponse.json({ received: true, event: webhookResult.eventType, status: "failed" });
    }

    // 4. Handle Payment Success (order.paid / payment.captured / checkout.session.completed)
    if (webhookResult.status === "completed") {
      const paymentId = webhookResult.paymentId;
      const orderId = webhookResult.orderId;

      if (!paymentId) {
        return NextResponse.json({ received: true, warning: "Completed event without payment ID" });
      }

      // Idempotency Protection: Check if already completed
      const { data: existingTx } = await adminSupabase
        .from("billing_transactions")
        .select("id, status")
        .eq("provider_payment_id", paymentId)
        .eq("status", "completed")
        .maybeSingle();

      if (existingTx) {
        return NextResponse.json({
          received: true,
          idempotent: true,
          message: "Transaction already processed.",
        });
      }

      // Find pending order record to recover context if not present in webhook notes
      let metadata = webhookResult.metadata || {};
      if (!metadata.userId && orderId) {
        const { data: pendingTx } = await adminSupabase
          .from("billing_transactions")
          .select("user_id, plan_id, billing_interval, metadata")
          .eq("provider_payment_id", orderId)
          .maybeSingle();

        if (pendingTx) {
          metadata = {
            ...metadata,
            userId: pendingTx.user_id,
            planId: pendingTx.plan_id,
            interval: pendingTx.billing_interval,
            ...(pendingTx.metadata || {}),
          };
        }
      }

      const userId = metadata.userId;
      const planId = (metadata.planId || "starter").toLowerCase();
      const interval = normalizeBillingInterval(metadata.interval || "monthly");
      const optInDomain = Boolean(metadata.optInDomainOffer);

      if (!userId) {
        console.error(`[Webhook] Could not identify user for payment ${paymentId}, order ${orderId}`);
        return NextResponse.json({ received: true, error: "Missing user identification" }, { status: 200 });
      }

      const plan = PLANS[planId] || PLANS.pro;
      const calculation = calculatePlanPrice(plan.id, interval, { optInDomainOffer: optInDomain });
      const periodEnd = calculatePeriodEndDate(now, calculation.interval);

      // Upsert Subscription
      const { data: subData } = await adminSupabase
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
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

      // Replenish credits
      await adminSupabase
        .from("user_credits")
        .upsert(
          {
            user_id: userId,
            balance: plan.monthlyCredits,
            monthly_used: 0,
            last_refreshed_at: now.toISOString(),
            updated_at: now.toISOString(),
          },
          { onConflict: "user_id" }
        );

      // Generate Sequential Tax Invoice
      const invoiceNumber = await generateSequentialInvoiceNumber(adminSupabase);
      const invoice = generateInvoiceRecord({
        userId,
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
          domainName: metadata.customDomain,
          freeYears: calculation.domainOfferDetails.freeYears,
        },
      });

      // Record Completed Billing Transaction (Idempotent Insertion)
      const { data: transData, error: transErr } = await adminSupabase
        .from("billing_transactions")
        .insert({
          user_id: userId,
          subscription_id: subData?.id || null,
          provider: provider.name,
          provider_payment_id: paymentId,
          transaction_type: "webhook_payment_captured",
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
            ...metadata,
            source: "webhook",
            event: webhookResult.eventType,
            order_id: orderId,
            payment_id: paymentId,
            provider: provider.name,
            invoice,
          },
        })
        .select()
        .single();

      if (transErr) {
        if ((transErr as any).code === "23505" || transErr.message?.includes("unique")) {
          console.log(`[Webhook] Duplicate completion gracefully acknowledged for payment ${paymentId}`);
          return NextResponse.json({
            received: true,
            idempotent: true,
            message: "Transaction already processed concurrently.",
          });
        }
        console.error("[Webhook] Failed to insert completed transaction:", transErr);
      }

      // Mark pending order record as completed if orderId exists
      if (orderId) {
        await adminSupabase
          .from("billing_transactions")
          .update({
            status: "completed",
            updated_at: now.toISOString(),
          })
          .eq("provider_payment_id", orderId)
          .eq("transaction_type", "checkout_order_created");
      }

      // Invalidate Cache
      await invalidateUserCache(userId);

      return NextResponse.json({
        received: true,
        activated: true,
        plan: plan.id,
        user: userId,
      });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("POST Billing Webhook Exception:", err);
    return NextResponse.json(
      { error: err?.message || "Webhook processing error" },
      { status: 500 }
    );
  }
}
