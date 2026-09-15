import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { buildSEOContext, generateSEOAgentResponse, SEOAgentMessage } from "@/lib/seo-agent";
import { getUserUsage, deductCredits } from "@/lib/billing";
import { canUseFeature } from "@/lib/features";

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

    // 2. Check Plan permissions
    const usage = await getUserUsage(user.id);
    const planId = usage?.plan?.id || "free";

    if (!canUseFeature(planId, "ai_seo")) {
      return NextResponse.json(
        {
          error: "The Dedicated AI SEO Agent requires a Pro or Agency subscription plan.",
          code: "UPGRADE_REQUIRED",
        },
        { status: 403 }
      );
    }

    // 3. Verify Website Ownership
    const { data: website, error: websiteErr } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (websiteErr || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 404 }
      );
    }

    // 4. Check Available Credits (5 credits per SEO Agent query)
    const CREDIT_COST = 5;
    if (!usage || usage.credits.balance < CREDIT_COST) {
      return NextResponse.json(
        {
          error: `Insufficient AI credits. Required: ${CREDIT_COST}, Balance: ${usage?.credits.balance || 0}`,
          code: "INSUFFICIENT_CREDITS",
        },
        { status: 402 }
      );
    }

    // Parse Request Body
    const body = await request.json();
    const prompt = (body.prompt || "").trim();
    const history: SEOAgentMessage[] = Array.isArray(body.history) ? body.history : [];

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt question is required." },
        { status: 400 }
      );
    }

    // 5. Assemble Bounded SEO Context
    const seoContext = await buildSEOContext(supabase, websiteId);

    // 6. Execute Gemini SEO Agent query
    const agentResponse = await generateSEOAgentResponse({
      userPrompt: prompt,
      seoContext,
      conversationHistory: history,
    });

    // 7. Deduct credits ONLY after successful AI execution
    await deductCredits(user.id, CREDIT_COST, "seo_ai_agent", websiteId);

    return NextResponse.json({
      response: agentResponse,
      creditsDeducted: CREDIT_COST,
      remainingCredits: Math.max(0, (usage.credits.balance || CREDIT_COST) - CREDIT_COST),
    });
  } catch (err: any) {
    console.error("POST SEO Agent Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to process request with AI SEO Agent." },
      { status: 500 }
    );
  }
}
