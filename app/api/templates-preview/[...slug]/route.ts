import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

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
    if (
      !templateDirPath.startsWith(TEMPLATES_DIR) ||
      !fs.existsSync(templateDirPath) ||
      !fs.statSync(templateDirPath).isDirectory()
    ) {
      return new NextResponse("Template Not Found", { status: 404 });
    }

    // If requested without asset path (e.g. /api/templates-preview/Accounting Firm), default to index.html
    let relativeAssetPath = "index.html";
    if (decodedSegments.length > 1) {
      relativeAssetPath = decodedSegments.slice(1).join(path.sep);
    }

    const targetFilePath = path.resolve(templateDirPath, relativeAssetPath);

    // Prevent path traversal outside the template folder
    if (!targetFilePath.startsWith(templateDirPath)) {
      return new NextResponse("Access Denied", { status: 403 });
    }

    if (!fs.existsSync(targetFilePath) || fs.statSync(targetFilePath).isDirectory()) {
      const fallbackIndex = path.join(targetFilePath, "index.html");
      if (fs.existsSync(fallbackIndex) && fs.statSync(fallbackIndex).isFile()) {
        const content = fs.readFileSync(fallbackIndex);
        return new NextResponse(content, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
            "X-Frame-Options": "SAMEORIGIN",
          },
        });
      }
      return new NextResponse("File Not Found", { status: 404 });
    }

    const ext = path.extname(targetFilePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const fileBuffer = fs.readFileSync(targetFilePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (error) {
    console.error("Template preview server error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
