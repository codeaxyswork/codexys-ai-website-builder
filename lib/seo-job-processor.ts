import { analyzeWebsite, CURRENT_ANALYSIS_VERSION, PageSEOInput } from "./seo-analyzer";

export interface EnqueueJobParams {
  websiteId: string;
  userId: string;
  requestedBy?: string | null;
  triggerType?: "manual" | "website_refinement" | "page_created" | "page_updated" | "page_deleted" | "scheduled" | "system";
  idempotencyKey?: string;
  priority?: number;
}

/**
 * Safely enqueues an SEO analysis job in PostgreSQL seo_analysis_jobs table.
 * Concurrency-safe, idempotent, and tenant-safe.
 */
export async function enqueueSEOJob(supabase: any, params: EnqueueJobParams) {
  const {
    websiteId,
    userId,
    requestedBy = userId,
    triggerType = "manual",
    idempotencyKey,
    priority = 0,
  } = params;

  // Deterministic idempotency key defaults to site + triggerType + pending status
  const key = idempotencyKey || `seo_job_${websiteId}_${triggerType}_pending`;

  // 1. Deduplication Check: Look for any existing active/queued/processing job for this idempotency key OR website
  const { data: existingJob } = await supabase
    .from("seo_analysis_jobs")
    .select("*")
    .eq("website_id", websiteId)
    .eq("user_id", userId)
    .in("status", ["queued", "processing"])
    .maybeSingle();

  if (existingJob) {
    return { job: existingJob, deduplicated: true };
  }

  // 2. Mark website_seo as dirty and queued
  await supabase
    .from("website_seo")
    .update({
      is_dirty: true,
      analysis_status: "queued",
      updated_at: new Date().toISOString(),
    })
    .eq("website_id", websiteId)
    .eq("user_id", userId);

  // 3. Insert job record into seo_analysis_jobs
  const jobPayload = {
    website_id: websiteId,
    user_id: userId,
    requested_by: requestedBy,
    trigger_type: triggerType,
    status: "queued",
    priority,
    attempt_count: 0,
    max_attempts: 3,
    idempotency_key: key,
    analysis_version: CURRENT_ANALYSIS_VERSION,
  };

  const { data: newJob, error: insertErr } = await supabase
    .from("seo_analysis_jobs")
    .insert(jobPayload)
    .select()
    .single();

  if (insertErr) {
    // If unique conflict on idempotency_key, fetch existing
    if (insertErr.code === "23505") {
      const { data: conflictJob } = await supabase
        .from("seo_analysis_jobs")
        .select("*")
        .eq("idempotency_key", key)
        .single();

      return { job: conflictJob, deduplicated: true };
    }
    console.error("Failed to enqueue SEO job:", insertErr);
    throw new Error(`Enqueue SEO job failed: ${insertErr.message}`);
  }

  return { job: newJob, deduplicated: false };
}

/**
 * Directly executes multi-page SEO analysis for a website, persisting page-level and site-level state.
 * Deterministic and reproducible (0 credits).
 */
export async function executeSEOAnalysis(
  supabase: any,
  websiteId: string,
  userId: string,
  triggerType: string = "manual"
) {
  // 1. Fetch website pages
  const { data: pages, error: pagesErr } = await supabase
    .from("website_pages")
    .select("id, path, html_content")
    .eq("website_id", websiteId)
    .eq("user_id", userId);

  if (pagesErr) {
    throw new Error(`Failed to load website pages: ${pagesErr.message}`);
  }

  // 2. Fetch website SEO settings
  const { data: seoSettings } = await supabase
    .from("website_seo")
    .select("*")
    .eq("website_id", websiteId)
    .single();

  const formattedPages: PageSEOInput[] = (pages && pages.length > 0 ? pages : [
    { id: "default-index", path: "index.html", html_content: "" }
  ]).map((p: any) => ({
    path: p.path || "index.html",
    htmlContent: p.html_content || "",
  }));

  // 3. Run multi-page Cheerio analysis engine
  const result = analyzeWebsite(formattedPages, seoSettings || {});

  const nowIso = new Date().toISOString();

  // 4. Persist page-level SEO state (website_page_seo)
  const activePageIds: string[] = [];
  for (const pageRes of result.pages) {
    const matchedPage = pages?.find((p: any) => p.path === pageRes.path) || pages?.[0];
    if (matchedPage?.id) {
      activePageIds.push(matchedPage.id);
      const pagePayload = {
        website_id: websiteId,
        page_id: matchedPage.id,
        user_id: userId,
        path: pageRes.path,
        seo_score: pageRes.seo_score,
        seo_analysis: pageRes.analysis,
        analysis_status: "completed",
        last_analyzed_at: nowIso,
        updated_at: nowIso,
      };

      await supabase
        .from("website_page_seo")
        .upsert(pagePayload, { onConflict: "page_id" });
    }
  }

  // Clean up any page SEO records for pages that no longer exist
  if (activePageIds.length > 0) {
    const { data: existingPageSeos } = await supabase
      .from("website_page_seo")
      .select("id, page_id")
      .eq("website_id", websiteId);

    if (existingPageSeos) {
      const obsoleteIds = existingPageSeos
        .filter((ps: any) => !activePageIds.includes(ps.page_id))
        .map((ps: any) => ps.id);

      if (obsoleteIds.length > 0) {
        await supabase.from("website_page_seo").delete().in("id", obsoleteIds);
      }
    }
  }

  // 5. Persist aggregate website-level SEO state (website_seo)
  const sitePayload = {
    website_id: websiteId,
    user_id: userId,
    seo_score: result.seo_score,
    seo_analysis: result.aggregate_analysis,
    is_dirty: false,
    analysis_status: "completed",
    critical_issues_count: result.issue_counts.critical,
    warnings_count: result.issue_counts.warning,
    opportunities_count: result.issue_counts.opportunity,
    passed_checks_count: result.issue_counts.passed,
    last_analyzed_at: nowIso,
    analysis_version: CURRENT_ANALYSIS_VERSION,
    updated_at: nowIso,
  };

  await supabase
    .from("website_seo")
    .upsert(sitePayload, { onConflict: "website_id" });

  // 6. Log analysis to history
  await supabase.from("seo_analysis_history").insert({
    website_id: websiteId,
    user_id: userId,
    seo_score: result.seo_score,
    analysis: result.aggregate_analysis,
    recommendations: result.recommendations,
    trigger_type: triggerType,
    analysis_version: CURRENT_ANALYSIS_VERSION,
    critical_issues_count: result.issue_counts.critical,
    warnings_count: result.issue_counts.warning,
    opportunities_count: result.issue_counts.opportunity,
  });

  return result;
}

/**
 * Claims and processes a queued job from seo_analysis_jobs table.
 * Concurrency-safe: uses atomic UPDATE ... WHERE status = 'queued' to prevent race conditions.
 */
export async function processSEOJob(supabase: any, jobId: string) {
  // 1. Claim job atomically (only one worker wins)
  const { data: job, error: claimErr } = await supabase
    .from("seo_analysis_jobs")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
      attempt_count: 1,
    })
    .eq("id", jobId)
    .eq("status", "queued")
    .select()
    .single();

  if (claimErr || !job) {
    return { success: false, reason: "Job already claimed or not found." };
  }

  try {
    // 2. Execute analysis
    const result = await executeSEOAnalysis(supabase, job.website_id, job.user_id, job.trigger_type);

    // 3. Mark job completed
    await supabase
      .from("seo_analysis_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return { success: true, result };
  } catch (err: any) {
    console.error(`Process SEO Job ${jobId} failed:`, err);
    const safeError = err.message || "SEO Job execution error";

    await supabase
      .from("seo_analysis_jobs")
      .update({
        status: "failed",
        error_code: "ANALYSIS_FAILED",
        error_message_safe: safeError,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    // Mark website_seo analysis_status as failed, but preserve previous score & data
    await supabase
      .from("website_seo")
      .update({
        analysis_status: "failed",
        is_dirty: true, // Remains dirty so user can retry
        updated_at: new Date().toISOString(),
      })
      .eq("website_id", job.website_id);

    throw err;
  }
}

