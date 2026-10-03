import { createAdminClient } from "@/utils/supabase/server";
import { extractAssetUrlsFromHtml } from "./asset-importer";
import { validateAndSanitizeUrl, isPrivateOrReservedIP } from "./scanner";
import { invalidateUserCache } from "@/lib/cache";
import crypto from "crypto";

export interface BackfillResult {
  success: boolean;
  websiteId: string;
  userId: string;
  pages_scanned: number;
  external_assets_found: number;
  assets_downloaded: number;
  assets_deduplicated: number;
  assets_failed: number;
  media_assets_created: number;
  bytes_imported: number;
  pages_rewritten: number;
  total_storage_mb: number;
  errors?: string[];
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

  // Exclude JS, CSS, tracking, analytics, ads, social pixels
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

  // Already stored Supabase URLs are not external
  if (lower.includes("supabase.co") || lower.includes("website-assets")) {
    return false;
  }

  const supportedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".ico", ".avif"];
  const urlPath = lower.split("?")[0].split("#")[0];

  if (supportedExtensions.some((ext) => urlPath.endsWith(ext))) {
    return true;
  }

  if (
    lower.includes("/uploads/") ||
    lower.includes("/images/") ||
    lower.includes("/media/") ||
    lower.includes("i0.wp.com") ||
    lower.includes("i1.wp.com") ||
    lower.includes("i2.wp.com")
  ) {
    return true;
  }

  return false;
}

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
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Codeaxys-Media-Backfill/1.0 (+https://codeaxys.com)",
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

    if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) {
      return null;
    }

    return { buffer, contentType };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Safely backfills missing external media assets for an existing migrated website.
 * FULLY IDEMPOTENT: running this multiple times will not duplicate storage files or media_assets rows.
 */
export async function runExistingMigrationAssetBackfill(
  websiteId: string,
  options?: { customSupabaseClient?: any }
): Promise<BackfillResult> {
  const db = options?.customSupabaseClient || getSafeAdminClient();
  const errors: string[] = [];

  // 1. Load target website details
  const { data: website, error: webErr } = await db
    .from("websites")
    .select("id, user_id, title, design_plan")
    .eq("id", websiteId)
    .single();

  if (webErr || !website) {
    throw new Error(`Website not found for ID: ${websiteId}`);
  }

  const userId = website.user_id;
  const baseUrl = website.design_plan?.migration?.originalUrl || "https://mncconline.com";

  // 2. Fetch all pages belonging to this website
  const { data: pages, error: pageErr } = await db
    .from("website_pages")
    .select("id, path, html_content, css_content")
    .eq("website_id", websiteId);

  if (pageErr || !pages || pages.length === 0) {
    return {
      success: true,
      websiteId,
      userId,
      pages_scanned: 0,
      external_assets_found: 0,
      assets_downloaded: 0,
      assets_deduplicated: 0,
      assets_failed: 0,
      media_assets_created: 0,
      bytes_imported: 0,
      pages_rewritten: 0,
      total_storage_mb: 0,
    };
  }

  const result: BackfillResult = {
    success: true,
    websiteId,
    userId,
    pages_scanned: pages.length,
    external_assets_found: 0,
    assets_downloaded: 0,
    assets_deduplicated: 0,
    assets_failed: 0,
    media_assets_created: 0,
    bytes_imported: 0,
    pages_rewritten: 0,
    total_storage_mb: 0,
    errors,
  };

  // 3. Collect existing media_assets for this user to ensure idempotency
  const existingAssetsMap = new Map<string, string>(); // storagePath or fileName -> publicUrl
  try {
    const { data: existingRows } = await db
      .from("media_assets")
      .select("file_name, storage_path, public_url")
      .eq("user_id", userId);

    if (existingRows) {
      existingRows.forEach((r: any) => {
        if (r.public_url) {
          existingAssetsMap.set(r.storage_path, r.public_url);
          existingAssetsMap.set(r.file_name, r.public_url);
        }
      });
    }
  } catch (err: any) {
    errors.push(`Failed to fetch existing media_assets: ${err?.message}`);
  }

  // 4. Extract external asset URLs across all 20 pages
  const urlMap = new Map<string, string>(); // externalSourceUrl -> storedPublicUrl
  const allDiscoveredUrls = new Set<string>();

  for (const p of pages) {
    const urlsInPage = extractAssetUrlsFromHtml(p.html_content || "", baseUrl);
    urlsInPage.forEach((u) => allDiscoveredUrls.add(u));

    if (p.css_content) {
      const urlsInCss = extractAssetUrlsFromHtml(p.css_content, baseUrl);
      urlsInCss.forEach((u) => allDiscoveredUrls.add(u));
    }
  }

  const eligibleUrls = Array.from(allDiscoveredUrls).filter((u) => isSupportedAssetUrl(u));
  result.external_assets_found = eligibleUrls.length;

  if (eligibleUrls.length === 0) {
    return result;
  }

  // 5. Download missing assets in bounded batches (5 parallel requests)
  const BATCH_SIZE = 5;
  for (let i = 0; i < eligibleUrls.length; i += BATCH_SIZE) {
    const chunk = eligibleUrls.slice(i, i + BATCH_SIZE);

    await Promise.all(
      chunk.map(async (sourceUrl) => {
        if (urlMap.has(sourceUrl)) {
          result.assets_deduplicated++;
          return;
        }

        const parsedUrl = new URL(sourceUrl);
        const rawFileName = sanitizeFileName(parsedUrl.pathname);
        const urlHash = crypto.createHash("md5").update(sourceUrl).digest("hex").substring(0, 8);
        const fileName = `${urlHash}_${rawFileName}`;
        const storagePath = `${userId}/${websiteId}/assets/${fileName}`;

        // Idempotency check: if file was already stored in DB/Storage
        if (existingAssetsMap.has(storagePath) || existingAssetsMap.has(fileName)) {
          const storedPublicUrl = existingAssetsMap.get(storagePath) || existingAssetsMap.get(fileName)!;
          urlMap.set(sourceUrl, storedPublicUrl);
          result.assets_deduplicated++;
          return;
        }

        try {
          const fetched = await fetchMediaAsset(sourceUrl);
          if (!fetched) {
            result.assets_failed++;
            return;
          }

          const { buffer, contentType } = fetched;

          // Upload to Supabase Storage website-assets bucket
          const { error: uploadError } = await db.storage
            .from("website-assets")
            .upload(storagePath, buffer, {
              contentType,
              upsert: true,
            });

          if (uploadError) {
            console.warn(`[BACKFILL] Storage upload warning for ${fileName}:`, uploadError.message);
            result.assets_failed++;
            return;
          }

          const { data: publicData } = db.storage
            .from("website-assets")
            .getPublicUrl(storagePath);

          const publicUrl = publicData?.publicUrl || "";
          if (!publicUrl) {
            result.assets_failed++;
            return;
          }

          // Insert row into media_assets table
          const { error: dbInsertError } = await db.from("media_assets").insert({
            user_id: userId,
            website_id: websiteId,
            file_name: fileName,
            file_size_bytes: buffer.length,
            mime_type: contentType,
            storage_path: storagePath,
            public_url: publicUrl,
          });

          if (!dbInsertError) {
            result.media_assets_created++;
          }

          urlMap.set(sourceUrl, publicUrl);
          existingAssetsMap.set(storagePath, publicUrl);
          result.assets_downloaded++;
          result.bytes_imported += buffer.length;
        } catch (err: any) {
          console.warn(`[BACKFILL] Failed to backfill asset ${sourceUrl}:`, err?.message);
          result.assets_failed++;
        }
      })
    );
  }

  // 6. Rewrite HTML and CSS in website_pages DB records
  if (urlMap.size > 0) {
    for (const p of pages) {
      let htmlMod = p.html_content || "";
      let cssMod = p.css_content || "";
      let isRewritten = false;

      for (const [originalUrl, newPublicUrl] of urlMap.entries()) {
        if (htmlMod.includes(originalUrl)) {
          htmlMod = htmlMod.replaceAll(originalUrl, newPublicUrl);
          isRewritten = true;
        }
        if (cssMod && cssMod.includes(originalUrl)) {
          cssMod = cssMod.replaceAll(originalUrl, newPublicUrl);
          isRewritten = true;
        }
      }

      if (isRewritten) {
        const { error: updateErr } = await db
          .from("website_pages")
          .update({
            html_content: htmlMod,
            css_content: cssMod,
          })
          .eq("id", p.id);

        if (!updateErr) {
          result.pages_rewritten++;
        } else {
          errors.push(`Failed to update website_page ${p.id}: ${updateErr.message}`);
        }
      }
    }
  }

  // 7. Invalidate user usage cache so Dashboard updates storage accounting immediately
  await invalidateUserCache(userId);

  // Calculate total storage for user
  const { data: userAssets } = await db
    .from("media_assets")
    .select("file_size_bytes")
    .eq("user_id", userId);

  const totalUserBytes = (userAssets || []).reduce((sum: number, r: any) => sum + (Number(r.file_size_bytes) || 0), 0);
  result.total_storage_mb = Number((totalUserBytes / (1024 * 1024)).toFixed(2));

  console.log(`[BACKFILL COMPLETE] Pages Scanned: ${result.pages_scanned} | Assets Found: ${result.external_assets_found} | Downloaded: ${result.assets_downloaded} | Deduplicated: ${result.assets_deduplicated} | Failed: ${result.assets_failed} | DB Rows Created: ${result.media_assets_created} | Pages Rewritten: ${result.pages_rewritten} | Total Storage: ${result.total_storage_mb} MB`);

  return result;
}
