import { NextRequest } from "next/server";

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

    let website: any = null;
    if (jobId) {
      const { data } = await db.from("websites").select("id, slug, is_published, design_plan, created_at").filter("design_plan->migration_job->>jobId", "eq", jobId).maybeSingle();
      website = data;
    }
    if (!website && websiteId) {
      const { data } = await db.from("websites").select("id, slug, is_published, design_plan, created_at").eq("id", websiteId).maybeSingle();
      website = data;
    }

    if (!website) {
      return jsonResponse({
        success: true,
        jobId: jobId || null,
        websiteId: websiteId || null,
        status: "QUEUED",
        progress: 10,
        currentStage: "Initializing migration environment...",
        currentPage: 0,
        totalPages: 0,
        completedPages: 0,
        failedPages: 0,
        elapsedTime: 0,
        lastError: null,
        error: null,
      });
    }

    const migrationJob = website.design_plan?.migration_job || {};
    const status = (migrationJob.status || "QUEUED").toUpperCase();
    const progress = typeof migrationJob.progress === "number" ? migrationJob.progress : 10;
    const currentStage = migrationJob.currentStage || "Processing migration...";
    const currentPage = migrationJob.currentPage || 0;
    const totalPages = migrationJob.totalPages || 1;
    const completedPages = migrationJob.completedPages || 0;
    const failedPages = migrationJob.failedPages || 0;
    const elapsedTime = migrationJob.startTime ? Math.max(0, Date.now() - new Date(migrationJob.startTime).getTime()) : 0;
    const lastError = migrationJob.error || null;
    const result = migrationJob.result || null;
    const pageDiagnostics = migrationJob.pageDiagnostics || [];
    const draftSlug = website.slug;
    const previewUrl = `https://codeaxys.com/site/${draftSlug}?preview=true`;

    return jsonResponse({
      success: true,
      jobId: migrationJob.jobId || jobId,
      websiteId: website.id,
      draftSlug,
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
      previewUrl,
      result,
      pageDiagnostics,
    });
  } catch (err: any) {
    return jsonResponse({ success: false, error: err?.message || "Failed to fetch migration status." }, 500);
  }
}
