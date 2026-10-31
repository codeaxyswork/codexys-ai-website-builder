/**
 * Phase 2B Stage 1: Google Gemini AI Visibility Provider Adapter
 * Isolated, failure-safe adapter for Gemini API with Google Search Grounding.
 * Operates strictly in mock/no-network mode when FEATURE_LIVE_AI_VISIBILITY=false.
 */

import {
  AiVisibilityProviderAdapter,
  AiVisibilityProbeInput,
  NormalizedAiVisibilityResponse,
  AiVisibilityProviderName,
  CitationItem,
} from "../types";
import { isLiveAiVisibilityEnabled } from "../config";
import { createNormalizedResponse, extractDomainFromUrl } from "../provider-abstraction";

export class GeminiVisibilityAdapter implements AiVisibilityProviderAdapter {
  readonly providerName: AiVisibilityProviderName = "gemini";
  readonly defaultModel: string = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  constructor(model?: string) {
    if (model) {
      this.defaultModel = model;
    }
  }

  async executeProbe(
    input: AiVisibilityProbeInput,
    signal?: AbortSignal
  ): Promise<NormalizedAiVisibilityResponse> {
    const startTime = Date.now();

    if (signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    // 1. Feature Flag Guard
    if (!isLiveAiVisibilityEnabled()) {
      return createNormalizedResponse({
        provider: this.providerName,
        model: `mock-${this.defaultModel}`,
        prompt: input.prompt,
        promptCategory: input.category,
        responseText: "",
        brandName: input.brandName,
        latencyMs: Date.now() - startTime,
        status: "failed",
        errorMessage: "FEATURE_LIVE_AI_VISIBILITY is false",
        isGroundedSearch: false,
        isMock: true,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    // 2. Fail-Closed Security Guard: Missing API key in live mode must return auth_error, never fabricate success
    if (!apiKey || apiKey.trim() === "") {
      return createNormalizedResponse({
        provider: this.providerName,
        model: this.defaultModel,
        prompt: input.prompt,
        promptCategory: input.category,
        responseText: "",
        brandName: input.brandName,
        latencyMs: Date.now() - startTime,
        status: "auth_error",
        errorMessage: "Gemini API key is missing or not configured on the server.",
        isGroundedSearch: false,
        isMock: false,
      });
    }

    // 3. Real Provider API Call (Gemini REST API with Google Search Grounding via secure header)
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.defaultModel}:generateContent`;

      const response = await fetch(endpoint, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: input.prompt }],
            },
          ],
          tools: [{ googleSearch: {} }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        const status = response.status === 429 ? "rate_limited" : response.status === 401 || response.status === 403 ? "auth_error" : "failed";
        return createNormalizedResponse({
          provider: this.providerName,
          model: this.defaultModel,
          prompt: input.prompt,
          promptCategory: input.category,
          responseText: "",
          brandName: input.brandName,
          latencyMs: Date.now() - startTime,
          status,
          errorMessage: `Gemini API Error (${response.status}): ${errText.slice(0, 150)}`,
        });
      }

      const data = await response.json();
      const candidate = data?.candidates?.[0];
      const contentText = candidate?.content?.parts?.[0]?.text || "";
      const servedModel = data?.modelVersion || this.defaultModel;
      console.log(`[AI_VISIBILITY] Gemini probe executed (requested: ${this.defaultModel}, served: ${servedModel})`);

      // Extract Grounding Metadata Citations (verified Google Search Grounding)
      const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
      const citations: CitationItem[] = groundingChunks
        .map((chunk: { web?: { uri?: string } }) => chunk.web?.uri)
        .filter((uri: string): uri is string => Boolean(uri))
        .map((url: string) => ({
          url,
          domain: extractDomainFromUrl(url) || undefined,
          sourceType: "grounded_search" as const,
        }));

      return createNormalizedResponse({
        provider: this.providerName,
        model: this.defaultModel,
        prompt: input.prompt,
        promptCategory: input.category,
        responseText: contentText,
        brandName: input.brandName,
        citations,
        latencyMs: Date.now() - startTime,
        status: "success",
        isGroundedSearch: true,
        isMock: false,
      });
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError" || err?.message?.includes("aborted");
      return createNormalizedResponse({
        provider: this.providerName,
        model: this.defaultModel,
        prompt: input.prompt,
        promptCategory: input.category,
        responseText: "",
        brandName: input.brandName,
        latencyMs: Date.now() - startTime,
        status: isTimeout ? "timeout" : "failed",
        errorMessage: isTimeout ? "Gemini request timed out" : err?.message || "Gemini request error",
      });
    }
  }
}
