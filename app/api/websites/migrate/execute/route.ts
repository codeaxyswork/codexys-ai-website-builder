import { NextRequest, after } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prepareMigrationDraftWebsite, startOrResumeMigrationJob } from "@/lib/migration/executor";
import { SourceWebsiteScan, MigrationMode, MigrationSelections } from "@/lib/migration/types";
import { getWebsitePreviewUrl } from "@/lib/domain-resolver";

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

    // 1. Prepare/reuse draft website synchronously (< 200ms response time)
    const { websiteId, cleanSlug } = await prepareMigrationDraftWebsite(
      user.id,
      scanResult,
      selectedMode,
      selectedOptions,
      runId
    );

    const previewUrl = getWebsitePreviewUrl({
      slug: cleanSlug,
      published_slug: cleanSlug,
      is_published: false,
    });

    // 2. Dispatch initial stage execution. The workflow is durable and resumable;
    // status polling automatically continues execution if this invocation terminates.
    try {
      after(async () => {
        console.log(`[MIGRATION WORKFLOW INITIAL DISPATCH] runId=${runId} websiteId=${websiteId}`);
        try {
          await startOrResumeMigrationJob(websiteId, runId, {
            userId: user.id,
            scanResult,
            mode: selectedMode,
            selections: selectedOptions,
            redesignPrompt,
          });
        } catch (bgErr: any) {
          console.error(`[MIGRATION WORKFLOW BACKGROUND DISPATCH ERROR] runId=${runId}:`, bgErr?.message || bgErr);
        }
      });
    } catch {
      // Fallback if after() is not supported in current environment
      startOrResumeMigrationJob(websiteId, runId, {
        userId: user.id,
        scanResult,
        mode: selectedMode,
        selections: selectedOptions,
        redesignPrompt,
      }).catch((bgErr) => {
        console.error(`[MIGRATION DIRECT DISPATCH ERROR] runId=${runId}:`, bgErr?.message || bgErr);
      });
    }

    console.log(`[MIGRATION API FAST RESPONSE] runId=${runId} websiteId=${websiteId} duration=${Date.now() - startTime}ms`);

    return jsonResponse({
      success: true,
      jobId: runId,
      websiteId,
      draftSlug: cleanSlug,
      status: "QUEUED",
      previewUrl,
    }, 200);
  } catch (err: any) {
    const errorMsg = String(err?.message || err || "Failed to execute website migration.");
    console.error(`[MIGRATION API INITIALIZATION FAILURE]:`, errorMsg);
    return jsonResponse({ success: false, error: errorMsg }, 500);
  }
}
