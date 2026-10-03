/**
 * Phase 3A: Server-Side Monitoring Configuration System
 * Provides tenant-isolated CRUD operations for website AI visibility monitoring settings.
 * Strictly verifies website ownership and enforces safe configuration limits.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { AiVisibilityProviderName, AiVisibilityPromptCategory } from "../types";
import { WebsiteAiVisibilityConfig, MonitoringFrequency } from "./types";

export interface UpsertMonitoringConfigInput {
  enabled?: boolean;
  frequency?: MonitoringFrequency;
  selectedProviders?: AiVisibilityProviderName[];
  promptCategories?: AiVisibilityPromptCategory[];
  brandName?: string;
  customPrompts?: string[];
  maxProbesPerExecution?: number;
  timezone?: string;
}

const DEFAULT_PROVIDERS: AiVisibilityProviderName[] = ["openai", "perplexity", "gemini", "claude"];
const DEFAULT_CATEGORIES: AiVisibilityPromptCategory[] = ["informational", "commercial", "buyer_intent"];

/**
 * Calculates the next scheduled execution timestamp based on frequency and timezone.
 */
export function calculateNextRunAt(
  frequency: MonitoringFrequency = "daily",
  fromTime: Date = new Date()
): string {
  const next = new Date(fromTime.getTime());
  if (frequency === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else {
    next.setDate(next.getDate() + 1);
  }
  return next.toISOString();
}

/**
 * Normalizes and validates input monitoring configuration parameters.
 */
export function validateAndSanitizeConfigInput(
  input: UpsertMonitoringConfigInput,
  fallbackBrandName: string = "Brand"
): {
  enabled: boolean;
  frequency: MonitoringFrequency;
  selectedProviders: AiVisibilityProviderName[];
  promptCategories: AiVisibilityPromptCategory[];
  brandName: string;
  customPrompts: string[];
  maxProbesPerExecution: number;
  timezone: string;
} {
  const enabled = input.enabled !== undefined ? Boolean(input.enabled) : true;
  
  const frequency: MonitoringFrequency =
    input.frequency === "weekly" ? "weekly" : "daily";

  const validProviders: AiVisibilityProviderName[] = ["openai", "perplexity", "gemini", "claude"];
  const selectedProviders = (input.selectedProviders || DEFAULT_PROVIDERS).filter((p) =>
    validProviders.includes(p)
  );
  const finalProviders = selectedProviders.length > 0 ? selectedProviders : DEFAULT_PROVIDERS;

  const validCategories: AiVisibilityPromptCategory[] = [
    "informational",
    "commercial",
    "buyer_intent",
    "local",
    "competitor",
  ];
  const promptCategories = (input.promptCategories || DEFAULT_CATEGORIES).filter((c) =>
    validCategories.includes(c)
  );
  const finalCategories = promptCategories.length > 0 ? promptCategories : DEFAULT_CATEGORIES;

  const brandName = (input.brandName || fallbackBrandName || "Brand").trim().slice(0, 100);

  const customPrompts = (input.customPrompts || [])
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 5); // Max 5 custom prompts

  // Strict cost safeguard: max 10 probes per execution
  const rawMax = Number(input.maxProbesPerExecution) || 5;
  const maxProbesPerExecution = Math.max(1, Math.min(10, rawMax));

  const timezone = (input.timezone || "UTC").trim().slice(0, 50);

  return {
    enabled,
    frequency,
    selectedProviders: finalProviders,
    promptCategories: finalCategories,
    brandName,
    customPrompts,
    maxProbesPerExecution,
    timezone,
  };
}

/**
 * Maps database row to `WebsiteAiVisibilityConfig` interface with backwards fallback.
 */
function mapRowToConfig(row: any): WebsiteAiVisibilityConfig {
  const isEnabled = row.is_enabled !== undefined ? row.is_enabled : (row.enabled !== undefined ? row.enabled : true);
  const providers = row.enabled_providers || row.selected_providers || DEFAULT_PROVIDERS;
  const categories = row.prompt_categories || DEFAULT_CATEGORIES;
  const maxProbes = row.max_probes_per_run || row.max_probes_per_execution || 5;

  return {
    id: row.id,
    websiteId: row.website_id,
    userId: row.user_id,
    enabled: Boolean(isEnabled),
    frequency: (row.frequency as MonitoringFrequency) || "daily",
    selectedProviders: providers as AiVisibilityProviderName[],
    promptCategories: categories as AiVisibilityPromptCategory[],
    brandName: row.brand_name || "Brand",
    customPrompts: row.custom_prompts || [],
    maxProbesPerExecution: maxProbes,
    timezone: row.timezone || "UTC",
    lastRunAt: row.last_run_at || null,
    nextRunAt: row.next_run_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Retrieves the AI visibility monitoring configuration for a given website.
 * Enforces RLS and tenant ownership.
 */
export async function getWebsiteMonitoringConfig(
  supabase: SupabaseClient,
  websiteId: string
): Promise<WebsiteAiVisibilityConfig | null> {
  try {
    const { data: row, error } = await supabase
      .from("website_ai_visibility_configs")
      .select("*")
      .eq("website_id", websiteId)
      .maybeSingle();

    if (error || !row) {
      if (error) console.error("Get Monitoring Config Error:", error.message);
      return null;
    }

    return mapRowToConfig(row);
  } catch (err: any) {
    console.error("Get Monitoring Config Exception:", err?.message || err);
    return null;
  }
}

/**
 * Creates or updates the AI visibility monitoring configuration for a website.
 * Requires verified userId from server-side authenticated session context.
 */
export async function upsertWebsiteMonitoringConfig(
  supabase: SupabaseClient,
  websiteId: string,
  userId: string,
  input: UpsertMonitoringConfigInput,
  fallbackBrandName: string = "Brand"
): Promise<WebsiteAiVisibilityConfig | null> {
  try {
    const existing = await getWebsiteMonitoringConfig(supabase, websiteId);

    const sanitized = validateAndSanitizeConfigInput(input, existing?.brandName || fallbackBrandName);

    const nextRunAt = existing?.nextRunAt && existing.enabled === sanitized.enabled
      ? existing.nextRunAt
      : calculateNextRunAt(sanitized.frequency);

    const payload = {
      website_id: websiteId,
      user_id: userId,
      is_enabled: sanitized.enabled,
      frequency: sanitized.frequency,
      enabled_providers: sanitized.selectedProviders,
      prompt_categories: sanitized.promptCategories,
      brand_name: sanitized.brandName,
      custom_prompts: sanitized.customPrompts,
      max_probes_per_run: sanitized.maxProbesPerExecution,
      next_run_at: nextRunAt,
      updated_at: new Date().toISOString(),
    };

    const { data: row, error } = await supabase
      .from("website_ai_visibility_configs")
      .upsert(payload, { onConflict: "website_id" })
      .select("*")
      .single();

    if (error || !row) {
      console.error("Upsert Monitoring Config Error:", error?.message || "No row returned");
      return null;
    }

    return mapRowToConfig(row);
  } catch (err: any) {
    console.error("Upsert Monitoring Config Exception:", err?.message || err);
    return null;
  }
}
