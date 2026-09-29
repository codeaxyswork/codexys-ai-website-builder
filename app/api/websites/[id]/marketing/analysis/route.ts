import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/marketing/meta-client";
import { getNormalizedCampaignAnalytics } from "@/lib/marketing/analytics-engine";
import { generateAIPerformanceAnalysis } from "@/lib/marketing/performance-analyzer";
import { checkCreditBalance, deductCredits } from "@/lib/billing";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

    // Validate website existence & ownership
    const { data: website, error: webErr } = await dbClient
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    const effectiveUserId = user?.id || website.user_id;
    if (user && website.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized access to AI performance analysis." }, { status: 403 });
    }

    // Check AI credits balance (5 credits per analysis)
    const creditCheck = await checkCreditBalance(effectiveUserId, 5);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: `Insufficient AI credits. Performance analysis requires 5 credits (Balance: ${creditCheck.balance}).` },
        { status: 402 }
      );
    }

    // Deduct AI credits
    await deductCredits(effectiveUserId, 5, "marketing_performance_analysis", websiteId);

    // Fetch normalized metrics
    const report = await getNormalizedCampaignAnalytics(dbClient, websiteId);

    // Run Gemini performance analysis
    const analysis = await generateAIPerformanceAnalysis(dbClient, websiteId, effectiveUserId, report);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (err: any) {
    console.error("POST AI Performance Analysis API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate AI performance analysis." },
      { status: 500 }
    );
  }
}
