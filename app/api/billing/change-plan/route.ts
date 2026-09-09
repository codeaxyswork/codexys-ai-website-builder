import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { PLANS } from "@/lib/constants";
import { getUserUsage } from "@/lib/billing";

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

    const isUpgrade = targetPlan.monthlyCredits > (PLANS[currentPlanId]?.monthlyCredits || 0);
    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setDate(now.getDate() + 30);

    // 3. Update Subscription
    const { data: updatedSub, error: subErr } = await supabase
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
      return NextResponse.json({ error: subErr.message }, { status: 500 });
    }

    // 4. Update Credits Balance
    await supabase.from("user_credits").upsert(
      {
        user_id: user.id,
        balance: targetPlan.monthlyCredits,
        last_refreshed_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id" }
    );

    // 5. Log Transaction
    const { data: transData } = await supabase
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
        },
      })
      .select()
      .single();

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
