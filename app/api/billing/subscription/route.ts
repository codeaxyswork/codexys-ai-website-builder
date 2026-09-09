import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getUserUsage } from "@/lib/billing";
import { PLANS } from "@/lib/constants";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const usage = await getUserUsage(user.id);
    const planId = usage?.plan?.id || "free";
    const planConfig = PLANS[planId] || PLANS.free;

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    return NextResponse.json({
      subscription: subscription || {
        plan_id: "free",
        status: "active",
        billing_provider: "mock",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        cancel_at_period_end: false,
      },
      plan: planConfig,
      usage,
    });
  } catch (err: any) {
    console.error("GET Billing Subscription Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch subscription data." },
      { status: 500 }
    );
  }
}
