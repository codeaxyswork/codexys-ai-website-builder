import { createClient } from "@/utils/supabase/server";
import {
  SourceWebsiteScan,
  SourcePage,
  MigrationMode,
  MigrationSelections,
  MigrationExecuteResult,
  PageCaptureManifest,
  MigrationJobStatus,
  MigrationJobRecord,
  MigrationPageDiagnostic,
  MigrationFailureDetails,
} from "./types";
import { convertPageToCodeaxysNative, convertPageToExactSnapshot } from "./converter";
import { generateAIRedesignForPage, DEFAULT_REDESIGN_PROMPT, buildSourcePageFromBrowserSnapshot } from "./redesign-engine";
import { captureSourcePageWithBrowser, fallbackHttpCapture, launchSharedMigrationBrowser } from "./browser-capture";
import { runOpportunityScan } from "@/lib/seo-opportunities/engine";
import {
  isPrivateOrReservedIP,
  normalizePageUrl,
  extractCanonicalPagePath,
  extractCanonicalSlug,
  scanSourceWebsite,
} from "./scanner";
import { buildLocalPageMap, localizeHtmlLinks } from "./link-localizer";
import { importAndStoreMigrationAssets } from "./asset-importer";
import {
  deriveCanonicalDomainSlug,
  resolveCanonicalWebsiteSlug,
  getWebsitePublicUrl,
} from "@/lib/domain-resolver";

export interface PageDiagnostic extends MigrationPageDiagnostic {}

export interface WorkerSession {
  runId: string;
  lastPing: number;
  promise?: Promise<any>;
}

// In-memory registry for concurrency management and fast real-time status access
const activeWorkers = new Map<string, WorkerSession>();
const inMemoryJobCache = new Map<string, MigrationJobRecord>();

function getSafeAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yumsturujjjgdxsrqgbm.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const { createClient: createSupabaseDirectClient } = require("@supabase/supabase-js");
  return createSupabaseDirectClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Safe database delete helper using explicit async/await inside try/catch.
 * NEVER calls .catch() directly on the Supabase query builder.
 */
async function safeDbDelete(db: any, table: string, column: string, value: string, runId = "unknown", websiteId = "unknown") {
  const stepName = `SAFE_DB_DELETE_${table.toUpperCase()}`;
  const startMs = Date.now();
  console.log(`[MIGRATION_STEP_START] runId=${runId} websiteId=${websiteId} step=${stepName} elapsedMs=${startMs}`);
  try {
    const { error } = await db.from(table).delete().eq(column, value);
    if (error) {
      console.error(`[MIGRATION_STEP_ERROR] runId=${runId} websiteId=${websiteId} step=${stepName} error="${error.message}"`);
    } else {
      console.log(`[MIGRATION_STEP_COMPLETE] runId=${runId} websiteId=${websiteId} step=${stepName} elapsedMs=${Date.now() - startMs}`);
    }
  } catch (err: any) {
    console.error(`[MIGRATION_STEP_ERROR] runId=${runId} websiteId=${websiteId} step=${stepName} error="${err?.message || err}"`);
  }
}

/**
 * Wraps an async operation with a strict bounded timeout using Promise.race.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string,
  runId = "unknown"
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Operation '${operationName}' timed out after ${timeoutMs}ms (runId=${runId})`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    throw err;
  }
}

/**
 * Telemetry-instrumented migration job state updater.
 * Updates both in-memory cache and Supabase DB atomically.
 */
export async function updateMigrationJobState(
  db: any,
  websiteId: string,
  runId: string,
  update: {
    status?: MigrationJobStatus;
    progress?: number;
    currentStage?: string;
    currentPage?: number;
    totalPages?: number;
    completedPages?: number;
    failedPages?: number;
    error?: string | null;
    failureDetails?: MigrationFailureDetails | null;
    result?: any;
    pageDiagnostics?: PageDiagnostic[];
    startTime?: string;
    lastHeartbeatAt?: string;
  }
) {
  const stepName = `MIGRATION_JOB_STATUS_UPDATE_${update.status || "STATE"}`;
  const startMs = Date.now();
  console.log(`[MIGRATION_STEP_START] runId=${runId} websiteId=${websiteId} step=${stepName} progress=${update.progress ?? 0}% stage="${update.currentStage || ''}" status=${update.status || 'UNKNOWN'}`);

  const nowIso = new Date().toISOString();

  // 1. Update in-memory cache immediately
  const existingCached = inMemoryJobCache.get(websiteId);
  const updatedJob: MigrationJobRecord = {
    jobId: runId,
    websiteId,
    targetUrl: existingCached?.targetUrl || "",
    cleanSlug: existingCached?.cleanSlug || "",
    mode: existingCached?.mode || "exact",
    selections: existingCached?.selections || ({} as any),
    status: update.status || existingCached?.status || "QUEUED",
    progress: typeof update.progress === "number" ? update.progress : existingCached?.progress || 10,
    currentStage: update.currentStage || existingCached?.currentStage || "Processing migration...",
    currentPage: typeof update.currentPage === "number" ? update.currentPage : existingCached?.currentPage || 0,
    totalPages: typeof update.totalPages === "number" ? update.totalPages : existingCached?.totalPages || 1,
    completedPages: typeof update.completedPages === "number" ? update.completedPages : existingCached?.completedPages || 0,
    failedPages: typeof update.failedPages === "number" ? update.failedPages : existingCached?.failedPages || 0,
    error: update.error !== undefined ? update.error : existingCached?.error || null,
    failureDetails: update.failureDetails !== undefined ? update.failureDetails : existingCached?.failureDetails || null,
    result: update.result !== undefined ? update.result : existingCached?.result || null,
    pageDiagnostics: update.pageDiagnostics || existingCached?.pageDiagnostics || [],
    startTime: update.startTime || existingCached?.startTime || nowIso,
    updatedAt: nowIso,
    lastHeartbeatAt: update.lastHeartbeatAt || nowIso,
  };
  inMemoryJobCache.set(websiteId, updatedJob);

  // 2. Persist to Supabase Database
  try {
    await withTimeout(
      (async () => {
        const { data: web, error: selectErr } = await db
          .from("websites")
          .select("design_plan")
          .eq("id", websiteId)
          .maybeSingle();

        if (selectErr || !web) {
          console.error(`[MIGRATION_STEP_ERROR] runId=${runId} websiteId=${websiteId} step=${stepName} error="${selectErr?.message || 'Website not found'}"`);
          return;
        }

        const currentPlan = web.design_plan || {};
        const currentJob = currentPlan.migration_job || {};

        const mergedJob = {
          ...currentJob,
          ...updatedJob,
          jobId: runId,
          updatedAt: nowIso,
        };

        const { error: updateErr } = await db
          .from("websites")
          .update({
            design_plan: {
              ...currentPlan,
              migration_job: mergedJob,
            },
            updated_at: nowIso,
          })
          .eq("id", websiteId);

        if (updateErr) {
          console.error(`[MIGRATION_STEP_ERROR] runId=${runId} websiteId=${websiteId} step=${stepName} error="${updateErr.message}"`);
        } else {
          console.log(`[MIGRATION_STEP_COMPLETE] runId=${runId} websiteId=${websiteId} step=${stepName} elapsedMs=${Date.now() - startMs}`);
        }
      })(),
      3000,
      stepName,
      runId
    );
  } catch (e: any) {
    console.error(`[MIGRATION_STEP_ERROR] runId=${runId} websiteId=${websiteId} step=${stepName} error="${e?.message || e}"`);
  }
}

/**
 * Returns latest in-memory job state or fetches from DB.
 */
export async function getMigrationJobState(websiteId?: string, runId?: string): Promise<MigrationJobRecord | null> {
  if (websiteId && inMemoryJobCache.has(websiteId)) {
    return inMemoryJobCache.get(websiteId)!;
  }

  const db = getSafeAdminClient();
  let website: any = null;

  if (websiteId) {
    const { data } = await db.from("websites").select("id, slug, is_published, design_plan").eq("id", websiteId).maybeSingle();
    website = data;
  }
  if (!website && runId) {
    const { data } = await db.from("websites").select("id, slug, is_published, design_plan").filter("design_plan->migration_job->>jobId", "eq", runId).maybeSingle();
    website = data;
  }

  if (website && website.design_plan?.migration_job) {
    const job = website.design_plan.migration_job as MigrationJobRecord;
    if (website.id) {
      inMemoryJobCache.set(website.id, job);
    }
    return job;
  }

  return null;
}

/**
 * Prepares/Reuses the draft website record synchronously before starting execution.
 * Derives generic canonical domain slug and deterministically avoids collisions.
 */
export async function prepareMigrationDraftWebsite(
  userId: string,
  scanResult: SourceWebsiteScan,
  mode: MigrationMode,
  selections: MigrationSelections,
  runId: string
): Promise<{ websiteId: string; cleanSlug: string }> {
  const startMs = Date.now();
  console.log(`[MIGRATION_STEP_START] runId=${runId} websiteId=pending step=PREPARE_DRAFT_WEBSITE elapsedMs=0`);

  const db = getSafeAdminClient();

  const rawTitle = scanResult.pages[0]?.title || scanResult.domain || "Migrated Website";
  const title = rawTitle.length > 50 ? rawTitle.substring(0, 47) + "..." : rawTitle;

  const cleanBrand = deriveCanonicalDomainSlug(scanResult.domain || scanResult.targetUrl);

  // 1. Check if the current user already has an existing website/draft with this cleanBrand
  const { data: userWebsites } = await db
    .from("websites")
    .select("id, user_id, is_published, slug, published_slug")
    .eq("user_id", userId)
    .or(`slug.eq.${cleanBrand},published_slug.eq.${cleanBrand}`)
    .limit(1);

  const existingUserDraft = userWebsites && userWebsites.length > 0 ? userWebsites[0] : null;

  let websiteId: string;
  let cleanSlug = cleanBrand;

  const initialJobState: MigrationJobRecord = {
    jobId: runId,
    websiteId: "",
    userId,
    targetUrl: scanResult.targetUrl,
    cleanSlug,
    mode,
    selections,
    status: "QUEUED",
    progress: 10,
    currentStage: "Initializing migration environment...",
    currentPage: 0,
    totalPages: scanResult.pages?.length || 1,
    completedPages: 0,
    failedPages: 0,
    pageDiagnostics: [],
    failureDetails: null,
    error: null,
    result: null,
    startTime: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastHeartbeatAt: new Date().toISOString(),
  };

  if (existingUserDraft) {
    websiteId = existingUserDraft.id;
    cleanSlug = existingUserDraft.slug || cleanBrand;
    initialJobState.websiteId = websiteId;
    initialJobState.cleanSlug = cleanSlug;

    await safeDbDelete(db, "website_pages", "website_id", websiteId, runId, websiteId);
    await safeDbDelete(db, "website_seo", "website_id", websiteId, runId, websiteId);

    await db
      .from("websites")
      .update({
        title: `[Migrated] ${title}`,
        prompt: `Migrated from ${scanResult.targetUrl}`,
        updated_at: new Date().toISOString(),
        design_plan: {
          websiteType: "migrated",
          migration: {
            originalUrl: scanResult.targetUrl,
            domain: scanResult.domain,
            platform: scanResult.platform.name,
            mode,
            selections,
            summary: scanResult.summary,
            urlMappings: scanResult.urlMappings,
          },
          colorPalette: [
            { name: "Primary", hex: scanResult.globalStyles?.colors?.primary || "#6366f1" },
            { name: "Secondary", hex: scanResult.globalStyles?.colors?.secondary || "#4f46e5" },
          ],
          migration_job: initialJobState,
        },
      })
      .eq("id", websiteId);

    // Clean up any old pages from prior attempts for this draft website to ensure a clean slate
    await db.from("website_pages").delete().eq("website_id", websiteId);
    await db.from("website_page_seo").delete().eq("website_id", websiteId);

    console.log(`[MIGRATION_STEP_COMPLETE] runId=${runId} websiteId=${websiteId} step=PREPARE_DRAFT_WEBSITE mode=REUSE_USER_DRAFT slug=${cleanSlug} elapsedMs=${Date.now() - startMs}`);
  } else {
    // Check for collisions with other users and resolve deterministically
    const resolved = await resolveCanonicalWebsiteSlug(db, userId, cleanBrand);
    cleanSlug = resolved.slug;
    initialJobState.cleanSlug = cleanSlug;

    const { data: newWebsite, error: createWebError } = await db
      .from("websites")
      .insert({
        user_id: userId,
        title: `[Migrated] ${title}`,
        slug: cleanSlug,
        published_slug: cleanSlug,
        prompt: `Migrated from ${scanResult.targetUrl}`,
        is_published: false,
        design_plan: {
          websiteType: "migrated",
          migration: {
            originalUrl: scanResult.targetUrl,
            domain: scanResult.domain,
            platform: scanResult.platform.name,
            mode,
            selections,
            summary: scanResult.summary,
            urlMappings: scanResult.urlMappings,
          },
          colorPalette: [
            { name: "Primary", hex: scanResult.globalStyles?.colors?.primary || "#6366f1" },
            { name: "Secondary", hex: scanResult.globalStyles?.colors?.secondary || "#4f46e5" },
          ],
          migration_job: initialJobState,
        },
      })
      .select("id")
      .single();

    if (createWebError || !newWebsite) {
      console.error(`[MIGRATION_STEP_ERROR] runId=${runId} websiteId=none step=PREPARE_DRAFT_WEBSITE error="${createWebError?.message}"`);
      throw new Error(`Failed to create migration draft website: ${createWebError?.message || "Unknown error"}`);
    }
    websiteId = newWebsite.id;
    initialJobState.websiteId = websiteId;
    console.log(`[MIGRATION_STEP_COMPLETE] runId=${runId} websiteId=${websiteId} step=PREPARE_DRAFT_WEBSITE mode=CREATE_NEW_DRAFT slug=${cleanSlug} elapsedMs=${Date.now() - startMs}`);
  }

  inMemoryJobCache.set(websiteId, initialJobState);
  return { websiteId, cleanSlug };
}

/**
 * Normalizes and deduplicates discovered pages to ensure 0 duplicate homepages or URLs.
 */
function normalizeAndDeduplicatePages(rawPages: SourcePage[], baseUrl: string): SourcePage[] {
  const uniquePages: SourcePage[] = [];
  const seenPaths = new Set<string>();
  const seenNormUrls = new Set<string>();

  for (const page of rawPages) {
    const normUrl = normalizePageUrl(page.url);
    const canonicalPath = extractCanonicalPagePath(page.url || page.path);
    const canonicalSlug = extractCanonicalSlug(canonicalPath);

    if (seenPaths.has(canonicalPath) || seenNormUrls.has(normUrl)) {
      continue;
    }

    seenPaths.add(canonicalPath);
    seenNormUrls.add(normUrl);

    uniquePages.push({
      ...page,
      path: canonicalPath,
      slug: canonicalSlug,
      url: page.url || `${baseUrl}/${canonicalPath}`,
    });
  }

  return uniquePages;
}

/**
 * Main Durable Stage Workflow Engine Runner.
 * Executes or resumes a migration job across explicit, persistent states:
 * QUEUED -> DISCOVERING -> CAPTURING -> IMPORTING_ASSETS -> FINALIZING -> VALIDATING -> COMPLETED
 */
export async function startOrResumeMigrationJob(
  websiteId: string,
  runId: string,
  options?: {
    userId?: string;
    scanResult?: SourceWebsiteScan;
    mode?: MigrationMode;
    selections?: MigrationSelections;
    redesignPrompt?: string;
  }
): Promise<MigrationExecuteResult | null> {
  const startTime = Date.now();
  console.log(`[MIGRATION_WORKFLOW_START] websiteId=${websiteId} runId=${runId} timestamp=${new Date().toISOString()}`);

  // 1. Concurrency guard: Ensure only one active worker executes for this websiteId at any time
  const existingWorker = activeWorkers.get(websiteId);
  if (existingWorker && Date.now() - existingWorker.lastPing < 5000) {
    console.log(`[MIGRATION_WORKFLOW_ALREADY_ACTIVE] websiteId=${websiteId} workerRunId=${existingWorker.runId} lastPingMs=${Date.now() - existingWorker.lastPing}`);
    return null;
  }

  const session: WorkerSession = {
    runId,
    lastPing: Date.now(),
  };
  activeWorkers.set(websiteId, session);

  const db = getSafeAdminClient();
  let sharedBrowser: any = null;

  try {
    // 2. Fetch current persisted website state
    const { data: website, error: webErr } = await db
      .from("websites")
      .select("*")
      .eq("id", websiteId)
      .maybeSingle();

    if (webErr || !website) {
      throw new Error(`Website not found for migration: ${webErr?.message || websiteId}`);
    }

    const designPlan = website.design_plan || {};
    const migrationMeta = designPlan.migration || {};
    const currentJob: MigrationJobRecord = designPlan.migration_job || {};

    const userId = options?.userId || website.user_id;
    const mode: MigrationMode = options?.mode || currentJob.mode || migrationMeta.mode || "exact";
    const selections: MigrationSelections = options?.selections || currentJob.selections || migrationMeta.selections || {
      content: { pages: true, blogPages: true, navigation: true, textContent: true, images: true, logo: true, forms: true },
      seo: { pageTitles: true, metaDescriptions: true, canonicalUrls: true, openGraph: true, robotsSettings: true, structuredData: true },
      design: { colors: true, typography: true, spacing: true, layout: true, buttons: true },
    };
    const redesignPrompt = options?.redesignPrompt || currentJob.redesignPrompt || DEFAULT_REDESIGN_PROMPT;
    const targetUrl = migrationMeta.originalUrl || options?.scanResult?.targetUrl || currentJob.targetUrl || "";
    const cleanSlug = website.slug || currentJob.cleanSlug || "migrated";
    const rawTitle = website.title || "Migrated Website";

    // If job is already COMPLETED or FAILED, return immediately
    if (currentJob.status === "COMPLETED" && currentJob.result) {
      console.log(`[MIGRATION_WORKFLOW_ALREADY_COMPLETED] websiteId=${websiteId} slug=${cleanSlug}`);
      return currentJob.result;
    }

    // =========================================================================
    // STAGE 1: DISCOVERING
    // =========================================================================
    let pagesToMigrate: SourcePage[] = currentJob.pagesToMigrate || [];
    let scanResultData: SourceWebsiteScan | undefined = options?.scanResult;

    if (pagesToMigrate.length === 0) {
      await updateMigrationJobState(db, websiteId, runId, {
        status: "DISCOVERING",
        progress: 15,
        currentStage: "Discovering all valid unique pages...",
        lastHeartbeatAt: new Date().toISOString(),
      });

      if (!scanResultData && targetUrl) {
        console.log(`[MIGRATION_DISCOVER_CRAWL] Scanning source targetUrl: ${targetUrl}`);
        scanResultData = await scanSourceWebsite(targetUrl);
      }

      if (scanResultData && scanResultData.pages) {
        pagesToMigrate = normalizeAndDeduplicatePages(scanResultData.pages, scanResultData.baseUrl);
      }

      if (pagesToMigrate.length === 0) {
        pagesToMigrate = [
          {
            url: targetUrl,
            path: "index.html",
            slug: "home",
            title: rawTitle,
            headings: [],
            paragraphs: [],
            images: [],
            links: [],
            forms: [],
            sections: [],
            seo: { seoTitle: rawTitle, metaDescription: "" },
          },
        ];
      }

      // Persist discovered pages
      await db.from("websites").update({
        design_plan: {
          ...designPlan,
          migration_job: {
            ...currentJob,
            status: "DISCOVERING",
            pagesToMigrate,
            totalPages: pagesToMigrate.length,
            updatedAt: new Date().toISOString(),
          },
        },
      }).eq("id", websiteId);
    }

    const totalPages = pagesToMigrate.length || 1;
    const pageDiagnostics: PageDiagnostic[] = currentJob.pageDiagnostics || [];
    const storedPagesList: string[] = currentJob.storedPagesList || [];
    const capturedPages: { path: string; html_content: string; css_content: string; manifest?: PageCaptureManifest }[] =
      currentJob.capturedPages || [];

    // =========================================================================
    // STAGE 2: CAPTURING
    // =========================================================================
    await updateMigrationJobState(db, websiteId, runId, {
      status: "CAPTURING",
      progress: Math.max(currentJob.progress || 20, 20),
      currentStage: `Preparing page capture (0/${totalPages})...`,
      totalPages,
      completedPages: capturedPages.length,
      failedPages: 0,
      lastHeartbeatAt: new Date().toISOString(),
    });

    if (mode === "exact") {
      sharedBrowser = await launchSharedMigrationBrowser(runId).catch(() => null);
    }

    for (let i = 0; i < totalPages; i++) {
      session.lastPing = Date.now();
      const srcPage = pagesToMigrate[i];
      const pageStartTime = Date.now();
      const pagePath = (!srcPage.path || srcPage.path === "/" || srcPage.path === "/index.html") ? "index.html" : srcPage.path;

      // Check if page is already captured and stored in website_pages
      const { data: existingRows } = await db
        .from("website_pages")
        .select("id, html_content, css_content")
        .eq("website_id", websiteId)
        .eq("path", pagePath);

      const alreadySaved = existingRows && existingRows.length > 0 ? existingRows[0] : null;
      if (existingRows && existingRows.length > 1) {
        const idsToDelete = existingRows.slice(1).map((r: any) => r.id);
        await db.from("website_pages").delete().in("id", idsToDelete);
      }

      if (alreadySaved && alreadySaved.html_content && alreadySaved.html_content.length > 200) {
        console.log(`[MIGRATION_PAGE_ALREADY_STORED] websiteId=${websiteId} path="${pagePath}" (skipping re-capture)`);
        if (!capturedPages.some((p) => p.path === pagePath)) {
          capturedPages.push({
            path: pagePath,
            html_content: alreadySaved.html_content,
            css_content: alreadySaved.css_content || "",
          });
        }
        if (!storedPagesList.includes(pagePath)) {
          storedPagesList.push(pagePath);
        }
        continue;
      }

      const currentProgress = Math.min(20 + Math.floor(((i + 1) / totalPages) * 50), 70);

      await updateMigrationJobState(db, websiteId, runId, {
        status: "CAPTURING",
        progress: currentProgress,
        currentStage: `Capturing page ${i + 1}/${totalPages} (${pagePath})...`,
        currentPage: i + 1,
        totalPages,
        completedPages: capturedPages.length,
        failedPages: 0,
        pageDiagnostics,
        lastHeartbeatAt: new Date().toISOString(),
      });

      console.log(`[MIGRATION_STEP_START] runId=${runId} websiteId=${websiteId} step=PAGE_CAPTURE_${i + 1} path="${pagePath}"`);

      let finalHtml = "";
      let finalCss = "";
      let finalJs = "";
      let pageCapturedSuccess = false;
      let pageErrorMessage: string | null = null;
      let browserSnapshot: any = null;

      if (mode === "exact") {
        const forceFastCapture = i > 0 && (Date.now() - startTime) > 20000;
        if (forceFastCapture) {
          console.log(`[MIGRATION_STEP_START] runId=${runId} websiteId=${websiteId} step=FAST_HTTP_CAPTURE_${i + 1} path="${pagePath}" elapsedMs=${Date.now() - startTime}`);
        }

        try {
          if (!forceFastCapture) {
            browserSnapshot = await captureSourcePageWithBrowser(srcPage.url, runId, sharedBrowser, i === 0);
          } else {
            browserSnapshot = await fallbackHttpCapture(srcPage.url, Date.now());
          }
        } catch (err: any) {
          pageErrorMessage = err?.message || "Playwright browser capture failed";
          console.warn(`[BROWSER_CAPTURE_FALLBACK] path="${pagePath}" error="${pageErrorMessage}". Falling back to fast HTTP capture.`);
          browserSnapshot = await fallbackHttpCapture(srcPage.url, Date.now()).catch(() => null);
        }

        if (!browserSnapshot || !browserSnapshot.html || browserSnapshot.html.length < 500) {
          const nativeFallback = convertPageToCodeaxysNative(srcPage, scanResultData?.globalStyles as any, mode, selections);
          browserSnapshot = {
            url: srcPage.url,
            title: srcPage.seo?.seoTitle || srcPage.title,
            html: nativeFallback.htmlContent,
            css: nativeFallback.cssContent,
            assetUrls: [],
            slides: [],
            seo: srcPage.seo,
            links: srcPage.links || [],
            forms: srcPage.forms || [],
          };
        }

        const converted = convertPageToExactSnapshot(
          {
            html: browserSnapshot.html,
            css: browserSnapshot.css || "",
            slides: browserSnapshot.slides,
            title: browserSnapshot.title || srcPage.seo?.seoTitle || srcPage.title,
          },
          websiteId
        );

        finalHtml = converted.htmlContent;
        finalCss = converted.cssContent;
        finalJs = converted.jsContent;
        pageCapturedSuccess = true;
      } else if (mode === "redesign") {
        try {
          browserSnapshot = await captureSourcePageWithBrowser(srcPage.url, runId, sharedBrowser, i === 0);
        } catch {
          // ignore
        }
        const richSourcePage = browserSnapshot
          ? buildSourcePageFromBrowserSnapshot(browserSnapshot, srcPage.path)
          : srcPage;
        const converted = await generateAIRedesignForPage(richSourcePage, scanResultData?.globalStyles as any, selections, redesignPrompt, undefined, userId, undefined, runId);
        finalHtml = converted.htmlContent;
        finalCss = converted.cssContent;
        finalJs = converted.jsContent;
        pageCapturedSuccess = true;
      } else {
        const converted = convertPageToCodeaxysNative(srcPage, scanResultData?.globalStyles as any, mode, selections);
        finalHtml = converted.htmlContent;
        finalCss = converted.cssContent;
        finalJs = converted.jsContent;
        pageCapturedSuccess = true;
      }

      if (pageCapturedSuccess) {
        pageDiagnostics.push({
          url: srcPage.url,
          path: pagePath,
          pageNumber: i + 1,
          status: "COMPLETED",
          durationMs: Date.now() - pageStartTime,
          error: null,
          retryCount: 0,
          timestamp: new Date().toISOString(),
        });
      }

      // Idempotent database storage for website_pages
      const pagePayload = {
        website_id: websiteId,
        user_id: userId,
        path: pagePath,
        html_content: finalHtml,
        css_content: finalCss,
        js_content: finalJs,
      };

      if (alreadySaved) {
        await db
          .from("website_pages")
          .update({
            html_content: finalHtml,
            css_content: finalCss,
            js_content: finalJs,
            updated_at: new Date().toISOString(),
          })
          .eq("id", alreadySaved.id);
      } else {
        await db
          .from("website_pages")
          .delete()
          .eq("website_id", websiteId)
          .eq("path", pagePath);

        const { data: insertedPage } = await db
          .from("website_pages")
          .insert(pagePayload)
          .select("id")
          .single();

        const pageId = insertedPage?.id;
        if (pageId && (srcPage.seo?.seoTitle || srcPage.seo?.metaDescription)) {
          const pageSeoPayload: any = {
            website_id: websiteId,
            page_id: pageId,
            user_id: userId,
            path: pagePath,
          };
          if (selections?.seo?.pageTitles !== false && srcPage.seo?.seoTitle) {
            pageSeoPayload.seo_title = srcPage.seo.seoTitle;
          }
          if (selections?.seo?.metaDescriptions !== false && srcPage.seo?.metaDescription) {
            pageSeoPayload.meta_description = srcPage.seo.metaDescription;
          }
          if (selections?.seo?.canonicalUrls !== false && srcPage.seo?.canonicalUrl) {
            pageSeoPayload.canonical_url = srcPage.seo.canonicalUrl;
          }
          Promise.resolve(db.from("website_page_seo").insert(pageSeoPayload)).catch(() => {});
        }
      }

      capturedPages.push({
        path: pagePath,
        html_content: finalHtml,
        css_content: finalCss,
        manifest: browserSnapshot?.manifest,
      });

      if (!storedPagesList.includes(pagePath)) {
        storedPagesList.push(pagePath);
      }

      console.log(`[MIGRATION_STEP_COMPLETE] runId=${runId} websiteId=${websiteId} step=PAGE_CAPTURE_${i + 1} path="${pagePath}" elapsedMs=${Date.now() - pageStartTime}`);
    }

    if (sharedBrowser) {
      await sharedBrowser.close().catch(() => {});
      sharedBrowser = null;
    }

    // =========================================================================
    // STAGE 3: IMPORTING_ASSETS (Isolated from page capture)
    // =========================================================================
    console.log(`[MIGRATION_STAGE_START] websiteId=${websiteId} stage=IMPORTING_ASSETS count=${capturedPages.length}`);
    await updateMigrationJobState(db, websiteId, runId, {
      status: "IMPORTING_ASSETS",
      progress: 75,
      currentStage: "Importing external media assets to storage...",
      completedPages: capturedPages.length,
      lastHeartbeatAt: new Date().toISOString(),
    });

    try {
      const baseUrl = targetUrl ? new URL(targetUrl).origin : getWebsitePublicUrl({ slug: cleanSlug, published_slug: cleanSlug });
      await withTimeout(
        importAndStoreMigrationAssets(userId, websiteId, baseUrl, capturedPages, { customSupabaseClient: db, runId }),
        4500,
        "ASSET_IMPORT_PIPELINE",
        runId
      );
    } catch (assetErr: any) {
      console.warn(`[MIGRATION_ASSET_IMPORT_NON_BLOCKING_WARN] websiteId=${websiteId}:`, assetErr?.message || assetErr);
    }

    // =========================================================================
    // STAGE 4: FINALIZING (Internal links localization)
    // =========================================================================
    console.log(`[MIGRATION_STAGE_START] websiteId=${websiteId} stage=FINALIZING`);
    await updateMigrationJobState(db, websiteId, runId, {
      status: "FINALIZING",
      progress: 85,
      currentStage: "Localizing internal links & verifying layout...",
      completedPages: capturedPages.length,
      lastHeartbeatAt: new Date().toISOString(),
    });

    try {
      const domain = targetUrl ? new URL(targetUrl).hostname : cleanSlug;
      const { pageMap, sourceHostnames } = buildLocalPageMap(capturedPages, domain);
      for (const page of capturedPages) {
        const locRes = localizeHtmlLinks(page.html_content, pageMap, sourceHostnames);
        if (locRes.internalLinksRewritten > 0) {
          page.html_content = locRes.html;
        }
      }

      // Persist localized HTML to website_pages
      await Promise.allSettled(
        capturedPages.map((page) =>
          db
            .from("website_pages")
            .update({
              html_content: page.html_content,
              css_content: page.css_content,
            })
            .eq("website_id", websiteId)
            .eq("path", page.path)
        )
      );
    } catch (finalizeErr: any) {
      console.warn(`[MIGRATION_FINALIZING_WARN] websiteId=${websiteId}:`, finalizeErr?.message || finalizeErr);
    }

    // Trigger non-blocking SEO analysis
    try {
      setTimeout(() => {
        runOpportunityScan(db, websiteId, userId).catch(() => {});
      }, 50);
    } catch {}

    // =========================================================================
    // STAGE 5: VALIDATING
    // =========================================================================
    console.log(`[MIGRATION_STAGE_START] websiteId=${websiteId} stage=VALIDATING`);
    await updateMigrationJobState(db, websiteId, runId, {
      status: "VALIDATING",
      progress: 95,
      currentStage: "Validating migrated website...",
      completedPages: capturedPages.length,
      lastHeartbeatAt: new Date().toISOString(),
    });

    // Deduplicate any possible duplicate rows in website_pages
    const { data: allStoredPages } = await db
      .from("website_pages")
      .select("id, path, created_at")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false });

    if (allStoredPages && allStoredPages.length > 0) {
      const seenPaths = new Set<string>();
      const duplicateIdsToDelete: string[] = [];
      for (const page of allStoredPages) {
        if (seenPaths.has(page.path)) {
          duplicateIdsToDelete.push(page.id);
        } else {
          seenPaths.add(page.path);
        }
      }
      if (duplicateIdsToDelete.length > 0) {
        console.log(`[MIGRATION_CLEANUP_DUPLICATES] Deleting ${duplicateIdsToDelete.length} duplicate website_pages rows for websiteId=${websiteId}`);
        await db.from("website_pages").delete().in("id", duplicateIdsToDelete);
      }
    }

    const { data: verifiedPages, error: verifyErr } = await db
      .from("website_pages")
      .select("id, path")
      .eq("website_id", websiteId);

    if (verifyErr || !verifiedPages || verifiedPages.length === 0) {
      throw new Error(`Migration validation failed: No pages found in database for websiteId ${websiteId}`);
    }

    const hasHomepage = verifiedPages.some((p: any) => p.path === "index.html" || p.path === "/");
    if (!hasHomepage) {
      console.warn(`[MIGRATION_VALIDATING_WARN] Missing index.html in verified pages. Adding fallback.`);
      const firstPage = capturedPages[0];
      if (firstPage) {
        await db.from("website_pages").insert({
          website_id: websiteId,
          user_id: userId,
          path: "index.html",
          html_content: firstPage.html_content,
          css_content: firstPage.css_content,
        });
      }
    }

    // =========================================================================
    // STAGE 6: COMPLETED
    // =========================================================================
    const manifests = capturedPages.map((p) => p.manifest).filter(Boolean) as any[];
    const finalResult: MigrationExecuteResult = {
      success: true,
      websiteId,
      draftSlug: cleanSlug,
      title: rawTitle,
      summary: scanResultData?.summary || {
        pagesCount: capturedPages.length,
        imagesCount: 0,
        navMenusCount: 1,
        formsCount: 0,
        blogPagesCount: 0,
        seoRecordsCount: capturedPages.length,
      },
      warnings: scanResultData?.warnings || [],
      urlMappings: scanResultData?.urlMappings || [],
      capturedPages,
      manifests,
    };

    await updateMigrationJobState(db, websiteId, runId, {
      status: "COMPLETED",
      progress: 100,
      currentStage: "Draft Website Ready!",
      currentPage: totalPages,
      totalPages,
      completedPages: capturedPages.length,
      failedPages: 0,
      error: null,
      failureDetails: null,
      result: finalResult,
      pageDiagnostics,
      lastHeartbeatAt: new Date().toISOString(),
    });

    console.log(`[MIGRATION_WORKFLOW_COMPLETE] websiteId=${websiteId} runId=${runId} totalPages=${capturedPages.length} totalDurationMs=${Date.now() - startTime}`);
    return finalResult;
  } catch (err: any) {
    const errorMsg = String(err?.message || err || "Migration failed during background execution.");
    console.error(`[MIGRATION_WORKFLOW_FATAL_ERROR] websiteId=${websiteId} runId=${runId} error="${errorMsg}"`);

    const failureDetails: MigrationFailureDetails = {
      stage: "EXECUTION",
      step: "WORKFLOW_STEP",
      errorMessage: errorMsg,
      retryCount: 0,
      timestamp: new Date().toISOString(),
    };

    await updateMigrationJobState(db, websiteId, runId, {
      status: "FAILED",
      progress: 0,
      currentStage: "Migration Failed",
      error: errorMsg,
      failureDetails,
      lastHeartbeatAt: new Date().toISOString(),
    });

    throw err;
  } finally {
    if (sharedBrowser) {
      await sharedBrowser.close().catch(() => {});
    }
    activeWorkers.delete(websiteId);
  }
}

/**
 * Autonomous self-healing / resume trigger called by /status or background checks.
 * If the job is active and has stalled (> 8 seconds without heartbeat), resumes execution.
 */
export async function checkAndAdvanceMigrationJob(websiteId: string, runId: string): Promise<void> {
  const existingWorker = activeWorkers.get(websiteId);
  if (existingWorker && Date.now() - existingWorker.lastPing < 5000) {
    return; // Worker actively processing
  }

  const job = await getMigrationJobState(websiteId, runId);
  if (!job) return;

  const activeStatuses: MigrationJobStatus[] = [
    "QUEUED",
    "DISCOVERING",
    "CAPTURING",
    "IMPORTING_ASSETS",
    "FINALIZING",
    "VALIDATING",
  ];

  if (activeStatuses.includes(job.status)) {
    const lastHeartbeat = job.lastHeartbeatAt ? new Date(job.lastHeartbeatAt).getTime() : 0;
    const isStalled = Date.now() - lastHeartbeat > 25000;

    if (isStalled || job.status === "QUEUED") {
      console.log(`[MIGRATION_RESUME_DISPATCH] Resuming stalled job for websiteId=${websiteId} runId=${runId} stage=${job.status}`);
      // Launch asynchronous resumption slice without blocking caller
      startOrResumeMigrationJob(websiteId, runId).catch((err) => {
        console.error(`[MIGRATION_RESUME_ERROR] websiteId=${websiteId}:`, err?.message || err);
      });
    }
  }
}

/**
 * Backward compatibility wrapper for executeWebsiteMigration.
 */
export async function executeWebsiteMigration(
  userId: string,
  scanResult: SourceWebsiteScan,
  mode: MigrationMode,
  selections: MigrationSelections,
  customSupabaseClient?: any,
  redesignPrompt?: string,
  customRunId?: string,
  existingWebsiteId?: string,
  existingCleanSlug?: string
): Promise<MigrationExecuteResult> {
  const runId = customRunId || `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let websiteId = existingWebsiteId;

  if (!websiteId) {
    const prepared = await prepareMigrationDraftWebsite(userId, scanResult, mode, selections, runId);
    websiteId = prepared.websiteId;
  }

  const result = await startOrResumeMigrationJob(websiteId, runId, {
    userId,
    scanResult,
    mode,
    selections,
    redesignPrompt,
  });

  return (
    result || {
      success: true,
      websiteId,
      draftSlug: existingCleanSlug || "migrated",
      title: scanResult.domain,
      summary: scanResult.summary,
      warnings: scanResult.warnings,
      urlMappings: scanResult.urlMappings,
      capturedPages: [],
    }
  );
}
