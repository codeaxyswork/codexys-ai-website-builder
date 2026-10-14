import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getWebsiteMetaAssets } from "@/lib/marketing/meta-client";
import { generateCampaignPlan, getLatestCampaignDraft } from "@/lib/marketing/campaign-planner";
import {
  checkMarketingPlanEntitlement,
  checkCreditBalance,
  deductCredits,
  refundCredits,
} from "@/lib/billing";
import { CREDIT_COSTS, ERROR_CODES } from "@/lib/constants";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    if (!websiteId) {
      return NextResponse.json({ error: "websiteId is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    // Validate website ownership
    const { data: website, error: webErr } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (webErr || !website) {
      return NextResponse.json(
        { error: "Website not found or unauthorized access." },
        { status: 403 }
      );
    }

    const latestDraft = await getLatestCampaignDraft(supabase, websiteId, user.id);

    return NextResponse.json({
      success: true,
      draft: latestDraft,
    });
  } catch (error: any) {
    console.error("API /api/websites/[id]/marketing/plan GET Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch campaign draft." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;

    if (!websiteId) {
      return NextResponse.json({ error: "websiteId is required." }, { status: 400 });
    }

    // 1. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    // 2. Validate website ownership
    const { data: website, error: webErr } = await supabase
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (webErr || !website) {
      return NextResponse.json(
        { error: "Website not found or unauthorized access." },
        { status: 403 }
      );
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

    // 4. Validate selected Meta assets exist (Phase 2A requirement)
    const metaAssets = await getWebsiteMetaAssets(supabase, websiteId);
    if (!metaAssets.selectedAdAccount || !metaAssets.selectedPage) {
      return NextResponse.json(
        {
          success: false,
          setupRequired: true,
          error:
            "A Meta Ad Account and Facebook Page must be selected in Meta Advertising settings before creating a campaign plan.",
        },
        { status: 400 }
      );
    }

    // 5. Rate limiting per User (10 requests per minute)
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const rl = checkRateLimit(`mktg_plan_user_${user.id}`, { limit: 10, windowMs: 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many campaign planning requests. Please wait a moment before trying again." },
        { status: 429 }
      );
    }

    // 6. Parse payload
    const body = await req.json().catch(() => ({}));
    const userGoal = (body.userGoal || "").trim();
    const missingInputs = body.missingInputs;

    if (!userGoal || userGoal.length < 3) {
      return NextResponse.json(
        { error: "Please enter a valid marketing goal (e.g. 'I want more consultations from people in Kerala')." },
        { status: 400 }
      );
    }

    // 7. Check credit balance upfront (CREDIT_COSTS.MARKETING_PLAN = 5)
    const creditCost = CREDIT_COSTS.MARKETING_PLAN;
    const creditCheck = await checkCreditBalance(user.id, creditCost, supabase);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: `Insufficient AI credits. You need ${creditCost} credits to generate an AI marketing campaign plan (Balance: ${creditCheck.balance}).`,
          code: ERROR_CODES.INSUFFICIENT_CREDITS,
          remainingCredits: creditCheck.balance,
        },
        { status: 402 }
      );
    }

    const opId =
      req.headers.get("x-request-id") ||
      req.headers.get("idempotency-key") ||
      body?.requestId ||
      crypto.randomUUID();
    const deductAction = `marketing_campaign_plan:${opId}`;
    const refundAction = `refund:${deductAction}`;

    // 8. Deduct credits upfront atomically
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

    // 9. Generate Campaign Plan with failure refund protection
    try {
      const result = await generateCampaignPlan(
        supabase,
        websiteId,
        user.id,
        userGoal,
        missingInputs,
        { skipCreditDeduction: true, operationId: opId }
      );

      if (result.needsMoreInfo) {
        // If the planner requires more user inputs, refund the credits upfront
        await refundCredits(user.id, creditCost, refundAction, websiteId);
        return NextResponse.json({
          success: true,
          needsMoreInfo: true,
          missingQuestions: result.missingQuestions,
          remainingCredits: creditCheck.balance,
        });
      }

      return NextResponse.json({
        success: true,
        draftId: result.draftId,
        strategy: result.strategy,
        creditsDeducted: creditCost,
        remainingCredits: Math.max(0, creditCheck.balance - creditCost),
      });
    } catch (genErr: any) {
      console.warn("Marketing campaign plan generation failed, refunding credits:", genErr?.message || genErr);
      await refundCredits(user.id, creditCost, refundAction, websiteId);
      throw genErr;
    }
  } catch (error: any) {
    console.error("API /api/websites/[id]/marketing/plan POST Error:", error);
    if (error?.message?.includes("Insufficient AI credits")) {
      return NextResponse.json(
        { error: error.message, code: "INSUFFICIENT_CREDITS" },
        { status: 402 }
      );
    }
    return NextResponse.json(
      { error: error?.message || "Failed to generate AI campaign plan." },
      { status: 500 }
    );
  }
}
