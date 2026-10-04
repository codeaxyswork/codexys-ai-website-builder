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

function getSafeAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yumsturujjjgdxsrqgbm.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const { createClient: createSupabaseDirectClient } = require("@supabase/supabase-js");
  return createSupabaseDirectClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function sanitizeFileName(rawName: string): string {
  const name = rawName.split("?")[0].split("#")[0];
  const parts = name.split("/");
  const base = parts[parts.length - 1] || "asset";
  const clean = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  if (clean.length > 80) {
    const ext = clean.substring(clean.lastIndexOf("."));
    return clean.substring(0, 70) + ext;
  }
  return clean || "image.jpg";
}

function isSupportedAssetUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== "string") return false;
  const lower = urlStr.toLowerCase();

  if (
    lower.includes(".js") ||
    lower.includes(".css") ||
    lower.includes(".html") ||
    lower.includes("google-analytics.com") ||
    lower.includes("googletagmanager.com") ||
    lower.includes("facebook.net") ||
    lower.includes("doubleclick.net") ||
    lower.includes("connect.facebook.net") ||
    lower.includes("pixel")
  ) {
    return false;
  }

  const supportedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".ico", ".avif"];
  const urlPath = lower.split("?")[0].split("#")[0];
  
  if (supportedExtensions.some((ext) => urlPath.endsWith(ext))) {
    return true;
  }

  if (lower.includes("/uploads/") || lower.includes("/images/") || lower.includes("/media/") || lower.includes("i0.wp.com") || lower.includes("i1.wp.com") || lower.includes("i2.wp.com")) {
    return true;
  }

  return false;
}

export function extractAssetUrlsFromHtml(html: string, baseUrl: string): string[] {
  if (!html) return [];
  const extracted = new Set<string>();

  const srcMatches = html.matchAll(/(?:src|poster)\s*=\s*["']([^"']+)["']/gi);
  for (const match of srcMatches) {
    if (match[1]) extracted.add(match[1].trim());
  }

  const srcsetMatches = html.matchAll(/(?:srcset|data-srcset)\s*=\s*["']([^"']+)["']/gi);
  for (const match of srcsetMatches) {
    if (match[1]) {
      const candidates = match[1].split(",");
      for (const cand of candidates) {
        const urlPart = cand.trim().split(/\s+/)[0];
        if (urlPart) extracted.add(urlPart.trim());
      }
    }
  }

  const lazyMatches = html.matchAll(/(?:data-src|data-lazy-src|data-original|data-bg|data-image)\s*=\s*["']([^"']+)["']/gi);
  for (const match of lazyMatches) {
    if (match[1]) extracted.add(match[1].trim());
  }

  const metaMatches = html.matchAll(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*>/gi);
  for (const match of metaMatches) {
    const fullTag = match[0].toLowerCase();
    if ((fullTag.includes("og:image") || fullTag.includes("twitter:image")) && match[1]) {
      extracted.add(match[1].trim());
    }
  }

  const faviconMatches = html.matchAll(/<link\s+[^>]*href=["']([^"']+)["'][^>]*>/gi);
  for (const match of faviconMatches) {
    const fullTag = match[0].toLowerCase();
    if ((fullTag.includes("icon") || fullTag.includes("apple-touch-icon")) && match[1]) {
      extracted.add(match[1].trim());
    }
  }

  const cssUrlMatches = html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi);
  for (const match of cssUrlMatches) {
    if (match[1] && !match[1].startsWith("data:")) {
      extracted.add(match[1].trim());
    }
  }

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
      // Ignore
    }
  }

  return Array.from(new Set(absoluteUrls));
}

/**
 * Safely fetches an external media asset with strict 1.5s timeout.
 */
async function fetchMediaAsset(imageUrl: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const sanitizedCheck = await validateAndSanitizeUrl(imageUrl);
  if (!sanitizedCheck.valid || !sanitizedCheck.normalizedUrl) {
    return null;
  }

  const targetUrl = sanitizedCheck.normalizedUrl;
  const parsed = new URL(targetUrl);
  if (isPrivateOrReservedIP(parsed.hostname)) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500); // Strict 1.5s timeout per asset fetch

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Codeaxys-Media-Importer/1.0 (+https://codeaxys.com)",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      redirect: "manual",
    });

    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (location) {
        let absRedirect = location;
        if (!location.startsWith("http://") && !location.startsWith("https://")) {
          absRedirect = new URL(location, targetUrl).href;
        }
        return await fetchMediaAsset(absRedirect);
      }
      return null;
    }

    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") || "image/jpeg").toLowerCase().split(";")[0].trim();
    const isImage =
      contentType.startsWith("image/") ||
      contentType.includes("svg") ||
      contentType.includes("icon") ||
      contentType.startsWith("video/");

    if (!isImage) return null;

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
      return null;
    }

    return { buffer, contentType };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Main entry point to import, store, and rewrite external media assets with a 6-second total cap.
 */
export async function importAndStoreMigrationAssets(
  userId: string,
  websiteId: string,
  baseUrl: string,
  pages: { path: string; html_content: string; css_content?: string }[],
  options?: { customSupabaseClient?: any; runId?: string }
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

  for (const page of pages) {
    const urlsInPage = extractAssetUrlsFromHtml(page.html_content, baseUrl);
    urlsInPage.forEach((u) => allDiscoveredUrls.add(u));

    if (page.css_content) {
      const urlsInCss = extractAssetUrlsFromHtml(page.css_content, baseUrl);
      urlsInCss.forEach((u) => allDiscoveredUrls.add(u));
    }
  }

  stats.detected = allDiscoveredUrls.size;
  const MAX_IMPORT_ASSETS = 6; // Cap to top 6 key assets per migration pass to guarantee SLA response
  const eligibleUrls = Array.from(allDiscoveredUrls).filter((u) => isSupportedAssetUrl(u)).slice(0, MAX_IMPORT_ASSETS);
  stats.eligible = eligibleUrls.length;

  if (eligibleUrls.length === 0) {
    console.log(`[MIGRATION_STEP_COMPLETE] runId=${runId} websiteId=${websiteId} step=ASSET_IMPORT_PIPELINE elapsedMs=${Date.now() - startMs} assetsImported=0`);
    return { stats, urlMap };
  }

  const BATCH_SIZE = 3;
  for (let i = 0; i < eligibleUrls.length; i += BATCH_SIZE) {
    const chunk = eligibleUrls.slice(i, i + BATCH_SIZE);

    await Promise.all(
      chunk.map(async (sourceUrl) => {
        if (urlMap.has(sourceUrl)) {
          stats.deduplicated++;
          return;
        }

        try {
          const fetched = await fetchMediaAsset(sourceUrl);
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

          const { error: uploadError } = await db.storage
            .from("website-assets")
            .upload(storagePath, buffer, {
              contentType,
              upsert: true,
            });

          if (uploadError) {
            stats.failed++;
            return;
          }

          const { data: publicData } = db.storage
            .from("website-assets")
            .getPublicUrl(storagePath);

          const publicUrl = publicData?.publicUrl || "";
          if (!publicUrl) {
            stats.failed++;
            return;
          }

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
          stats.imported++;
          stats.totalBytes += buffer.length;
        } catch (err: any) {
          stats.failed++;
        }
      })
    );
  }

  if (urlMap.size > 0) {
    for (const page of pages) {
      for (const [originalUrl, newPublicUrl] of urlMap.entries()) {
        if (page.html_content.includes(originalUrl)) {
          page.html_content = page.html_content.replaceAll(originalUrl, newPublicUrl);
        }
        if (page.css_content && page.css_content.includes(originalUrl)) {
          page.css_content = page.css_content.replaceAll(originalUrl, newPublicUrl);
        }
      }
    }
  }

  if (stats.imported > 0) {
    await invalidateUserCache(userId).catch(() => {});
  }

  console.log(`[MIGRATION_STEP_COMPLETE] runId=${runId} websiteId=${websiteId} step=ASSET_IMPORT_PIPELINE elapsedMs=${Date.now() - startMs} assetsImported=${stats.imported}`);

  return { stats, urlMap };
}
