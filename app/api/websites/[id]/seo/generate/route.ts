import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateAISEOSuggestions } from "@/lib/seo-ai";
import { getUserUsage, deductCredits } from "@/lib/billing";
import { canUseFeature } from "@/lib/features";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check Plan permissions
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

    // Verify ownership
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

    // Deduct 5 credits for AI SEO suggestion generation
    const CREDIT_COST = 5;
    if (usage && usage.credits.balance < CREDIT_COST) {
      return NextResponse.json(
        { error: `Insufficient AI credits. Required: ${CREDIT_COST}, Balance: ${usage.credits.balance}` },
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

    const suggestions = await generateAISEOSuggestions({
      websiteTitle: website.title,
      prompt: website.prompt || "",
      htmlContent: indexPage?.html_content || "",
      designPlan: website.design_plan,
    });

    // Deduct credits after successful AI call
    await deductCredits(user.id, CREDIT_COST, "ai_seo_suggestions", websiteId);

    return NextResponse.json({
      suggestions,
      creditsDeducted: CREDIT_COST,
      remainingCredits: (usage?.credits.balance || CREDIT_COST) - CREDIT_COST,
    });
  } catch (err: any) {
    console.error("POST SEO AI Generate Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate AI SEO suggestions." },
      { status: 500 }
    );
  }
}
