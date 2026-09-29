import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/marketing/meta-client";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; draftId: string }> }
) {
  try {
    const { id: websiteId, draftId } = await context.params;
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

    // 2. Validate website ownership
    const { data: website, error: siteError } = await dbClient
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteError || !website) {
      return NextResponse.json({ error: "Website not found or ownership validation failed." }, { status: 404 });
    }

    // 3. Fetch execution record for draft
    let execQuery = dbClient
      .from("marketing_campaign_executions")
      .select("*")
      .eq("website_id", websiteId)
      .eq("user_id", user.id);

    if (draftId && draftId !== "latest") {
      execQuery = execQuery.eq("draft_id", draftId);
    } else {
      execQuery = execQuery.order("created_at", { ascending: false }).limit(1);
    }

    const { data: executions, error: execErr } = await execQuery;
    const execution = Array.isArray(executions) && executions.length > 0 ? executions[0] : null;

    if (!execution) {
      return NextResponse.json({
        hasExecution: false,
        status: "none",
        publishingStep: "none",
      });
    }

    const trace = Array.isArray(execution.execution_trace) ? execution.execution_trace : [];
    const lastSync = trace.slice().reverse().find((t: any) => t.step === "status_synced")?.statuses || {};

    return NextResponse.json({
      hasExecution: true,
      executionId: execution.id,
      draftId: execution.draft_id,
      status: execution.status,
      publishingStep: execution.publishing_step,
      metaCampaignId: execution.meta_campaign_id,
      metaAdsetId: execution.meta_adset_id,
      metaCreativeId: execution.meta_creative_id,
      metaAdId: execution.meta_ad_id,
      campaignStatus: lastSync.campaignStatus || "PAUSED",
      adsetStatus: lastSync.adsetStatus || "PAUSED",
      adStatus: lastSync.adStatus || "PAUSED",
      approvalSnapshot: execution.approval_snapshot,
      executionTrace: execution.execution_trace || [],
      errorLog: execution.error_log || [],
      createdAt: execution.created_at,
      updatedAt: execution.updated_at,
    });
  } catch (err: any) {
    console.error("GET Campaign Execution Status Error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error fetching campaign status." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; draftId: string }> }
) {
  try {
    const { id: websiteId, draftId } = await context.params;
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

    // 2. Validate website ownership
    const { data: website, error: siteError } = await dbClient
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteError || !website) {
      return NextResponse.json({ error: "Website not found or ownership validation failed." }, { status: 404 });
    }

    // 3. Fetch execution record for draft
    let execQuery = dbClient
      .from("marketing_campaign_executions")
      .select("*")
      .eq("website_id", websiteId)
      .eq("user_id", user.id);

    if (draftId && draftId !== "latest") {
      execQuery = execQuery.eq("draft_id", draftId);
    } else {
      execQuery = execQuery.order("created_at", { ascending: false }).limit(1);
    }

    const { data: executions, error: execErr } = await execQuery;
    const execution = Array.isArray(executions) && executions.length > 0 ? executions[0] : null;

    if (!execution) {
      return NextResponse.json({
        error: "No campaign execution record found to sync status.",
      }, { status: 404 });
    }

    const { syncMetaExecutionStatus } = await import("@/lib/marketing/meta-publisher");
    const result = await syncMetaExecutionStatus(dbClient, execution.id);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("POST Campaign Execution Status Sync Error:", err);
    return NextResponse.json({
      success: false,
      warning: "Unable to refresh Meta status. Showing the last known status.",
      error: err?.message || "Internal server error syncing campaign status.",
    }, { status: 500 });
  }
}

