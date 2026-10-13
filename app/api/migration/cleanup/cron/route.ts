import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { processMigrationTrialCleanup } from "@/lib/migration/trial-cleanup-engine";

export async function POST(req: NextRequest) {
  try {
    // 1. Check if CRON_SECRET is configured on the server
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || cronSecret.trim() === "") {
      console.error("[MigrationCleanupCron] CRON_SECRET is missing in server environment. Failing closed.");
      return NextResponse.json(
        { error: "CRON_SECRET is not configured on the server." },
        { status: 500 }
      );
    }

    // 2. Strict Bearer Token or Query Secret Authorization Check
    const authHeader = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");

    const providedToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7).trim()
      : querySecret || "";

    if (providedToken !== cronSecret) {
      return NextResponse.json(
        { error: "Unauthorized cron invocation. Invalid or missing secret." },
        { status: 401 }
      );
    }

    // 3. Parse options (dryRun, limit) from query or JSON body
    let isDryRun = req.nextUrl.searchParams.get("dryRun") === "true";
    let batchLimit = 50;

    try {
      if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
        const body = await req.json().catch(() => ({}));
        if (typeof body.dryRun === "boolean") {
          isDryRun = body.dryRun;
        }
        if (typeof body.batchLimit === "number" && body.batchLimit > 0) {
          batchLimit = Math.min(body.batchLimit, 100);
        }
      }
    } catch {
      // Body parsing optional
    }

    // 4. Initialize Admin Database Client for scheduled execution
    const adminDb = createAdminClient();

    // 5. Execute Migration Trial Cleanup Engine
    const report = await processMigrationTrialCleanup({
      supabase: adminDb,
      dryRun: isDryRun,
      batchLimit,
    });

    return NextResponse.json({
      success: report.success,
      timestamp: report.timestamp,
      dryRun: report.dryRun,
      summary: {
        scanned_websites: report.scanned_websites,
        active_trial_count: report.active_trial_count,
        preserved_paid_count: report.preserved_paid_count,
        preserved_published_count: report.preserved_published_count,
        preserved_payment_unverified_count: report.preserved_payment_unverified_count,
        reminders_sent: report.reminders_sent,
        cleaned_websites_count: report.cleaned_websites_count,
        deleted_files_count: report.deleted_files_count,
        freed_storage_bytes: report.freed_storage_bytes,
      },
      cleaned_details: report.cleaned_details,
      preserved_details: report.preserved_details,
      errors: report.errors,
      auditLogId: report.auditLogId,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err || "Internal server error");
    console.error("[MigrationCleanupCron] Error:", errorMsg);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
