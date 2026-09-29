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

    // TEMPORARY UNLIMITED AI USAGE MODE: Credit balance check bypassed
    const CREDIT_COST = 5;

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

    // PHASE A: UNIFIED GEMINI INTENT & ROUTING CORE
    const { analyzeUnifiedConversationIntent } = await import("@/lib/ai/unified-conversation-core");
    const unifiedResult = await analyzeUnifiedConversationIntent({
      userPrompt: prompt,
      history,
      activeMode: "seo",
      timeoutMs: 4000,
    }).catch(() => null);

    if (unifiedResult && unifiedResult.success) {
      // 1. Cross-Agent Guidance for Marketing Requests (e.g. "Run Facebook ads")
      if (unifiedResult.domain === "marketing") {
        return NextResponse.json({
          response: {
            message: unifiedResult.responseMessage ||
              `You're asking about paid ad campaigns, lead generation, or marketing spend analytics!\n\n` +
              `Our **Marketing Agent** handles Meta (Facebook & Instagram) and Google ad strategies, lead tracking, and campaign optimization. You can switch to the Marketing tab right from your dashboard!`,
            suggestedActions: ["Open Marketing Agent", "View Ad Analytics"],
            navigationTarget: "marketing",
          },
          creditsDeducted: 0,
          remainingCredits: usage?.credits?.balance || 0,
        });
      }

      // 2. Cross-Agent Guidance for Website Requests (e.g. "Change my homepage")
      if (unifiedResult.domain === "website") {
        return NextResponse.json({
          response: {
            message: unifiedResult.responseMessage ||
              `To modify your website design, colors, layout, or page structure, please use the **Website Editor** or consult the **Website Agent**! I'm here in SEO to help you optimize search engine rankings and AEO/AI Search discovery.`,
            suggestedActions: ["Open Website Editor"],
            navigationTarget: "pages",
          },
          creditsDeducted: 0,
          remainingCredits: usage?.credits?.balance || 0,
        });
      }

      // 3. General Capability Questions (e.g. "What is your SEO Agent?")
      if (
        unifiedResult.domain === "general" &&
        (unifiedResult.route === "agent_capability_question" || unifiedResult.route === "product_question")
      ) {
        return NextResponse.json({
          response: {
            message: unifiedResult.responseMessage ||
              `Hi 👋 I am your **Codeaxys SEO Specialist**!\n\n` +
              `I orchestrate your website's full SEO engine:\n` +
              `• **Technical SEO & Crawl Audits**: Canonical tags, robots.txt, sitemaps, orphan pages\n` +
              `• **AEO & AI Search Readiness**: Optimizing for ChatGPT, Perplexity, and Gemini discovery\n` +
              `• **Content Studio**: Writing blog posts, content gap analysis, keyword research\n` +
              `• **Google Search Console**: Clicks, impressions, position tracking\n` +
              `• **Local SEO**: NAP consistency and JSON-LD schema\n\n` +
              `How can I help optimize your search visibility today?`,
            suggestedActions: ["How is my website SEO?", "Are there technical issues?", "How ready is my website for AI Search?"],
            navigationTarget: "overview",
          },
          creditsDeducted: 0,
          remainingCredits: usage?.credits?.balance || 0,
        });
      }
    }

    // 5. Detect Customer Intent
    const { detectSEOIntent } = await import("@/lib/seo-agent-intent");
    const detectedIntent = detectSEOIntent(prompt, history);

    // 6. Assemble Intent-Filtered SEO Context
    const seoContext = await buildSEOContext(supabase, websiteId, detectedIntent);

    // 7. Execute Gemini SEO Agent query
    const agentResponse = await generateSEOAgentResponse({
      userPrompt: prompt,
      seoContext,
      conversationHistory: history,
      detectedIntent,
    });

    // 7. Deduct credits ONLY after successful AI execution
    await deductCredits(user.id, CREDIT_COST, "seo_ai_agent", websiteId);

    return NextResponse.json({
      response: agentResponse,
      creditsDeducted: CREDIT_COST,
      remainingCredits: Math.max(0, (usage?.credits?.balance || CREDIT_COST) - CREDIT_COST),
    });
  } catch (err: any) {
    console.error("POST SEO Agent Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to process request with AI SEO Agent." },
      { status: 500 }
    );
  }
}
