import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { PLANS } from "@/lib/constants";
import { getUserUsage } from "@/lib/billing";
import { invalidateUserCache } from "@/lib/cache";
import { isMockPaymentAllowed } from "@/lib/payment-providers";

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
    const targetPlanId = (body.planId || "").toLowerCase().trim();
    const targetPlan = PLANS[targetPlanId];

    if (!targetPlan) {
      return NextResponse.json({ error: "Invalid target plan specified." }, { status: 400 });
    }

    // 0. Server-Side Environment Guard: Direct mock plan changes strictly forbidden in Production
    if (!isMockPaymentAllowed()) {
      return NextResponse.json(
        {
          error: "Direct mock plan changes are unavailable in the production environment. Please complete checkout with a live payment method.",
          code: "PAYMENT_REQUIRED",
        },
        { status: 403 }
      );
    }

    const currentUsage = await getUserUsage(user.id);
    const currentPlanId = currentUsage?.plan?.id || "free";

    if (currentPlanId === targetPlan.id) {
      return NextResponse.json(
        { error: `You are already subscribed to the ${targetPlan.name} plan.` },
        { status: 400 }
      );
    }

    // 1. DOWNGRADE PROTECTION: Website Count Check
    const currentWebsiteCount = currentUsage?.websites.used || 0;
    if (currentWebsiteCount > targetPlan.maxWebsites) {
      return NextResponse.json(
        {
          error: `You currently have ${currentWebsiteCount} saved websites. Please delete or reduce your websites to ${targetPlan.maxWebsites} or fewer before downgrading to the ${targetPlan.name} plan.`,
          code: "WEBSITE_LIMIT_EXCEEDED",
        },
        { status: 400 }
      );
    }

    // 2. DOWNGRADE PROTECTION: Storage Usage Check
    const currentStorageBytes = currentUsage?.storage.usedBytes || 0;
    if (currentStorageBytes > targetPlan.storageLimitBytes) {
      const formattedUsed = (currentStorageBytes / (1024 * 1024)).toFixed(1) + " MB";
      return NextResponse.json(
        {
          error: `Your media storage usage (${formattedUsed}) exceeds the ${targetPlan.name} plan limit of ${targetPlan.storageLimitFormatted}. Please delete media assets before downgrading.`,
          code: "STORAGE_LIMIT_EXCEEDED",
        },
        { status: 400 }
      );
    }

    // Use admin client for privileged database writes under Row Level Security (RLS)
    const adminSupabase = createAdminClient();

    const isUpgrade = targetPlan.monthlyCredits > (PLANS[currentPlanId]?.monthlyCredits || 0);
    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setDate(now.getDate() + 30);

    // 3. Update Subscription with service_role privileges
    const { data: updatedSub, error: subErr } = await adminSupabase
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan_id: targetPlan.id,
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
      console.error("Change Plan Subscription Error:", subErr);
      return NextResponse.json({ error: subErr.message || "Failed to change subscription plan." }, { status: 500 });
    }

    // 4. Update Credits Balance with service_role privileges
    const { error: creditErr } = await adminSupabase.from("user_credits").upsert(
      {
        user_id: user.id,
        balance: targetPlan.monthlyCredits,
        last_refreshed_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (creditErr) {
      console.error("Change Plan Credit Upsert Error:", creditErr);
      return NextResponse.json(
        { error: "Failed to update credit balance for changed plan." },
        { status: 500 }
      );
    }

    // 5. Log Transaction (Explicitly record mock simulation evidence)
    const { data: transData, error: transErr } = await adminSupabase
      .from("billing_transactions")
      .insert({
        user_id: user.id,
        subscription_id: updatedSub?.id || null,
        provider: "mock",
        provider_payment_id: `mock_change_${targetPlan.id}_${Math.random().toString(36).substring(2, 8)}`,
        transaction_type: isUpgrade ? "subscription_upgraded" : "subscription_downgraded",
        plan_id: targetPlan.id,
        amount: targetPlan.price,
        currency: targetPlan.currency,
        status: "completed",
        metadata: {
          previous_plan: currentPlanId,
          new_plan: targetPlan.id,
          provider: "mock",
          payment_mode: "simulation",
        },
      })
      .select()
      .single();

    if (transErr) {
      console.error("Change Plan Transaction Log Error:", transErr);
      return NextResponse.json(
        { error: "Failed to record billing transaction log." },
        { status: 500 }
      );
    }

    // 6. Invalidate User Cache so dashboard reflects fresh plan & credits immediately
    await invalidateUserCache(user.id);

    return NextResponse.json({
      success: true,
      subscription: updatedSub,
      transaction: transData,
      message: `Plan changed successfully to ${targetPlan.name}!`,
    });
  } catch (err: any) {
    console.error("POST Change Plan Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to change plan." },
      { status: 500 }
    );
  }
}
