/**
 * Phase 2A: AI Visibility Types & Provider Interfaces
 * Core provider-independent definitions for LLM brand visibility intelligence.
 */

export type AiVisibilityProviderName = "openai" | "perplexity" | "gemini" | "claude";

export type AiVisibilityPromptCategory =
  | "informational"
  | "commercial"
  | "buyer_intent"
  | "local"
  | "competitor";

export type AiVisibilityResponseStatus =
  | "success"
  | "failed"
  | "timeout"
  | "rate_limited"
  | "auth_error";

export interface CitationItem {
  url: string;
  title?: string;
  snippet?: string;
  domain?: string;
}

export interface NormalizedAiVisibilityResponse {
  provider: AiVisibilityProviderName;
  model: string;
  prompt: string;
  promptCategory: AiVisibilityPromptCategory;
  responseText: string;
  responseExcerpt?: string;
  brandName: string;
  brandMentioned: boolean;
  unpromptedMention: boolean;
  sentiment: "positive" | "neutral" | "negative";
  citations: CitationItem[];
  citationDomains: string[];
  latencyMs: number;
  status: AiVisibilityResponseStatus;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface AiVisibilityProbeInput {
  websiteId: string;
  userId: string;
  brandName: string;
  prompt: string;
  category: AiVisibilityPromptCategory;
  options?: {
    timeoutMs?: number;
    maxTokens?: number;
  };
}

export interface AiVisibilityProviderAdapter {
  readonly providerName: AiVisibilityProviderName;
  readonly defaultModel: string;
  
  executeProbe(
    input: AiVisibilityProbeInput,
    signal?: AbortSignal
  ): Promise<NormalizedAiVisibilityResponse>;
}
