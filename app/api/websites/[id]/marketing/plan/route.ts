import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getWebsiteMetaAssets } from "@/lib/marketing/meta-client";
import { generateCampaignPlan, getLatestCampaignDraft } from "@/lib/marketing/campaign-planner";

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

    // 3. Validate selected Meta assets exist (Phase 2A requirement)
    const metaAssets = await getWebsiteMetaAssets(supabase, websiteId);
    if (!metaAssets.selectedAdAccount || !metaAssets.selectedPage) {
      return NextResponse.json(
        {
          success: false,
          setupRequired: true,
          error: "A Meta Ad Account and Facebook Page must be selected in Meta Advertising settings before creating a campaign plan.",
        },
        { status: 400 }
      );
    }

    // 4. Rate limiting per User (10 requests per minute)
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const rl = checkRateLimit(`mktg_plan_user_${user.id}`, { limit: 10, windowMs: 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many campaign planning requests. Please wait a moment before trying again." },
        { status: 429 }
      );
    }

    // 5. Parse payload
    const body = await req.json().catch(() => ({}));
    const userGoal = (body.userGoal || "").trim();
    const missingInputs = body.missingInputs;

    if (!userGoal || userGoal.length < 3) {
      return NextResponse.json(
        { error: "Please enter a valid marketing goal (e.g. 'I want more consultations from people in Kerala')." },
        { status: 400 }
      );
    }

    // 6. Generate Campaign Plan (enforces 5 credits via lib/billing.ts)
    const result = await generateCampaignPlan(
      supabase,
      websiteId,
      user.id,
      userGoal,
      missingInputs
    );

    if (result.needsMoreInfo) {
      return NextResponse.json({
        success: true,
        needsMoreInfo: true,
        missingQuestions: result.missingQuestions,
      });
    }

    return NextResponse.json({
      success: true,
      draftId: result.draftId,
      strategy: result.strategy,
    });
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
