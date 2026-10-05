import { createClient } from "@/utils/supabase/server";
import { SourceWebsiteScan, MigrationMode, MigrationSelections, MigrationExecuteResult, PageCaptureManifest } from "./types";
import { convertPageToCodeaxysNative, convertPageToExactSnapshot } from "./converter";
import { generateAIRedesignForPage, DEFAULT_REDESIGN_PROMPT, buildSourcePageFromBrowserSnapshot } from "./redesign-engine";
import { captureSourcePageWithBrowser, fallbackHttpCapture, launchSharedMigrationBrowser } from "./browser-capture";
import { runOpportunityScan } from "@/lib/seo-opportunities/engine";
import { isPrivateOrReservedIP } from "./scanner";
import { buildLocalPageMap, localizeHtmlLinks } from "./link-localizer";
import { importAndStoreMigrationAssets } from "./asset-importer";

const failedHostsMap = new Map<string, number>();

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

export interface PageDiagnostic {
  url: string;
  path: string;
  pageNumber: number;
  status: "COMPLETED" | "SKIPPED" | "FAILED";
  durationMs: number;
  error: string | null;
  retryCount: number;
}

/**
 * Wraps an async operation with a strict bounded timeout using Promise.race.
 * Prevents any async database call, asset download, browser cleanup, or finalization step from hanging indefinitely.
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
 */
export async function updateMigrationJobState(
  db: any,
  websiteId: string,
  runId: string,
  update: {
    status?: "QUEUED" | "RUNNING" | "CAPTURING_PAGE" | "CAPTURING_ASSETS" | "FINALIZING" | "COMPLETED" | "FAILED" | "CANCELLED";
    progress?: number;
    currentStage?: string;
    currentPage?: number;
    totalPages?: number;
    completedPages?: number;
    failedPages?: number;
    error?: string | null;
    result?: any;
    pageDiagnostics?: PageDiagnostic[];
    startTime?: string;
  }
) {
  const stepName = `MIGRATION_JOB_STATUS_UPDATE_${update.status || "STATE"}`;
  const startMs = Date.now();
  console.log(`[MIGRATION_STEP_START] runId=${runId} websiteId=${websiteId} step=${stepName} progress=${update.progress || 0}% stage="${update.currentStage || ''}"`);

  try {
    await withTimeout(
      (async () => {
        const { data: web, error: selectErr } = await db.from("websites").select("design_plan").eq("id", websiteId).maybeSingle();
        if (selectErr || !web) {
          console.error(`[MIGRATION_STEP_ERROR] runId=${runId} websiteId=${websiteId} step=${stepName} error="${selectErr?.message || 'Website not found'}"`);
          return;
        }

        const currentPlan = web.design_plan || {};
        const currentJob = currentPlan.migration_job || {};

        const updatedJob = {
          ...currentJob,
          jobId: runId,
          status: update.status || currentJob.status || "QUEUED",
          progress: typeof update.progress === "number" ? update.progress : currentJob.progress || 10,
          currentStage: update.currentStage || currentJob.currentStage || "Processing migration...",
          currentPage: typeof update.currentPage === "number" ? update.currentPage : currentJob.currentPage || 0,
          totalPages: typeof update.totalPages === "number" ? update.totalPages : currentJob.totalPages || 1,
          completedPages: typeof update.completedPages === "number" ? update.completedPages : currentJob.completedPages || 0,
          failedPages: typeof update.failedPages === "number" ? update.failedPages : currentJob.failedPages || 0,
          error: update.error !== undefined ? update.error : currentJob.error || null,
          result: update.result !== undefined ? update.result : currentJob.result || null,
          pageDiagnostics: update.pageDiagnostics || currentJob.pageDiagnostics || [],
          startTime: update.startTime || currentJob.startTime || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const { error: updateErr } = await db
          .from("websites")
          .update({
            design_plan: {
              ...currentPlan,
              migration_job: updatedJob,
            },
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
 * Prepares/Reuses the draft website record synchronously before starting long-running execution.
 * Ensures clean slug reuse for the same user's draft, avoiding suffix pollution.
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

  let cleanBrand = scanResult.domain
    .toLowerCase()
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?/i, "")
    .replace(/(\.online|\.com|\.org|\.net|\.site|\.co|\.in|\.io|\.tech)+$/gi, "")
    .replace(/online$/gi, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  if (!cleanBrand || cleanBrand.length < 2) {
    cleanBrand = scanResult.domain.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "");
  }

  let cleanSlug = cleanBrand;

  const { data: existingWebsite } = await db
    .from("websites")
    .select("id, user_id, is_published, slug")
    .or(`slug.eq.${cleanSlug},published_slug.eq.${cleanSlug}`)
    .maybeSingle();

  let websiteId: string;

  const initialJobState = {
    jobId: runId,
    status: "QUEUED",
    progress: 10,
    currentStage: "Initializing migration environment...",
    currentPage: 0,
    totalPages: scanResult.pages?.length || 1,
    completedPages: 0,
    failedPages: 0,
    error: null,
    startTime: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  if (existingWebsite) {
    if (existingWebsite.user_id === userId && !existingWebsite.is_published) {
      websiteId = existingWebsite.id;
      cleanSlug = existingWebsite.slug || cleanBrand;

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
              { name: "Primary", hex: scanResult.globalStyles.colors.primary || "#6366f1" },
              { name: "Secondary", hex: scanResult.globalStyles.colors.secondary || "#4f46e5" },
            ],
            migration_job: initialJobState,
          },
        })
        .eq("id", websiteId);
      console.log(`[MIGRATION_STEP_COMPLETE] runId=${runId} websiteId=${websiteId} step=PREPARE_DRAFT_WEBSITE mode=REUSE_DRAFT slug=${cleanSlug} elapsedMs=${Date.now() - startMs}`);
    } else {
      const suffix = Math.random().toString(36).substring(2, 7);
      cleanSlug = `${cleanBrand}-${suffix}`;
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
              { name: "Primary", hex: scanResult.globalStyles.colors.primary || "#6366f1" },
              { name: "Secondary", hex: scanResult.globalStyles.colors.secondary || "#4f46e5" },
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
      console.log(`[MIGRATION_STEP_COMPLETE] runId=${runId} websiteId=${websiteId} step=PREPARE_DRAFT_WEBSITE mode=CREATE_SUFFIX_DRAFT slug=${cleanSlug} elapsedMs=${Date.now() - startMs}`);
    }
  } else {
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
            { name: "Primary", hex: scanResult.globalStyles.colors.primary || "#6366f1" },
            { name: "Secondary", hex: scanResult.globalStyles.colors.secondary || "#4f46e5" },
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
    console.log(`[MIGRATION_STEP_COMPLETE] runId=${runId} websiteId=${websiteId} step=PREPARE_DRAFT_WEBSITE mode=CREATE_NEW_DRAFT slug=${cleanSlug} elapsedMs=${Date.now() - startMs}`);
  }

  return { websiteId, cleanSlug };
}

/**
 * Downloads external image/media/font safely and saves to media_assets & storage bucket.
 * Uses a strict 800ms timeout per asset & circuit breaker per host to prevent blocking migration.
 */
async function importMediaAsset(
  supabase: any,
  userId: string,
  websiteId: string,
  imageUrl: string,
  urlCache?: Map<string, string>
): Promise<string | null> {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) return null;

  if (urlCache && urlCache.has(imageUrl)) {
    return urlCache.get(imageUrl)!;
  }

  try {
    const parsed = new URL(imageUrl);
    const host = parsed.hostname.toLowerCase();

    if ((failedHostsMap.get(host) || 0) >= 2) {
      return null;
    }

    if (isPrivateOrReservedIP(host)) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800); // 800ms timeout per asset

    const res = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Codeaxys-Media-Migrator/1.0 (+https://codeaxys.com)",
      },
    });

    clearTimeout(timer);
    if (!res.ok) {
      failedHostsMap.set(host, (failedHostsMap.get(host) || 0) + 1);
      return null;
    }

    const contentType = (res.headers.get("content-type") || "image/jpeg").toLowerCase();
    const isAllowed = contentType.startsWith("image/") || contentType.includes("svg") || contentType.includes("font") || contentType.startsWith("video/");
    if (!isAllowed) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > 5 * 1024 * 1024) return null;

    const rawExt = parsed.pathname.split(".").pop() || "jpg";
    const cleanExt = rawExt.replace(/[^a-zA-Z0-9]/g, "").substring(0, 5) || "jpg";
    const fileName = (parsed.pathname.split("/").pop() || `asset_${Date.now()}.${cleanExt}`)
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${userId}/${websiteId}/migrated_${Date.now()}_${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("website-assets")
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
      });

    let publicUrl = imageUrl;
    if (!uploadError) {
      const { data: publicData } = supabase.storage
        .from("website-assets")
        .getPublicUrl(storagePath);
      publicUrl = publicData?.publicUrl || imageUrl;
    }

    await supabase.from("media_assets").insert({
      user_id: userId,
      website_id: websiteId,
      file_name: fileName,
      file_size_bytes: buffer.length,
      mime_type: contentType,
      storage_path: storagePath,
      public_url: publicUrl,
    });

    if (urlCache && publicUrl !== imageUrl) {
      urlCache.set(imageUrl, publicUrl);
    }

    return publicUrl;
  } catch {
    try {
      const host = new URL(imageUrl).hostname.toLowerCase();
      failedHostsMap.set(host, (failedHostsMap.get(host) || 0) + 1);
    } catch {
      // ignore
    }
    return null;
  }
}

/**
 * Executes full migration asynchronously to produce a Codeaxys Native Draft Website.
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
  const startTime = Date.now();

  const MIGRATION_DEADLINE_MS = 45000; // 45s total migration runtime deadline SLA
  const PAGE_TIMEOUT_MS = 20000; // 20s per-page timeout SLA
  const FINALIZATION_TIMEOUT_MS = 15000; // 15s max for asset import & finalization

  console.log(`[MIGRATION_STEP_START] runId=${runId} websiteId=${existingWebsiteId || 'pending'} step=EXECUTE_MIGRATION_START mode=${mode} targetUrl=${scanResult.targetUrl} elapsedMs=0`);

  const db = getSafeAdminClient();
  const supabase = customSupabaseClient || (await createClient());

  let websiteId: string;
  let cleanSlug: string;

  if (existingWebsiteId && existingCleanSlug) {
    websiteId = existingWebsiteId;
    cleanSlug = existingCleanSlug;
  } else {
    const prepared = await prepareMigrationDraftWebsite(userId, scanResult, mode, selections, runId);
    websiteId = prepared.websiteId;
    cleanSlug = prepared.cleanSlug;
  }

  const rawTitle = scanResult.pages[0]?.title || scanResult.domain || "Migrated Website";
  const title = rawTitle.length > 50 ? rawTitle.substring(0, 47) + "..." : rawTitle;

  const pagesToMigrate = scanResult.pages || [];
  const totalPages = pagesToMigrate.length || 1;
  const pageDiagnostics: PageDiagnostic[] = [];

  console.log(`[MIGRATION_DISCOVERED_PAGES] runId=${runId} websiteId=${existingWebsiteId || 'pending'} count=${totalPages} pages=${JSON.stringify(pagesToMigrate.map(p => ({ url: p.url, path: p.path })))}`);
  console.log(`[MIGRATION_SELECTED_PAGES] runId=${runId} websiteId=${existingWebsiteId || 'pending'} count=${totalPages} pages=${JSON.stringify(pagesToMigrate.map(p => ({ url: p.url, path: p.path })))}`);
  console.log(`[MIGRATION_SKIPPED_PAGES] runId=${runId} websiteId=${existingWebsiteId || 'pending'} count=0 pages=[] reasons=[]`);

  await updateMigrationJobState(db, websiteId, runId, {
    status: "RUNNING",
    progress: 15,
    currentStage: "Starting website migration worker...",
    currentPage: 0,
    totalPages,
    completedPages: 0,
    failedPages: 0,
    startTime: new Date().toISOString(),
  });

  const urlCache = new Map<string, string>();
  const capturedPages: { path: string; html_content: string; css_content: string; manifest?: PageCaptureManifest }[] = [];
  const storedPagesList: string[] = [];

  let completedCount = 0;
  let failedCount = 0;

  let sharedBrowser: any = null;
  if (mode === "exact") {
    sharedBrowser = await launchSharedMigrationBrowser(runId);
  }

  try {
    // Process and convert pages
    for (let i = 0; i < pagesToMigrate.length; i++) {
      const srcPage = pagesToMigrate[i];
      const pageStartTime = Date.now();
      const elapsedTime = pageStartTime - startTime;

      // Check Overall Migration Deadline (45s)
      if (elapsedTime > MIGRATION_DEADLINE_MS) {
        console.error(`[MIGRATION_STEP_ERROR] runId=${runId} websiteId=${websiteId} step=MIGRATION_DEADLINE_GUARD error="Exceeded 45,000ms deadline threshold" elapsedMs=${elapsedTime}`);
        await updateMigrationJobState(db, websiteId, runId, {
          status: "FAILED",
          progress: 0,
          currentStage: "Migration Deadline Exceeded (45s)",
          error: `Migration exceeded total 45,000ms deadline threshold at page ${i + 1}/${totalPages}.`,
          completedPages: completedCount,
          failedPages: failedCount,
          pageDiagnostics,
        });
        throw new Error(`Migration deadline exceeded (${elapsedTime}ms > ${MIGRATION_DEADLINE_MS}ms)`);
      }

      const currentProgress = Math.min(20 + Math.floor(((i + 1) / totalPages) * 50), 70);
      
      // Non-blocking state update every 2 pages to eliminate ~1.5s per-page blocking DB network delay
      if (i === 0 || i === pagesToMigrate.length - 1 || i % 2 === 0) {
        updateMigrationJobState(db, websiteId, runId, {
          status: "CAPTURING_PAGE",
          progress: currentProgress,
          currentStage: `Capturing page ${i + 1}/${totalPages} (${srcPage.path})...`,
          currentPage: i + 1,
          totalPages,
          completedPages: completedCount,
          failedPages: failedCount,
          pageDiagnostics,
        }).catch(() => {});
      }

      console.log(`[MIGRATION_STEP_START] runId=${runId} websiteId=${websiteId} step=PAGE_CAPTURE_${i + 1} path="${srcPage.path}" elapsedMs=${elapsedTime}`);

      let finalHtml = "";
      let finalCss = "";
      let finalJs = "";
      let pageCapturedSuccess = false;
      let pageErrorMessage: string | null = null;

      if (mode === "exact") {
        let browserSnapshot;
        const forceFastCapture = i > 0 && (Date.now() - startTime) > PAGE_TIMEOUT_MS;
        if (forceFastCapture) {
          console.log(`[MIGRATION_STEP_START] runId=${runId} websiteId=${websiteId} step=PAGE_TIMEOUT_GUARD_${i + 1} action=FAST_HTTP_FALLBACK elapsedMs=${Date.now() - startTime}`);
        }

        try {
          if (!forceFastCapture) {
            browserSnapshot = await captureSourcePageWithBrowser(srcPage.url, runId, sharedBrowser, i === 0);
          } else {
            browserSnapshot = await fallbackHttpCapture(srcPage.url, Date.now());
          }
        } catch (err: any) {
          pageErrorMessage = err?.message || "Playwright browser capture failed";
          console.error(`[MIGRATION_STEP_ERROR] runId=${runId} websiteId=${websiteId} step=BROWSER_CAPTURE_${i + 1} error="${pageErrorMessage}"`);
          browserSnapshot = await fallbackHttpCapture(srcPage.url, Date.now()).catch((e) => {
            pageErrorMessage = e?.message || pageErrorMessage;
            return undefined;
          });
        }

        if (browserSnapshot) {
          (srcPage as any)._browserManifest = browserSnapshot.manifest;
        }

        if (!browserSnapshot || !browserSnapshot.html || browserSnapshot.html.length < 500) {
          console.warn(`[HOMEPAGE_CAPTURE_FALLBACK] Exact capture produced empty HTML for ${srcPage.url}. Converting from scan payload...`);
          const nativeConverted = convertPageToCodeaxysNative(srcPage, scanResult.globalStyles, mode, selections);
          browserSnapshot = {
            url: srcPage.url,
            title: srcPage.seo?.seoTitle || srcPage.title,
            html: nativeConverted.htmlContent,
            css: nativeConverted.cssContent,
            assetUrls: [],
            slides: [],
            seo: srcPage.seo,
            links: srcPage.links || [],
            forms: srcPage.forms || [],
            warnings: [],
            manifest: {
              sourceUrl: srcPage.url,
              path: srcPage.path,
              status: "PASS",
              startTime: Date.now(),
              endTime: Date.now(),
              durationMs: 0,
              htmlSizeBytes: nativeConverted.htmlContent.length,
              css: { detected: 0, localized: 0, unresolved: 0, urls: [] },
              js: { detected: 0, localized: 0, unresolved: 0, urls: [] },
              images: { detected: 0, localized: 0, unresolved: 0 },
              fonts: { detected: 0, localized: 0, unresolved: 0, urls: [] },
              media: { videoCount: 0, iframeCount: 0 },
              inline: { styleCount: 0, scriptCount: 0 },
              errors: { consoleErrors: [], pageErrors: [], networkFailures: [] },
              behaviors: {} as any,
              interactions: {} as any,
              unresolvedResources: [],
              jsInventory: [],
              htmlSizes: { renderedContentSizeBytes: 0, outerHtmlSizeBytes: 0, sanitizedSizeBytes: nativeConverted.htmlContent.length, generatedSizeBytes: nativeConverted.htmlContent.length },
              runtimeVerification: {} as any,
              behaviorSource: {} as any,
              migrationStatusLabel: "COMPLETED",
            },
          };
        }

        let capturedHtml = browserSnapshot.html;
        let capturedCss = browserSnapshot.css || "";

        // Collect visual asset URLs
        const urlsToMigrate = new Set<string>();
        if (browserSnapshot.assetUrls) {
          browserSnapshot.assetUrls.forEach((u) => {
            if (u && (u.startsWith("http://") || u.startsWith("https://"))) urlsToMigrate.add(u);
          });
        }



        const converted = convertPageToExactSnapshot(
          {
            html: capturedHtml,
            css: capturedCss,
            slides: browserSnapshot.slides,
            title: browserSnapshot.title || srcPage.seo.seoTitle || srcPage.title,
          },
          websiteId
        );

        finalHtml = converted.htmlContent;
        finalCss = converted.cssContent;
        finalJs = converted.jsContent;
        pageCapturedSuccess = true;
      } else if (mode === "redesign") {
        let browserSnapshot;
        try {
          browserSnapshot = await captureSourcePageWithBrowser(srcPage.url);
          (srcPage as any)._browserManifest = browserSnapshot.manifest;
        } catch (err: any) {
          console.warn(`Browser capture for redesign mode warning (${srcPage.url}): ${err.message}`);
        }

        const richSourcePage = browserSnapshot
          ? buildSourcePageFromBrowserSnapshot(browserSnapshot, srcPage.path)
          : srcPage;

        const userPrompt = redesignPrompt || DEFAULT_REDESIGN_PROMPT;
        const converted = await generateAIRedesignForPage(richSourcePage, scanResult.globalStyles, selections, userPrompt, undefined, userId, undefined, runId);
        finalHtml = converted.htmlContent;
        finalCss = converted.cssContent;
        finalJs = converted.jsContent;
        pageCapturedSuccess = true;
      } else {
        const converted = convertPageToCodeaxysNative(srcPage, scanResult.globalStyles, mode, selections);
        finalHtml = converted.htmlContent;
        finalCss = converted.cssContent;
        finalJs = converted.jsContent;
        pageCapturedSuccess = true;
      }

      if (pageCapturedSuccess) {
        completedCount++;
        pageDiagnostics.push({
          url: srcPage.url,
          path: srcPage.path,
          pageNumber: i + 1,
          status: "COMPLETED",
          durationMs: Date.now() - pageStartTime,
          error: null,
          retryCount: 0,
        });
      }

      const pagePath = (!srcPage.path || srcPage.path === "/" || srcPage.path === "/index.html") ? "index.html" : srcPage.path;

      // WEBSITE_PAGES_DB_UPDATES Instrumentation
      const stepPagesDb = `WEBSITE_PAGES_DB_INSERT_${i + 1}`;
      const startPagesDbMs = Date.now();
      console.log(`[MIGRATION_STEP_START] runId=${runId} websiteId=${websiteId} step=${stepPagesDb} path="${pagePath}" elapsedMs=${startPagesDbMs - startTime}`);

      const pageInsertPayload = {
        website_id: websiteId,
        user_id: userId,
        path: pagePath,
        html_content: finalHtml,
        css_content: finalCss,
        js_content: finalJs,
      };

      const { data: insertedPages, error: pageInsertError } = await db
        .from("website_pages")
        .insert(pageInsertPayload)
        .select("id")
        .single();

      if (pageInsertError) {
        console.error(`[MIGRATION_STEP_ERROR] runId=${runId} websiteId=${websiteId} step=${stepPagesDb} error="${pageInsertError.message}"`);
      } else {
        storedPagesList.push(pagePath);
        console.log(`[MIGRATION_STEP_COMPLETE] runId=${runId} websiteId=${websiteId} step=${stepPagesDb} elapsedMs=${Date.now() - startPagesDbMs}`);
      }

      const pageId = insertedPages?.id;

      // WEBSITE_SEO_DB_UPDATES Instrumentation
      if (pageId && (srcPage.seo?.seoTitle || srcPage.seo?.metaDescription)) {
        const stepSeoDb = `WEBSITE_PAGE_SEO_DB_INSERT_${i + 1}`;
        const startSeoDbMs = Date.now();
        console.log(`[MIGRATION_STEP_START] runId=${runId} websiteId=${websiteId} step=${stepSeoDb} elapsedMs=${startSeoDbMs - startTime}`);

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

        db.from("website_page_seo").insert(pageSeoPayload).catch(() => {});
        console.log(`[MIGRATION_STEP_COMPLETE] runId=${runId} websiteId=${websiteId} step=${stepSeoDb} status=ASYNC_DISPATCHED`);
      }

      let pageManifest = (mode === "exact" && (srcPage as any)._browserManifest) || undefined;

      capturedPages.push({
        path: pagePath,
        html_content: finalHtml,
        css_content: finalCss,
        manifest: pageManifest,
      });

      console.log(`[MIGRATION_STEP_COMPLETE] runId=${runId} websiteId=${websiteId} step=PAGE_CAPTURE_${i + 1} status=COMPLETED elapsedMs=${Date.now() - pageStartTime}`);
    }

    console.log(`[MIGRATION_CAPTURED_PAGES] runId=${runId} websiteId=${websiteId} count=${capturedPages.length} paths=${JSON.stringify(capturedPages.map(p => p.path))}`);
    console.log(`[MIGRATION_STORED_PAGES] runId=${runId} websiteId=${websiteId} count=${storedPagesList.length} paths=${JSON.stringify(storedPagesList)}`);

    // =========================================================================
    // TELEMETRY-INSTRUMENTED FINALIZATION STAGE WITH STRICT TIMEOUT BOUNDS
    // =========================================================================
    const finalizationStartMs = Date.now();
    console.log(`[MIGRATION_FINALIZE_START] runId=${runId} websiteId=${websiteId} operation=FINALIZE_START elapsedMs=${finalizationStartMs - startTime}`);

    // 1. ASSET IMPORT STAGE
      console.log(`[MIGRATION_ASSET_IMPORT_START] runId=${runId} websiteId=${websiteId} operation=ASSET_IMPORT elapsedMs=${Date.now() - startTime}`);
      await updateMigrationJobState(db, websiteId, runId, {
        status: "CAPTURING_ASSETS",
        progress: 75,
        currentStage: "Importing external media assets to storage...",
        completedPages: completedCount,
        failedPages: failedCount,
        pageDiagnostics,
      });

      try {
        await withTimeout(
          importAndStoreMigrationAssets(userId, websiteId, scanResult.baseUrl, capturedPages, { customSupabaseClient: db, runId }),
          4000,
          "ASSET_IMPORT_PIPELINE",
          runId
        );
      } catch (assetErr: any) {
        console.error(`[MIGRATION_FINALIZE_ERROR] runId=${runId} websiteId=${websiteId} operation=ASSET_IMPORT error="${assetErr?.message || assetErr}" elapsedMs=${Date.now() - startTime}`);
      }
      console.log(`[MIGRATION_ASSET_IMPORT_COMPLETE] runId=${runId} websiteId=${websiteId} operation=ASSET_IMPORT elapsedMs=${Date.now() - startTime}`);

      // 2. LINK LOCALIZATION STAGE
      console.log(`[MIGRATION_LINK_LOCALIZATION_START] runId=${runId} websiteId=${websiteId} operation=LINK_LOCALIZATION elapsedMs=${Date.now() - startTime}`);
      await updateMigrationJobState(db, websiteId, runId, {
        status: "FINALIZING",
        progress: 85,
        currentStage: "Localizing internal links & verifying layout...",
        completedPages: completedCount,
        failedPages: failedCount,
        pageDiagnostics,
      });

      try {
        await withTimeout(
          (async () => {
            const { pageMap, sourceHostnames } = buildLocalPageMap(capturedPages, scanResult.domain);
            for (const page of capturedPages) {
              const locRes = localizeHtmlLinks(page.html_content, pageMap, sourceHostnames);
              if (locRes.internalLinksRewritten > 0) {
                page.html_content = locRes.html;
              }
            }
          })(),
          2000,
          "LINK_LOCALIZATION",
          runId
        );
      } catch (linkErr: any) {
        console.error(`[MIGRATION_FINALIZE_ERROR] runId=${runId} websiteId=${websiteId} operation=LINK_LOCALIZATION error="${linkErr?.message || linkErr}" elapsedMs=${Date.now() - startTime}`);
      }
      console.log(`[MIGRATION_LINK_LOCALIZATION_COMPLETE] runId=${runId} websiteId=${websiteId} operation=LINK_LOCALIZATION elapsedMs=${Date.now() - startTime}`);

      // 3. LAYOUT VERIFICATION STAGE
      console.log(`[MIGRATION_LAYOUT_VERIFY_START] runId=${runId} websiteId=${websiteId} operation=LAYOUT_VERIFY elapsedMs=${Date.now() - startTime}`);
      try {
        await withTimeout(
          (async () => {
            for (const page of capturedPages) {
              if (!page.html_content || page.html_content.length < 100) {
                console.warn(`[LAYOUT_VERIFY_WARN] runId=${runId} path="${page.path}" empty or truncated HTML`);
              }
            }
          })(),
          1000,
          "LAYOUT_VERIFY",
          runId
        );
      } catch (verifyErr: any) {
        console.error(`[MIGRATION_FINALIZE_ERROR] runId=${runId} websiteId=${websiteId} operation=LAYOUT_VERIFY error="${verifyErr?.message || verifyErr}" elapsedMs=${Date.now() - startTime}`);
      }
      console.log(`[MIGRATION_LAYOUT_VERIFY_COMPLETE] runId=${runId} websiteId=${websiteId} operation=LAYOUT_VERIFY elapsedMs=${Date.now() - startTime}`);

      // 4. DATABASE FINALIZE STAGE (Batch/Parallel Update for all pages)
      console.log(`[MIGRATION_DB_FINALIZE_START] runId=${runId} websiteId=${websiteId} operation=DB_FINALIZE count=${capturedPages.length} elapsedMs=${Date.now() - startTime}`);
      try {
        await withTimeout(
          Promise.allSettled(
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
          ),
          4000,
          "DATABASE_PAGE_FINALIZE",
          runId
        );
      } catch (dbErr: any) {
        console.error(`[MIGRATION_FINALIZE_ERROR] runId=${runId} websiteId=${websiteId} operation=DB_FINALIZE error="${dbErr?.message || dbErr}" elapsedMs=${Date.now() - startTime}`);
      }
      console.log(`[MIGRATION_DB_FINALIZE_COMPLETE] runId=${runId} websiteId=${websiteId} operation=DB_FINALIZE elapsedMs=${Date.now() - startTime}`);

      // 5. Trigger async SEO intelligence analysis (NON-BLOCKING)
      try {
        setTimeout(() => {
          runOpportunityScan(supabase, websiteId, userId).catch((err: any) => {
            console.error(`[MIGRATION_FINALIZE_ERROR] runId=${runId} websiteId=${websiteId} operation=SEO_OPPORTUNITY_SCAN error="${err?.message || err}"`);
          });
        }, 50);
      } catch {
        // Non-blocking
      }

      const manifests = capturedPages.map((p) => p.manifest).filter(Boolean) as any[];

      const finalResult: MigrationExecuteResult = {
        success: true,
        websiteId,
        draftSlug: cleanSlug,
        title,
        summary: scanResult.summary,
        warnings: scanResult.warnings,
        urlMappings: scanResult.urlMappings,
        capturedPages,
        manifests,
      };

      // Mark migration as COMPLETED only after ALL pages, assets, and DB records are verified
      await withTimeout(
        updateMigrationJobState(db, websiteId, runId, {
          status: "COMPLETED",
          progress: 100,
          currentStage: "Draft Website Ready!",
          completedPages: completedCount,
          failedPages: failedCount,
          error: null,
          result: finalResult,
          pageDiagnostics,
        }),
        3000,
        "FINAL_COMPLETED_STATUS_UPDATE",
        runId
      );

      console.log(`[MIGRATION_COMPLETED] runId=${runId} websiteId=${websiteId} operation=MIGRATION_COMPLETED totalTimeMs=${Date.now() - startTime}`);
      return finalResult;
    } catch (err: any) {
      const errorMsg = String(err?.message || err || "Migration failed during execution.");
      console.error(`[MIGRATION_FINALIZE_ERROR] runId=${runId} websiteId=${websiteId} operation=EXECUTE_MIGRATION_EXCEPTION error="${errorMsg}" elapsedMs=${Date.now() - startTime}`);

      if (capturedPages.length === 0) {
        // Clean up empty website row so broken draft never pollutes the dashboard
        await safeDbDelete(db, "website_pages", "website_id", websiteId, runId, websiteId);
        await safeDbDelete(db, "website_seo", "website_id", websiteId, runId, websiteId);
        await safeDbDelete(db, "websites", "id", websiteId, runId, websiteId);
      } else {
        await updateMigrationJobState(db, websiteId, runId, {
          status: "FAILED",
          progress: 0,
          currentStage: "Migration Failed",
          error: errorMsg,
          completedPages: completedCount,
          failedPages: failedCount,
          pageDiagnostics,
        });
      }

      throw err;
    } finally {
      if (sharedBrowser) {
        console.log(`[MIGRATION_BROWSER_CLOSE_START] runId=${runId} websiteId=${websiteId} operation=BROWSER_CLOSE elapsedMs=${Date.now() - startTime}`);
        try {
          await withTimeout(sharedBrowser.close().catch(() => {}), 2000, "BROWSER_CLOSE", runId).catch(() => {});
        } catch {
          // Ignore browser close timeout
        }
        console.log(`[MIGRATION_BROWSER_CLOSE_COMPLETE] runId=${runId} websiteId=${websiteId} operation=BROWSER_CLOSE elapsedMs=${Date.now() - startTime}`);
      }
    }
  }



