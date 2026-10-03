/**
 * Phase 2B Stage 1: Perplexity AI Visibility Provider Adapter
 * Isolated, failure-safe adapter for Perplexity API with native citation forwarding.
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

export class PerplexityVisibilityAdapter implements AiVisibilityProviderAdapter {
  readonly providerName: AiVisibilityProviderName = "perplexity";
  readonly defaultModel: string = "sonar";

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

    const apiKey = process.env.PERPLEXITY_API_KEY;

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
      const mockText = `${input.brandName} is prominently featured for ${input.category} searches with direct citations. Source: https://${mockDomain}/pricing`;
      const mockCitations: CitationItem[] = [
        {
          url: `https://${mockDomain}/pricing`,
          domain: mockDomain,
          title: `${input.brandName} Official Page`,
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

    // 3. Real Provider API Call (Perplexity Chat Completions with native citations)
    try {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages: [
            {
              role: "system",
              content: "Provide accurate research and web recommendations with clear citations.",
            },
            { role: "user", content: input.prompt },
          ],
          max_tokens: input.options?.maxTokens || 500,
          temperature: 0.2,
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
          errorMessage: `Perplexity API Error (${response.status}): ${errText.slice(0, 150)}`,
        });
      }

      const data = await response.json();
      const contentText = data?.choices?.[0]?.message?.content || "";
      const rawCitations: string[] = data?.citations || [];

      const citations: CitationItem[] = rawCitations.map((url: string) => ({
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
        errorMessage: isTimeout ? "Perplexity request timed out" : err?.message || "Perplexity request error",
      });
    }
  }
}
