import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateGoogleSearchPlan } from "@/lib/marketing/google-strategy";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  checkMarketingPlanEntitlement,
  checkCreditBalance,
  deductCredits,
  refundCredits,
} from "@/lib/billing";
import { CREDIT_COSTS, ERROR_CODES } from "@/lib/constants";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // 1. Rate Limiting (10 requests per minute per user)
    const rl = checkRateLimit(`google_plan_${user.id}`, { limit: 10, windowMs: 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many campaign planning requests. Please wait a moment." },
        { status: 429 }
      );
    }

    // 2. Website Ownership Check
    const { data: website, error: siteErr } = await supabase
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .single();

    if (siteErr || !website || website.user_id !== user.id) {
      return NextResponse.json({ error: "Website not found or access denied" }, { status: 403 });
    }

    // 3. Plan Entitlement Verification (Pro, Business, Agency, or active marketing entitlement)
    const entitlement = await checkMarketingPlanEntitlement(user.id, supabase);
    if (!entitlement.entitled) {
      return NextResponse.json(
        {
          error:
            entitlement.reason ||
            "AI Marketing Campaign Planning requires a Pro, Business, or Agency subscription.",
          code: "PLAN_UPGRADE_REQUIRED",
          currentPlan: entitlement.planId,
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const userGoal = body.userGoal || body.goal;
    const missingInputs = body.missingInputs;

    if (!userGoal || typeof userGoal !== "string" || !userGoal.trim()) {
      return NextResponse.json(
        { error: "Please provide a valid campaign goal." },
        { status: 400 }
      );
    }

    // 4. Check credit balance upfront (CREDIT_COSTS.MARKETING_PLAN = 5)
    const creditCost = CREDIT_COSTS.MARKETING_PLAN;
    const creditCheck = await checkCreditBalance(user.id, creditCost, supabase);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: `Insufficient AI credits. You need ${creditCost} credits to generate a Google Search campaign plan (Balance: ${creditCheck.balance}).`,
          code: ERROR_CODES.INSUFFICIENT_CREDITS,
          remainingCredits: creditCheck.balance,
        },
        { status: 402 }
      );
    }

    const opId = crypto.randomUUID();
    const deductAction = `google_campaign_plan:${opId}`;
    const refundAction = `refund:${deductAction}`;

    // 5. Deduct credits upfront atomically
    const deducted = await deductCredits(user.id, creditCost, deductAction, websiteId);
    if (!deducted) {
      return NextResponse.json(
        {
          error: `Insufficient AI credits. Failed to deduct ${creditCost} credits.`,
          code: ERROR_CODES.INSUFFICIENT_CREDITS,
          remainingCredits: creditCheck.balance,
        },
        { status: 402 }
      );
    }

    // 6. Generate Google Search Plan with failure refund protection
    try {
      const result = await generateGoogleSearchPlan(
        supabase,
        websiteId,
        user.id,
        userGoal.trim(),
        missingInputs,
        { skipCreditDeduction: true, operationId: opId }
      );

      if (result.needsMoreInfo) {
        // If the planner requires more user inputs, refund the credits upfront
        await refundCredits(user.id, creditCost, refundAction, websiteId);
        return NextResponse.json({
          ...result,
          remainingCredits: creditCheck.balance,
        });
      }

      return NextResponse.json({
        ...result,
        creditsDeducted: creditCost,
        remainingCredits: Math.max(0, creditCheck.balance - creditCost),
      });
    } catch (genErr: any) {
      console.warn("Google campaign plan generation failed, refunding credits:", genErr?.message || genErr);
      await refundCredits(user.id, creditCost, refundAction, websiteId);
      throw genErr;
    }
  } catch (err: any) {
    console.error("Google Plan API Route Error:", err);
    const isCreditError = err?.message?.toLowerCase().includes("insufficient ai credits");
    return NextResponse.json(
      {
        error: err?.message || "Failed to generate Google Search campaign plan.",
        code: isCreditError ? "INSUFFICIENT_CREDITS" : "PLAN_ERROR",
      },
      { status: isCreditError ? 402 : 500 }
    );
  }
}
