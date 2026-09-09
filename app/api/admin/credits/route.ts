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

    // 1. Fetch user credits
    const { data: userCredits } = await supabase.from("user_credits").select("balance, monthly_used, lifetime_used");
    const totalRemainingCredits = (userCredits || []).reduce((sum, c) => sum + (c.balance || 0), 0);

    // 2. Fetch AI Credit Transactions
    const { data: transactions, error: txErr } = await supabase
      .from("ai_credit_transactions")
      .select("id, user_id, website_id, credits_used, action_type, created_at, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (txErr) {
      return NextResponse.json({ error: txErr.message }, { status: 500 });
    }

    const formattedTx = (transactions || []).map((t: any) => ({
      id: t.id,
      user_id: t.user_id,
      user_name: t.profiles?.full_name || "User",
      website_id: t.website_id,
      credits_used: t.credits_used,
      action_type: t.action_type,
      created_at: t.created_at,
    }));

    return NextResponse.json({
      totalRemainingCredits,
      transactions: formattedTx,
    });
  } catch (err: any) {
    console.error("GET Admin Credits Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch credit analytics." }, { status: 500 });
  }
}
