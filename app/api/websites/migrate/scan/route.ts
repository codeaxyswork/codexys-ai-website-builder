import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { scanSourceWebsite, validateAndSanitizeUrl } from "@/lib/migration/scanner";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    let supabase: any;
    try {
      supabase = await createClient();
    } catch (e: any) {
      return jsonResponse({ success: false, error: `Failed to initialize auth client: ${e?.message || e}` }, 500);
    }

    let user: any = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data?.user || null;
    } catch (e: any) {
      return jsonResponse({ success: false, error: `Auth validation failed: ${e?.message || e}` }, 401);
    }

    if (!user) {
      return jsonResponse({ success: false, error: "Authentication required to perform website migration scan." }, 401);
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, error: "Invalid JSON request payload." }, 400);
    }

    const { url } = body as { url?: string };

    if (!url || typeof url !== "string") {
      return jsonResponse({ success: false, error: "Website URL is required for migration scan." }, 400);
    }

    // SSRF & URL Validation
    const urlCheck = await validateAndSanitizeUrl(url);
    if (!urlCheck.valid || !urlCheck.normalizedUrl) {
      return jsonResponse({ success: false, error: urlCheck.error || "Invalid or disallowed URL provided." }, 400);
    }

    // Execute server-side scan & discovery (0 AI credits)
    const scan = await scanSourceWebsite(urlCheck.normalizedUrl);

    return jsonResponse({
      success: true,
      scan,
    }, 200);
  } catch (err: any) {
    const errorMsg = String(err?.message || err || "Failed to complete website discovery scan.");
    console.error("Migration Scan API Error:", errorMsg);
    return jsonResponse({ success: false, error: errorMsg }, 500);
  }
}
