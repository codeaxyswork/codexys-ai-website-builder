import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const TEMPLATES_DIR = path.resolve(process.cwd(), "templates");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".txt": "text/plain; charset=utf-8",
};

interface CachedAsset {
  buffer: Buffer;
  contentType: string;
  etag: string;
  mtimeMs: number;
}

// In-memory cache for static template assets to eliminate repeated disk I/O
const assetCache = new Map<string, CachedAsset>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> }
) {
  try {
    const { slug } = await params;
    if (!slug || slug.length === 0) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Decode path segments
    const decodedSegments = slug.map((seg) => decodeURIComponent(seg));
    const templateName = decodedSegments[0];

    // Ensure the template folder actually exists in templates/
    const templateDirPath = path.resolve(TEMPLATES_DIR, templateName);
    if (!templateDirPath.startsWith(TEMPLATES_DIR)) {
      return new NextResponse("Access Denied", { status: 403 });
    }

    // If requested without asset path (e.g. /api/templates-preview/Accounting Firm), default to index.html
    let relativeAssetPath = "index.html";
    if (decodedSegments.length > 1) {
      relativeAssetPath = decodedSegments.slice(1).join(path.sep);
    }

    let targetFilePath = path.resolve(templateDirPath, relativeAssetPath);

    // Prevent path traversal outside the template folder
    if (!targetFilePath.startsWith(templateDirPath)) {
      return new NextResponse("Access Denied", { status: 403 });
    }

    const ifNoneMatch = request.headers.get("if-none-match");

    // Check in-memory cache first for instant sub-millisecond response
    const cached = assetCache.get(targetFilePath);
    if (cached) {
      if (ifNoneMatch && ifNoneMatch === cached.etag) {
        return new NextResponse(null, {
          status: 304,
          headers: {
            "ETag": cached.etag,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            "X-Frame-Options": "SAMEORIGIN",
          },
        });
      }

      return new NextResponse(new Uint8Array(cached.buffer), {
        status: 200,
        headers: {
          "Content-Type": cached.contentType,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          "ETag": cached.etag,
          "X-Frame-Options": "SAMEORIGIN",
        },
      });
    }

    // File not in cache: verify on disk asynchronously
    let stats: fs.Stats;
    try {
      stats = await fs.promises.stat(targetFilePath);
    } catch {
      // File not found; try fallback to index.html if target was a directory
      const fallbackIndex = path.join(targetFilePath, "index.html");
      try {
        stats = await fs.promises.stat(fallbackIndex);
        targetFilePath = fallbackIndex;
      } catch {
        return new NextResponse("File Not Found", { status: 404 });
      }
    }

    if (stats.isDirectory()) {
      targetFilePath = path.join(targetFilePath, "index.html");
      try {
        stats = await fs.promises.stat(targetFilePath);
      } catch {
        return new NextResponse("File Not Found", { status: 404 });
      }
    }

    const ext = path.extname(targetFilePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const fileBuffer = await fs.promises.readFile(targetFilePath);
    const etag = `W/"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;

    // Cache static asset in memory
    assetCache.set(targetFilePath, {
      buffer: fileBuffer,
      contentType,
      etag,
      mtimeMs: stats.mtimeMs,
    });

    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "ETag": etag,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          "X-Frame-Options": "SAMEORIGIN",
        },
      });
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "ETag": etag,
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (error) {
    console.error("Template preview server error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
