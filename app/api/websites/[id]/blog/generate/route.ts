import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { checkCreditBalance, deductCredits, refundCredits } from "@/lib/billing";
import { checkRateLimit } from "@/lib/rate-limit";
import { CREDIT_COSTS } from "@/lib/constants";
import { GoogleGenAI } from "@google/genai";
import { getGeminiConfig } from "@/lib/gemini";

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
    const rl = checkRateLimit(`blog_gen_${user.id}`, { limit: 10, windowMs: 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many blog generation requests. Please slow down." },
        { status: 429 }
      );
    }

    // 2. Verify Website Ownership & Fetch SEO Context
    const { data: website, error: webErr } = await supabase
      .from("websites")
      .select("id, title, prompt, design_plan")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    // 3. Parse Request Body
    const body = await request.json().catch(() => ({}));
    const topic = (body.topic || "").trim();

    if (!topic) {
      return NextResponse.json({ error: "Blog post topic is required." }, { status: 400 });
    }

    // 4. Check Credit Balance & Deduct Upfront Atomically
    const CREDIT_COST = CREDIT_COSTS.BLOG_GENERATION;
    const creditCheck = await checkCreditBalance(user.id, CREDIT_COST);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: `Insufficient AI credits. You need ${CREDIT_COST} credits to generate an AI blog post.`,
          code: "INSUFFICIENT_CREDITS",
          remainingCredits: creditCheck.balance,
        },
        { status: 402 }
      );
    }

    const opId =
      request.headers.get("x-request-id") ||
      request.headers.get("idempotency-key") ||
      body?.requestId ||
      crypto.randomUUID();
    const deductAction = `ai_blog_generation:${opId}`;
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

    const { data: seoRow } = await supabase
      .from("website_seo")
      .select("focus_keywords, seo_title, meta_description")
      .eq("website_id", websiteId)
      .maybeSingle();

    // 5. Invoke Gemini AI Content Generation with Failure Refund
    try {
      const { apiKey, model } = getGeminiConfig();
      const ai = new GoogleGenAI({ apiKey });

      const brandName = website.title || "Our Website";
      const brandPrompt = website.prompt || "";
      const siteKeywords = (seoRow?.focus_keywords || []).join(", ");

      const systemPrompt = `You are a principal SEO Content Strategist and professional copywriter for ${brandName}.
Your goal is to write a high-value, highly engaging, search-engine-optimized blog article.

CRITICAL CONTENT QUALITY RULES:
1. USEFUL INFORMATION: Provide practical, accurate, engaging insights that answer search intent.
2. NATURAL LANGUAGE & READABILITY: Use clear headings (<h2>, <h3>), short readable paragraphs (<p>), bullet points (<ul>/<li>), and occasional blockquotes.
3. KEYWORD INTENSITY: Include target focus keywords naturally in the title, intro paragraph, and headings without keyword stuffing.
4. NO FAKE STATISTICS: Do not make up fake claims, unverified statistics, or false guarantees.
5. FORMAT: Return ONLY a raw JSON object with NO markdown code fences.

JSON OUTPUT STRUCTURE:
{
  "title": "Compelling SEO Blog Title",
  "slug": "seo-friendly-url-slug",
  "excerpt": "A concise 2-sentence summary of the article.",
  "content": "<p>Engaging introduction paragraph...</p><h2>First Main Topic</h2><p>Detailed insights...</p><ul><li>Key takeaway 1</li><li>Key takeaway 2</li></ul><h2>Conclusion</h2><p>Closing thoughts and CTA.</p>",
  "category": "Industry Insights",
  "tags": ["SEO", "Guides", "Advice"],
  "seo_title": "SEO Optimized Title for Search Engines | Brand",
  "meta_description": "Search engine snippet description under 155 characters.",
  "focus_keyword": "primary target keyword phrase"
}`;

      const userPrompt = `
WEBSITE TITLE: ${brandName}
BUSINESS CONTEXT: ${brandPrompt}
WEBSITE TARGET KEYWORDS: ${siteKeywords || "General Industry Topics"}
REQUESTED BLOG TOPIC: "${topic}"
      `;

      const candidateModels = Array.from(new Set([model || "gemini-3.6-flash", "gemini-3.6-flash", "gemini-3.5-flash"]));
      let rawResponseText = "";
      let lastError: any = null;

      for (const targetModel of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: targetModel,
            contents: [
              { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
            ],
            config: {
              responseMimeType: "application/json",
            },
          });

          rawResponseText = response.text || "";
          if (rawResponseText.trim()) break;
        } catch (err: any) {
          console.warn(`AI Blog Generation model ${targetModel} failed:`, err?.message || err);
          lastError = err;
        }
      }

      if (!rawResponseText.trim()) {
        throw new Error(lastError?.message || "AI engine failed to generate blog post.");
      }

      const cleanedText = rawResponseText.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsedDraft = JSON.parse(cleanedText);

      return NextResponse.json({
        success: true,
        draft: {
          title: parsedDraft.title || topic,
          slug: parsedDraft.slug || topic.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          excerpt: parsedDraft.excerpt || "",
          content: parsedDraft.content || `<p>${topic}</p>`,
          category: parsedDraft.category || "General",
          tags: Array.isArray(parsedDraft.tags) ? parsedDraft.tags : ["Blog"],
          seo_title: parsedDraft.seo_title || parsedDraft.title || topic,
          meta_description: parsedDraft.meta_description || parsedDraft.excerpt || "",
          focus_keyword: parsedDraft.focus_keyword || topic,
        },
        creditsDeducted: CREDIT_COST,
        remainingCredits: Math.max(0, creditCheck.balance - CREDIT_COST),
      });
    } catch (genErr: any) {
      console.warn("AI Blog Generation failed, refunding credits:", genErr?.message || genErr);
      await refundCredits(user.id, CREDIT_COST, refundAction, websiteId);
      return NextResponse.json(
        { error: genErr?.message || "Failed to generate AI blog post. Your credits have been refunded." },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("POST AI Blog Generation Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate AI blog post." },
      { status: 500 }
    );
  }
}
