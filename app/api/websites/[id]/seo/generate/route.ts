import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateAISEOSuggestions } from "@/lib/seo-ai";
import { getUserUsage, checkCreditBalance, deductCredits, refundCredits } from "@/lib/billing";
import { canUseFeature } from "@/lib/features";
import { checkRateLimit } from "@/lib/rate-limit";
import { CREDIT_COSTS } from "@/lib/constants";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    // 1. Authenticate User
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate Limiting (10 requests per minute per user)
    const rl = checkRateLimit(`seo_gen_${user.id}`, { limit: 10, windowMs: 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many SEO suggestion requests. Please slow down." },
        { status: 429 }
      );
    }

    // 2. Check Plan permissions
    const usage = await getUserUsage(user.id);
    const planId = usage?.plan?.id || "free";

    if (!canUseFeature(planId, "ai_seo")) {
      return NextResponse.json(
        {
          error: "AI SEO Generation requires a Pro or Agency subscription plan.",
          code: "UPGRADE_REQUIRED",
        },
        { status: 403 }
      );
    }

    // 3. Verify ownership
    const { data: website, error: websiteErr } = await supabase
      .from("websites")
      .select("id, title, prompt, design_plan")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (websiteErr || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 404 }
      );
    }

    // 4. Check Credit Balance & Deduct Upfront Atomically
    const CREDIT_COST = CREDIT_COSTS.SEO_SUGGESTIONS;
    const creditCheck = await checkCreditBalance(user.id, CREDIT_COST);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: `Insufficient AI credits. You need ${CREDIT_COST} credits to generate AI SEO suggestions.`,
          code: "INSUFFICIENT_CREDITS",
          remainingCredits: creditCheck.balance,
        },
        { status: 402 }
      );
    }

    const opId =
      request.headers.get("x-request-id") ||
      request.headers.get("idempotency-key") ||
      crypto.randomUUID();
    const deductAction = `ai_seo_suggestions:${opId}`;
    const refundAction = `refund:${deductAction}`;

    const deducted = await deductCredits(user.id, CREDIT_COST, deductAction, websiteId);
    if (!deducted) {
      return NextResponse.json(
        {
          error: "Unable to deduct AI credits. Insufficient balance or concurrent request in progress.",
          code: "INSUFFICIENT_CREDITS",
          remainingCredits: creditCheck.balance,
        },
        { status: 402 }
      );
    }

    // Fetch website page html
    const { data: indexPage } = await supabase
      .from("website_pages")
      .select("html_content")
      .eq("website_id", websiteId)
      .eq("path", "index.html")
      .single();

    try {
      const suggestions = await generateAISEOSuggestions({
        websiteTitle: website.title,
        prompt: website.prompt || "",
        htmlContent: indexPage?.html_content || "",
        designPlan: website.design_plan,
      });

      return NextResponse.json({
        suggestions,
        creditsDeducted: CREDIT_COST,
        remainingCredits: Math.max(0, creditCheck.balance - CREDIT_COST),
      });
    } catch (genErr: any) {
      console.warn("AI SEO Generation failed, refunding credits:", genErr?.message || genErr);
      await refundCredits(user.id, CREDIT_COST, refundAction, websiteId);
      return NextResponse.json(
        { error: genErr?.message || "Failed to generate AI SEO suggestions. Your credits have been refunded." },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("POST SEO AI Generate Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate AI SEO suggestions." },
      { status: 500 }
    );
  }
}
