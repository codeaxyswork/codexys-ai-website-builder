/**
 * Phase 2B Stage 6B: AI Visibility Persistence Module
 * Safe, isolated database logging and historical analytics retrieval for AI Visibility probes.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  NormalizedAiVisibilityResponse,
  AiVisibilityProviderName,
  AiVisibilityPromptCategory,
  AiVisibilityResponseStatus,
} from "./types";

export interface HistoricalVisibilitySummary {
  totalProbes: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  brandMentionCount: number;
  brandMentionRate: number; // Percentage 0-100
  totalCitations: number;
  uniqueCitationDomains: string[];
  providerBreakdown: Record<
    AiVisibilityProviderName,
    {
      total: number;
      mentions: number;
      mentionRate: number;
      avgLatencyMs: number;
    }
  >;
  recentHistory: Array<{
    id: string;
    websiteId: string;
    userId: string;
    provider: AiVisibilityProviderName;
    modelName: string;
    prompt: string;
    promptCategory: AiVisibilityPromptCategory;
    brandName: string;
    brandMentioned: boolean;
    unpromptedMention: boolean;
    sentiment: "positive" | "neutral" | "negative";
    citationUrls: string[];
    citationDomains: string[];
    responseExcerpt: string | null;
    latencyMs: number;
    status: AiVisibilityResponseStatus;
    errorMessage: string | null;
    createdAt: string;
  }>;
}

/**
 * Safely persists normalized AI Visibility probe result(s) into `seo_ai_visibility_logs`.
 * Accepts authenticated websiteId & userId verified from server-side context.
 * Guarantees zero unhandled exceptions: Persistence failure NEVER fails the underlying probe response.
 */
export async function persistProbeResults(
  supabase: SupabaseClient,
  websiteId: string,
  userId: string,
  results: NormalizedAiVisibilityResponse | NormalizedAiVisibilityResponse[]
): Promise<boolean> {
  try {
    const list = Array.isArray(results) ? results : [results];
    if (list.length === 0) return true;

    const rows = list.map((res) => {
      const citationUrls = (res.citations || []).map((c) => c.url).filter(Boolean);
      const citationDomains =
        res.citationDomains && res.citationDomains.length > 0
          ? res.citationDomains
          : (res.citations || []).map((c) => c.domain).filter((d): d is string => Boolean(d));

      const excerpt = res.responseExcerpt
        ? res.responseExcerpt.slice(0, 300)
        : res.responseText
        ? res.responseText.slice(0, 300)
        : null;

      const errorMessage = res.errorMessage
        ? res.errorMessage.slice(0, 250)
        : null;

      return {
        website_id: websiteId,
        user_id: userId,
        provider: res.provider,
        model_name: res.model || "unknown",
        prompt: res.prompt || "",
        prompt_category: res.promptCategory || "informational",
        brand_name: res.brandName || "Brand",
        brand_mentioned: Boolean(res.brandMentioned),
        unprompted_mention: Boolean(res.unpromptedMention),
        sentiment: res.sentiment || "neutral",
        citation_urls: citationUrls,
        citation_domains: citationDomains,
        response_excerpt: excerpt,
        latency_ms: res.latencyMs || 0,
        status: res.status || "success",
        error_message: errorMessage,
      };
    });

    const { error } = await supabase.from("seo_ai_visibility_logs").insert(rows);

    if (error) {
      console.error("AI Visibility Persistence Warning:", error.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error("AI Visibility Persistence Exception:", err?.message || err);
    return false;
  }
}

/**
 * Retrieves historical AI visibility log records for a given website and aggregates metrics server-side.
 * Enforces RLS and tenant isolation.
 */
export async function getHistoricalVisibilityLogs(
  supabase: SupabaseClient,
  websiteId: string,
  limit = 50
): Promise<HistoricalVisibilitySummary> {
  const emptySummary: HistoricalVisibilitySummary = {
    totalProbes: 0,
    successCount: 0,
    failureCount: 0,
    timeoutCount: 0,
    brandMentionCount: 0,
    brandMentionRate: 0,
    totalCitations: 0,
    uniqueCitationDomains: [],
    providerBreakdown: {
      openai: { total: 0, mentions: 0, mentionRate: 0, avgLatencyMs: 0 },
      perplexity: { total: 0, mentions: 0, mentionRate: 0, avgLatencyMs: 0 },
      gemini: { total: 0, mentions: 0, mentionRate: 0, avgLatencyMs: 0 },
      claude: { total: 0, mentions: 0, mentionRate: 0, avgLatencyMs: 0 },
    },
    recentHistory: [],
  };

  try {
    const { data: rows, error } = await supabase
      .from("seo_ai_visibility_logs")
      .select("*")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !rows) {
      if (error) console.error("AI Visibility History Query Error:", error.message);
      return emptySummary;
    }

    const totalProbes = rows.length;
    if (totalProbes === 0) return emptySummary;

    let successCount = 0;
    let failureCount = 0;
    let timeoutCount = 0;
    let brandMentionCount = 0;
    let totalCitations = 0;

    const domainSet = new Set<string>();

    const providerStats: Record<
      AiVisibilityProviderName,
      { total: number; mentions: number; totalLatency: number }
    > = {
      openai: { total: 0, mentions: 0, totalLatency: 0 },
      perplexity: { total: 0, mentions: 0, totalLatency: 0 },
      gemini: { total: 0, mentions: 0, totalLatency: 0 },
      claude: { total: 0, mentions: 0, totalLatency: 0 },
    };

    const recentHistory = rows.map((r: any) => {
      if (r.status === "success") successCount++;
      else if (r.status === "timeout") timeoutCount++;
      else failureCount++;

      if (r.brand_mentioned) brandMentionCount++;

      const urls: string[] = r.citation_urls || [];
      const domains: string[] = r.citation_domains || [];

      totalCitations += urls.length;
      domains.forEach((d) => {
        if (d && d.trim()) domainSet.add(d.toLowerCase().trim());
      });

      const provider = (r.provider as AiVisibilityProviderName) || "openai";
      if (providerStats[provider]) {
        providerStats[provider].total++;
        if (r.brand_mentioned) providerStats[provider].mentions++;
        providerStats[provider].totalLatency += r.latency_ms || 0;
      }

      return {
        id: r.id,
        websiteId: r.website_id,
        userId: r.user_id,
        provider,
        modelName: r.model_name,
        prompt: r.prompt,
        promptCategory: r.prompt_category as AiVisibilityPromptCategory,
        brandName: r.brand_name,
        brandMentioned: r.brand_mentioned,
        unpromptedMention: r.unprompted_mention,
        sentiment: r.sentiment as "positive" | "neutral" | "negative",
        citationUrls: urls,
        citationDomains: domains,
        responseExcerpt: r.response_excerpt,
        latencyMs: r.latency_ms,
        status: r.status as AiVisibilityResponseStatus,
        errorMessage: r.error_message,
        createdAt: r.created_at,
      };
    });

    const brandMentionRate = Math.round((brandMentionCount / totalProbes) * 100);

    const providerBreakdown: HistoricalVisibilitySummary["providerBreakdown"] = {
      openai: {
        total: providerStats.openai.total,
        mentions: providerStats.openai.mentions,
        mentionRate:
          providerStats.openai.total > 0
            ? Math.round((providerStats.openai.mentions / providerStats.openai.total) * 100)
            : 0,
        avgLatencyMs:
          providerStats.openai.total > 0
            ? Math.round(providerStats.openai.totalLatency / providerStats.openai.total)
            : 0,
      },
      perplexity: {
        total: providerStats.perplexity.total,
        mentions: providerStats.perplexity.mentions,
        mentionRate:
          providerStats.perplexity.total > 0
            ? Math.round((providerStats.perplexity.mentions / providerStats.perplexity.total) * 100)
            : 0,
        avgLatencyMs:
          providerStats.perplexity.total > 0
            ? Math.round(providerStats.perplexity.totalLatency / providerStats.perplexity.total)
            : 0,
      },
      gemini: {
        total: providerStats.gemini.total,
        mentions: providerStats.gemini.mentions,
        mentionRate:
          providerStats.gemini.total > 0
            ? Math.round((providerStats.gemini.mentions / providerStats.gemini.total) * 100)
            : 0,
        avgLatencyMs:
          providerStats.gemini.total > 0
            ? Math.round(providerStats.gemini.totalLatency / providerStats.gemini.total)
            : 0,
      },
      claude: {
        total: providerStats.claude.total,
        mentions: providerStats.claude.mentions,
        mentionRate:
          providerStats.claude.total > 0
            ? Math.round((providerStats.claude.mentions / providerStats.claude.total) * 100)
            : 0,
        avgLatencyMs:
          providerStats.claude.total > 0
            ? Math.round(providerStats.claude.totalLatency / providerStats.claude.total)
            : 0,
      },
    };

    return {
      totalProbes,
      successCount,
      failureCount,
      timeoutCount,
      brandMentionCount,
      brandMentionRate,
      totalCitations,
      uniqueCitationDomains: Array.from(domainSet),
      providerBreakdown,
      recentHistory,
    };
  } catch (err: any) {
    console.error("AI Visibility History Execution Exception:", err?.message || err);
    return emptySummary;
  }
}
