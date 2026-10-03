/**
 * Phase 2B Stage 3: Multi-Provider AI Visibility Probe Engine
 * Parallel batch execution & failure-isolated orchestration across OpenAI, Perplexity, Gemini, and Claude.
 */

import {
  AiVisibilityProviderAdapter,
  AiVisibilityProbeInput,
  NormalizedAiVisibilityResponse,
  AiVisibilityProviderName,
} from "./types";
import { executeProviderProbeSafe } from "./provider-abstraction";
import { OpenAiVisibilityAdapter } from "./adapters/openai-adapter";
import { PerplexityVisibilityAdapter } from "./adapters/perplexity-adapter";
import { GeminiVisibilityAdapter } from "./adapters/gemini-adapter";
import { ClaudeVisibilityAdapter } from "./adapters/claude-adapter";

export interface MultiProviderProbeResult {
  websiteId: string;
  brandName: string;
  timestamp: string;
  totalProviders: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  responses: NormalizedAiVisibilityResponse[];
}

/**
 * Returns instantiated provider adapter for given provider name.
 */
export function getProviderAdapter(provider: AiVisibilityProviderName): AiVisibilityProviderAdapter {
  switch (provider) {
    case "openai":
      return new OpenAiVisibilityAdapter();
    case "perplexity":
      return new PerplexityVisibilityAdapter();
    case "gemini":
      return new GeminiVisibilityAdapter();
    case "claude":
      return new ClaudeVisibilityAdapter();
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Executes parallel AI visibility probes across specified providers (or all 4 default providers).
 * Guarantees 100% failure isolation: A failure in one provider adapter NEVER cancels or affects other providers.
 */
export async function executeMultiProviderAiVisibilityProbe(
  input: AiVisibilityProbeInput,
  targetProviders: AiVisibilityProviderName[] = ["openai", "perplexity", "gemini", "claude"]
): Promise<MultiProviderProbeResult> {
  const startTime = Date.now();

  // Deduplicate target providers
  const uniqueProviders = Array.from(new Set(targetProviders));

  // Dispatch parallel requests with failure isolation (Promise.allSettled)
  const probePromises = uniqueProviders.map(async (providerName) => {
    try {
      const adapter = getProviderAdapter(providerName);
      return await executeProviderProbeSafe(adapter, input);
    } catch (err: any) {
      // Emergency catch for any uncaught provider adapter error
      return {
        provider: providerName,
        model: "unknown",
        prompt: input.prompt,
        promptCategory: input.category,
        responseText: "",
        brandName: input.brandName,
        brandMentioned: false,
        unpromptedMention: false,
        sentiment: "neutral" as const,
        citations: [],
        citationDomains: [],
        latencyMs: Date.now() - startTime,
        status: "failed" as const,
        errorMessage: err?.message || "Uncaught provider failure",
      };
    }
  });

  const settledResults = await Promise.allSettled(probePromises);

  const responses: NormalizedAiVisibilityResponse[] = settledResults.map((res, index) => {
    if (res.status === "fulfilled") {
      return res.value;
    }
    // Rejected fallback
    const providerName = uniqueProviders[index];
    return {
      provider: providerName,
      model: "unknown",
      prompt: input.prompt,
      promptCategory: input.category,
      responseText: "",
      brandName: input.brandName,
      brandMentioned: false,
      unpromptedMention: false,
      sentiment: "neutral",
      citations: [],
      citationDomains: [],
      latencyMs: Date.now() - startTime,
      status: "failed",
      errorMessage: res.reason?.message || "Promise rejection",
    };
  });

  const successCount = responses.filter((r) => r.status === "success").length;
  const timeoutCount = responses.filter((r) => r.status === "timeout").length;
  const failureCount = responses.length - successCount - timeoutCount;

  return {
    websiteId: input.websiteId,
    brandName: input.brandName,
    timestamp: new Date().toISOString(),
    totalProviders: responses.length,
    successCount,
    failureCount,
    timeoutCount,
    responses,
  };
}
