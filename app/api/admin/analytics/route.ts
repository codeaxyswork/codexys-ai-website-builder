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

    // 1. User Signups over last 30 days
    const { data: profiles } = await supabase.from("profiles").select("created_at");
    
    // 2. Websites Created over last 30 days
    const { data: websites } = await supabase.from("websites").select("created_at, is_published");

    // 3. AI Credits Usage over last 30 days
    const { data: creditLogs } = await supabase.from("ai_credit_transactions").select("credits_used, action_type, created_at");

    // 4. Plan distribution
    const { data: subs } = await supabase.from("subscriptions").select("plan_id");

    const freeCount = (subs || []).filter((s) => s.plan_id === "free").length;
    const proCount = (subs || []).filter((s) => s.plan_id === "pro").length;
    const agencyCount = (subs || []).filter((s) => s.plan_id === "agency").length;

    const initialGenCount = (creditLogs || []).filter((c) => c.action_type === "initial_generation").length;
    const aiEditCount = (creditLogs || []).filter((c) => c.action_type === "ai_edit").length;
    const aiSeoCount = (creditLogs || []).filter((c) => c.action_type === "ai_seo_suggestions").length;

    return NextResponse.json({
      userGrowth: {
        total: (profiles || []).length,
      },
      websiteActivity: {
        total: (websites || []).length,
        published: (websites || []).filter((w) => w.is_published).length,
        draft: (websites || []).filter((w) => !w.is_published).length,
      },
      aiUsageBreakdown: {
        initialGenerations: initialGenCount,
        aiEdits: aiEditCount,
        aiSeoSuggestions: aiSeoCount,
      },
      planDistribution: {
        free: freeCount,
        pro: proCount,
        agency: agencyCount,
      },
    });
  } catch (err: any) {
    console.error("GET Admin Analytics Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch analytics." }, { status: 500 });
  }
}
