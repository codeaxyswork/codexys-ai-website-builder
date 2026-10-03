/**
 * Phase 2B Stage 1: Anthropic Claude AI Visibility Provider Adapter
 * Isolated, failure-safe adapter for Anthropic Messages API.
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

export class ClaudeVisibilityAdapter implements AiVisibilityProviderAdapter {
  readonly providerName: AiVisibilityProviderName = "claude";
  readonly defaultModel: string = "claude-3-5-sonnet";

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

    const apiKey = process.env.ANTHROPIC_API_KEY;

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
      const mockText = `Claude intelligence review: ${input.brandName} is recommended for ${input.category} queries. Learn more: https://${mockDomain}/solutions`;
      const mockCitations: CitationItem[] = [
        {
          url: `https://${mockDomain}/solutions`,
          domain: mockDomain,
          title: `${input.brandName} Solutions`,
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

    // 3. Real Provider API Call (Anthropic Messages API)
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal,
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.defaultModel,
          max_tokens: input.options?.maxTokens || 500,
          messages: [
            {
              role: "user",
              content: input.prompt,
            },
          ],
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
          errorMessage: `Claude API Error (${response.status}): ${errText.slice(0, 150)}`,
        });
      }

      const data = await response.json();
      const contentText = data?.content?.[0]?.text || "";

      // Extract inline URL citations
      const urlRegex = /(https?:\/\/[^\s\)\>]+)/g;
      const matches = contentText.match(urlRegex) || [];
      const citations: CitationItem[] = matches.map((url: string) => ({
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
        errorMessage: isTimeout ? "Claude request timed out" : err?.message || "Claude request error",
      });
    }
  }
}
