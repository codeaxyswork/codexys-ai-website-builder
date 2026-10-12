import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import {
  OpenAiVisibilityAdapter,
  PerplexityVisibilityAdapter,
  GeminiVisibilityAdapter,
  ClaudeVisibilityAdapter,
  executeProviderProbeSafe,
  executeMultiProviderAiVisibilityProbe,
  persistProbeResults,
  AiVisibilityProbeInput,
  AiVisibilityProviderName,
  AiVisibilityPromptCategory,
  isLiveAiVisibilityEnabled,
  checkAiVisibilityEntitlement,
  checkProbeCreditEligibility,
  deductProbeCredits,
  refundProbeCredits,
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

    // 3. Server-Side PRO Subscription Entitlement Check
    const entitlement = await checkAiVisibilityEntitlement(user.id, supabase);
    if (!entitlement.entitled) {
      return NextResponse.json(
        {
          error: entitlement.reason || "PRO subscription required for AI Visibility.",
          code: "UPGRADE_REQUIRED",
          requiredPlan: "pro",
          currentPlan: entitlement.planId,
          upgradeUrl: "/dashboard/billing",
        },
        { status: 403 }
      );
    }

    // 4. Payload Extraction & Strict Validation
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid JSON request payload." },
        { status: 400 }
      );
    }

    // Determine target provider(s): single provider or batch
    const rawProvider: string = body?.provider;
    const rawProviders: any = body?.providers;
    let isBatch = false;
    let targetProviders: AiVisibilityProviderName[] = [];

    if (rawProvider === "all" || Array.isArray(rawProviders)) {
      isBatch = true;
      if (Array.isArray(rawProviders) && rawProviders.length > 0) {
        targetProviders = rawProviders.filter((p: any): p is AiVisibilityProviderName =>
          VALID_PROVIDERS.includes(p)
        );
      } else {
        targetProviders = [...VALID_PROVIDERS];
      }

      if (targetProviders.length === 0) {
        return NextResponse.json(
          {
            error: `Invalid providers list. Supported providers: ${VALID_PROVIDERS.join(", ")}`,
          },
          { status: 400 }
        );
      }
    } else {
      if (!rawProvider || !VALID_PROVIDERS.includes(rawProvider as AiVisibilityProviderName)) {
        return NextResponse.json(
          {
            error: `Invalid provider '${rawProvider}'. Supported providers: ${VALID_PROVIDERS.join(", ")}, or 'all'`,
          },
          { status: 400 }
        );
      }
      targetProviders = [rawProvider as AiVisibilityProviderName];
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

    // 5. Credit & Operational Rate Limit Guard (Atomic Verification)
    const eligibility = await checkProbeCreditEligibility(
      supabase,
      user.id,
      websiteId,
      prompt,
      targetProviders
    );

    if (!eligibility.allowed) {
      return NextResponse.json(
        {
          error: eligibility.error || "Probe request declined.",
          code: eligibility.code || "PROBE_FORBIDDEN",
          creditsRequired: eligibility.creditsRequired,
          currentBalance: eligibility.currentBalance,
        },
        { status: eligibility.code === "INSUFFICIENT_CREDITS" ? 402 : 400 }
      );
    }

    const probeRequestId =
      request.headers.get("x-request-id") ||
      request.headers.get("idempotency-key") ||
      body?.requestId ||
      crypto.randomUUID();
    const probeActionKey = `probe_${probeRequestId}`;

    // 6. Deduct credits atomically if in live mode (deducts batch price ONCE for multi-provider)
    let deductedCredits = 0;
    if (eligibility.liveMode && eligibility.creditsRequired > 0) {
      const deduction = await deductProbeCredits(
        supabase,
        user.id,
        websiteId,
        eligibility.creditsRequired,
        prompt,
        probeActionKey
      );

      if (!deduction.success) {
        return NextResponse.json(
          {
            error: deduction.error || "Failed to deduct AI credits.",
            code: "INSUFFICIENT_CREDITS",
          },
          { status: 402 }
        );
      }
      deductedCredits = deduction.creditsDeducted;
    }

    // 7. Execution Input Construction & Unique Request Tracking
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

    // 8. Execution Orchestration: Batch vs Single Provider
    if (isBatch || targetProviders.length > 1) {
      // Execute multi-provider parallel probe with failure isolation
      const batchResult = await executeMultiProviderAiVisibilityProbe(
        probeInput,
        targetProviders
      );

      // Refund safeguard: If in live mode and ALL providers failed or timed out, refund atomically
      if (
        eligibility.liveMode &&
        deductedCredits > 0 &&
        batchResult.successCount === 0
      ) {
        const adminDb = createAdminClient();
        await refundProbeCredits(
          adminDb || supabase,
          user.id,
          websiteId,
          deductedCredits,
          `All ${batchResult.totalProviders} batch providers failed`,
          probeActionKey
        );
        deductedCredits = 0;
      }

      // Persist results for each provider (failure-isolated)
      for (const res of batchResult.responses) {
        await persistProbeResults(supabase, websiteId, user.id, res);
      }

      return NextResponse.json({
        success: batchResult.successCount > 0,
        probeRequestId,
        liveMode: isLiveAiVisibilityEnabled(),
        creditsDeducted: deductedCredits,
        batch: {
          totalProviders: batchResult.totalProviders,
          successCount: batchResult.successCount,
          failureCount: batchResult.failureCount,
          timeoutCount: batchResult.timeoutCount,
        },
        responses: batchResult.responses,
        response: batchResult.responses[0] || null, // Backwards-compatible single response reference
      });
    }

    // Single Provider Execution Path
    const singleProvider = targetProviders[0];
    let adapter;
    switch (singleProvider) {
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

    const result = await executeProviderProbeSafe(adapter, probeInput);

    // Automatic refund if live single provider call failed or timed out
    if (eligibility.liveMode && deductedCredits > 0 && result.status !== "success") {
      const adminDb = createAdminClient();
      await refundProbeCredits(
        adminDb || supabase,
        user.id,
        websiteId,
        deductedCredits,
        `Provider failed: ${result.errorMessage || result.status}`,
        probeActionKey
      );
      deductedCredits = 0;
    }

    // Isolated DB Persistence
    await persistProbeResults(supabase, websiteId, user.id, result);

    return NextResponse.json({
      success: result.status === "success",
      probeRequestId,
      liveMode: isLiveAiVisibilityEnabled(),
      creditsDeducted: deductedCredits,
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
