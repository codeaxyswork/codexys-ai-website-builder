import { createAdminClient } from "@/utils/supabase/server";
import { isPrivateOrReservedIP, validateAndSanitizeUrl } from "./scanner";
import { invalidateUserCache } from "@/lib/cache";
import crypto from "crypto";

export interface AssetImportStats {
  detected: number;
  eligible: number;
  imported: number;
  failed: number;
  deduplicated: number;
  totalBytes: number;
}

export interface MigrationAssetImportResult {
  stats: AssetImportStats;
  urlMap: Map<string, string>;
}

export function getSafeAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yumsturujjjgdxsrqgbm.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const { createClient: createSupabaseDirectClient } = require("@supabase/supabase-js");
  return createSupabaseDirectClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function sanitizeFileName(rawName: string): string {
  const name = rawName.split("?")[0].split("#")[0];
  const parts = name.split("/");
  const base = parts[parts.length - 1] || "asset";
  const clean = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  if (clean.length > 80) {
    const extIdx = clean.lastIndexOf(".");
    const ext = extIdx > -1 ? clean.substring(extIdx) : ".jpg";
    return clean.substring(0, 70) + ext;
  }
  return clean || "image.jpg";
}

/**
 * Universal, domain-agnostic media asset validation.
 * Supports all standard image and media extensions, image query-string formats,
 * and standard media path patterns, while strictly filtering out code, fonts, documents, and analytics.
 */
export function isSupportedAssetUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== "string") return false;
  const trimmed = urlStr.trim();
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return false;
  }

  const lower = trimmed.toLowerCase();

  // Exclude third-party analytics, tracking pixels, ads, and telemetry
  if (
    lower.includes("google-analytics.com") ||
    lower.includes("googletagmanager.com") ||
    lower.includes("facebook.net") ||
    lower.includes("doubleclick.net") ||
    lower.includes("connect.facebook.net") ||
    lower.includes("clarity.ms") ||
    lower.includes("hotjar") ||
    lower.includes("statcounter") ||
    lower.includes("bat.bing.com") ||
    lower.includes("pixel")
  ) {
    return false;
  }

  // Exclude assets that are already localized in Codeaxys / Supabase storage
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yumsturujjjgdxsrqgbm.supabase.co";
  let supabaseHost = "";
  try {
    supabaseHost = new URL(supabaseUrl).hostname.toLowerCase();
  } catch {}

  if (
    (supabaseHost && lower.includes(supabaseHost)) ||
    lower.includes("/storage/v1/object/public/website-assets/")
  ) {
    return false;
  }

  // Parse path and query parameters
  let pathname = "";
  let search = "";
  try {
    const parsed = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed, "https://codeaxys-dummy.local");
    pathname = parsed.pathname.toLowerCase();
    search = parsed.search.toLowerCase();
  } catch {
    const withoutHash = lower.split("#")[0];
    const parts = withoutHash.split("?");
    pathname = parts[0] || "";
    search = parts[1] || "";
  }

  // Exclude non-media file types (code, styles, fonts, documents)
  if (
    pathname.endsWith(".js") ||
    pathname.endsWith(".mjs") ||
    pathname.endsWith(".cjs") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".html") ||
    pathname.endsWith(".htm") ||
    pathname.endsWith(".php") ||
    pathname.endsWith(".json") ||
    pathname.endsWith(".xml") ||
    pathname.endsWith(".txt") ||
    pathname.endsWith(".map") ||
    pathname.endsWith(".woff") ||
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".ttf") ||
    pathname.endsWith(".eot") ||
    pathname.endsWith(".otf")
  ) {
    return false;
  }

  // Universal media extensions
  const supportedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".svg",
    ".ico",
    ".avif",
    ".bmp",
    ".tiff",
    ".tif",
    ".mp4",
    ".webm",
    ".mov",
  ];
  if (supportedExtensions.some((ext) => pathname.endsWith(ext))) {
    return true;
  }

  // Generic dynamic image CDN parameters (e.g. ?format=webp, ?auto=format, ?fm=jpg, etc.)
  if (
    search.includes("format=") ||
    search.includes("ext=") ||
    search.includes("fm=") ||
    search.includes("auto=format") ||
    search.includes("fit=crop") ||
    search.includes("width=") ||
    search.includes("w=") ||
    search.includes("image")
  ) {
    return true;
  }

  // Standard media directory patterns across web frameworks and CMSs
  if (
    pathname.includes("/image") ||
    pathname.includes("/img") ||
    pathname.includes("/photo") ||
    pathname.includes("/picture") ||
    pathname.includes("/upload") ||
    pathname.includes("/media") ||
    pathname.includes("/asset") ||
    pathname.includes("/attachment") ||
    pathname.includes("/gallery") ||
    pathname.includes("/avatar") ||
    pathname.includes("/icon") ||
    pathname.includes("/banner") ||
    pathname.includes("/thumb") ||
    pathname.includes("/cdn")
  ) {
    return true;
  }

  return false;
}

/**
 * Deterministically scans HTML/CSS content to discover all referenced media assets.
 * Extracts src, srcset, data-*, video posters, icons, social preview metadata, and CSS url(...).
 */
export function extractAssetUrlsFromHtml(html: string, baseUrl: string): string[] {
  if (!html) return [];
  const extracted = new Set<string>();

  // 1. Standard src and poster attributes
  const srcMatches = html.matchAll(/(?:src|poster)\s*=\s*["']([^"']+)["']/gi);
  for (const match of srcMatches) {
    if (match[1]) extracted.add(match[1].trim());
  }

  // 2. Responsive srcset and data-srcset attributes
  const srcsetMatches = html.matchAll(/(?:srcset|data-srcset|data-lazy-srcset)\s*=\s*["']([^"']+)["']/gi);
  for (const match of srcsetMatches) {
    if (match[1]) {
      const candidates = match[1].split(",");
      for (const cand of candidates) {
        const urlPart = cand.trim().split(/\s+/)[0];
        if (urlPart) extracted.add(urlPart.trim());
      }
    }
  }

  // 3. Lazy loaded attributes
  const lazyMatches = html.matchAll(
    /(?:data-src|data-lazy-src|data-original|data-orig-file|data-large_image|data-image|data-bg|data-background|data-background-image)\s*=\s*["']([^"']+)["']/gi
  );
  for (const match of lazyMatches) {
    if (match[1]) extracted.add(match[1].trim());
  }

  // 4. Social preview images (og:image, twitter:image)
  const metaMatches = html.matchAll(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*>/gi);
  for (const match of metaMatches) {
    const fullTag = match[0].toLowerCase();
    if (
      (fullTag.includes("og:image") ||
        fullTag.includes("twitter:image") ||
        fullTag.includes("thumbnail")) &&
      match[1]
    ) {
      extracted.add(match[1].trim());
    }
  }

  // 5. Favicon and touch icons
  const faviconMatches = html.matchAll(/<link\s+[^>]*href=["']([^"']+)["'][^>]*>/gi);
  for (const match of faviconMatches) {
    const fullTag = match[0].toLowerCase();
    if ((fullTag.includes("icon") || fullTag.includes("apple-touch-icon")) && match[1]) {
      extracted.add(match[1].trim());
    }
  }

  // 6. CSS url(...) references (in styles, inline style attributes, and CSS blocks)
  const cssUrlMatches = html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi);
  for (const match of cssUrlMatches) {
    if (match[1] && !match[1].startsWith("data:")) {
      extracted.add(match[1].trim());
    }
  }

  // Normalize all URLs against baseUrl
  const absoluteUrls: string[] = [];
  for (const rel of extracted) {
    if (rel.startsWith("data:")) continue;
    let abs = rel;
    try {
      if (rel.startsWith("//")) {
        abs = `https:${rel}`;
      } else if (!rel.startsWith("http://") && !rel.startsWith("https://")) {
        abs = new URL(rel, baseUrl).href;
      }
      const parsed = new URL(abs);
      if ((parsed.protocol === "http:" || parsed.protocol === "https:") && isSupportedAssetUrl(abs)) {
        absoluteUrls.push(abs);
      }
    } catch {
      // Ignore invalid URLs
    }
  }

  return Array.from(new Set(absoluteUrls));
}

/**
 * Detect image content type from buffer magic bytes when HTTP headers are missing or generic.
 */
function detectMimeFromBuffer(buffer: Buffer, fallbackContentType: string): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer.length >= 6 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return "image/gif";
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  const prefixStr = buffer.subarray(0, 100).toString("utf8").trim().toLowerCase();
  if (prefixStr.includes("<svg") || prefixStr.includes("<?xml")) {
    return "image/svg+xml";
  }
  return fallbackContentType;
}

/**
 * Safely fetches an external media asset with bounded timeout (8s) and redirect following.
 */
export async function fetchMediaAsset(
  imageUrl: string,
  timeoutMs: number = 8000
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  let targetUrl = imageUrl.trim();
  if (targetUrl.startsWith("//")) targetUrl = `https:${targetUrl}`;

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    isPrivateOrReservedIP(hostname)
  ) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Codeaxys-Asset-Importer/2.0",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
      },
      redirect: "manual",
    });

    clearTimeout(timer);

    // Follow redirects manually up to 5 hops
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (location) {
        let absRedirect = location;
        if (!location.startsWith("http://") && !location.startsWith("https://")) {
          absRedirect = new URL(location, targetUrl).href;
        }
        return await fetchMediaAsset(absRedirect, timeoutMs);
      }
      return null;
    }

    if (!res.ok) return null;

    let contentType = (res.headers.get("content-type") || "image/jpeg").toLowerCase().split(";")[0].trim();
    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    if (buffer.length === 0 || buffer.length > 25 * 1024 * 1024) {
      return null; // Reject empty files or files exceeding 25MB
    }

    contentType = detectMimeFromBuffer(buffer, contentType);

    const isMedia =
      contentType.startsWith("image/") ||
      contentType.includes("svg") ||
      contentType.includes("icon") ||
      contentType.startsWith("video/") ||
      contentType === "application/octet-stream";

    if (!isMedia) return null;

    if (contentType === "application/octet-stream") {
      contentType = "image/jpeg";
    }

    return { buffer, contentType };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Universal, domain-agnostic migration asset localization pipeline.
 * Discovers, downloads, uploads to website-assets storage bucket, inserts into media_assets table,
 * rewrites all HTML/CSS references across all captured pages, and persists updated pages directly to website_pages.
 */
export async function importAndStoreMigrationAssets(
  userId: string,
  websiteId: string,
  baseUrl: string,
  pages: { path: string; html_content: string; css_content?: string; discoveredAssetUrls?: string[] }[],
  options?: { customSupabaseClient?: any; runId?: string; maxAssets?: number }
): Promise<MigrationAssetImportResult> {
  const runId = options?.runId || "unknown";
  const startMs = Date.now();
  console.log(`[MIGRATION_STEP_START] runId=${runId} websiteId=${websiteId} step=ASSET_IMPORT_PIPELINE elapsedMs=0`);

  const db = options?.customSupabaseClient || getSafeAdminClient();

  const stats: AssetImportStats = {
    detected: 0,
    eligible: 0,
    imported: 0,
    failed: 0,
    deduplicated: 0,
    totalBytes: 0,
  };

  const urlMap = new Map<string, string>();
  const allDiscoveredUrls = new Set<string>();

  // 1. Gather all assets: From live browser DOM + static HTML/CSS scan
  for (const page of pages) {
    // Assets discovered dynamically during Playwright page capture
    if (page.discoveredAssetUrls && Array.isArray(page.discoveredAssetUrls)) {
      for (const liveUrl of page.discoveredAssetUrls) {
        if (liveUrl && !liveUrl.startsWith("data:") && isSupportedAssetUrl(liveUrl)) {
          allDiscoveredUrls.add(liveUrl);
        }
      }
    }

    // Assets discovered from HTML content
    const urlsInPage = extractAssetUrlsFromHtml(page.html_content, baseUrl);
    urlsInPage.forEach((u) => allDiscoveredUrls.add(u));

    // Assets discovered from CSS content
    if (page.css_content) {
      const urlsInCss = extractAssetUrlsFromHtml(page.css_content, baseUrl);
      urlsInCss.forEach((u) => allDiscoveredUrls.add(u));
    }
  }

  stats.detected = allDiscoveredUrls.size;

  // 2. Fetch existing media_assets for this website & user to guarantee idempotency
  const existingAssetsMap = new Map<string, string>(); // sourceHash or storagePath or fileName -> publicUrl
  try {
    const { data: existingRows } = await db
      .from("media_assets")
      .select("file_name, storage_path, public_url")
      .eq("website_id", websiteId);

    if (existingRows) {
      for (const row of existingRows) {
        if (row.public_url) {
          existingAssetsMap.set(row.storage_path, row.public_url);
          existingAssetsMap.set(row.file_name, row.public_url);
          // Check if fileName has a hash prefix e.g. "a1b2c3d4_image.jpg"
          const hashPrefix = row.file_name.split("_")[0];
          if (hashPrefix && hashPrefix.length === 8) {
            existingAssetsMap.set(hashPrefix, row.public_url);
          }
        }
      }
    }
  } catch (err: any) {
    console.warn(`[ASSET_IMPORT] Non-fatal warning fetching existing media_assets:`, err?.message || err);
  }

  // 3. Match already-imported assets and determine eligible URLs to download
  const urlsToDownload: string[] = [];
  for (const sourceUrl of allDiscoveredUrls) {
    if (!isSupportedAssetUrl(sourceUrl)) continue;

    const urlHash = crypto.createHash("md5").update(sourceUrl).digest("hex").substring(0, 8);
    const existingUrl = existingAssetsMap.get(urlHash);

    if (existingUrl) {
      urlMap.set(sourceUrl, existingUrl);
      stats.deduplicated++;
    } else {
      urlsToDownload.push(sourceUrl);
    }
  }

  // Production-safe configurable asset limit (default: 250 assets)
  const MAX_IMPORT_ASSETS =
    options?.maxAssets ||
    (process.env.MIGRATION_MAX_IMPORT_ASSETS ? parseInt(process.env.MIGRATION_MAX_IMPORT_ASSETS, 10) : 250);

  const eligibleUrls = urlsToDownload.slice(0, MAX_IMPORT_ASSETS);
  stats.eligible = allDiscoveredUrls.size;

  console.log(
    `[ASSET_IMPORT_DISCOVERY] websiteId=${websiteId} detected=${stats.detected} alreadyImported=${stats.deduplicated} toDownload=${eligibleUrls.length}`
  );

  // 4. Download and store assets in bounded concurrency batches (6 parallel requests)
  const BATCH_SIZE = 6;
  for (let i = 0; i < eligibleUrls.length; i += BATCH_SIZE) {
    const chunk = eligibleUrls.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      chunk.map(async (sourceUrl) => {
        if (urlMap.has(sourceUrl)) {
          stats.deduplicated++;
          return;
        }

        try {
          const fetched = await fetchMediaAsset(sourceUrl, 8000);
          if (!fetched) {
            stats.failed++;
            return;
          }

          const { buffer, contentType } = fetched;
          const parsedUrl = new URL(sourceUrl);
          const rawFileName = sanitizeFileName(parsedUrl.pathname);
          const urlHash = crypto.createHash("md5").update(sourceUrl).digest("hex").substring(0, 8);
          const fileName = `${urlHash}_${rawFileName}`;
          const storagePath = `${userId}/${websiteId}/assets/${fileName}`;

          // Check if file is already in storage
          if (existingAssetsMap.has(storagePath) || existingAssetsMap.has(fileName)) {
            const publicUrl = existingAssetsMap.get(storagePath) || existingAssetsMap.get(fileName)!;
            urlMap.set(sourceUrl, publicUrl);
            stats.deduplicated++;
            return;
          }

          // Upload to Supabase Storage website-assets bucket
          const { error: uploadError } = await db.storage
            .from("website-assets")
            .upload(storagePath, buffer, {
              contentType,
              upsert: true,
            });

          if (uploadError) {
            console.warn(`[ASSET_IMPORT] Storage upload error for ${fileName}:`, uploadError.message);
            stats.failed++;
            return;
          }

          const { data: publicData } = db.storage.from("website-assets").getPublicUrl(storagePath);
          const publicUrl = publicData?.publicUrl || "";
          if (!publicUrl) {
            stats.failed++;
            return;
          }

          // Insert row into media_assets table
          await db.from("media_assets").insert({
            user_id: userId,
            website_id: websiteId,
            file_name: fileName,
            file_size_bytes: buffer.length,
            mime_type: contentType,
            storage_path: storagePath,
            public_url: publicUrl,
          });

          urlMap.set(sourceUrl, publicUrl);
          existingAssetsMap.set(storagePath, publicUrl);
          existingAssetsMap.set(fileName, publicUrl);
          existingAssetsMap.set(urlHash, publicUrl);
          stats.imported++;
          stats.totalBytes += buffer.length;
        } catch (err: any) {
          console.warn(`[ASSET_IMPORT] Error localizing asset ${sourceUrl}:`, err?.message || err);
          stats.failed++;
        }
      })
    );
  }

  // 5. Universal Reference Rewriting across all captured pages (HTML and CSS)
  if (urlMap.size > 0) {
    // Sort mappings by sourceUrl length descending to prevent partial URL prefix replacement
    const sortedReplacements = Array.from(urlMap.entries()).sort(
      (a, b) => b[0].length - a[0].length
    );

    for (const page of pages) {
      for (const [originalUrl, newPublicUrl] of sortedReplacements) {
        // Direct absolute match
        if (page.html_content.includes(originalUrl)) {
          page.html_content = page.html_content.replaceAll(originalUrl, newPublicUrl);
        }
        if (page.css_content && page.css_content.includes(originalUrl)) {
          page.css_content = page.css_content.replaceAll(originalUrl, newPublicUrl);
        }

        // HTML-encoded match (e.g. &amp; in URLs)
        const htmlEncodedUrl = originalUrl.replaceAll("&", "&amp;");
        if (htmlEncodedUrl !== originalUrl && page.html_content.includes(htmlEncodedUrl)) {
          page.html_content = page.html_content.replaceAll(htmlEncodedUrl, newPublicUrl);
        }

        // Protocol-relative match (e.g. //domain.com/path/img.jpg)
        const protoRelativeUrl = originalUrl.replace(/^https?:/, "");
        if (protoRelativeUrl !== originalUrl && page.html_content.includes(protoRelativeUrl)) {
          page.html_content = page.html_content.replaceAll(protoRelativeUrl, newPublicUrl);
        }
        if (page.css_content && protoRelativeUrl !== originalUrl && page.css_content.includes(protoRelativeUrl)) {
          page.css_content = page.css_content.replaceAll(protoRelativeUrl, newPublicUrl);
        }
      }
    }

    // 6. Direct Database Persistence: Save rewritten HTML/CSS immediately into website_pages
    try {
      await Promise.allSettled(
        pages.map((p) =>
          db
            .from("website_pages")
            .update({
              html_content: p.html_content,
              css_content: p.css_content || "",
            })
            .eq("website_id", websiteId)
            .eq("path", p.path)
        )
      );
      console.log(`[ASSET_IMPORT_PERSIST_SUCCESS] websiteId=${websiteId} pagesPersisted=${pages.length}`);
    } catch (persistErr: any) {
      console.warn(`[ASSET_IMPORT_PERSIST_WARN] websiteId=${websiteId}:`, persistErr?.message || persistErr);
    }
  }

  if (stats.imported > 0) {
    await invalidateUserCache(userId).catch(() => {});
  }

  console.log(
    `[MIGRATION_STEP_COMPLETE] runId=${runId} websiteId=${websiteId} step=ASSET_IMPORT_PIPELINE elapsedMs=${
      Date.now() - startMs
    } detected=${stats.detected} imported=${stats.imported} deduplicated=${stats.deduplicated} failed=${stats.failed}`
  );

  return { stats, urlMap };
}
