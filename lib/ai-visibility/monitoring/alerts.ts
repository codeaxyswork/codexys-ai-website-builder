/**
 * Phase 3I: Alert Foundation & Deduplication System
 * Evaluates monitoring run results, detects negative trends or failures, and creates tenant-isolated alert logs.
 * Includes deduplication & cooldown safeguards (no spammy repeated notifications).
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { AiVisibilityProviderName } from "../types";
import { MonitoringRunResult, MonitoringAlert, AlertType, AlertSeverity } from "./types";

export interface AlertConditionCheck {
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metricName: string;
  previousValue?: number;
  currentValue?: number;
  changeDelta?: number;
}

/**
 * Evaluates a completed monitoring run against previous baseline and detects alert conditions.
 */
export function evaluateMonitoringAlertConditions(
  currentRun: MonitoringRunResult,
  previousRun: MonitoringRunResult | null
): AlertConditionCheck[] {
  const alerts: AlertConditionCheck[] = [];

  // 1. Overall Monitoring Execution Failure Check
  if (currentRun.status === "failed") {
    alerts.push({
      alertType: "execution_failure",
      severity: "critical",
      title: "Monitoring Execution Failed",
      message: currentRun.errorMessage || "Automated AI visibility monitoring run failed completely.",
      metricName: "execution_status",
    });
    return alerts; // Exit early on full failure
  }

  // 2. Significant Brand Mention Rate Decrease Check (Drop >= 10 percentage points)
  if (previousRun && previousRun.status !== "failed") {
    const mentionDrop = previousRun.brandMentionRate - currentRun.brandMentionRate;
    if (mentionDrop >= 10) {
      alerts.push({
        alertType: "mention_rate_drop",
        severity: mentionDrop >= 25 ? "critical" : "warning",
        title: "Significant Brand Mention Rate Decrease",
        message: `Brand mention rate decreased by ${mentionDrop}% (from ${previousRun.brandMentionRate}% to ${currentRun.brandMentionRate}%).`,
        metricName: "brand_mention_rate",
        previousValue: previousRun.brandMentionRate,
        currentValue: currentRun.brandMentionRate,
        changeDelta: -mentionDrop,
      });
    }

    // 3. Citation Count Decrease Check (Drop >= 30%)
    if (previousRun.citationsFound > 2) {
      const citationDrop = previousRun.citationsFound - currentRun.citationsFound;
      const pctDrop = Math.round((citationDrop / previousRun.citationsFound) * 100);
      if (pctDrop >= 30) {
        alerts.push({
          alertType: "citation_drop",
          severity: "warning",
          title: "Citation Count Drop",
          message: `Total AI citations dropped by ${pctDrop}% (${previousRun.citationsFound} -> ${currentRun.citationsFound}).`,
          metricName: "citations_found",
          previousValue: previousRun.citationsFound,
          currentValue: currentRun.citationsFound,
          changeDelta: -citationDrop,
        });
      }
    }
  }

  // 4. Provider-Specific Repeated Failures or Timeouts Check
  const providers: AiVisibilityProviderName[] = ["openai", "perplexity", "gemini", "claude"];
  for (const provider of providers) {
    const pData = currentRun.providerBreakdown?.[provider];
    if (pData) {
      if (pData.status === "failed") {
        alerts.push({
          alertType: "provider_repeated_failure",
          severity: "warning",
          title: `Provider ${provider.toUpperCase()} Failed`,
          message: `Provider '${provider}' experienced an execution failure during monitoring.`,
          metricName: `provider_${provider}_status`,
        });
      } else if (pData.status === "timeout") {
        alerts.push({
          alertType: "provider_timeout",
          severity: "warning",
          title: `Provider ${provider.toUpperCase()} Timed Out`,
          message: `Provider '${provider}' exceeded the strict execution timeout deadline.`,
          metricName: `provider_${provider}_timeout`,
        });
      }
    }
  }

  return alerts;
}

/**
 * Persists detected alerts into `ai_visibility_alerts` with 24-hour deduplication / cooldown safeguard.
 */
export async function processAndPersistAlerts(
  supabase: SupabaseClient,
  configId: string,
  websiteId: string,
  userId: string,
  runId: string,
  detectedAlerts: AlertConditionCheck[]
): Promise<MonitoringAlert[]> {
  if (detectedAlerts.length === 0) return [];

  const createdAlerts: MonitoringAlert[] = [];

  try {
    // Deduplication check window: 24 hours
    const cooldownWindow = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Query recent alerts for this website to prevent duplicate spam alerts
    const { data: recentAlerts } = await supabase
      .from("ai_visibility_alerts")
      .select("alert_type, title")
      .eq("website_id", websiteId)
      .gte("created_at", cooldownWindow);

    const existingKeys = new Set(
      (recentAlerts || []).map((a) => `${a.alert_type}:${a.title}`)
    );

    const rowsToInsert = [];

    for (const alert of detectedAlerts) {
      const key = `${alert.alertType}:${alert.title}`;
      if (!existingKeys.has(key)) {
        rowsToInsert.push({
          website_id: websiteId,
          user_id: userId,
          alert_type: alert.alertType,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          is_read: false,
        });
        existingKeys.add(key);
      }
    }

    if (rowsToInsert.length > 0) {
      const { data: inserted, error } = await supabase
        .from("ai_visibility_alerts")
        .insert(rowsToInsert)
        .select("*");

      if (error) {
        console.error("Alert Persistence Error:", error.message);
      } else if (inserted) {
        inserted.forEach((r: any) => {
          createdAlerts.push({
            id: r.id,
            configId: r.config_id || "",
            websiteId: r.website_id,
            userId: r.user_id,
            runId: r.run_id || "",
            alertType: r.alert_type,
            severity: r.severity,
            title: r.title,
            message: r.message,
            metricName: r.metric_name || r.alert_type,
            previousValue: r.previous_value,
            currentValue: r.current_value,
            changeDelta: r.change_delta,
            acknowledged: r.is_read || r.acknowledged || false,
            createdAt: r.created_at,
          });
        });
      }
    }

    return createdAlerts;
  } catch (err: any) {
    console.error("Alert Processing Exception:", err?.message || err);
    return [];
  }
}
