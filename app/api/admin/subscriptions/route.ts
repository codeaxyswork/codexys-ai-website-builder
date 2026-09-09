import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const adminCtx = await requireAdmin();
    if (!adminCtx) {
      return NextResponse.json({ error: "Unauthorized access denied." }, { status: 403 });
    }

    const supabase = await createClient();

    const { data: subs, error } = await supabase
      .from("subscriptions")
      .select("id, user_id, plan_id, status, billing_provider, current_period_start, current_period_end, cancel_at_period_end, created_at, profiles(full_name)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedSubs = (subs || []).map((s: any) => ({
      id: s.id,
      user_id: s.user_id,
      owner_name: s.profiles?.full_name || "User",
      plan_id: s.plan_id,
      status: s.status,
      billing_provider: s.billing_provider || "mock",
      current_period_start: s.current_period_start,
      current_period_end: s.current_period_end,
      cancel_at_period_end: Boolean(s.cancel_at_period_end),
      created_at: s.created_at,
    }));

    return NextResponse.json({ subscriptions: formattedSubs });
  } catch (err: any) {
    console.error("GET Admin Subscriptions Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch subscriptions." }, { status: 500 });
  }
}
