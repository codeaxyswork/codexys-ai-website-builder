import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient, getWebsiteMetaAssets } from "@/lib/marketing/meta-client";
import { ApprovalSnapshot, getProductionWebsiteUrl, validateProductionUrl } from "@/lib/marketing/meta-publisher";
import { validateCampaignSpec, getFallbackDraft } from "@/lib/marketing/campaign-planner";

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

    // 2. Validate website ownership & fetch publication metadata
    const { data: website, error: siteError } = await dbClient
      .from("websites")
      .select("id, title, custom_domain, domain, is_published, published_slug, user_id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteError || !website) {
      return NextResponse.json({ error: "Website not found or ownership validation failed." }, { status: 404 });
    }

    // 3. Fetch draft record (support explicit draftId, UUID, or 'latest' resolution with fallback)
    let draft: any = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draftId);

    try {
      let draftQuery = dbClient
        .from("marketing_campaign_drafts")
        .select("*")
        .eq("website_id", websiteId)
        .eq("user_id", user.id);

      if (draftId && draftId !== "latest" && isUuid) {
        draftQuery = draftQuery.eq("id", draftId);
      } else {
        draftQuery = draftQuery.order("created_at", { ascending: false }).limit(1);
      }

      const { data: drafts } = await draftQuery;
      draft = Array.isArray(drafts) ? drafts[0] : drafts;
    } catch (err) {
      console.warn("DB draft query failed, checking fallback:", err);
    }

    if (!draft) {
      draft = getFallbackDraft(websiteId, user.id, draftId);
    }

    if (!draft) {
      return NextResponse.json({ error: "Campaign draft not found or unauthorized." }, { status: 404 });
    }

    const realDraftId = draft.id || draftId;


    // 4. Parse payload from request body
    const body = await req.json().catch(() => ({}));
    const selectedAdCopyIndex = typeof body.selectedAdCopyIndex === "number" ? body.selectedAdCopyIndex : 0;
    const selectedImageUrl = body.selectedImageUrl || "";

    // Custom Campaign Editor overrides
    const customCampaignName = body.campaignName;
    const customDailyBudget = body.dailyBudgetAmount !== undefined ? Number(body.dailyBudgetAmount) : null;
    const customDuration = body.durationDays !== undefined ? Number(body.durationDays) : null;
    const customTotalBudget = body.totalBudgetAmount !== undefined ? Number(body.totalBudgetAmount) : null;
    const customHeadline = body.headline;
    const customPrimaryText = body.primaryText;
    const customDescription = body.description;
    const customCta = body.cta;
    const customLocation = body.location;
    const customLandingPagePath = body.landingPagePath;
    const customLandingPageUrl = body.landingPageUrl;
    const customLeadDestination = body.leadDestination;
    const customObjective = body.objective;
    const customAudienceSummary = body.audienceSummary;

    const strat = draft.strategy_payload || {};
    const adVariations = Array.isArray(strat.adCopyVariations) ? strat.adCopyVariations : [];
    const baseSelectedAdCopy = adVariations[selectedAdCopyIndex] || adVariations[0] || {
      headline: strat.userGoal || "Special Offer",
      primaryText: strat.userGoal || "Learn more about our services.",
      description: "Contact us today.",
      cta: "LEARN_MORE",
    };

    const selectedAdCopy = {
      headline: customHeadline || baseSelectedAdCopy.headline,
      primaryText: customPrimaryText || baseSelectedAdCopy.primaryText,
      description: customDescription !== undefined ? customDescription : (baseSelectedAdCopy.description || ""),
      cta: customCta || baseSelectedAdCopy.cta || "LEARN_MORE",
    };

    // 5. Validate selected Meta assets & Campaign Spec
    const metaAssets = await getWebsiteMetaAssets(dbClient, websiteId);
    if (!metaAssets.selectedAdAccount || !metaAssets.selectedPage) {
      return NextResponse.json({
        error: "Selected Meta Ad Account and Facebook Page are required before approving campaign for launch.",
        setupRequired: true,
      }, { status: 400 });
    }

    if (strat.spec) {
      const specValidation = validateCampaignSpec(strat.spec);
      if (!specValidation.is_valid) {
        return NextResponse.json({
          error: "Campaign specification failed validation rules prior to approval.",
          validationErrors: specValidation.errors,
          validationWarnings: specValidation.warnings,
        }, { status: 400 });
      }
    }

    const adAccount = metaAssets.selectedAdAccount;
    const page = metaAssets.selectedPage;

    // 6. Validate budget & resolve authoritative production landing page URL
    const prodBaseUrl = getProductionWebsiteUrl(website);
    if (!prodBaseUrl) {
      return NextResponse.json({
        error: "This website is not published or does not have a valid production URL. Publish or connect the client's website before creating the Meta campaign.",
      }, { status: 400 });
    }

    const targetPath = (customLandingPagePath || strat.landingPageRecommendation?.path || "/contact").replace(/^\//, "");
    let resolvedLandingPageUrl = customLandingPageUrl;
    if (!resolvedLandingPageUrl || resolvedLandingPageUrl.includes("website.com") || resolvedLandingPageUrl.includes("localhost")) {
      resolvedLandingPageUrl = `${prodBaseUrl.replace(/\/$/, "")}/${targetPath}`;
    }

    try {
      resolvedLandingPageUrl = validateProductionUrl(resolvedLandingPageUrl);
    } catch (err: any) {
      return NextResponse.json({
        error: err?.message || "This website is not published or does not have a valid production URL. Publish or connect the client's website before creating the Meta campaign.",
      }, { status: 400 });
    }

    const baseBudget = strat.budgetRecommendation || {
      dailyBudgetAmount: 1000,
      recommendedDurationDays: 7,
      totalBudgetAmount: 7000,
      currency: adAccount.currency || "INR",
    };

    const computedDaily = customDailyBudget !== null ? customDailyBudget : (Number(baseBudget.dailyBudgetAmount) || 1000);
    const computedDuration = customDuration !== null ? customDuration : (Number(baseBudget.recommendedDurationDays) || 7);
    const computedTotal = customTotalBudget !== null ? customTotalBudget : (computedDaily * computedDuration);

    const approvedAt = new Date().toISOString();
    const hashString = `${realDraftId}:${websiteId}:${user.id}:${approvedAt}:${JSON.stringify(selectedAdCopy)}:${computedTotal}`;
    const snapshotHash = crypto.createHash("sha256").update(hashString).digest("hex");
    const idempotencyKey = `exec_${snapshotHash.slice(0, 24)}`;

    const imageSource = selectedImageUrl || strat.creativeBrief?.recommendedImages?.[0] || "";

    // 7. Build Immutable Approval Snapshot with Editor Overrides
    const snapshot: ApprovalSnapshot & { campaignName?: string } = {
      user_id: user.id,
      website_id: websiteId,
      draft_id: realDraftId,
      approved_at: approvedAt,
      approved_by: user.email || user.id,
      campaignName: customCampaignName || `Codeaxys - ${selectedAdCopy.headline.slice(0, 30)}`,
      budget: {
        dailyBudgetAmount: computedDaily,
        durationDays: computedDuration,
        totalBudgetAmount: computedTotal,
        currency: (baseBudget.currency || adAccount.currency || "INR").toUpperCase(),
      },
      targetAudience: {
        ...strat.targetAudience,
        demographicsSummary: customAudienceSummary || strat.targetAudience?.demographicsSummary,
        location: customLocation || strat.targetAudience?.location || "Kerala, India",
      },
      location: customLocation || strat.targetAudience?.location || "Kerala, India",
      metaAdAccountId: adAccount.id,
      metaPageId: page.id,
      selectedAdCopy: {
        headline: selectedAdCopy.headline,
        primaryText: selectedAdCopy.primaryText,
        description: selectedAdCopy.description || "",
        cta: selectedAdCopy.cta || "LEARN_MORE",
      },
      selectedImage: {
        sourceUrl: imageSource,
        sourceType: imageSource ? "media_asset" : "none",
      },
      landingPage: {
        path: `/${targetPath}`,
        url: resolvedLandingPageUrl,
      },
      leadDestination: customLeadDestination || strat.leadDestinationRecommendation?.details || "Meta On-Facebook Instant Lead Form",
      platform: "Meta",
      objective: customObjective || strat.platformStrategy?.objective || "OUTCOME_LEADS",
      snapshotHash,
    };

    // 8. Create execution record in DB
    const executionPayload = {
      draft_id: realDraftId,
      website_id: websiteId,
      user_id: user.id,
      status: "approved",
      idempotency_key: idempotencyKey,
      approval_snapshot: snapshot,
      publishing_step: "approved",
      execution_trace: [{ step: "approved", timestamp: approvedAt }],
      error_log: [],
      updated_at: approvedAt,
    };

    let executionId = `exec_${snapshotHash.slice(0, 16)}`;
    try {
      const { data: execution, error: execError } = await dbClient
        .from("marketing_campaign_executions")
        .upsert(executionPayload, { onConflict: "idempotency_key" })
        .select("*")
        .single();

      if (execution && execution.id) {
        executionId = execution.id;
      } else if (execError) {
        console.warn("Notice: marketing_campaign_executions DB save warning:", execError.message);
      }
    } catch (err) {
      console.warn("DB execution record error, using generated executionId:", err);
    }

    // Update draft status to approved
    try {
      await dbClient
        .from("marketing_campaign_drafts")
        .update({ status: "approved", updated_at: approvedAt })
        .eq("id", realDraftId);
    } catch (err) {
      console.warn("Notice: marketing_campaign_drafts status update warning:", err);
    }

    return NextResponse.json({
      success: true,
      executionId,
      draftId: realDraftId,
      status: "approved",
      snapshot: {
        dailyBudgetAmount: snapshot.budget.dailyBudgetAmount,
        durationDays: snapshot.budget.durationDays,
        totalBudgetAmount: snapshot.budget.totalBudgetAmount,
        currency: snapshot.budget.currency,
        adAccount: adAccount.name,
        page: page.name,
        headline: snapshot.selectedAdCopy.headline,
        landingPageUrl: snapshot.landingPage.url,
      },
    });
  } catch (err: any) {
    console.error("POST Campaign Approval Error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error during campaign approval." }, { status: 500 });
  }
}
