import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient, getWebsiteMetaAssets } from "@/lib/marketing/meta-client";
import { buildMarketingBusinessContext } from "@/lib/marketing/business-context";
import { validateCampaignSpec, buildCampaignSpecFromStrategy } from "@/lib/marketing/campaign-planner";

export async function PUT(
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
      .select("id, title, user_id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteError || !website) {
      return NextResponse.json({ error: "Website not found or ownership validation failed." }, { status: 404 });
    }

    // 3. Fetch existing draft (support explicit draftId or 'latest' resolution)
    let draftQuery = dbClient
      .from("marketing_campaign_drafts")
      .select("*")
      .eq("website_id", websiteId)
      .eq("user_id", user.id);

    if (draftId && draftId !== "latest") {
      draftQuery = draftQuery.eq("id", draftId);
    } else {
      draftQuery = draftQuery.order("created_at", { ascending: false }).limit(1);
    }

    const { data: drafts, error: draftError } = await draftQuery;
    const draft = Array.isArray(drafts) ? drafts[0] : drafts;

    if (draftError || !draft) {
      return NextResponse.json({ error: "Campaign draft not found." }, { status: 404 });
    }

    const realDraftId = draft.id;

    // 4. Parse revision payload
    const body = await req.json().catch(() => ({}));
    const updatedStrategy = { ...draft.strategy_payload, ...body };

    // 5. Re-evaluate Meta Assets & Business Context
    const businessContext = await buildMarketingBusinessContext(dbClient, websiteId);
    updatedStrategy.spec = buildCampaignSpecFromStrategy(businessContext, updatedStrategy);

    // 6. Validate updated spec
    const validation = validateCampaignSpec(updatedStrategy.spec);

    // 7. Persist updated draft in marketing_campaign_drafts
    const { error: updateErr } = await dbClient
      .from("marketing_campaign_drafts")
      .update({
        strategy_payload: updatedStrategy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", draftId);

    if (updateErr) {
      throw new Error(`Failed to update campaign draft: ${updateErr.message}`);
    }

    return NextResponse.json({
      success: true,
      draftId,
      strategy: updatedStrategy,
      validation,
      message: "Campaign draft revised successfully.",
    });
  } catch (err: any) {
    console.error("PUT Campaign Draft Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to update campaign draft." }, { status: 500 });
  }
}
