import { createAdminClient, loadMetaConnection } from "./meta-client";
import { getNormalizedCampaignAnalytics, MarketingAnalyticsReport, NormalizedMetrics } from "./analytics-engine";

/**
 * Deterministic Cost Per Lead (CPL) Calculation
 * CPL = spend / attributed_leads
 * Rules:
 * - spend === 0 -> null
 * - leads === 0 -> null
 * - never divide by zero
 */
export function calculateCPL(spend: number, leads: number): number | null {
  if (!spend || spend <= 0 || !leads || leads <= 0) {
    return null;
  }
  return Number((spend / leads).toFixed(2));
}

/**
 * Service function to trigger server-side Meta insights synchronization
 */
export async function syncMetaCampaignInsights(
  supabase: any,
  websiteId: string,
  options?: { datePreset?: string; since?: string; until?: string }
): Promise<MarketingAnalyticsReport> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

  // 1. Fetch normalized campaign analytics report
  const report = await getNormalizedCampaignAnalytics(dbClient, websiteId, options);

  // 2. Additional sync logging if needed
  try {
    await dbClient.from("marketing_webhook_events").insert({
      provider: "meta_insights_sync",
      event_type: "performance_sync",
      payload_hash: `sync_${websiteId}_${Date.now()}`,
      raw_payload: { websiteId, datePreset: report.datePreset, summary: report.summary },
      status: "processed",
      processed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Sync logging warning:", err);
  }

  return report;
}

/**
 * Service function to retrieve campaign performance insights
 */
export async function getCampaignInsights(
  supabase: any,
  websiteId: string,
  options?: { datePreset?: string; since?: string; until?: string }
): Promise<MarketingAnalyticsReport> {
  return getNormalizedCampaignAnalytics(supabase, websiteId, options);
}
