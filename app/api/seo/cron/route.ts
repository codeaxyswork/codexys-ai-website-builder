import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/gsc-client";
import { processScheduledMonitoringBatch } from "@/lib/seo-monitoring-engine";

export async function POST(req: NextRequest) {
  try {
    // 1. Check if CRON_SECRET is configured on the server
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || cronSecret.trim() === "") {
      console.error("CRON_SECRET is missing in server environment variables. Failing closed.");
      return NextResponse.json(
        { error: "CRON_SECRET is not configured on the server." },
        { status: 500 }
      );
    }

    // 2. Strict Bearer Token Authorization Check
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized cron invocation. Missing Bearer token." },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7).trim();
    if (token !== cronSecret) {
      return NextResponse.json(
        { error: "Unauthorized cron invocation. Invalid Bearer token." },
        { status: 401 }
      );
    }

    // 3. Initialize Admin Database Client for background scheduled batch execution
    const dbClient = createAdminClient();

    // 4. Execute bounded scheduled monitoring batch (0 AI credits)
    const result = await processScheduledMonitoringBatch(dbClient, 10);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: any) {
    console.error("POST SEO cron error:", err);
    return NextResponse.json(
      { error: err.message || "Cron batch execution error." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
