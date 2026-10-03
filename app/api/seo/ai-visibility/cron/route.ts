import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { executeWebsiteMonitoringRun, WebsiteAiVisibilityConfig } from "@/lib/ai-visibility";

export async function POST(req: NextRequest) {
  try {
    // 1. Check if CRON_SECRET is configured on server
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || cronSecret.trim() === "") {
      console.error("CRON_SECRET missing in server env. Failing closed.");
      return NextResponse.json(
        { error: "CRON_SECRET is not configured on the server." },
        { status: 500 }
      );
    }

    // 2. Authorization Bearer Token Check
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

    // 3. Initialize Admin Database Client for background scheduled batch execution
    const adminDb = createAdminClient();

    // 4. Fetch enabled monitoring configurations due for execution (next_run_at <= NOW())
    const nowIso = new Date().toISOString();
    const { data: dueConfigs, error: fetchErr } = await adminDb
      .from("website_ai_visibility_configs")
      .select("*")
      .eq("is_enabled", true)
      .lte("next_run_at", nowIso)
      .limit(10); // Bounded batch limit per cron trigger (max 10 websites per batch)

    if (fetchErr) {
      console.error("[AiVisibilityCron] Failed to fetch due configs:", fetchErr.message);
      return NextResponse.json(
        { error: `Database query error: ${fetchErr.message}` },
        { status: 500 }
      );
    }

    if (!dueConfigs || dueConfigs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No AI visibility monitoring configurations currently due for execution.",
        executedCount: 0,
        timestamp: nowIso,
      });
    }

    // 5. Execute monitoring batch sequentially or in controlled parallel pool
    const results = [];
    for (const r of dueConfigs) {
      const config: WebsiteAiVisibilityConfig = {
        id: r.id,
        websiteId: r.website_id,
        userId: r.user_id,
        enabled: r.is_enabled !== undefined ? r.is_enabled : (r.enabled !== undefined ? r.enabled : true),
        frequency: r.frequency,
        selectedProviders: r.enabled_providers || r.selected_providers || [],
        promptCategories: r.prompt_categories || [],
        brandName: r.brand_name || "Brand",
        customPrompts: r.custom_prompts || [],
        maxProbesPerExecution: r.max_probes_per_run || r.max_probes_per_execution || 5,
        timezone: r.timezone || "UTC",
        lastRunAt: r.last_run_at,
        nextRunAt: r.next_run_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };

      const runResult = await executeWebsiteMonitoringRun(adminDb, config, {
        triggerType: "scheduled",
      });
      results.push({
        websiteId: config.websiteId,
        status: runResult.status,
        totalProbes: runResult.totalProbes,
        mentionRate: runResult.brandMentionRate,
        errorMessage: runResult.errorMessage,
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: nowIso,
      executedCount: results.length,
      runs: results,
    });
  } catch (err: any) {
    console.error("[AiVisibilityCron] Batch Execution Error:", err);
    return NextResponse.json(
      { error: err?.message || "AI Visibility cron batch error." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
