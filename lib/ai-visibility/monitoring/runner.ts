/**
 * Phase 3B: Scheduled Monitoring Runner Engine
 * Dedicated orchestration layer for running automated AI visibility probes.
 * Reuses existing provider adapters, engine, normalization, and persistence infrastructure.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  AiVisibilityProviderName,
  NormalizedAiVisibilityResponse,
  AiVisibilityResponseStatus,
} from "../types";
import { getProviderAdapter } from "../engine";
import { executeProviderProbeSafe } from "../provider-abstraction";
import { persistProbeResults } from "../persistence";
import { WebsiteAiVisibilityConfig, MonitoringRunResult } from "./types";
import { generateControlledMonitoringPrompts } from "./prompts";
import { acquireMonitoringLock, releaseMonitoringLock } from "./lock";
import { calculateNextRunAt } from "./config-manager";
import { evaluateMonitoringAlertConditions, processAndPersistAlerts } from "./alerts";

export interface ExecuteMonitoringRunOptions {
  triggerType?: "scheduled" | "manual";
  lockTtlSeconds?: number;
}

/**
 * Orchestrates an automated AI visibility monitoring run for a single website.
 * Guarantees zero duplicate execution via lock management and 100% failure isolation.
 */
export async function executeWebsiteMonitoringRun(
  supabase: SupabaseClient,
  config: WebsiteAiVisibilityConfig,
  options: ExecuteMonitoringRunOptions = {}
): Promise<MonitoringRunResult> {
  const triggerType = options.triggerType || "scheduled";
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  const emptyRunResult: MonitoringRunResult = {
    id: "",
    configId: config.id,
    websiteId: config.websiteId,
    userId: config.userId,
    triggerType,
    status: "failed",
    totalProbes: 0,
    successCount: 0,
    failureCount: 0,
    timeoutCount: 0,
    brandMentionRate: 0,
    citationsFound: 0,
    uniqueDomainsCount: 0,
    providerBreakdown: {
      openai: { probes: 0, mentions: 0, mentionRate: 0, avgLatencyMs: 0, status: "failed" },
      perplexity: { probes: 0, mentions: 0, mentionRate: 0, avgLatencyMs: 0, status: "failed" },
      gemini: { probes: 0, mentions: 0, mentionRate: 0, avgLatencyMs: 0, status: "failed" },
      claude: { probes: 0, mentions: 0, mentionRate: 0, avgLatencyMs: 0, status: "failed" },
    },
    durationMs: 0,
    errorMessage: null,
    startedAt,
    completedAt: startedAt,
  };

  // 1. Acquire execution lock to prevent overlapping runs for the same website
  const lockAcquired = await acquireMonitoringLock(config.websiteId, options.lockTtlSeconds || 300);
  if (!lockAcquired) {
    console.warn(`[MonitoringRunner] Overlapping run blocked for website ${config.websiteId}`);
    return {
      ...emptyRunResult,
      errorMessage: "Execution locked: A monitoring run is already in progress for this website.",
      completedAt: new Date().toISOString(),
    };
  }

  try {
    // 2. Resolve configured prompts and providers
    const targetProviders: AiVisibilityProviderName[] =
      config.selectedProviders.length > 0
        ? config.selectedProviders
        : ["openai", "perplexity", "gemini", "claude"];

    const controlledPrompts = generateControlledMonitoringPrompts(
      config.brandName,
      config.promptCategories,
      config.customPrompts,
      config.maxProbesPerExecution || 5
    );

    const probeInputs = controlledPrompts.map((cp) => ({
      websiteId: config.websiteId,
      userId: config.userId,
      brandName: config.brandName,
      prompt: cp.prompt,
      category: cp.category,
      options: { timeoutMs: 8000 },
    }));

    // 3. Dispatch probes across selected providers and prompts
    const allNormalizedResponses: NormalizedAiVisibilityResponse[] = [];

    for (const input of probeInputs) {
      const providerPromises = targetProviders.map(async (providerName) => {
        try {
          const adapter = getProviderAdapter(providerName);
          return await executeProviderProbeSafe(adapter, input);
        } catch (err: any) {
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
            errorMessage: err?.message || "Provider error",
          };
        }
      });

      const settled = await Promise.allSettled(providerPromises);
      settled.forEach((res, idx) => {
        if (res.status === "fulfilled") {
          allNormalizedResponses.push(res.value);
        } else {
          allNormalizedResponses.push({
            provider: targetProviders[idx],
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
            errorMessage: res.reason?.message || "Promise rejected",
          });
        }
      });
    }

    // 4. Reuse existing persistence module to insert logs into `seo_ai_visibility_logs`
    if (allNormalizedResponses.length > 0) {
      await persistProbeResults(supabase, config.websiteId, config.userId, allNormalizedResponses);
    }

    // 5. Aggregate metrics for this monitoring run
    const totalProbes = allNormalizedResponses.length;
    let successCount = 0;
    let failureCount = 0;
    let timeoutCount = 0;
    let brandMentionCount = 0;
    let citationsFound = 0;
    const domainSet = new Set<string>();

    const providerStats: Record<
      AiVisibilityProviderName,
      { probes: number; mentions: number; totalLatency: number; statuses: AiVisibilityResponseStatus[] }
    > = {
      openai: { probes: 0, mentions: 0, totalLatency: 0, statuses: [] },
      perplexity: { probes: 0, mentions: 0, totalLatency: 0, statuses: [] },
      gemini: { probes: 0, mentions: 0, totalLatency: 0, statuses: [] },
      claude: { probes: 0, mentions: 0, totalLatency: 0, statuses: [] },
    };

    for (const res of allNormalizedResponses) {
      if (res.status === "success") successCount++;
      else if (res.status === "timeout") timeoutCount++;
      else failureCount++;

      if (res.brandMentioned) brandMentionCount++;

      citationsFound += res.citations?.length || 0;
      (res.citationDomains || []).forEach((d) => d && domainSet.add(d.toLowerCase().trim()));

      if (providerStats[res.provider]) {
        providerStats[res.provider].probes++;
        if (res.brandMentioned) providerStats[res.provider].mentions++;
        providerStats[res.provider].totalLatency += res.latencyMs || 0;
        providerStats[res.provider].statuses.push(res.status);
      }
    }

    const brandMentionRate = totalProbes > 0 ? Math.round((brandMentionCount / totalProbes) * 100) : 0;
    const overallStatus: MonitoringRunResult["status"] =
      failureCount === 0 && timeoutCount === 0
        ? "completed"
        : successCount > 0
        ? "partial_failure"
        : "failed";

    const providerBreakdown: MonitoringRunResult["providerBreakdown"] = {
      openai: {
        probes: providerStats.openai.probes,
        mentions: providerStats.openai.mentions,
        mentionRate:
          providerStats.openai.probes > 0
            ? Math.round((providerStats.openai.mentions / providerStats.openai.probes) * 100)
            : 0,
        avgLatencyMs:
          providerStats.openai.probes > 0
            ? Math.round(providerStats.openai.totalLatency / providerStats.openai.probes)
            : 0,
        status: providerStats.openai.statuses.includes("success")
          ? "success"
          : providerStats.openai.statuses.includes("timeout")
          ? "timeout"
          : "failed",
      },
      perplexity: {
        probes: providerStats.perplexity.probes,
        mentions: providerStats.perplexity.mentions,
        mentionRate:
          providerStats.perplexity.probes > 0
            ? Math.round((providerStats.perplexity.mentions / providerStats.perplexity.probes) * 100)
            : 0,
        avgLatencyMs:
          providerStats.perplexity.probes > 0
            ? Math.round(providerStats.perplexity.totalLatency / providerStats.perplexity.probes)
            : 0,
        status: providerStats.perplexity.statuses.includes("success")
          ? "success"
          : providerStats.perplexity.statuses.includes("timeout")
          ? "timeout"
          : "failed",
      },
      gemini: {
        probes: providerStats.gemini.probes,
        mentions: providerStats.gemini.mentions,
        mentionRate:
          providerStats.gemini.probes > 0
            ? Math.round((providerStats.gemini.mentions / providerStats.gemini.probes) * 100)
            : 0,
        avgLatencyMs:
          providerStats.gemini.probes > 0
            ? Math.round(providerStats.gemini.totalLatency / providerStats.gemini.probes)
            : 0,
        status: providerStats.gemini.statuses.includes("success")
          ? "success"
          : providerStats.gemini.statuses.includes("timeout")
          ? "timeout"
          : "failed",
      },
      claude: {
        probes: providerStats.claude.probes,
        mentions: providerStats.claude.mentions,
        mentionRate:
          providerStats.claude.probes > 0
            ? Math.round((providerStats.claude.mentions / providerStats.claude.probes) * 100)
            : 0,
        avgLatencyMs:
          providerStats.claude.probes > 0
            ? Math.round(providerStats.claude.totalLatency / providerStats.claude.probes)
            : 0,
        status: providerStats.claude.statuses.includes("success")
          ? "success"
          : providerStats.claude.statuses.includes("timeout")
          ? "timeout"
          : "failed",
      },
    };

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    // 6. Record monitoring run log in `ai_visibility_monitoring_runs`
    const runPayload = {
      website_id: config.websiteId,
      user_id: config.userId,
      status: overallStatus,
      total_probes: totalProbes,
      success_count: successCount,
      failure_count: failureCount,
      brand_mention_count: brandMentionCount,
      brand_mention_rate: brandMentionRate,
      citation_count: citationsFound,
      unique_domains_count: domainSet.size,
      created_at: completedAt,
    };

    let runId = "";
    const { data: insertedRun, error: runInsertErr } = await supabase
      .from("ai_visibility_monitoring_runs")
      .insert(runPayload)
      .select("id")
      .single();

    if (runInsertErr) {
      console.error("[MonitoringRunner] Run Insertion Warning:", runInsertErr.message);
    } else if (insertedRun) {
      runId = insertedRun.id;
    }

    const runResult: MonitoringRunResult = {
      id: runId,
      configId: config.id,
      websiteId: config.websiteId,
      userId: config.userId,
      triggerType,
      status: overallStatus,
      totalProbes,
      successCount,
      failureCount,
      timeoutCount,
      brandMentionRate,
      citationsFound,
      uniqueDomainsCount: domainSet.size,
      providerBreakdown,
      durationMs,
      errorMessage: null,
      startedAt,
      completedAt,
    };

    // 7. Detect and persist alert conditions
    const detectedAlerts = evaluateMonitoringAlertConditions(runResult, null);
    if (detectedAlerts.length > 0 && runId) {
      await processAndPersistAlerts(
        supabase,
        config.id,
        config.websiteId,
        config.userId,
        runId,
        detectedAlerts
      );
    }

    // 8. Update config `last_run_at` and `next_run_at`
    const nextRunAt = calculateNextRunAt(config.frequency);
    await supabase
      .from("website_ai_visibility_configs")
      .update({
        last_run_at: completedAt,
        next_run_at: nextRunAt,
        updated_at: completedAt,
      })
      .eq("id", config.id);

    return runResult;
  } catch (err: any) {
    console.error("[MonitoringRunner] Run Exception:", err?.message || err);
    return {
      ...emptyRunResult,
      errorMessage: err?.message || "Execution exception",
      completedAt: new Date().toISOString(),
    };
  } finally {
    // 9. Guarantee lock release
    await releaseMonitoringLock(config.websiteId);
  }
}
