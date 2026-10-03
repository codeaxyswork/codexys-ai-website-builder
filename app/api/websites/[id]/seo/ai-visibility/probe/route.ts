import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  OpenAiVisibilityAdapter,
  PerplexityVisibilityAdapter,
  GeminiVisibilityAdapter,
  ClaudeVisibilityAdapter,
  executeProviderProbeSafe,
  persistProbeResults,
  AiVisibilityProbeInput,
  AiVisibilityProviderName,
  AiVisibilityPromptCategory,
  isLiveAiVisibilityEnabled,
} from "@/lib/ai-visibility";

const VALID_PROVIDERS: AiVisibilityProviderName[] = [
  "openai",
  "perplexity",
  "gemini",
  "claude",
];

const VALID_CATEGORIES: AiVisibilityPromptCategory[] = [
  "informational",
  "commercial",
  "buyer_intent",
  "local",
  "competitor",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;

    // 1. Authentication Check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized access. Please log in." },
        { status: 401 }
      );
    }

    // 2. Website Ownership Check
    const { data: website, error: websiteErr } = await supabase
      .from("websites")
      .select("id, title, user_id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (websiteErr || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 403 }
      );
    }

    // 3. Payload Extraction & Strict Validation
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid JSON request payload." },
        { status: 400 }
      );
    }

    const provider: AiVisibilityProviderName = body?.provider;
    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        {
          error: `Invalid provider '${provider}'. Supported providers: ${VALID_PROVIDERS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const promptCategory: AiVisibilityPromptCategory =
      body?.category || body?.promptCategory || "informational";
    if (!VALID_CATEGORIES.includes(promptCategory)) {
      return NextResponse.json(
        {
          error: `Invalid category '${promptCategory}'. Supported categories: ${VALID_CATEGORIES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const prompt: string = (body?.prompt || "").trim();
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required and cannot be empty." },
        { status: 400 }
      );
    }

    if (prompt.length > 1000) {
      return NextResponse.json(
        { error: "Prompt exceeds maximum allowed length of 1000 characters." },
        { status: 400 }
      );
    }

    const brandName: string = (body?.brandName || website.title || "Brand").trim();

    // 4. Provider Adapter Selection
    let adapter;
    switch (provider) {
      case "openai":
        adapter = new OpenAiVisibilityAdapter();
        break;
      case "perplexity":
        adapter = new PerplexityVisibilityAdapter();
        break;
      case "gemini":
        adapter = new GeminiVisibilityAdapter();
        break;
      case "claude":
        adapter = new ClaudeVisibilityAdapter();
        break;
      default:
        return NextResponse.json({ error: "Unsupported provider." }, { status: 400 });
    }

    // 5. Execution Input Construction
    const probeInput: AiVisibilityProbeInput = {
      websiteId,
      userId: user.id,
      brandName,
      prompt,
      category: promptCategory,
      options: {
        timeoutMs: 8000, // Strict 8s deadline
      },
    };

    // 6. Safe Provider Execution (Handled via feature flag + failure isolation)
    const result = await executeProviderProbeSafe(adapter, probeInput);

    // 7. Isolated DB Persistence (Safe call, failures never throw or crash response)
    await persistProbeResults(supabase, websiteId, user.id, result);

    // 8. ZERO Credit Deduction Guarantee
    // Note: Credit deduction is strictly disabled in Stage 6B

    return NextResponse.json({
      success: result.status === "success",
      liveMode: isLiveAiVisibilityEnabled(),
      response: {
        provider: result.provider,
        model: result.model,
        promptCategory: result.promptCategory,
        prompt: result.prompt,
        brandName: result.brandName,
        brandMentioned: result.brandMentioned,
        unpromptedMention: result.unpromptedMention,
        sentiment: result.sentiment,
        citationDomains: result.citationDomains,
        citations: result.citations,
        responseExcerpt: result.responseExcerpt,
        latencyMs: result.latencyMs,
        status: result.status,
        errorMessage: result.errorMessage,
      },
    });
  } catch (err: any) {
    console.error("AI Visibility Probe API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to process AI visibility probe." },
      { status: 500 }
    );
  }
}
