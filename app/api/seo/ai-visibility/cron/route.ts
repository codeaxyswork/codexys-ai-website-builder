import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import {
  executeWebsiteMonitoringRun,
  WebsiteAiVisibilityConfig,
  checkAiVisibilityEntitlement,
  isLiveAiVisibilityEnabled,
  LIVE_AI_VISIBILITY_CONFIG,
  deductProbeCredits,
  refundProbeCredits,
} from "@/lib/ai-visibility";

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

    // 5. Execute monitoring batch with strict entitlement, ownership, and credit verification
    const results = [];
    const liveMode = isLiveAiVisibilityEnabled();

    for (const r of dueConfigs) {
      // 5a. Verify website ownership and active existence
      const { data: website } = await adminDb
        .from("websites")
        .select("id, user_id, title")
        .eq("id", r.website_id)
        .eq("user_id", r.user_id)
        .maybeSingle();

      if (!website) {
        console.warn(`[AiVisibilityCron] Skipped config ${r.id}: website not found or user ownership mismatch.`);
        continue;
      }

      // 5b. Authoritative Server-side Entitlement Verification
      const entitlement = await checkAiVisibilityEntitlement(r.user_id, adminDb);
      if (!entitlement.entitled) {
        console.warn(`[AiVisibilityCron] Skipped website ${r.website_id}: user ${r.user_id} lacks Pro/Agency plan. Auto-disabling stale config.`);
        // Disable stale config to prevent repeated cron attempts for free users
        await adminDb
          .from("website_ai_visibility_configs")
          .update({ is_enabled: false, updated_at: nowIso })
          .eq("id", r.id);
        continue;
      }

      // 5c. Credit policy enforcement when live mode is active
      const batchCreditCost = LIVE_AI_VISIBILITY_CONFIG.CREDIT_COST_PER_MULTI_PROBE_BATCH;
      let deductedCredits = 0;

      if (liveMode) {
        const { data: creditRow } = await adminDb
          .from("user_credits")
          .select("balance")
          .eq("user_id", r.user_id)
          .maybeSingle();

        const currentBalance = creditRow?.balance ?? 0;
        if (currentBalance < batchCreditCost) {
          console.warn(`[AiVisibilityCron] Skipped website ${r.website_id}: insufficient credits (${currentBalance} < ${batchCreditCost}).`);
          results.push({
            websiteId: r.website_id,
            status: "failed",
            totalProbes: 0,
            mentionRate: 0,
            errorMessage: "Insufficient AI credits for scheduled monitoring run.",
          });
          continue;
        }

        const deduction = await deductProbeCredits(
          adminDb,
          r.user_id,
          r.website_id,
          batchCreditCost,
          `Scheduled Monitoring for ${website.title || "Website"}`
        );

        if (!deduction.success) {
          console.warn(`[AiVisibilityCron] Deduction failed for website ${r.website_id}: ${deduction.error}`);
          continue;
        }
        deductedCredits = deduction.creditsDeducted;
      }

      const config: WebsiteAiVisibilityConfig = {
        id: r.id,
        websiteId: r.website_id,
        userId: r.user_id,
        enabled: r.is_enabled !== undefined ? r.is_enabled : (r.enabled !== undefined ? r.enabled : true),
        frequency: r.frequency,
        selectedProviders: r.enabled_providers || r.selected_providers || [],
        promptCategories: r.prompt_categories || [],
        brandName: r.brand_name || website.title || "Brand",
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

      // 5d. Refund safeguard: If live mode and the scheduled run failed completely, refund credits
      if (liveMode && deductedCredits > 0 && runResult.status === "failed" && runResult.successCount === 0) {
        await refundProbeCredits(
          adminDb,
          r.user_id,
          r.website_id,
          deductedCredits,
          "Scheduled monitoring run failed",
          `cron_run_${r.id}_${Date.now()}`
        );
      }

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
