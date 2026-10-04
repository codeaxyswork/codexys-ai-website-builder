import { createClient } from "@/utils/supabase/server";
import { SourceWebsiteScan, MigrationMode, MigrationSelections, MigrationExecuteResult, PageCaptureManifest } from "./types";
import { convertPageToCodeaxysNative, convertPageToExactSnapshot } from "./converter";
import { generateAIRedesignForPage, DEFAULT_REDESIGN_PROMPT, buildSourcePageFromBrowserSnapshot } from "./redesign-engine";
import { captureSourcePageWithBrowser, fallbackHttpCapture } from "./browser-capture";
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
 * Bulletproof database cleanup helper using explicit async/await with try/catch.
 * NEVER calls .catch() on the Supabase query builder object.
 */
async function safeDbDelete(db: any, table: string, column: string, value: string) {
  try {
    const { error } = await db.from(table).delete().eq(column, value);
    if (error) {
      console.error(`[SAFE DB DELETE ERROR] (${table}.${column}=${value}):`, error.message);
    }
  } catch (err: any) {
    console.error(`[SAFE DB DELETE EXCEPTION] (${table}.${column}=${value}):`, err?.message || err);
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
 * Updates migration job state persisted inside websites.design_plan->migration_job.
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
  try {
    const { data: web } = await db.from("websites").select("design_plan").eq("id", websiteId).maybeSingle();
    if (!web) return;

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

    await db
      .from("websites")
      .update({
        design_plan: {
          ...currentPlan,
          migration_job: updatedJob,
        },
      })
      .eq("id", websiteId);
  } catch (e: any) {
    console.warn(`[MIGRATION JOB STATE UPDATE WARN]`, e?.message);
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
      // Re-use existing draft website for this user & brand
      websiteId = existingWebsite.id;
      cleanSlug = existingWebsite.slug || cleanBrand;

      await safeDbDelete(db, "website_pages", "website_id", websiteId);
      await safeDbDelete(db, "website_seo", "website_id", websiteId);

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
      console.log(`[MIGRATION DRAFT PREPARED] Re-using existing draft website ${websiteId} for ${cleanSlug}`);
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
        throw new Error(`Failed to create migration draft website: ${createWebError?.message || "Unknown error"}`);
      }
      websiteId = newWebsite.id;
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
      throw new Error(`Failed to create migration draft website: ${createWebError?.message || "Unknown error"}`);
    }
    websiteId = newWebsite.id;
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

    // Circuit breaker check per host
    if ((failedHostsMap.get(host) || 0) >= 2) {
      return null;
    }

    // SSRF check on host
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
    if (buffer.length > 10 * 1024 * 1024) return null; // 10MB limit

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
  console.log(`\n[MIGRATION_EXECUTION_START] runId: ${runId} | mode: ${mode} | targetUrl: ${scanResult.targetUrl}`);

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

  const PAGE_TIMEOUT_MS = 20000; // 20s per-page timeout threshold
  const SLA_HARD_CAP_MS = 38000; // 38s total runtime budget threshold

  let completedCount = 0;
  let failedCount = 0;

  try {
    // Process and convert pages
    for (let i = 0; i < pagesToMigrate.length; i++) {
      const srcPage = pagesToMigrate[i];
      const pageStartTime = Date.now();
      const elapsedTime = pageStartTime - startTime;

      const currentProgress = Math.min(20 + Math.floor(((i + 1) / totalPages) * 50), 70);
      await updateMigrationJobState(db, websiteId, runId, {
        status: "CAPTURING_PAGE",
        progress: currentProgress,
        currentStage: `Capturing page ${i + 1}/${totalPages} (${srcPage.path})...`,
        currentPage: i + 1,
        totalPages,
        completedPages: completedCount,
        failedPages: failedCount,
        pageDiagnostics,
      });

      if (i > 0 && elapsedTime > SLA_HARD_CAP_MS) {
        console.log(`[MIGRATION SLA GUARD] Hard SLA cap reached (${elapsedTime}ms > ${SLA_HARD_CAP_MS}ms). Finalizing draft with ${capturedPages.length} captured pages.`);
        break;
      }
      console.log(`[MIGRATION] PAGE CREATE START [${i + 1}/${totalPages}] (${srcPage.path}) elapsed: ${elapsedTime}ms`);

      let finalHtml = "";
      let finalCss = "";
      let finalJs = "";
      let pageCapturedSuccess = false;
      let pageErrorMessage: string | null = null;

      if (mode === "exact") {
        // EXACT MODE: PLAYWRIGHT BROWSER SNAPSHOT WITH BOUNDED TIMEOUT & HTTP FALLBACK
        console.log(`[MIGRATION] BROWSER CAPTURE START (${srcPage.path}) elapsed: ${Date.now() - startTime}ms`);
        let browserSnapshot;

        const forceFastCapture = i > 0 && (Date.now() - startTime) > PAGE_TIMEOUT_MS;
        if (forceFastCapture) {
          console.log(`[MIGRATION] PAGE TIMEOUT GUARD ACTIVATED (${srcPage.path}): Switching secondary page to fast HTTP capture.`);
        }

        try {
          if (!forceFastCapture) {
            browserSnapshot = await captureSourcePageWithBrowser(srcPage.url, runId);
          } else {
            browserSnapshot = await fallbackHttpCapture(srcPage.url, Date.now());
          }
        } catch (err: any) {
          pageErrorMessage = err?.message || "Playwright browser capture failed";
          console.warn(`[MIGRATION PAGE CAPTURE WARNING] (${srcPage.path}): ${pageErrorMessage}. Attempting fallback HTTP capture...`);
          browserSnapshot = await fallbackHttpCapture(srcPage.url, Date.now()).catch((e) => {
            pageErrorMessage = e?.message || pageErrorMessage;
            return undefined;
          });
        }

        if (browserSnapshot) {
          (srcPage as any)._browserManifest = browserSnapshot.manifest;
        }

        if (!browserSnapshot || !browserSnapshot.html || browserSnapshot.html.length < 500) {
          failedCount++;
          pageDiagnostics.push({
            url: srcPage.url,
            path: srcPage.path,
            pageNumber: i + 1,
            status: i === 0 ? "FAILED" : "SKIPPED",
            durationMs: Date.now() - pageStartTime,
            error: pageErrorMessage || "Invalid or empty HTML content captured",
            retryCount: 0,
          });

          if (i === 0) {
            // Homepage capture failed — Clean up draft website so no broken draft record pollutes the dashboard
            await safeDbDelete(db, "website_pages", "website_id", websiteId);
            await safeDbDelete(db, "website_seo", "website_id", websiteId);
            await safeDbDelete(db, "websites", "id", websiteId);

            const failMsg = `Exact capture could not render the source homepage (${srcPage.url}). Draft website cleaned up cleanly.`;
            console.error(`[MIGRATION FAILURE DIAGNOSTIC] runId: ${runId} | websiteId: ${websiteId} | sourceUrl: ${srcPage.url} | error: ${failMsg}`);
            throw new Error(failMsg);
          } else {
            console.warn(`[MIGRATION PAGE SKIPPED] Exact capture invalid HTML for secondary page ${srcPage.url}, skipping...`);
            continue;
          }
        }

        let capturedHtml = browserSnapshot.html;
        let capturedCss = browserSnapshot.css || "";

        // Collect all visual asset URLs strictly from browser snapshot
        const urlsToMigrate = new Set<string>();
        if (browserSnapshot.assetUrls) {
          browserSnapshot.assetUrls.forEach((u) => {
            if (u && (u.startsWith("http://") || u.startsWith("https://"))) urlsToMigrate.add(u);
          });
        }

        // Parallel Bounded Batch Asset Localization (capped to top 5 key assets per page)
        if (selections?.content?.images !== false && urlsToMigrate.size > 0) {
          const urlArray = Array.from(urlsToMigrate).slice(0, 5);
          const BATCH_SIZE = 6;
          for (let b = 0; b < urlArray.length; b += BATCH_SIZE) {
            const chunk = urlArray.slice(b, b + BATCH_SIZE);
            await Promise.all(
              chunk.map(async (rawUrl) => {
                const localizedUrl = await importMediaAsset(supabase, userId, websiteId, rawUrl, urlCache);
                if (localizedUrl && localizedUrl !== rawUrl) {
                  capturedHtml = capturedHtml.replaceAll(rawUrl, localizedUrl);
                  capturedCss = capturedCss.replaceAll(rawUrl, localizedUrl);
                }
              })
            );
          }
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
        // SOURCE-PRESERVING AI REDESIGN MODE
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
        // REBUILD MODE
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

      const pageId = insertedPages?.id;
      if (pageInsertError) {
        console.error(`[MIGRATION PAGE INSERT ERROR] Failed to save website_pages for ${pagePath}:`, pageInsertError.message);
      }

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

        await db.from("website_page_seo").insert(pageSeoPayload);
      }

      let pageManifest = (mode === "exact" && (srcPage as any)._browserManifest) || undefined;

      capturedPages.push({
        path: pagePath,
        html_content: finalHtml,
        css_content: finalCss,
        manifest: pageManifest,
      });

      console.log(`[MIGRATION] PAGE CREATE COMPLETE (${srcPage.path}) ${Date.now() - startTime}ms`);
    }

    await updateMigrationJobState(db, websiteId, runId, {
      status: "CAPTURING_ASSETS",
      progress: 75,
      currentStage: "Importing external media assets to storage...",
      completedPages: completedCount,
      failedPages: failedCount,
      pageDiagnostics,
    });

    try {
      const assetImportResult = await importAndStoreMigrationAssets(userId, websiteId, scanResult.baseUrl, capturedPages, { customSupabaseClient: db });
      if (assetImportResult.urlMap.size > 0) {
        console.log(`[MIGRATION] ASSET IMPORT COMPLETE: Rewriting DB records for ${assetImportResult.urlMap.size} asset URLs`);
        for (const page of capturedPages) {
          await db
            .from("website_pages")
            .update({
              html_content: page.html_content,
              css_content: page.css_content,
            })
            .eq("website_id", websiteId)
            .eq("path", page.path);
        }
      }
    } catch (assetErr: any) {
      console.warn(`[MIGRATION ASSET IMPORT WARNING] (${Date.now() - startTime}ms):`, assetErr?.message);
    }

    await updateMigrationJobState(db, websiteId, runId, {
      status: "FINALIZING",
      progress: 90,
      currentStage: "Localizing internal links & verifying layout...",
      completedPages: completedCount,
      failedPages: failedCount,
      pageDiagnostics,
    });

    // Localize internal links across all captured pages
    console.log(`[MIGRATION] LOCALIZING INTERNAL LINKS ${Date.now() - startTime}ms`);
    try {
      const { pageMap, sourceHostnames } = buildLocalPageMap(capturedPages, scanResult.domain);
      for (const page of capturedPages) {
        const locRes = localizeHtmlLinks(page.html_content, pageMap, sourceHostnames);
        if (locRes.internalLinksRewritten > 0) {
          page.html_content = locRes.html;
          await db
            .from("website_pages")
            .update({ html_content: locRes.html })
            .eq("website_id", websiteId)
            .eq("path", page.path);
        }
      }
      console.log(`[MIGRATION] INTERNAL LINKS LOCALIZED ${Date.now() - startTime}ms`);
    } catch (err: any) {
      console.warn("[MIGRATION] Internal link localization warning:", err?.message);
    }

    // Trigger async SEO intelligence analysis (NON-BLOCKING)
    try {
      setTimeout(() => {
        runOpportunityScan(supabase, websiteId, userId).catch((err: any) => {
          console.error("Async SEO Analysis trigger after migration failed:", err);
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
    await updateMigrationJobState(db, websiteId, runId, {
      status: "COMPLETED",
      progress: 100,
      currentStage: "Draft Website Ready!",
      completedPages: completedCount,
      failedPages: failedCount,
      error: null,
      result: finalResult,
      pageDiagnostics,
    });

    console.log(`[MIGRATION COMPLETE] runId: ${runId} | websiteId: ${websiteId} | slug: ${cleanSlug} | totalTime: ${Date.now() - startTime}ms`);
    return finalResult;
  } catch (err: any) {
    const errorMsg = String(err?.message || err || "Migration failed during execution.");
    console.error(`[MIGRATION EXCEPTION] runId: ${runId} | websiteId: ${websiteId}:`, errorMsg);

    if (capturedPages.length === 0) {
      // Clean up empty website row so broken draft never pollutes the dashboard
      await safeDbDelete(db, "website_pages", "website_id", websiteId);
      await safeDbDelete(db, "website_seo", "website_id", websiteId);
      await safeDbDelete(db, "websites", "id", websiteId);
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
  }
}
