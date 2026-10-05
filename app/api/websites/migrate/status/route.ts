import { NextRequest, after } from "next/server";
import { getMigrationJobState, checkAndAdvanceMigrationJob } from "@/lib/migration/executor";
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

function getSafeAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yumsturujjjgdxsrqgbm.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const { createClient: createSupabaseDirectClient } = require("@supabase/supabase-js");
  return createSupabaseDirectClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId") || searchParams.get("runId");
    const websiteId = searchParams.get("websiteId");

    if (!jobId && !websiteId) {
      return jsonResponse({ success: false, error: "Missing jobId or websiteId parameter." }, 400);
    }

    const db = getSafeAdminClient();

    // 1. Direct indexed primary key query first if websiteId provided
    let website: any = null;
    if (websiteId) {
      const { data } = await db
        .from("websites")
        .select("id, slug, is_published, design_plan, created_at")
        .eq("id", websiteId)
        .maybeSingle();
      website = data;
    }

    // 2. Fallback to jobId lookup if website not found yet
    if (!website && jobId) {
      const { data } = await db
        .from("websites")
        .select("id, slug, is_published, design_plan, created_at")
        .filter("design_plan->migration_job->>jobId", "eq", jobId)
        .maybeSingle();
      website = data;
    }

    // 3. Fallback to in-memory job cache if database lookup has a momentary sync delay
    const cachedJob = await getMigrationJobState(websiteId || undefined, jobId || undefined);

    if (!website && !cachedJob) {
      // NEVER return a fake/default QUEUED state when the migration job actually exists but website row is temporarily unavailable
      return jsonResponse({
        success: false,
        error: "Migration job record not found or still initializing.",
        jobId: jobId || null,
        websiteId: websiteId || null,
      }, 404);
    }

    const effectiveWebsiteId = website?.id || cachedJob?.websiteId || websiteId;
    const effectiveSlug = website?.slug || cachedJob?.cleanSlug || "migrated";
    const migrationJob = website?.design_plan?.migration_job || cachedJob || {};

    const activeJobId = migrationJob.jobId || jobId || "";

    // 4. Autonomous self-healing / resume trigger: If job is active and has stalled, resume execution
    if (effectiveWebsiteId && activeJobId) {
      try {
        after(async () => {
          await checkAndAdvanceMigrationJob(effectiveWebsiteId, activeJobId);
        });
      } catch {
        checkAndAdvanceMigrationJob(effectiveWebsiteId, activeJobId).catch((advErr) => {
          console.warn(`[STATUS_SELF_HEAL_WARN] websiteId=${effectiveWebsiteId}:`, advErr?.message);
        });
      }
    }

    const status = (migrationJob.status || "QUEUED").toUpperCase();
    const progress = typeof migrationJob.progress === "number" ? migrationJob.progress : 10;
    const currentStage = migrationJob.currentStage || "Processing migration...";
    const currentPage = migrationJob.currentPage || 0;
    const totalPages = migrationJob.totalPages || 1;
    const completedPages = migrationJob.completedPages || 0;
    const failedPages = migrationJob.failedPages || 0;
    const elapsedTime = migrationJob.startTime ? Math.max(0, Date.now() - new Date(migrationJob.startTime).getTime()) : 0;
    const lastError = migrationJob.error || null;
    const failureDetails = migrationJob.failureDetails || null;
    const result = migrationJob.result || null;
    const pageDiagnostics = migrationJob.pageDiagnostics || [];
    const previewUrl = getWebsitePreviewUrl({
      slug: effectiveSlug,
      published_slug: effectiveSlug,
      is_published: website?.is_published || false,
    });

    return jsonResponse({
      success: true,
      jobId: activeJobId,
      websiteId: effectiveWebsiteId,
      draftSlug: effectiveSlug,
      status,
      progress,
      currentStage,
      currentPage,
      totalPages,
      completedPages,
      failedPages,
      elapsedTime,
      lastError,
      error: lastError,
      failureDetails,
      previewUrl,
      result,
      pageDiagnostics,
    });
  } catch (err: any) {
    return jsonResponse({ success: false, error: err?.message || "Failed to fetch migration status." }, 500);
  }
}
