import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { PLANS } from "@/lib/constants";
import { getPaymentProvider } from "@/lib/payment-providers";

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

    const plan = PLANS[planId];
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan ID specified." }, { status: 400 });
    }

    // Process Mock Payment via Provider Abstraction Layer
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

    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setDate(now.getDate() + 30);

    // 1. Upsert Subscription
    const { data: subData, error: subErr } = await supabase
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
      return NextResponse.json({ error: subErr.message }, { status: 500 });
    }

    // 2. Set / Refresh User Credits to New Plan Limit
    const { error: creditErr } = await supabase
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
    }

    // 3. Log Billing Transaction
    const { data: transData, error: transErr } = await supabase
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
        },
      })
      .select()
      .single();

    if (transErr) {
      console.error("Billing Transaction Log Error:", transErr);
    }

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
