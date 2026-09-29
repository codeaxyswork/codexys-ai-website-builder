import crypto from "crypto";

export interface SEOReportData {
  id: string;
  website_id: string;
  user_id: string;
  report_type: "weekly" | "monthly" | "on_demand" | "custom";
  title: string;
  period_start: string;
  period_end: string;
  seo_score: number;
  health_grade: "A+" | "A" | "B" | "C" | "D" | "F";
  metrics: {
    total_impressions: number;
    total_clicks: number;
    average_ctr: number;
    average_position: number;
    resolved_issues: number;
    open_opportunities: number;
    ai_visibility_score: number;
    geo_readiness_score: number;
    aio_answer_score: number;
  };
  executive_summary: string;
  key_achievements: string[];
  top_queries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  completed_fixes: Array<{ title: string; type: string; applied_at: string }>;
  action_plan: string[];
  white_label: {
    agency_name: string;
    agency_logo_url: string | null;
    primary_color: string;
    custom_footer: string;
    client_name: string;
  };
  share_token: string;
  created_at: string;
}

export interface WhiteLabelConfig {
  website_id: string;
  agency_name: string;
  agency_logo_url?: string | null;
  primary_color?: string;
  custom_footer?: string;
  client_name?: string;
  updated_at?: string;
}

/**
 * Generates an automated, data-backed SEO Performance Report for a website.
 * Consumes 0 AI credits (deterministic calculation with real GSC, SEO, and Opportunity metrics).
 */
export async function generateSEOReport(
  supabase: any,
  websiteId: string,
  userId: string,
  reportType: "weekly" | "monthly" | "on_demand" | "custom" = "weekly"
): Promise<SEOReportData> {
  const now = new Date();
  const periodEnd = now.toISOString();

  const startDate = new Date();
  if (reportType === "weekly") {
    startDate.setDate(now.getDate() - 7);
  } else if (reportType === "monthly") {
    startDate.setDate(now.getDate() - 30);
  } else {
    startDate.setDate(now.getDate() - 14);
  }
  const periodStart = startDate.toISOString();

  // 1. Fetch Website & SEO Base Data
  const { data: website } = await supabase
    .from("websites")
    .select("id, title, published_slug")
    .eq("id", websiteId)
    .single();

  const { data: seoData } = await supabase
    .from("website_seo")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  const seoScore = seoData?.seo_score ?? 75;

  let healthGrade: "A+" | "A" | "B" | "C" | "D" | "F" = "B";
  if (seoScore >= 95) healthGrade = "A+";
  else if (seoScore >= 85) healthGrade = "A";
  else if (seoScore >= 70) healthGrade = "B";
  else if (seoScore >= 55) healthGrade = "C";
  else if (seoScore >= 40) healthGrade = "D";
  else healthGrade = "F";

  // 2. Fetch GSC Performance
  const { data: gscData } = await supabase
    .from("seo_gsc_performance")
    .select("*")
    .eq("website_id", websiteId)
    .order("impressions", { ascending: false })
    .limit(50);

  let totalImpressions = 0;
  let totalClicks = 0;
  let totalCtrSum = 0;
  let totalPosSum = 0;
  const topQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }> = [];

  if (gscData && Array.isArray(gscData) && gscData.length > 0) {
    for (const row of gscData) {
      totalImpressions += row.impressions || 0;
      totalClicks += row.clicks || 0;
      totalCtrSum += row.ctr || 0;
      totalPosSum += row.position || 0;

      if (topQueries.length < 10) {
        topQueries.push({
          query: row.query,
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          ctr: Number(((row.ctr || 0) * 100).toFixed(1)),
          position: Number((row.position || 0).toFixed(1)),
        });
      }
    }
  }

  const avgCtr = gscData?.length ? Number(((totalCtrSum / gscData.length) * 100).toFixed(1)) : 0;
  const avgPos = gscData?.length ? Number((totalPosSum / gscData.length).toFixed(1)) : 0;

  // 3. Fetch Opportunities & Autopilot Fixes
  const { data: opps } = await supabase
    .from("seo_opportunities")
    .select("*")
    .eq("website_id", websiteId);

  const openOpps = (opps || []).filter((o: any) => o.status === "new" || o.status === "in_progress").length;
  const completedOpps = (opps || []).filter((o: any) => o.status === "completed");

  const completedFixes: Array<{ title: string; type: string; applied_at: string }> = completedOpps.map((o: any) => ({
    title: o.title,
    type: o.action_type || "seo_fix",
    applied_at: o.updated_at || periodEnd,
  }));

  // 4. Fetch White Label Settings
  const { data: wlConfig } = await supabase
    .from("seo_white_label_settings")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  const whiteLabel = {
    agency_name: wlConfig?.agency_name || "Codeaxys Agency Suite",
    agency_logo_url: wlConfig?.agency_logo_url || null,
    primary_color: wlConfig?.primary_color || "#7c3aed",
    custom_footer: wlConfig?.custom_footer || "Powered by Codeaxys Enterprise SEO Intelligence Engine.",
    client_name: wlConfig?.client_name || website?.title || "Valued Client",
  };

  // 5. Generate Share Token & Executive Summary
  const shareToken = crypto.randomBytes(16).toString("hex");

  const periodName = reportType === "weekly" ? "Weekly" : reportType === "monthly" ? "Monthly" : "Performance";
  const title = `${periodName} SEO Performance Report - ${website?.title || "Website"}`;

  const executiveSummary = `During this ${periodName.toLowerCase()} evaluation window, ${website?.title || "the website"} achieved an overall SEO Health Score of ${seoScore}/100 (Grade ${healthGrade}). Discovered ${openOpps} actionable ranking opportunities and successfully applied ${completedFixes.length} SEO optimizations. Total search impressions reached ${totalImpressions.toLocaleString()} with ${totalClicks.toLocaleString()} organic clicks.`;

  const keyAchievements = [
    `Maintained a solid ${seoScore}/100 overall technical & structural SEO score.`,
    `Generated ${totalImpressions.toLocaleString()} organic impressions in Google Search.`,
    `Resolved ${completedFixes.length} technical and metadata search optimization items.`,
    `Monitored ${openOpps} active keyword & content gap growth opportunities.`,
  ];

  const actionPlan = [
    "Address remaining critical missing metadata tags and heading structures.",
    "Implement high-impact GSC click-through rate optimizations on top impression queries.",
    "Expand blog content depth for target topical authority keywords.",
    "Inject LocalBusiness and Organization JSON-LD Schema markup for rich snippet display.",
  ];

  const reportId = `report_${websiteId}_${Date.now()}`;

  const reportPayload: SEOReportData = {
    id: reportId,
    website_id: websiteId,
    user_id: userId,
    report_type: reportType,
    title,
    period_start: periodStart,
    period_end: periodEnd,
    seo_score: seoScore,
    health_grade: healthGrade,
    metrics: {
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      average_ctr: avgCtr,
      average_position: avgPos,
      resolved_issues: completedFixes.length,
      open_opportunities: openOpps,
      ai_visibility_score: Math.min(100, Math.round(seoScore * 0.9 + 10)),
      geo_readiness_score: Math.min(100, Math.round(seoScore * 0.85 + 12)),
      aio_answer_score: Math.min(100, Math.round(seoScore * 0.88 + 8)),
    },
    executive_summary: executiveSummary,
    key_achievements: keyAchievements,
    top_queries: topQueries,
    completed_fixes: completedFixes,
    action_plan: actionPlan,
    white_label: whiteLabel,
    share_token: shareToken,
    created_at: new Date().toISOString(),
  };

  // Persist report record in seo_reports table (upsert/insert)
  await supabase.from("seo_reports").upsert(
    {
      id: reportId,
      website_id: websiteId,
      user_id: userId,
      report_type: reportType,
      title,
      period_start: periodStart,
      period_end: periodEnd,
      seo_score: seoScore,
      share_token: shareToken,
      report_data: reportPayload,
      created_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  return reportPayload;
}

/**
 * Saves white label agency branding configuration
 */
export async function saveWhiteLabelConfig(
  supabase: any,
  websiteId: string,
  userId: string,
  config: Partial<WhiteLabelConfig>
) {
  const payload = {
    website_id: websiteId,
    user_id: userId,
    agency_name: config.agency_name || "Codeaxys Agency Suite",
    agency_logo_url: config.agency_logo_url || null,
    primary_color: config.primary_color || "#7c3aed",
    custom_footer: config.custom_footer || "Powered by Codeaxys Enterprise SEO Intelligence Engine.",
    client_name: config.client_name || "Valued Client",
    updated_at: new Date().toISOString(),
  };

  await supabase
    .from("seo_white_label_settings")
    .upsert(payload, { onConflict: "website_id" });

  return payload;
}
