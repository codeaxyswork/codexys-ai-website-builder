/**
 * Phase 3: AI Visibility Automated Monitoring Types
 * Defines data structures for monitoring configuration, execution runs, trend deltas, and alerts.
 */

import {
  AiVisibilityProviderName,
  AiVisibilityPromptCategory,
  AiVisibilityResponseStatus,
} from "../types";

export type MonitoringFrequency = "daily" | "weekly";

export interface WebsiteAiVisibilityConfig {
  id: string;
  websiteId: string;
  userId: string;
  enabled: boolean;
  frequency: MonitoringFrequency;
  selectedProviders: AiVisibilityProviderName[];
  promptCategories: AiVisibilityPromptCategory[];
  brandName: string;
  customPrompts: string[];
  maxProbesPerExecution: number;
  timezone: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonitoringRunResult {
  id: string;
  configId: string;
  websiteId: string;
  userId: string;
  triggerType: "scheduled" | "manual";
  status: "completed" | "partial_failure" | "failed";
  totalProbes: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  brandMentionRate: number; // 0-100%
  citationsFound: number;
  uniqueDomainsCount: number;
  providerBreakdown: Record<
    AiVisibilityProviderName,
    {
      probes: number;
      mentions: number;
      mentionRate: number;
      avgLatencyMs: number;
      status: AiVisibilityResponseStatus;
    }
  >;
  durationMs: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string;
}

export interface MonitoringTrendDelta {
  previousRunDate: string | null;
  currentRunDate: string;
  mentionRateChange: number; // e.g. +16 or -10 percentage points
  citationCountChange: number; // e.g. +4 or -2
  uniqueDomainsChange: number;
  providerStatus: Record<AiVisibilityProviderName, AiVisibilityResponseStatus>;
  providerMentionRates: Record<AiVisibilityProviderName, { current: number; previous: number; delta: number }>;
}

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertType =
  | "mention_rate_drop"
  | "provider_repeated_failure"
  | "provider_timeout"
  | "citation_drop"
  | "execution_failure";

export interface MonitoringAlert {
  id: string;
  configId: string;
  websiteId: string;
  userId: string;
  runId?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metricName: string;
  previousValue?: number;
  currentValue?: number;
  changeDelta?: number;
  acknowledged: boolean;
  createdAt: string;
}

export interface MonitoringExecutionLimits {
  MAX_PROMPTS_PER_RUN: number;
  MAX_PROVIDERS_PER_RUN: number;
  MAX_RUNS_PER_DAY: number;
  PROVIDER_TIMEOUT_MS: number;
}
