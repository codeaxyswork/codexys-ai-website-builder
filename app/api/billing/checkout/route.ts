import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { PLANS } from "@/lib/constants";
import { getPaymentProvider } from "@/lib/payment-providers";
import { invalidateUserCache } from "@/lib/cache";

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

    // Explicitly validate requested plan against trusted server-side catalog
    const plan = PLANS[planId];
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan ID specified." }, { status: 400 });
    }

    // Process Mock Payment via Provider Abstraction Layer (using trusted server-side pricing)
    const provider = getPaymentProvider("mock");
    const checkoutResult = await provider.createCheckout({
      userId: user.id,
      planId: plan.id,
      amount: plan.price,
      currency: plan.currency,
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
    const periodEnd = new Date();
    periodEnd.setDate(now.getDate() + 30);

    // 1. Upsert Subscription with service_role privileges
    const { data: subData, error: subErr } = await adminSupabase
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan_id: plan.id,
          status: "active",
          billing_provider: "mock",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
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

    // 2. Set / Refresh User Credits to New Plan Limit (Atomic grant)
    const { error: creditErr } = await adminSupabase
      .from("user_credits")
      .upsert(
        {
          user_id: user.id,
          balance: plan.monthlyCredits,
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

    // 3. Log Billing Transaction (Explicitly record mock simulation evidence)
    const { data: transData, error: transErr } = await adminSupabase
      .from("billing_transactions")
      .insert({
        user_id: user.id,
        subscription_id: subData?.id || null,
        provider: "mock",
        provider_payment_id: checkoutResult.providerPaymentId,
        transaction_type: "subscription_upgraded",
        plan_id: plan.id,
        amount: plan.price,
        currency: plan.currency,
        status: "completed",
        metadata: {
          plan_name: plan.name,
          monthly_credits: plan.monthlyCredits,
          max_websites: plan.maxWebsites,
          provider: "mock",
          payment_mode: "simulation",
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

    // 4. Invalidate User Cache so dashboard reflects fresh plan & credits immediately
    await invalidateUserCache(user.id);

    return NextResponse.json({
      success: true,
      subscription: subData,
      transaction: transData,
      message: `Successfully upgraded to ${plan.name} plan!`,
    });
  } catch (err: any) {
    console.error("POST Billing Checkout Error:", err);
    return NextResponse.json(
      { error: err?.message || "Checkout failed." },
      { status: 500 }
    );
  }
}
