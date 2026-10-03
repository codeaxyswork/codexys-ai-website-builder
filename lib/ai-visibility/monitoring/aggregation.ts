/**
 * Phase 3F & 3G: Historical Trend Analysis & Trend Change Detection
 * Server-side aggregation and measured change reporting across AI visibility monitoring periods.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { AiVisibilityProviderName, AiVisibilityResponseStatus } from "../types";
import { MonitoringRunResult, MonitoringTrendDelta } from "./types";

export interface AggregateMonitoringTrends {
  totalRuns: number;
  totalProbes: number;
  successProbes: number;
  failedProbes: number;
  timeoutProbes: number;
  brandMentionRate: number; // Percentage 0-100
  unpromptedMentionRate: number; // Percentage 0-100
  totalCitations: number;
  uniqueCitationDomains: string[];
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  providerMentionRates: Record<AiVisibilityProviderName, number>;
  providerCitationRates: Record<AiVisibilityProviderName, number>;
  latestRun: MonitoringRunResult | null;
  previousRun: MonitoringRunResult | null;
  trendDelta: MonitoringTrendDelta | null;
}

/**
 * Calculates measured trend delta between two monitoring runs.
 */
export function calculateTrendDelta(
  currentRun: MonitoringRunResult,
  previousRun: MonitoringRunResult | null
): MonitoringTrendDelta {
  if (!previousRun) {
    return {
      previousRunDate: null,
      currentRunDate: currentRun.completedAt,
      mentionRateChange: 0,
      citationCountChange: 0,
      uniqueDomainsChange: 0,
      providerStatus: {
        openai: currentRun.providerBreakdown?.openai?.status || "success",
        perplexity: currentRun.providerBreakdown?.perplexity?.status || "success",
        gemini: currentRun.providerBreakdown?.gemini?.status || "success",
        claude: currentRun.providerBreakdown?.claude?.status || "success",
      },
      providerMentionRates: {
        openai: { current: currentRun.providerBreakdown?.openai?.mentionRate || 0, previous: 0, delta: 0 },
        perplexity: { current: currentRun.providerBreakdown?.perplexity?.mentionRate || 0, previous: 0, delta: 0 },
        gemini: { current: currentRun.providerBreakdown?.gemini?.mentionRate || 0, previous: 0, delta: 0 },
        claude: { current: currentRun.providerBreakdown?.claude?.mentionRate || 0, previous: 0, delta: 0 },
      },
    };
  }

  const mentionRateChange = currentRun.brandMentionRate - previousRun.brandMentionRate;
  const citationCountChange = currentRun.citationsFound - previousRun.citationsFound;
  const uniqueDomainsChange = currentRun.uniqueDomainsCount - previousRun.uniqueDomainsCount;

  const providers: AiVisibilityProviderName[] = ["openai", "perplexity", "gemini", "claude"];
  const providerRates: Record<
    AiVisibilityProviderName,
    { current: number; previous: number; delta: number }
  > = {
    openai: { current: 0, previous: 0, delta: 0 },
    perplexity: { current: 0, previous: 0, delta: 0 },
    gemini: { current: 0, previous: 0, delta: 0 },
    claude: { current: 0, previous: 0, delta: 0 },
  };

  const providerStatus: Record<AiVisibilityProviderName, AiVisibilityResponseStatus> = {
    openai: currentRun.providerBreakdown?.openai?.status || "success",
    perplexity: currentRun.providerBreakdown?.perplexity?.status || "success",
    gemini: currentRun.providerBreakdown?.gemini?.status || "success",
    claude: currentRun.providerBreakdown?.claude?.status || "success",
  };

  for (const p of providers) {
    const curr = currentRun.providerBreakdown?.[p]?.mentionRate || 0;
    const prev = previousRun.providerBreakdown?.[p]?.mentionRate || 0;
    providerRates[p] = {
      current: curr,
      previous: prev,
      delta: curr - prev,
    };
  }

  return {
    previousRunDate: previousRun.completedAt,
    currentRunDate: currentRun.completedAt,
    mentionRateChange,
    citationCountChange,
    uniqueDomainsChange,
    providerStatus,
    providerMentionRates: providerRates,
  };
}

/**
 * Computes aggregated monitoring trends and historical deltas for a website.
 */
export async function getWebsiteMonitoringTrends(
  supabase: SupabaseClient,
  websiteId: string,
  limit: number = 20
): Promise<AggregateMonitoringTrends> {
  const defaultResult: AggregateMonitoringTrends = {
    totalRuns: 0,
    totalProbes: 0,
    successProbes: 0,
    failedProbes: 0,
    timeoutProbes: 0,
    brandMentionRate: 0,
    unpromptedMentionRate: 0,
    totalCitations: 0,
    uniqueCitationDomains: [],
    sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
    providerMentionRates: { openai: 0, perplexity: 0, gemini: 0, claude: 0 },
    providerCitationRates: { openai: 0, perplexity: 0, gemini: 0, claude: 0 },
    latestRun: null,
    previousRun: null,
    trendDelta: null,
  };

  try {
    // 1. Fetch recent monitoring run records
    const { data: runRows, error: runErr } = await supabase
      .from("ai_visibility_monitoring_runs")
      .select("*")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (runErr || !runRows || runRows.length === 0) {
      return defaultResult;
    }

    const runs: MonitoringRunResult[] = runRows.map((r: any) => ({
      id: r.id,
      configId: r.config_id || "",
      websiteId: r.website_id,
      userId: r.user_id,
      triggerType: r.trigger_type || "scheduled",
      status: r.status || "completed",
      totalProbes: r.total_probes || 0,
      successCount: r.success_count || 0,
      failureCount: r.failure_count || 0,
      timeoutCount: r.timeout_count || 0,
      brandMentionRate: r.brand_mention_rate || 0,
      citationsFound: r.citation_count !== undefined ? r.citation_count : (r.citations_found || 0),
      uniqueDomainsCount: r.unique_domains_count || 0,
      providerBreakdown: r.provider_breakdown || {},
      durationMs: r.duration_ms || 0,
      errorMessage: r.error_message,
      startedAt: r.created_at,
      completedAt: r.created_at,
    }));

    const latestRun = runs[0] || null;
    const previousRun = runs[1] || null;
    const trendDelta = latestRun ? calculateTrendDelta(latestRun, previousRun) : null;

    // Aggregate overall metrics across runs
    let totalProbes = 0;
    let successProbes = 0;
    let failedProbes = 0;
    let timeoutProbes = 0;
    let totalMentionProbes = 0;
    let totalCitations = 0;

    for (const run of runs) {
      totalProbes += run.totalProbes;
      successProbes += run.successCount;
      failedProbes += run.failureCount;
      timeoutProbes += run.timeoutCount;
      totalMentionProbes += Math.round((run.brandMentionRate / 100) * run.totalProbes);
      totalCitations += run.citationsFound;
    }

    const brandMentionRate = totalProbes > 0 ? Math.round((totalMentionProbes / totalProbes) * 100) : 0;

    // 2. Fetch probe log detail for domains & sentiment calculation
    const { data: logRows } = await supabase
      .from("seo_ai_visibility_logs")
      .select("sentiment, unprompted_mention, citation_domains, provider")
      .eq("website_id", websiteId)
      .limit(200);

    const domainSet = new Set<string>();
    let positiveCount = 0;
    let neutralCount = 0;
    let negativeCount = 0;
    let unpromptedCount = 0;

    const providerMentions: Record<AiVisibilityProviderName, number> = { openai: 0, perplexity: 0, gemini: 0, claude: 0 };
    const providerTotals: Record<AiVisibilityProviderName, number> = { openai: 0, perplexity: 0, gemini: 0, claude: 0 };
    const providerCitations: Record<AiVisibilityProviderName, number> = { openai: 0, perplexity: 0, gemini: 0, claude: 0 };

    if (logRows) {
      for (const log of logRows) {
        if (log.sentiment === "positive") positiveCount++;
        else if (log.sentiment === "negative") negativeCount++;
        else neutralCount++;

        if (log.unprompted_mention) unpromptedCount++;

        const domains: string[] = log.citation_domains || [];
        domains.forEach((d) => d && domainSet.add(d.toLowerCase().trim()));

        const p = log.provider as AiVisibilityProviderName;
        if (p && providerTotals[p] !== undefined) {
          providerTotals[p]++;
          if (domains.length > 0) providerCitations[p] += domains.length;
        }
      }
    }

    const totalLogs = logRows ? logRows.length : 0;
    const unpromptedMentionRate = totalLogs > 0 ? Math.round((unpromptedCount / totalLogs) * 100) : 0;

    const providerMentionRates: Record<AiVisibilityProviderName, number> = {
      openai: latestRun?.providerBreakdown?.openai?.mentionRate || 0,
      perplexity: latestRun?.providerBreakdown?.perplexity?.mentionRate || 0,
      gemini: latestRun?.providerBreakdown?.gemini?.mentionRate || 0,
      claude: latestRun?.providerBreakdown?.claude?.mentionRate || 0,
    };

    const providerCitationRates: Record<AiVisibilityProviderName, number> = {
      openai: providerTotals.openai > 0 ? Math.round((providerCitations.openai / providerTotals.openai) * 10) / 10 : 0,
      perplexity: providerTotals.perplexity > 0 ? Math.round((providerCitations.perplexity / providerTotals.perplexity) * 10) / 10 : 0,
      gemini: providerTotals.gemini > 0 ? Math.round((providerCitations.gemini / providerTotals.gemini) * 10) / 10 : 0,
      claude: providerTotals.claude > 0 ? Math.round((providerCitations.claude / providerTotals.claude) * 10) / 10 : 0,
    };

    return {
      totalRuns: runs.length,
      totalProbes,
      successProbes,
      failedProbes,
      timeoutProbes,
      brandMentionRate,
      unpromptedMentionRate,
      totalCitations,
      uniqueCitationDomains: Array.from(domainSet),
      sentimentDistribution: {
        positive: positiveCount,
        neutral: neutralCount,
        negative: negativeCount,
      },
      providerMentionRates,
      providerCitationRates,
      latestRun,
      previousRun,
      trendDelta,
    };
  } catch (err: any) {
    console.error("Aggregation Exception:", err?.message || err);
    return defaultResult;
  }
}
