import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/marketing/meta-client";
import { executeMetaCampaignPublish } from "@/lib/marketing/meta-publisher";

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

    const body = await req.json().catch(() => ({}));
    const reqExecutionId = body.executionId;
    const mockMode = Boolean(body.mockMode);

    // 3. Query approved execution record
    let execQuery = dbClient
      .from("marketing_campaign_executions")
      .select("*")
      .eq("website_id", websiteId)
      .eq("user_id", user.id);

    if (reqExecutionId) {
      execQuery = execQuery.eq("id", reqExecutionId);
    } else if (draftId && draftId !== "latest") {
      execQuery = execQuery.eq("draft_id", draftId);
    } else {
      execQuery = execQuery.order("created_at", { ascending: false }).limit(1);
    }

    const { data: executions, error: execErr } = await execQuery;
    const execution = Array.isArray(executions) ? executions[0] : executions;

    if (execErr || !execution) {
      return NextResponse.json({
        error: "No approved execution snapshot found for this draft. Please approve campaign strategy first.",
      }, { status: 400 });
    }

    if (execution.status === "published") {
      return NextResponse.json({
        success: true,
        executionId: execution.id,
        status: "published",
        metaCampaignId: execution.meta_campaign_id,
        metaAdsetId: execution.meta_adset_id,
        metaCreativeId: execution.meta_creative_id,
        metaAdId: execution.meta_ad_id,
        publishingStep: "completed",
        message: "Campaign has already been published.",
      });
    }

    // 4. Trigger atomic publishing state machine & sequential Meta Graph creation
    const result = await executeMetaCampaignPublish(dbClient, execution.id, mockMode);

    return NextResponse.json({
      success: true,
      executionId: result.id,
      status: result.status,
      publishingStep: result.publishing_step,
      metaCampaignId: result.meta_campaign_id,
      metaAdsetId: result.meta_adset_id,
      metaCreativeId: result.meta_creative_id,
      metaAdId: result.meta_ad_id,
    });
  } catch (err: any) {
    console.error("POST Campaign Publish Error:", err);
    return NextResponse.json({
      error: err?.message || "Campaign publishing failed. Progress saved for safe recovery.",
    }, { status: 500 });
  }
}
