import { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";

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

    // Query website record for migration status in design_plan
    let website: any = null;
    if (websiteId) {
      const { data } = await db.from("websites").select("id, slug, is_published, design_plan").eq("id", websiteId).maybeSingle();
      website = data;
    } else if (jobId) {
      const { data } = await db.from("websites").select("id, slug, is_published, design_plan").filter("design_plan->migration_job->>jobId", "eq", jobId).maybeSingle();
      website = data;
    }

    if (!website) {
      return jsonResponse({
        success: true,
        status: "queued",
        progress: 10,
        currentStage: "Initializing migration job...",
        error: null,
      });
    }

    const migrationJob = website.design_plan?.migration_job || {};
    const status = migrationJob.status || "queued";
    const progress = typeof migrationJob.progress === "number" ? migrationJob.progress : 10;
    const currentStage = migrationJob.currentStage || "Processing migration...";
    const error = migrationJob.error || null;
    const result = migrationJob.result || null;
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
      previewUrl,
      result,
      error,
    });
  } catch (err: any) {
    return jsonResponse({ success: false, error: err?.message || "Failed to fetch migration status." }, 500);
  }
}
