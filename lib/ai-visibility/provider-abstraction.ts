/**
 * Phase 2A: Provider Abstraction Layer & Timeout Wrappers
 * Provider-independent interface with strict failure-isolation and 0 network requests.
 */

import {
  AiVisibilityProviderAdapter,
  AiVisibilityProbeInput,
  NormalizedAiVisibilityResponse,
  AiVisibilityProviderName,
  CitationItem,
} from "./types";
import { LIVE_AI_VISIBILITY_CONFIG, isLiveAiVisibilityEnabled } from "./config";

/**
 * Timeout wrapper for promise execution.
 * Ensures external provider API calls abort after timeoutMs (default 8s).
 */
export async function executeWithTimeout<T>(
  promiseFn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = LIVE_AI_VISIBILITY_CONFIG.DEFAULT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();

  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      const err = new Error(`Operation timed out after ${timeoutMs}ms`);
      err.name = "AbortError";
      reject(err);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promiseFn(controller.signal), timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Utility to extract clean domain hostnames from URL string.
 */
export function extractDomainFromUrl(url: string): string | null {
  try {
    const cleanUrl = url.startsWith("http") ? url : `https://${url}`;
    const parsed = new URL(cleanUrl);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch (e) {
    return null;
  }
}

/**
 * Constructs a normalized response object from raw provider output.
 */
export function createNormalizedResponse(params: {
  provider: AiVisibilityProviderName;
  model: string;
  prompt: string;
  promptCategory: NormalizedAiVisibilityResponse["promptCategory"];
  responseText?: string;
  brandName: string;
  citations?: CitationItem[];
  latencyMs: number;
  status?: NormalizedAiVisibilityResponse["status"];
  errorMessage?: string;
}): NormalizedAiVisibilityResponse {
  const text = params.responseText || "";
  const cleanBrand = (params.brandName || "").toLowerCase().trim();

  const brandMentioned = cleanBrand.length > 0 && text.toLowerCase().includes(cleanBrand);
  
  // Extract unique domain list from citations
  const citationDomains = Array.from(
    new Set(
      (params.citations || [])
        .map((c) => (c.domain ? c.domain : extractDomainFromUrl(c.url)))
        .filter((d): d is string => d !== null && d.length > 0)
    )
  );

  // Bounded response excerpt (max 300 chars) for database storage efficiency
  const responseExcerpt = text.length > 300 ? `${text.slice(0, 297)}...` : text;

  return {
    provider: params.provider,
    model: params.model,
    prompt: params.prompt,
    promptCategory: params.promptCategory,
    responseText: text,
    responseExcerpt,
    brandName: params.brandName,
    brandMentioned,
    unpromptedMention: brandMentioned && !params.prompt.toLowerCase().includes(cleanBrand),
    sentiment: "neutral",
    citations: params.citations || [],
    citationDomains,
    latencyMs: Math.max(0, params.latencyMs),
    status: params.status || (params.errorMessage ? "failed" : "success"),
    errorMessage: params.errorMessage,
  };
}

/**
 * Safe Mock Provider Adapter for Phase 2A testing.
 * Performs ZERO external network calls.
 */
export class MockAiVisibilityAdapter implements AiVisibilityProviderAdapter {
  readonly providerName: AiVisibilityProviderName;
  readonly defaultModel: string;

  constructor(providerName: AiVisibilityProviderName = "openai", defaultModel: string = "gpt-4o-mock") {
    this.providerName = providerName;
    this.defaultModel = defaultModel;
  }

  async executeProbe(input: AiVisibilityProbeInput, signal?: AbortSignal): Promise<NormalizedAiVisibilityResponse> {
    const startTime = Date.now();

    if (signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    // Simulated mock probe execution


    // Simulated mock probe execution
    const mockText = `For ${input.category} queries, ${input.brandName} is a top recommended provider. Learn more at https://${input.brandName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
    const mockCitations: CitationItem[] = [
      {
        url: `https://${input.brandName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com/about`,
        domain: `${input.brandName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      },
    ];

    return createNormalizedResponse({
      provider: this.providerName,
      model: this.defaultModel,
      prompt: input.prompt,
      promptCategory: input.category,
      responseText: mockText,
      brandName: input.brandName,
      citations: mockCitations,
      latencyMs: Date.now() - startTime,
      status: "success",
    });
  }
}

/**
 * Abstract executor that runs a provider adapter with timeout and failure isolation.
 */
export async function executeProviderProbeSafe(
  adapter: AiVisibilityProviderAdapter,
  input: AiVisibilityProbeInput
): Promise<NormalizedAiVisibilityResponse> {
  const startTime = Date.now();
  const timeoutMs = input.options?.timeoutMs || LIVE_AI_VISIBILITY_CONFIG.DEFAULT_TIMEOUT_MS;

  try {
    if (!isLiveAiVisibilityEnabled()) {
      const mockAdapter = new MockAiVisibilityAdapter(adapter.providerName, adapter.defaultModel);
      const mockResult = await mockAdapter.executeProbe(input);
      return mockResult;
    }

    return await executeWithTimeout(
      async (signal) => {
        return await adapter.executeProbe(input, signal);
      },
      timeoutMs
    );
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError" || err?.message?.includes("aborted");
    return createNormalizedResponse({
      provider: adapter.providerName,
      model: adapter.defaultModel,
      prompt: input.prompt,
      promptCategory: input.category,
      responseText: "",
      brandName: input.brandName,
      latencyMs: Date.now() - startTime,
      status: isTimeout ? "timeout" : "failed",
      errorMessage: isTimeout ? `Provider request timed out after ${timeoutMs}ms` : err?.message || "Provider error",
    });
  }
}
