import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/marketing/meta-client";
import { getNormalizedCampaignAnalytics } from "@/lib/marketing/analytics-engine";
import { generateAIPerformanceAnalysis } from "@/lib/marketing/performance-analyzer";
import { checkCreditBalance, deductCredits, refundCredits } from "@/lib/billing";
import { CREDIT_COSTS } from "@/lib/constants";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    // 1. Strict Server-Side Authentication
    if (authErr || !user) {
      return NextResponse.json({ error: "Authentication required to run AI performance analysis." }, { status: 401 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

    // 2. Validate website existence & user ownership
    const { data: website, error: webErr } = await dbClient
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ error: "Website not found." }, { status: 404 });
    }

    if (website.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized access: You do not own this website." }, { status: 403 });
    }

    // 3. Check AI credits balance (5 credits per analysis)
    const REQUIRED_CREDITS = CREDIT_COSTS.MARKETING_ANALYSIS;
    const creditCheck = await checkCreditBalance(user.id, REQUIRED_CREDITS);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: `Insufficient AI credits. Performance analysis requires ${REQUIRED_CREDITS} credits (Balance: ${creditCheck.balance}).`,
          code: "INSUFFICIENT_CREDITS",
          remainingCredits: creditCheck.balance,
        },
        { status: 402 }
      );
    }

    const opId =
      req.headers.get("x-request-id") ||
      req.headers.get("idempotency-key") ||
      crypto.randomUUID();
    const deductAction = `marketing_analysis:${opId}`;
    const refundAction = `refund:${deductAction}`;

    // 4. Atomic Upfront Credit Deduction
    const deductSuccess = await deductCredits(user.id, REQUIRED_CREDITS, deductAction, websiteId);
    if (!deductSuccess) {
      return NextResponse.json(
        { error: "Failed to deduct credits. Insufficient credit balance.", code: "INSUFFICIENT_CREDITS" },
        { status: 402 }
      );
    }

    // 5. Fetch normalized metrics
    const report = await getNormalizedCampaignAnalytics(dbClient, websiteId);

    // 6. Run Gemini performance analysis with Refund Protection
    let analysis;
    try {
      analysis = await generateAIPerformanceAnalysis(dbClient, websiteId, user.id, report);
    } catch (analysisErr: any) {
      await refundCredits(user.id, REQUIRED_CREDITS, refundAction, websiteId);
      throw analysisErr;
    }

    return NextResponse.json({
      success: true,
      analysis,
      creditsDeducted: REQUIRED_CREDITS,
      remainingCredits: Math.max(0, creditCheck.balance - REQUIRED_CREDITS),
    });
  } catch (err: any) {
    console.error("POST AI Performance Analysis API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate AI performance analysis." },
      { status: 500 }
    );
  }
}
