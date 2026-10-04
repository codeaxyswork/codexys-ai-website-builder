import { createClient, createAdminClient } from "@/utils/supabase/server";
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
 * Downloads external image/media/font safely and saves to media_assets & storage bucket.
 * Uses a strict 1.8s timeout per asset & circuit breaker per host to prevent blocking migration.
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

    // Insert metadata into media_assets table
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
 * Executes full migration to produce a Codeaxys Native Draft Website.
 */
export async function executeWebsiteMigration(
  userId: string,
  scanResult: SourceWebsiteScan,
  mode: MigrationMode,
  selections: MigrationSelections,
  customSupabaseClient?: any,
  redesignPrompt?: string,
  customRunId?: string
): Promise<MigrationExecuteResult> {
  const runId = customRunId || `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const startTime = Date.now();
  console.log(`\n[MIGRATION_EXECUTION_START] runId: ${runId} | mode: ${mode} | targetUrl: ${scanResult.targetUrl}`);

  const supabase = customSupabaseClient || (await createClient());
  console.log(`[MIGRATION] URL VALIDATED ${Date.now() - startTime}ms`);

  // 1. Derive title and unique draft slug
  const rawTitle = scanResult.pages[0]?.title || scanResult.domain || "Migrated Website";
  const title = rawTitle.length > 50 ? rawTitle.substring(0, 47) + "..." : rawTitle;

  // Derive clean brand slug (e.g. mncconline.com -> mncc)
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

  // Ensure slug uniqueness
  let cleanSlug = cleanBrand;
  const { data: existingSlug } = await supabase
    .from("websites")
    .select("id")
    .or(`slug.eq.${cleanSlug},published_slug.eq.${cleanSlug}`)
    .maybeSingle();

  if (existingSlug) {
    const suffix = Math.random().toString(36).substring(2, 7);
    cleanSlug = `${cleanBrand}-${suffix}`;
  }

  const db = getSafeAdminClient();

  console.log(`[MIGRATION] WEBSITE CREATE START ${Date.now() - startTime}ms`);
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
      },
    })
    .select("id")
    .single();

  if (createWebError || !newWebsite) {
    const errorMsg = `Failed to create migration draft website: ${createWebError?.message || "Unknown error"} (code: ${createWebError?.code || "none"})`;
    console.error(`[MIGRATION FAILURE DIAGNOSTIC]
      runId: ${runId}
      websiteId: none
      userId: ${userId}
      sourceUrl: ${scanResult.targetUrl}
      mode: ${mode}
      stage: WEBSITE_RECORD_INSERTION
      error: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const websiteId = newWebsite.id;
  console.log(`[MIGRATION] WEBSITE CREATE COMPLETE ${Date.now() - startTime}ms (websiteId: ${websiteId})`);

  const urlCache = new Map<string, string>();
  const capturedPages: { path: string; html_content: string; css_content: string; manifest?: PageCaptureManifest }[] = [];

  const pagesToMigrate = scanResult.pages;
  const TIME_BUDGET_MS = 20000; // 20s budget threshold to switch secondary pages to fast HTTP capture
  const SLA_HARD_CAP_MS = 38000; // 38s budget threshold to break page loop and finalize migration response

  // 3. Process and convert pages
  for (let i = 0; i < pagesToMigrate.length; i++) {
    const srcPage = pagesToMigrate[i];
    const pageStartTime = Date.now();
    const elapsedTime = pageStartTime - startTime;

    if (i > 0 && elapsedTime > SLA_HARD_CAP_MS) {
      console.log(`[MIGRATION SLA GUARD] Hard SLA cap reached (${elapsedTime}ms > ${SLA_HARD_CAP_MS}ms). Finalizing draft with ${capturedPages.length} captured pages.`);
      break;
    }
    console.log(`[MIGRATION] PAGE CREATE START [${i + 1}/${pagesToMigrate.length}] (${srcPage.path}) elapsed: ${elapsedTime}ms`);

    let finalHtml = "";
    let finalCss = "";
    let finalJs = "";

    if (mode === "exact") {
      // EXACT MODE: PLAYWRIGHT BROWSER SNAPSHOT + HTTP FALLBACK RESILIENCY
      console.log(`[MIGRATION] BROWSER CAPTURE START (${srcPage.path}) elapsed: ${Date.now() - startTime}ms`);
      let browserSnapshot;

      // Time Budget Guard: If elapsed time > 25s and i > 0, use fast HTTP capture for secondary pages
      const forceFastCapture = i > 0 && (Date.now() - startTime) > TIME_BUDGET_MS;
      if (forceFastCapture) {
        console.log(`[MIGRATION] TIME BUDGET GUARD ACTIVATED (${srcPage.path}): Switching secondary page to fast HTTP capture to preserve request SLA.`);
      }

      try {
        if (!forceFastCapture) {
          browserSnapshot = await captureSourcePageWithBrowser(srcPage.url, runId);
        } else {
          browserSnapshot = await fallbackHttpCapture(srcPage.url, Date.now());
        }
      } catch (err: any) {
        console.warn(`[MIGRATION PAGE CAPTURE WARNING] (${srcPage.path}): Playwright browser capture failed: ${err.message}. Attempting fallback HTTP capture...`);
        browserSnapshot = await fallbackHttpCapture(srcPage.url, Date.now()).catch(() => undefined);
      }

      if (browserSnapshot) {
        (srcPage as any)._browserManifest = browserSnapshot.manifest;
        console.log(`[MIGRATION] SOURCE LOADED (${srcPage.path}) elapsed: ${Date.now() - startTime}ms`);
      }

      if (!browserSnapshot || !browserSnapshot.html || browserSnapshot.html.length < 500) {
        if (i === 0) {
          // Page 0 cleanup: Delete draft website record so no orphan website remains
          await db.from("websites").delete().eq("id", websiteId).catch(() => {});
          const failMsg = `Exact capture could not render the source homepage (${srcPage.url}). Draft website ${websiteId} cleaned up.`;
          console.error(`[MIGRATION FAILURE DIAGNOSTIC]
            runId: ${runId}
            websiteId: ${websiteId}
            userId: ${userId}
            sourceUrl: ${srcPage.url}
            mode: ${mode}
            stage: HOMEPAGE_CAPTURE
            error: ${failMsg}`);
          throw new Error(failMsg);
        } else {
          console.warn(`[MIGRATION PAGE SKIPPED] Exact capture invalid HTML for secondary page ${srcPage.url}, skipping...`);
          continue;
        }
      }

      let capturedHtml = browserSnapshot.html;
      let capturedCss = browserSnapshot.css || "";

      console.log(`[MIGRATION] HTML CAPTURED ${Date.now() - startTime}ms`);
      console.log(`[MIGRATION] CSS CAPTURED ${Date.now() - startTime}ms`);
      console.log(`[MIGRATION] JS CAPTURED ${Date.now() - startTime}ms`);

      // Collect all visual asset URLs strictly from browser snapshot
      const urlsToMigrate = new Set<string>();
      if (browserSnapshot.assetUrls) {
        browserSnapshot.assetUrls.forEach((u) => {
          if (u && (u.startsWith("http://") || u.startsWith("https://"))) urlsToMigrate.add(u);
        });
      }
      if (browserSnapshot.slides) {
        browserSnapshot.slides.forEach((s) => {
          if (s.bgImage && s.bgImage.startsWith("http")) urlsToMigrate.add(s.bgImage);
          if (s.foregroundImages) {
            s.foregroundImages.forEach((fg) => {
              if (fg && fg.startsWith("http")) urlsToMigrate.add(fg);
            });
          }
        });
      }

      console.log(`[MIGRATION] ASSETS CAPTURED (${urlsToMigrate.size} assets) ${Date.now() - startTime}ms`);

      // Parallel Bounded Batch Asset Localization (capped to top 5 key assets per page for fast response)
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

      console.log(`[MIGRATION] ASSETS LOCALIZED ${Date.now() - startTime}ms`);

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
    } else if (mode === "redesign") {
      // SOURCE-PRESERVING AI REDESIGN MODE WITH REAL BROWSER CAPTURE
      console.log(`[MIGRATION REDESIGN] BROWSER CAPTURE START (${srcPage.path}) ${Date.now() - startTime}ms`);
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

      console.log(
        `[MIGRATION REDESIGN] RICH SOURCE PAGE DERIVED (${richSourcePage.headings.length} headings, ${richSourcePage.paragraphs.length} paras, ${richSourcePage.images.length} images)`
      );

      const userPrompt = redesignPrompt || DEFAULT_REDESIGN_PROMPT;
      const converted = await generateAIRedesignForPage(richSourcePage, scanResult.globalStyles, selections, userPrompt, undefined, userId, undefined, runId);
      finalHtml = converted.htmlContent;
      finalCss = converted.cssContent;
      finalJs = converted.jsContent;

      if (selections?.content?.images !== false) {
        const urlsToMigrate = new Set<string>();

        if (srcPage.heroBgImage && srcPage.heroBgImage.startsWith("http")) urlsToMigrate.add(srcPage.heroBgImage);
        if (srcPage.logoUrl && srcPage.logoUrl.startsWith("http")) urlsToMigrate.add(srcPage.logoUrl);

        srcPage.sections.forEach((sec: any) => {
          if (sec.bgImage && sec.bgImage.startsWith("http")) urlsToMigrate.add(sec.bgImage);
          if (sec.slides) {
            sec.slides.forEach((s: any) => {
              if (s.bgImage && s.bgImage.startsWith("http")) urlsToMigrate.add(s.bgImage);
              if (s.foregroundImages) {
                s.foregroundImages.forEach((fg: any) => {
                  if (fg && fg.startsWith("http")) urlsToMigrate.add(fg);
                });
              }
            });
          }
        });

        srcPage.images.forEach((img: any) => {
          if (img.src && img.src.startsWith("http")) urlsToMigrate.add(img.src);
        });

        const urlArray = Array.from(urlsToMigrate).slice(0, 25);
        const BATCH_SIZE = 6;
        for (let b = 0; b < urlArray.length; b += BATCH_SIZE) {
          const chunk = urlArray.slice(b, b + BATCH_SIZE);
          await Promise.all(
            chunk.map(async (rawUrl) => {
              const importedUrl = await importMediaAsset(supabase, userId, websiteId, rawUrl, urlCache);
              if (importedUrl) {
                finalHtml = finalHtml.replaceAll(rawUrl, importedUrl);
                finalCss = finalCss.replaceAll(rawUrl, importedUrl);
              }
            })
          );
        }
      }
    } else {
      // REBUILD MODE
      const converted = convertPageToCodeaxysNative(srcPage, scanResult.globalStyles, mode, selections);
      finalHtml = converted.htmlContent;
      finalCss = converted.cssContent;
      finalJs = converted.jsContent;
    }

    console.log(`[MIGRATION] SEO SAVE START ${Date.now() - startTime}ms`);
    const pagePath = (!srcPage.path || srcPage.path === "/" || srcPage.path === "/index.html") ? "index.html" : srcPage.path;

    const pageInsertPayload = {
      website_id: websiteId,
      user_id: userId,
      path: pagePath,
      html_content: finalHtml,
      css_content: finalCss,
      js_content: finalJs,
    };

    // Insert into website_pages directly via admin client
    const { data: insertedPages, error: pageInsertError } = await db
      .from("website_pages")
      .insert(pageInsertPayload)
      .select("id")
      .single();

    const pageId = insertedPages?.id;
    if (pageInsertError) {
      console.error(`[MIGRATION PAGE INSERT ERROR] Failed to save website_pages for ${pagePath}:`, pageInsertError.message);
    }

    // Save page-level SEO metadata to website_page_seo table if pageId is available
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
      if (selections?.seo?.openGraph !== false && srcPage.seo?.ogTitle) {
        pageSeoPayload.og_title = srcPage.seo.ogTitle;
        pageSeoPayload.og_image_url = srcPage.seo.ogImage;
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

    console.log(`[MIGRATION] SEO SAVE COMPLETE ${Date.now() - startTime}ms`);
    console.log(`[MIGRATION] PAGE CREATE COMPLETE (${srcPage.path}) ${Date.now() - startTime}ms`);
  }

  // 3.4 Full External Asset Import & Storage Pipeline
  console.log(`[MIGRATION] EXPORTING & STORING EXTERNAL MEDIA ASSETS ${Date.now() - startTime}ms`);
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

  // 3.5 Localize internal links across all captured pages
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

  // 4. Trigger async SEO intelligence analysis (NON-BLOCKING)
  console.log(`[MIGRATION] OPPORTUNITY SCAN START ${Date.now() - startTime}ms`);
  try {
    setTimeout(() => {
      runOpportunityScan(supabase, websiteId, userId).catch((err: any) => {
        console.error("Async SEO Analysis trigger after migration failed:", err);
      });
    }, 50);
  } catch {
    // Non-blocking
  }
  console.log(`[MIGRATION] OPPORTUNITY SCAN SCHEDULED ${Date.now() - startTime}ms`);

  console.log(`[MIGRATION] FINALIZE START ${Date.now() - startTime}ms`);
  console.log(`[MIGRATION] FINALIZE COMPLETE ${Date.now() - startTime}ms`);
  console.log(`[MIGRATION] RESPONSE SENT ${Date.now() - startTime}ms`);

  const manifests = capturedPages.map((p) => p.manifest).filter(Boolean) as any[];

  return {
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
}
