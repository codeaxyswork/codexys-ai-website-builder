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
    const todayISO = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const firstOfMonthISO = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    // 1. Users Stats
    const { count: totalUsers } = await supabase.from("profiles").select("id", { count: "exact", head: true });
    const { count: newUsersToday } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayISO);
    const { count: newUsersMonth } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", firstOfMonthISO);
    const { count: suspendedUsers } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "suspended");

    // 2. Websites Stats
    const { count: totalWebsites } = await supabase.from("websites").select("id", { count: "exact", head: true });
    const { count: publishedWebsites } = await supabase
      .from("websites")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true);
    const { count: websitesToday } = await supabase
      .from("websites")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayISO);

    // 3. AI Credit Usage Stats
    const { data: creditTrans } = await supabase
      .from("ai_credit_transactions")
      .select("credits_used, created_at");

    const totalCreditsUsed = (creditTrans || []).reduce((sum, t) => sum + (t.credits_used || 0), 0);
    const creditsUsedToday = (creditTrans || [])
      .filter((t) => t.created_at >= todayISO)
      .reduce((sum, t) => sum + (t.credits_used || 0), 0);
    const creditsUsedMonth = (creditTrans || [])
      .filter((t) => t.created_at >= firstOfMonthISO)
      .reduce((sum, t) => sum + (t.credits_used || 0), 0);

    // 4. Subscriptions Stats
    const { data: subs } = await supabase.from("subscriptions").select("plan_id, status");
    const freeCount = (subs || []).filter((s) => s.plan_id === "free").length;
    const proCount = (subs || []).filter((s) => s.plan_id === "pro").length;
    const agencyCount = (subs || []).filter((s) => s.plan_id === "agency").length;

    // 5. Mock Revenue Stats
    const { data: transactions } = await supabase
      .from("billing_transactions")
      .select("amount, created_at")
      .eq("status", "completed");

    const totalMockRevenue = (transactions || []).reduce((sum, t) => sum + (t.amount || 0), 0);
    const monthlyMockRevenue = (transactions || [])
      .filter((t) => t.created_at >= firstOfMonthISO)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    return NextResponse.json({
      users: {
        total: totalUsers || 0,
        today: newUsersToday || 0,
        month: newUsersMonth || 0,
        active: (totalUsers || 0) - (suspendedUsers || 0),
        suspended: suspendedUsers || 0,
      },
      websites: {
        total: totalWebsites || 0,
        published: publishedWebsites || 0,
        draft: (totalWebsites || 0) - (publishedWebsites || 0),
        today: websitesToday || 0,
      },
      ai: {
        totalUsed: totalCreditsUsed,
        todayUsed: creditsUsedToday,
        monthUsed: creditsUsedMonth,
      },
      subscriptions: {
        free: freeCount,
        pro: proCount,
        agency: agencyCount,
        active: (subs || []).length,
      },
      mockRevenue: {
        total: totalMockRevenue,
        monthly: monthlyMockRevenue,
      },
    });
  } catch (err: any) {
    console.error("GET Admin Stats Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch admin stats." }, { status: 500 });
  }
}
