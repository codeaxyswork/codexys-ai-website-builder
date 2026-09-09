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

    const { data: transactions, error } = await supabase
      .from("billing_transactions")
      .select("id, user_id, subscription_id, provider, provider_payment_id, transaction_type, plan_id, amount, currency, status, created_at, profiles(full_name)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedTx = (transactions || []).map((t: any) => ({
      id: t.id,
      user_id: t.user_id,
      owner_name: t.profiles?.full_name || "User",
      subscription_id: t.subscription_id,
      provider: t.provider || "mock",
      provider_payment_id: t.provider_payment_id,
      transaction_type: t.transaction_type,
      plan_id: t.plan_id,
      amount: t.amount,
      currency: t.currency || "INR",
      status: t.status,
      created_at: t.created_at,
    }));

    return NextResponse.json({ transactions: formattedTx });
  } catch (err: any) {
    console.error("GET Admin Transactions Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch transactions." }, { status: 500 });
  }
}
