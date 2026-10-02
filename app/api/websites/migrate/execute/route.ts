import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { executeWebsiteMigration } from "@/lib/migration/executor";
import { SourceWebsiteScan, MigrationMode, MigrationSelections } from "@/lib/migration/types";

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
  const startTime = Date.now();
  console.log(`[MIGRATION API] Route invoked at ${new Date().toISOString()}`);

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
      return jsonResponse({ success: false, error: "Authentication required to execute website migration." }, 401);
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, error: "Invalid JSON request payload." }, 400);
    }

    const { scanResult, mode, selections, redesignPrompt, runId: clientRunId } = body as {
      scanResult?: SourceWebsiteScan;
      mode?: MigrationMode;
      selections?: MigrationSelections;
      redesignPrompt?: string;
      runId?: string;
    };

    const runId = clientRunId || `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[MIGRATION API START] runId: ${runId} | mode: ${mode}`);

    if (!scanResult || !scanResult.targetUrl || !scanResult.pages) {
      return jsonResponse({ success: false, error: "Invalid scan result object provided." }, 400);
    }

    const selectedMode: MigrationMode = mode || "exact";
    const selectedOptions: MigrationSelections = selections || {
      content: { pages: true, blogPages: true, navigation: true, textContent: true, images: true, logo: true, forms: true },
      seo: { pageTitles: true, metaDescriptions: true, canonicalUrls: true, openGraph: true, robotsSettings: true, structuredData: true },
      design: { colors: true, typography: true, spacing: true, layout: true, buttons: true },
    };

    const result = await executeWebsiteMigration(user.id, scanResult, selectedMode, selectedOptions, supabase, redesignPrompt, runId);

    console.log(`[MIGRATION API] Route completed in ${Date.now() - startTime}ms`);
    return jsonResponse(result, 200);
  } catch (err: any) {
    const errorMsg = String(err?.message || err || "Failed to execute website migration.");
    console.error(`[MIGRATION API Error] (${Date.now() - startTime}ms):`, errorMsg);
    return jsonResponse({ success: false, error: errorMsg }, 500);
  }
}
