import { executeSEOAnalysis } from "./seo-job-processor";
import { analyzeInternalLinks } from "./internal-linking-engine";
import { analyzeLocalSEO } from "./local-seo-engine";

export interface MonitoringSchedule {
  id?: string;
  website_id: string;
  user_id: string;
  enabled: boolean;
  frequency: "manual" | "daily" | "weekly" | "monthly";
  preferred_hour: number;
  last_run_at: string | null;
  next_run_at: string | null;
  last_successful_run_at: string | null;
  last_failure_at: string | null;
  failure_count: number;
  last_error: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MonitoringAlertInput {
  website_id: string;
  user_id: string;
  event_type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  previous_value?: string | null;
  current_value?: string | null;
  affected_page?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Calculates the next run time based on schedule frequency and preferred hour UTC.
 */
export function calculateNextRunAt(
  frequency: "manual" | "daily" | "weekly" | "monthly",
  from: Date = new Date(),
  preferredHour: number = 3
): Date | null {
  if (frequency === "manual") return null;

  const next = new Date(from.getTime());
  if (frequency === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (frequency === "monthly") {
    next.setDate(next.getDate() + 30);
  }

  next.setUTCHours(preferredHour, 0, 0, 0);
  return next;
}

/**
 * Gets or initializes a website monitoring schedule.
 */
export async function getOrCreateMonitoringSchedule(
  supabase: any,
  websiteId: string,
  userId: string
): Promise<MonitoringSchedule> {
  const { data: existing, error } = await supabase
    .from("website_monitoring_schedules")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const defaultNextRun = calculateNextRunAt("weekly", new Date());

  const newSchedule: Partial<MonitoringSchedule> = {
    website_id: websiteId,
    user_id: userId,
    enabled: true,
    frequency: "weekly",
    preferred_hour: 3,
    next_run_at: defaultNextRun ? defaultNextRun.toISOString() : null,
    failure_count: 0,
  };

  const { data: created, error: createErr } = await supabase
    .from("website_monitoring_schedules")
    .insert(newSchedule)
    .select()
    .single();

  if (createErr) {
    console.error("Failed to create monitoring schedule:", createErr);
    // Return fallback in-memory object if database write had a transient issue
    return {
      website_id: websiteId,
      user_id: userId,
      enabled: true,
      frequency: "weekly",
      preferred_hour: 3,
      last_run_at: null,
      next_run_at: defaultNextRun ? defaultNextRun.toISOString() : null,
      last_successful_run_at: null,
      last_failure_at: null,
      failure_count: 0,
      last_error: null,
    };
  }

  return created;
}

/**
 * Persists a monitoring event alert while preventing duplicate alerts created within 24 hours.
 */
export async function createMonitoringAlert(
  supabase: any,
  alert: MonitoringAlertInput
): Promise<boolean> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Deduplication check: check for unread or recent identical event for website
  let query = supabase
    .from("seo_monitoring_events")
    .select("id")
    .eq("website_id", alert.website_id)
    .eq("event_type", alert.event_type)
    .gte("created_at", twentyFourHoursAgo);

  if (alert.affected_page) {
    query = query.eq("affected_page", alert.affected_page);
  }

  const { data: recentDups } = await query;
  if (recentDups && recentDups.length > 0) {
    // Skip creating duplicate alert
    return false;
  }

  const { error } = await supabase.from("seo_monitoring_events").insert({
    website_id: alert.website_id,
    user_id: alert.user_id,
    event_type: alert.event_type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    previous_value: alert.previous_value || null,
    current_value: alert.current_value || null,
    affected_page: alert.affected_page || null,
    metadata: alert.metadata || {},
    is_read: false,
  });

  if (error) {
    console.error("Failed to insert monitoring alert:", error);
    return false;
  }

  return true;
}

/**
 * Executes a full multi-category deterministic SEO monitoring audit for a website.
 * Costs 0 AI credits.
 */
export async function runMonitoringAuditForWebsite(
  supabase: any,
  websiteId: string,
  userId: string
) {
  // 1. Capture BEFORE state across all 5 monitoring categories
  const { data: oldSeo } = await supabase
    .from("website_seo")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  const { data: oldPageSeos } = await supabase
    .from("website_page_seo")
    .select("*")
    .eq("website_id", websiteId);

  const { data: oldLinksRow } = await supabase
    .from("website_internal_links")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  const { data: oldLocalRow } = await supabase
    .from("website_local_seo")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  const { data: oldGscRows } = await supabase
    .from("gsc_search_analytics")
    .select("clicks, impressions, ctr, position, date")
    .eq("website_id", websiteId)
    .order("date", { ascending: false })
    .limit(30);

  // 2. Execute Deterministic Engine Audits (0 AI credits)
  // A. Core SEO Analysis Engine (Phase 1)
  const coreSeoResult = await executeSEOAnalysis(supabase, websiteId, userId, "scheduled");

  // B. Internal Linking Engine Audit (Phase 7)
  const { data: pageRows } = await supabase
    .from("website_pages")
    .select("path, html_content, seo_title, focus_keywords")
    .eq("website_id", websiteId);

  const pagesList = (pageRows || []).map((p: any) => ({
    path: p.path,
    htmlContent: p.html_content || "",
    title: p.seo_title || p.path,
    focus_keywords: p.focus_keywords || [],
  }));

  const { data: blogRows } = await supabase
    .from("blog_posts")
    .select("title, slug, content, excerpt, category, tags, focus_keyword, status")
    .eq("website_id", websiteId)
    .eq("status", "published");

  const publishedBlogs = (blogRows || []).map((b: any) => ({
    title: b.title,
    slug: b.slug,
    content: b.content,
    excerpt: b.excerpt,
    category: b.category,
    tags: b.tags,
    focus_keyword: b.focus_keyword,
    status: b.status,
  }));

  const internalLinkResult = analyzeInternalLinks(pagesList, publishedBlogs);
  await supabase.from("website_internal_links").upsert(
    {
      website_id: websiteId,
      internal_link_score: internalLinkResult.internal_link_score,
      summary: internalLinkResult.summary,
      link_graph: internalLinkResult.link_graph,
      opportunities: internalLinkResult.opportunities,
      last_analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "website_id" }
  );

  // C. Local SEO Engine Audit (Phase 8)
  const profileData = oldLocalRow || { business_name: "", business_type: "LocalBusiness" };
  const localSeoResult = analyzeLocalSEO(profileData, pagesList);
  await supabase.from("website_local_seo").upsert(
    {
      website_id: websiteId,
      local_seo_score: localSeoResult.local_seo_score,
      analysis_result: localSeoResult,
      last_analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "website_id" }
  );

  // 3. Fetch AFTER state for comparison
  const { data: newPageSeos } = await supabase
    .from("website_page_seo")
    .select("*")
    .eq("website_id", websiteId);

  const { data: newGscRows } = await supabase
    .from("gsc_search_analytics")
    .select("clicks, impressions, ctr, position, date")
    .eq("website_id", websiteId)
    .order("date", { ascending: false })
    .limit(30);

  // 4. Change Detection Logic & Event Alerts Generation
  const alertsGenerated: string[] = [];

  // A. Core SEO Score Changes
  const oldScore = oldSeo?.seo_score ?? null;
  const newScore = coreSeoResult.seo_score;
  if (oldScore !== null && newScore < oldScore - 4) {
    const scoreDrop = oldScore - newScore;
    const severity = scoreDrop >= 10 ? "critical" : "warning";
    const alertCreated = await createMonitoringAlert(supabase, {
      website_id: websiteId,
      user_id: userId,
      event_type: "seo_score_drop",
      severity,
      title: `SEO Score Dropped by ${scoreDrop} Points`,
      message: `Website overall SEO score decreased from ${oldScore} → ${newScore}. Review critical issues to regain performance.`,
      previous_value: String(oldScore),
      current_value: String(newScore),
    });
    if (alertCreated) alertsGenerated.push("seo_score_drop");
  }

  // Critical Issues Count Increased
  const oldCritical = oldSeo?.critical_issues_count ?? 0;
  const newCritical = coreSeoResult.issue_counts.critical;
  if (newCritical > oldCritical) {
    const diff = newCritical - oldCritical;
    const alertCreated = await createMonitoringAlert(supabase, {
      website_id: websiteId,
      user_id: userId,
      event_type: oldCritical === 0 ? "critical_issue_detected" : "critical_issue_increased",
      severity: "critical",
      title: `${diff} New Critical SEO Issue(s) Detected`,
      message: `Critical SEO issues increased from ${oldCritical} → ${newCritical}. Immediate attention recommended.`,
      previous_value: String(oldCritical),
      current_value: String(newCritical),
    });
    if (alertCreated) alertsGenerated.push("critical_issue_detected");
  }

  // B. Page Level Changes (Robots, Canonical, Schema, Removed Pages)
  if (oldPageSeos && oldPageSeos.length > 0) {
    const oldPageMap = new Map<string, any>(oldPageSeos.map((p: any) => [p.path, p]));
    const newPageMap = new Map<string, any>((newPageSeos || []).map((p: any) => [p.path, p]));

    // Check for removed pages
    for (const [path, oldPage] of oldPageMap.entries()) {
      if (!newPageMap.has(path)) {
        const alertCreated = await createMonitoringAlert(supabase, {
          website_id: websiteId,
          user_id: userId,
          event_type: "important_page_removed",
          severity: "warning",
          title: `Page Removed: ${path}`,
          message: `Page ${path} was removed from the website structure. Verify redirect configurations.`,
          affected_page: path,
          previous_value: "Active",
          current_value: "Deleted",
        });
        if (alertCreated) alertsGenerated.push("important_page_removed");
      }
    }

    // Check individual page state changes
    for (const [path, newPage] of newPageMap.entries()) {
      const oldPage = oldPageMap.get(path);
      if (!oldPage) continue;

      // Robots directive changed to noindex
      if (oldPage.robots_index === true && newPage.robots_index === false) {
        const alertCreated = await createMonitoringAlert(supabase, {
          website_id: websiteId,
          user_id: userId,
          event_type: "robots_changed",
          severity: "critical",
          title: `Page Marked Noindex: ${path}`,
          message: `Robots directive for ${path} was changed to noindex, preventing search engines from indexing this page.`,
          affected_page: path,
          previous_value: "index",
          current_value: "noindex",
        });
        if (alertCreated) alertsGenerated.push("robots_changed");
      }

      // Canonical URL changed
      if (oldPage.canonical_url && newPage.canonical_url && oldPage.canonical_url !== newPage.canonical_url) {
        const alertCreated = await createMonitoringAlert(supabase, {
          website_id: websiteId,
          user_id: userId,
          event_type: "canonical_changed",
          severity: "warning",
          title: `Canonical URL Changed on ${path}`,
          message: `Canonical URL changed from "${oldPage.canonical_url}" to "${newPage.canonical_url}".`,
          affected_page: path,
          previous_value: oldPage.canonical_url,
          current_value: newPage.canonical_url,
        });
        if (alertCreated) alertsGenerated.push("canonical_changed");
      }

      // Schema markup disappeared
      const oldHasSchema = oldPage.schema_markup && Object.keys(oldPage.schema_markup).length > 0;
      const newHasSchema = newPage.schema_markup && Object.keys(newPage.schema_markup).length > 0;
      if (oldHasSchema && !newHasSchema) {
        const alertCreated = await createMonitoringAlert(supabase, {
          website_id: websiteId,
          user_id: userId,
          event_type: "schema_changed",
          severity: "warning",
          title: `Schema Structured Data Missing on ${path}`,
          message: `Structured JSON-LD schema markup was removed or cleared on ${path}.`,
          affected_page: path,
          previous_value: "Configured",
          current_value: "Missing",
        });
        if (alertCreated) alertsGenerated.push("schema_changed");
      }
    }
  }

  // C. Internal Linking Changes
  const oldBroken = oldLinksRow?.summary?.broken_links_count || 0;
  const newBroken = internalLinkResult.summary.broken_links_count;
  if (newBroken > oldBroken && newBroken > 0) {
    const alertCreated = await createMonitoringAlert(supabase, {
      website_id: websiteId,
      user_id: userId,
      event_type: "broken_internal_links_detected",
      severity: "critical",
      title: `${newBroken} Broken Internal Link(s) Detected`,
      message: `Found ${newBroken} broken internal links across website pages and published blog content.`,
      previous_value: String(oldBroken),
      current_value: String(newBroken),
    });
    if (alertCreated) alertsGenerated.push("broken_internal_links_detected");
  }

  const oldOrphan = oldLinksRow?.summary?.orphan_pages_count || 0;
  const newOrphan = internalLinkResult.summary.orphan_pages_count;
  if (newOrphan > oldOrphan && newOrphan > 0) {
    const alertCreated = await createMonitoringAlert(supabase, {
      website_id: websiteId,
      user_id: userId,
      event_type: "orphan_page_detected",
      severity: "warning",
      title: `${newOrphan} Orphan Page(s) Detected`,
      message: `${newOrphan} page(s) have no incoming internal links from other website pages.`,
      previous_value: String(oldOrphan),
      current_value: String(newOrphan),
    });
    if (alertCreated) alertsGenerated.push("orphan_page_detected");
  }

  const oldLinkScore = oldLinksRow?.internal_link_score ?? null;
  const newLinkScore = internalLinkResult.internal_link_score;
  if (oldLinkScore !== null && newLinkScore < oldLinkScore - 9) {
    const alertCreated = await createMonitoringAlert(supabase, {
      website_id: websiteId,
      user_id: userId,
      event_type: "internal_link_score_drop",
      severity: "warning",
      title: `Internal Linking Score Dropped by ${oldLinkScore - newLinkScore} Points`,
      message: `Internal link architecture score dropped from ${oldLinkScore} → ${newLinkScore}.`,
      previous_value: String(oldLinkScore),
      current_value: String(newLinkScore),
    });
    if (alertCreated) alertsGenerated.push("internal_link_score_drop");
  }

  // D. Local SEO Changes
  const oldLocalScore = oldLocalRow?.local_seo_score ?? null;
  const newLocalScore = localSeoResult.local_seo_score;
  if (oldLocalScore !== null && newLocalScore < oldLocalScore - 9) {
    const alertCreated = await createMonitoringAlert(supabase, {
      website_id: websiteId,
      user_id: userId,
      event_type: "local_seo_score_drop",
      severity: "warning",
      title: `Local SEO Score Dropped by ${oldLocalScore - newLocalScore} Points`,
      message: `Local SEO health score dropped from ${oldLocalScore} → ${newLocalScore}.`,
      previous_value: String(oldLocalScore),
      current_value: String(newLocalScore),
    });
    if (alertCreated) alertsGenerated.push("local_seo_score_drop");
  }

  const newNapIssues = localSeoResult.issues.filter((i: any) => i.category === "NAP");
  if (newNapIssues.length > 0 && (!oldLocalRow || (oldLocalRow.analysis_result?.issues || []).filter((i: any) => i.category === "NAP").length === 0)) {
    const alertCreated = await createMonitoringAlert(supabase, {
      website_id: websiteId,
      user_id: userId,
      event_type: "local_nap_issue",
      severity: "warning",
      title: `Local NAP Consistency Issue Detected`,
      message: `Business Name, Address, or Phone (NAP) is incomplete or inconsistent with HTML landing pages.`,
      previous_value: "Consistent",
      current_value: `${newNapIssues.length} issue(s)`,
    });
    if (alertCreated) alertsGenerated.push("local_nap_issue");
  }

  // E. Google Search Console Performance Changes
  if (oldGscRows && newGscRows && oldGscRows.length >= 14 && newGscRows.length >= 7) {
    const recentClicks = newGscRows.slice(0, 7).reduce((sum: number, r: any) => sum + (r.clicks || 0), 0);
    const prevClicks = oldGscRows.slice(7, 14).reduce((sum: number, r: any) => sum + (r.clicks || 0), 0);

    if (prevClicks >= 20 && recentClicks < prevClicks * 0.85) {
      const dropPct = Math.round(((prevClicks - recentClicks) / prevClicks) * 100);
      const alertCreated = await createMonitoringAlert(supabase, {
        website_id: websiteId,
        user_id: userId,
        event_type: "gsc_performance_drop",
        severity: dropPct >= 30 ? "critical" : "warning",
        title: `Google Search Console Clicks Dropped by ${dropPct}%`,
        message: `Weekly organic clicks dropped from ${prevClicks} → ${recentClicks}.`,
        previous_value: `${prevClicks} clicks/wk`,
        current_value: `${recentClicks} clicks/wk`,
      });
      if (alertCreated) alertsGenerated.push("gsc_performance_drop");
    }
  }

  return {
    websiteId,
    coreSeoScore: coreSeoResult.seo_score,
    internalLinkScore: internalLinkResult.internal_link_score,
    localSeoScore: localSeoResult.local_seo_score,
    alertsGenerated,
  };
}

/**
 * Processes scheduled monitoring jobs in safe, bounded batches.
 * Idempotent, concurrency-safe, and bounded retry count.
 */
export async function processScheduledMonitoringBatch(
  supabase: any,
  batchLimit: number = 5
) {
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Fetch websites due for scheduled monitoring
  const { data: dueSchedules, error: fetchErr } = await supabase
    .from("website_monitoring_schedules")
    .select("*")
    .eq("enabled", true)
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(batchLimit);

  if (fetchErr) {
    console.error("Failed to query due monitoring schedules:", fetchErr);
    return { processed: 0, errors: [fetchErr.message] };
  }

  if (!dueSchedules || dueSchedules.length === 0) {
    return { processed: 0, errors: [] };
  }

  const results: Array<{ websiteId: string; status: "success" | "failed"; error?: string }> = [];

  for (const schedule of dueSchedules) {
    const websiteId = schedule.website_id;
    const userId = schedule.user_id;

    // 2. ATOMIC CLAIM MECHANISM:
    // Pushes next_run_at 15 minutes into the future atomically using WHERE next_run_at <= nowIso.
    // If a concurrent worker claims this schedule first, this update will match 0 rows and return null.
    const temporaryLockTime = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    const { data: claimedSchedule, error: claimErr } = await supabase
      .from("website_monitoring_schedules")
      .update({
        next_run_at: temporaryLockTime,
        updated_at: nowIso,
      })
      .eq("id", schedule.id)
      .lte("next_run_at", nowIso)
      .select()
      .maybeSingle();

    if (claimErr || !claimedSchedule) {
      // Skip schedule: another concurrent worker claimed it first
      continue;
    }

    try {
      // Deduplication Check: Check if an active scheduled job is already queued/running for this site
      const { data: existingJob } = await supabase
        .from("seo_analysis_jobs")
        .select("id")
        .eq("website_id", websiteId)
        .in("status", ["queued", "processing"])
        .maybeSingle();

      if (existingJob) {
        continue;
      }

      // Run full deterministic monitoring audit (0 AI credits)
      await runMonitoringAuditForWebsite(supabase, websiteId, userId);

      // Update schedule record on success with next calculated run date
      const nextRun = calculateNextRunAt(schedule.frequency, now, schedule.preferred_hour || 3);
      await supabase
        .from("website_monitoring_schedules")
        .update({
          last_run_at: nowIso,
          last_successful_run_at: nowIso,
          next_run_at: nextRun ? nextRun.toISOString() : null,
          failure_count: 0,
          last_error: null,
          updated_at: nowIso,
        })
        .eq("id", schedule.id);

      results.push({ websiteId, status: "success" });
    } catch (err: any) {
      console.error(`Scheduled monitoring failed for website ${websiteId}:`, err);
      const safeErr = err.message || "Scheduled monitoring error";
      const newFailCount = (schedule.failure_count || 0) + 1;

      // Bounded retries: If failed < 3 times, retry in 1 hour. Else push to next normal schedule.
      let retryNextRun: Date | null;
      if (newFailCount < 3) {
        retryNextRun = new Date(now.getTime() + 60 * 60 * 1000); // Retry in 1 hour
      } else {
        retryNextRun = calculateNextRunAt(schedule.frequency, now, schedule.preferred_hour || 3);
      }

      await supabase
        .from("website_monitoring_schedules")
        .update({
          last_run_at: nowIso,
          last_failure_at: nowIso,
          failure_count: newFailCount,
          last_error: safeErr,
          next_run_at: retryNextRun ? retryNextRun.toISOString() : null,
          updated_at: nowIso,
        })
        .eq("id", schedule.id);

      results.push({ websiteId, status: "failed", error: safeErr });
    }
  }

  return { processed: results.length, results };
}
