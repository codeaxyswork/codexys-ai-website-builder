import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { PLANS } from "@/lib/constants";
import { getPaymentProvider, isMockPaymentAllowed } from "@/lib/payment-providers";
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const planId = (body.planId || "").toLowerCase().trim();
    const interval = normalizeBillingInterval(body.interval || body.billingInterval || "monthly");
    const optInDomain = Boolean(body.includeDomainOffer || body.optInDomainOffer);
    const isBundleSelected = Boolean(body.isBundleSelected || body.bundleOptIn);
    const websiteId = body.websiteId ? String(body.websiteId).trim() : null;
    const requestedDomain = body.domain ? String(body.domain).toLowerCase().trim() : null;
    const flowType = body.flowType || (websiteId ? "flow_a_website_publish" : "flow_b_direct_plan");

    // Explicitly validate requested plan against trusted server-side catalog
    const plan = PLANS[planId];
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan ID specified." }, { status: 400 });
    }

    // Calculate verified multi-period pricing with approved domain offer policy
    const calculation = calculatePlanPrice(plan.id, interval, { optInDomainOffer: optInDomain });

    // Resolve configured payment provider
    const provider = getPaymentProvider();
    const mode = provider.getMode();

    // =========================================================================
    // BRANCH 1: MOCK / SIMULATION FLOW (Staging, Local, and Automated CI Tests)
    // =========================================================================
    if (provider.name === "mock") {
      // 0. Server-Side Environment Guard: Mock payments strictly forbidden in Production
      if (!isMockPaymentAllowed()) {
        return NextResponse.json(
          {
            error: "Mock checkout is unavailable in the production environment.",
            code: "PAYMENT_METHOD_UNAVAILABLE",
          },
          { status: 403 }
        );
      }

      // Process Mock Payment via Provider Abstraction Layer (using trusted calculated total)
      const checkoutResult = await provider.createCheckout({
        userId: user.id,
        planId: plan.id,
        amount: calculation.finalTotal,
        currency: calculation.currency,
        userEmail: user.email || undefined,
      });

      if (!checkoutResult.success) {
        return NextResponse.json(
          { error: checkoutResult.message || "Payment simulation failed." },
          { status: 400 }
        );
      }

      // Use admin client for privileged database writes under Row Level Security (RLS)
      const adminSupabase = createAdminClient();

      const now = new Date();
      const periodEnd = calculatePeriodEndDate(now, calculation.interval);

      // 1. Upsert Subscription with service_role privileges
      const { data: subData, error: subErr } = await adminSupabase
        .from("subscriptions")
        .upsert(
          {
            user_id: user.id,
            plan_id: plan.id,
            status: "active",
            billing_provider: "mock",
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
        console.error("Checkout Subscription Error:", subErr);
        if ((subErr as any).code === "23503" || subErr.message?.includes("foreign key")) {
          return NextResponse.json(
            {
              error: `Plan '${plan.name}' is currently pending database catalog synchronization. Please select Pro or Agency, or contact support.`,
              code: "PLAN_CATALOG_UNSYNCHRONIZED",
            },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: subErr.message || "Failed to update subscription." }, { status: 500 });
      }

      // 2. Set / Refresh User Credits to New Plan's normal monthly allowance (Never grant future months upfront)
      const { error: creditErr } = await adminSupabase
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

      if (creditErr) {
        console.error("Checkout Credit Upsert Error:", creditErr);
        return NextResponse.json(
          { error: "Failed to update credit balance for subscription." },
          { status: 500 }
        );
      }

      // Generate structured sequential invoice record for financial auditability
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
        provider: "mock",
        orderId: checkoutResult.providerPaymentId,
        paymentId: checkoutResult.providerPaymentId,
        invoiceNumber,
        domainOfferDetails: {
          optedIn: calculation.domainOfferDetails.optedIn,
          domainName: requestedDomain || undefined,
          freeYears: calculation.domainOfferDetails.freeYears,
        },
      });

      // 3. Log Billing Transaction
      const { data: transData, error: transErr } = await adminSupabase
        .from("billing_transactions")
        .insert({
          user_id: user.id,
          subscription_id: subData?.id || null,
          provider: "mock",
          provider_payment_id: checkoutResult.providerPaymentId,
          transaction_type: "subscription_upgraded",
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
            billing_interval: calculation.interval,
            duration_months: calculation.durationMonths,
            monthly_credits: plan.monthlyCredits,
            max_websites: plan.maxWebsites,
            custom_domain_connections_limit: calculation.customDomainConnectionLimit,
            discount_percent: calculation.discountPercent,
            discount_amount: calculation.discountAmount,
            final_total: calculation.finalTotal,
            domain_offer_opted_in: calculation.domainOfferDetails.optedIn,
            free_domains_granted: calculation.freeDomainRegistrationCount,
            max_free_domains_allowed: calculation.domainOfferDetails.maxFreeDomains,
            premium_bundle_selected: isBundleSelected,
            premium_bundle_amount_charged: 0,
            premium_bundle_status: isBundleSelected ? "preview_only_pending_approval" : "not_selected",
            provider: "mock",
            payment_mode: "simulation",
            flow_type: flowType,
            website_id: websiteId,
            custom_domain: requestedDomain,
            invoice,
          },
        })
        .select()
        .single();

      if (transErr) {
        console.error("Billing Transaction Log Error:", transErr);
        return NextResponse.json(
          { error: "Failed to record billing transaction log." },
          { status: 500 }
        );
      }

      // 4. Invalidate User Cache
      await invalidateUserCache(user.id);

      return NextResponse.json({
        success: true,
        mode: "mock",
        provider: "mock",
        subscription: subData,
        transaction: transData,
        invoice,
        message: `Successfully upgraded to ${plan.name} plan!`,
      });
    }

    // =========================================================================
    // BRANCH 2: REAL GATEWAY ORDER CREATION (Razorpay / Stripe)
    // =========================================================================
    const orderRes = await provider.createOrder({
      userId: user.id,
      userEmail: user.email || undefined,
      planId: plan.id,
      planName: plan.name,
      interval: calculation.interval,
      amount: calculation.finalTotal,
      currency: calculation.currency,
      metadata: {
        userId: user.id,
        planId: plan.id,
        interval: calculation.interval,
        durationMonths: calculation.durationMonths,
        optInDomainOffer: optInDomain,
        websiteId,
        customDomain: requestedDomain,
        flowType,
        isBundleSelected,
      },
    });

    if (!orderRes.success) {
      return NextResponse.json(
        { error: orderRes.message || "Failed to initialize gateway order." },
        { status: 400 }
      );
    }

    // Record 'pending' transaction in database under service_role
    const adminSupabase = createAdminClient();
    await adminSupabase.from("billing_transactions").insert({
      user_id: user.id,
      provider: provider.name,
      provider_payment_id: orderRes.orderId,
      transaction_type: "checkout_order_created",
      plan_id: plan.id,
      amount: calculation.finalTotal,
      currency: calculation.currency,
      status: "pending",
      billing_interval: calculation.interval,
      duration_months: calculation.durationMonths,
      discount_percent: calculation.discountPercent,
      discount_amount: calculation.discountAmount,
      original_amount: calculation.grossTotal,
      metadata: {
        plan_name: plan.name,
        order_id: orderRes.orderId,
        gateway_mode: orderRes.mode,
        flow_type: flowType,
        website_id: websiteId,
        custom_domain: requestedDomain,
        domain_offer_opted_in: calculation.domainOfferDetails.optedIn,
        provider: provider.name,
      },
    });

    return NextResponse.json({
      success: true,
      mode: orderRes.mode,
      provider: provider.name,
      orderId: orderRes.orderId,
      amount: orderRes.amount,
      currency: orderRes.currency,
      keyId: orderRes.keyId,
      clientSecret: orderRes.clientSecret,
      checkoutUrl: orderRes.checkoutUrl,
      calculation,
      message: "Gateway order prepared for client payment.",
    });
  } catch (err: any) {
    console.error("POST Billing Checkout Error:", err);
    return NextResponse.json(
      { error: err?.message || "Checkout failed." },
      { status: 500 }
    );
  }
}
