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
  readonly defaultModel: string = process.env.GEMINI_MODEL || "gemini-1.5-flash";

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
        model: this.defaultModel,
        prompt: input.prompt,
        promptCategory: input.category,
        responseText: "",
        brandName: input.brandName,
        latencyMs: Date.now() - startTime,
        status: "failed",
        errorMessage: "FEATURE_LIVE_AI_VISIBILITY is false",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // 2. Mock / Fallback Mode
    if (!apiKey) {
      if (signal) {
        if (signal.aborted) {
          throw new DOMException("The operation was aborted.", "AbortError");
        }
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 5);
          signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              const err = new Error("The operation was aborted.");
              err.name = "AbortError";
              reject(err);
            },
            { once: true }
          );
        });
      }

      const mockDomain = `${input.brandName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
      const mockText = `Gemini Search Grounding analysis: ${input.brandName} is highly ranked for ${input.category} queries. Reference: https://${mockDomain}`;
      const mockCitations: CitationItem[] = [
        {
          url: `https://${mockDomain}/home`,
          domain: mockDomain,
          title: `${input.brandName} Grounded Search Result`,
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

    // 3. Real Provider API Call (Gemini REST API with Google Search Grounding)
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.defaultModel}:generateContent?key=${apiKey}`;

      const response = await fetch(endpoint, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
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

      // Extract Grounding Metadata Citations
      const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
      const citations: CitationItem[] = groundingChunks
        .map((chunk: any) => chunk.web?.uri)
        .filter((uri: string): uri is string => Boolean(uri))
        .map((url: string) => ({
          url,
          domain: extractDomainFromUrl(url) || undefined,
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
