import { runOpportunityScan } from "./engine";
import { SEOAutopilotActivity, SEOAutopilotSettings } from "./types";

/**
 * Fetches or initializes SEO Autopilot settings for a website.
 */
export async function getAutopilotSettings(
  supabase: any,
  websiteId: string,
  userId: string
): Promise<SEOAutopilotSettings> {
  const { data: existing } = await supabase
    .from("seo_autopilot_settings")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  if (existing) {
    return existing as SEOAutopilotSettings;
  }

  // Default settings
  const defaultSettings: Partial<SEOAutopilotSettings> = {
    website_id: websiteId,
    user_id: userId,
    status: "active",
    scan_frequency: "weekly",
    auto_stage_safe_fixes: true,
    notify_on_critical: true,
    last_scanned_at: null,
    next_scan_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const { data: inserted, error } = await supabase
    .from("seo_autopilot_settings")
    .insert(defaultSettings)
    .select()
    .single();

  if (error || !inserted) {
    return {
      website_id: websiteId,
      user_id: userId,
      status: "active",
      scan_frequency: "weekly",
      auto_stage_safe_fixes: true,
      notify_on_critical: true,
    };
  }

  return inserted as SEOAutopilotSettings;
}

/**
 * Updates SEO Autopilot status & settings.
 */
export async function updateAutopilotSettings(
  supabase: any,
  websiteId: string,
  userId: string,
  updates: Partial<SEOAutopilotSettings>
): Promise<SEOAutopilotSettings> {
  // Ensure settings row exists
  await getAutopilotSettings(supabase, websiteId, userId);

  const { data, error } = await supabase
    .from("seo_autopilot_settings")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("website_id", websiteId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update Autopilot settings: ${error.message}`);
  }

  // Log activity event
  await logAutopilotActivity(supabase, websiteId, userId, {
    event_type: updates.status ? `autopilot_${updates.status}` : "settings_updated",
    title: updates.status
      ? `SEO Autopilot ${updates.status === "active" ? "Activated" : "Paused"}`
      : "SEO Autopilot Settings Updated",
    details: updates.status
      ? `Autopilot scanner status set to ${updates.status}.`
      : "Autopilot scan frequency and notification preferences updated.",
    metadata: updates,
  });

  return data as SEOAutopilotSettings;
}

/**
 * Runs an SEO Autopilot cycle:
 *   1. Scans for new opportunities (0 AI credits).
 *   2. Stages safe non-destructive recommendations.
 *   3. Logs cycle activity.
 */
export async function runAutopilotCycle(
  supabase: any,
  websiteId: string,
  userId: string
) {
  const settings = await getAutopilotSettings(supabase, websiteId, userId);

  if (settings.status === "paused") {
    return {
      status: "paused",
      message: "Autopilot is currently paused.",
      scanResult: null,
    };
  }

  // Run scanner
  const scanResult = await runOpportunityScan(supabase, websiteId, userId);

  // Update last scanned timestamp
  const now = new Date();
  const nextScan = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await supabase
    .from("seo_autopilot_settings")
    .update({
      last_scanned_at: now.toISOString(),
      next_scan_at: nextScan.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("website_id", websiteId);

  // Log scan completion activity
  await logAutopilotActivity(supabase, websiteId, userId, {
    event_type: "scan_completed",
    title: "SEO Autopilot Opportunity Scan Completed",
    details: `Scanned website architecture. Discovered ${scanResult.newDiscovered} new opportunity(ies). Total active opportunities: ${scanResult.opportunities.length}.`,
    metadata: {
      totalScanned: scanResult.totalScanned,
      newDiscovered: scanResult.newDiscovered,
      totalActive: scanResult.opportunities.length,
    },
  });

  return {
    status: "completed",
    lastScannedAt: now.toISOString(),
    nextScanAt: nextScan.toISOString(),
    scanResult,
  };
}

/**
 * Logs an event in the `seo_autopilot_activity` audit table.
 */
export async function logAutopilotActivity(
  supabase: any,
  websiteId: string,
  userId: string,
  activity: {
    event_type: string;
    title: string;
    details?: string;
    metadata?: Record<string, any>;
  }
): Promise<SEOAutopilotActivity | null> {
  const { data, error } = await supabase
    .from("seo_autopilot_activity")
    .insert({
      website_id: websiteId,
      user_id: userId,
      event_type: activity.event_type,
      title: activity.title,
      details: activity.details || null,
      metadata: activity.metadata || {},
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error("Failed to log Autopilot activity:", error);
    return null;
  }

  return data as SEOAutopilotActivity;
}
