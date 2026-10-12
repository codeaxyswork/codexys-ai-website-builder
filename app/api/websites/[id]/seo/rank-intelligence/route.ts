import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import {
  isLiveAiVisibilityEnabled,
  checkAiVisibilityEntitlement,
  checkProbeCreditEligibility,
  deductProbeCredits,
  refundProbeCredits,
  executeProviderProbeSafe,
  persistProbeResults,
  OpenAiVisibilityAdapter,
  AiVisibilityProbeInput,
} from "@/lib/ai-visibility";
import { calculateOpportunityPriority } from "@/lib/seo-opportunities/prioritizer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    // 1. Authenticate User
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    // 2. Verify Website Ownership
    const { data: website, error: siteErr } = await supabase
      .from("websites")
      .select("id, title, published_slug")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteErr || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    // 3. Check GSC integration connection status
    const { data: gscIntegration } = await supabase
      .from("seo_integrations")
      .select("status, configuration, last_synced_at")
      .eq("website_id", websiteId)
      .eq("provider", "google_search_console")
      .maybeSingle();

    const isGscConnected = gscIntegration?.status === "connected" && !!gscIntegration?.configuration?.selected_property;

    // 4. Fetch GSC Queries
    const { data: gscQueryRows } = await supabase
      .from("gsc_search_analytics")
      .select("dimension_value, clicks, impressions, ctr, position")
      .eq("website_id", websiteId)
      .eq("dimension_type", "query")
      .order("clicks", { ascending: false });

    // 5. Fetch Focus Keywords & SEO Settings
    const { data: seoRow } = await supabase
      .from("website_seo")
      .select("focus_keywords")
      .eq("website_id", websiteId)
      .maybeSingle();

    const rawFocusKeywords: string[] = Array.isArray(seoRow?.focus_keywords)
      ? seoRow.focus_keywords
      : typeof seoRow?.focus_keywords === "string"
      ? (seoRow.focus_keywords as string).split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // 6. Fetch AI Visibility Probe Logs
    const { data: probeLogs } = await supabase
      .from("seo_ai_visibility_logs")
      .select("provider, model_name, prompt, brand_mentioned, citation_urls, status, created_at")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false });

    // 7. Fetch Existing Open Opportunities for deduplication
    const { data: existingOpps } = await supabase
      .from("seo_opportunities")
      .select("id, category, affected_keyword, status")
      .eq("website_id", websiteId)
      .in("status", ["new", "viewed", "in_progress"]);

    const openGapKeywords = new Set(
      (existingOpps || [])
        .filter((o: any) => o.category === "ai_citation_gap" && o.affected_keyword)
        .map((o: any) => String(o.affected_keyword).toLowerCase().trim())
    );

    // 8. Correlate Unified Keywords Dataset
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    const keywordMap = new Map<string, {
      keyword: string;
      source: "gsc" | "focus_keyword" | "both";
      gsc: {
        avgPosition: number | null;
        clicks: number;
        impressions: number;
        ctr: number;
        hasReliableSample: boolean;
      };
      aiVisibility: {
        probesCount: number;
        mentionsCount: number;
        citationsCount: number;
        citationRate: number | null;
        sampleStatus: "live_sample" | "historical_sample" | "insufficient_sample" | "unprobed";
        lastProbedAt: string | null;
        providers: string[];
      };
      gapStatus: "AI_CITATION_GAP" | "STRONG_IN_BOTH" | "RANK_OPPORTUNITY" | "AI_WIN" | "UNPROBED" | "INSUFFICIENT_SAMPLE";
      opportunityExists: boolean;
    }>();

    // A. Add GSC queries
    (gscQueryRows || []).forEach((row: any) => {
      const q = String(row.dimension_value || "").trim();
      if (!q) return;

      const clicks = Number(row.clicks) || 0;
      const impressions = Number(row.impressions) || 0;
      const ctr = Number(row.ctr) || 0;
      const avgPosition = Number(row.position) || null;
      const hasReliableSample = impressions >= 15 || clicks >= 2;

      keywordMap.set(q.toLowerCase(), {
        keyword: q,
        source: "gsc",
        gsc: {
          avgPosition,
          clicks,
          impressions,
          ctr: Number((ctr * 100).toFixed(2)),
          hasReliableSample,
        },
        aiVisibility: {
          probesCount: 0,
          mentionsCount: 0,
          citationsCount: 0,
          citationRate: null,
          sampleStatus: "unprobed",
          lastProbedAt: null,
          providers: [],
        },
        gapStatus: "UNPROBED",
        opportunityExists: openGapKeywords.has(q.toLowerCase()),
      });
    });

    // B. Merge focus keywords
    rawFocusKeywords.forEach((kw) => {
      const cleanKw = kw.trim();
      if (!cleanKw) return;
      const key = cleanKw.toLowerCase();

      if (keywordMap.has(key)) {
        keywordMap.get(key)!.source = "both";
      } else {
        keywordMap.set(key, {
          keyword: cleanKw,
          source: "focus_keyword",
          gsc: {
            avgPosition: null,
            clicks: 0,
            impressions: 0,
            ctr: 0,
            hasReliableSample: false,
          },
          aiVisibility: {
            probesCount: 0,
            mentionsCount: 0,
            citationsCount: 0,
            citationRate: null,
            sampleStatus: "unprobed",
            lastProbedAt: null,
            providers: [],
          },
          gapStatus: "UNPROBED",
          opportunityExists: openGapKeywords.has(key),
        });
      }
    });

    // C. Correlate AI Visibility Probe logs
    const allLogs = probeLogs || [];

    for (const [, item] of keywordMap) {
      const kwLower = item.keyword.toLowerCase();
      const matching = allLogs.filter((l: any) => {
        const pLower = (l.prompt || "").toLowerCase();
        return pLower.includes(kwLower) || kwLower.includes(pLower);
      });

      if (matching.length > 0) {
        // Exclude mock/simulated probe logs from live intelligence calculation
        const liveLogs = matching.filter((l: any) => !l.is_mock && !l.model_name?.startsWith("mock-"));
        const successful = liveLogs.filter((l: any) => l.status === "success");
        const probesCount = liveLogs.length;
        const mentionsCount = successful.filter((l: any) => l.brand_mentioned).length;
        const citationsCount = successful.filter((l: any) => (l.citation_urls || []).length > 0).length;
        const latestTime = new Date(matching[0].created_at).getTime();
        const isRecent = (now - latestTime) < SEVEN_DAYS_MS;
        const uniqueProviders = Array.from(new Set(matching.map((l: any) => l.provider)));

        let sampleStatus: "live_sample" | "historical_sample" | "insufficient_sample" | "unprobed" = "live_sample";
        if (successful.length < 2) {
          sampleStatus = "insufficient_sample";
        } else if (!isRecent) {
          sampleStatus = "historical_sample";
        }

        const citationRate = successful.length > 0 ? Math.round((mentionsCount / successful.length) * 100) : 0;

        item.aiVisibility = {
          probesCount,
          mentionsCount,
          citationsCount,
          citationRate,
          sampleStatus,
          lastProbedAt: matching[0].created_at,
          providers: uniqueProviders,
        };

        // Determine intelligence gap classification
        const gscAvgPos = item.gsc.avgPosition;
        const isGoodGoogleRank = gscAvgPos !== null && gscAvgPos <= 10.0;
        const hasGoogleVolume = item.gsc.impressions >= 20 || item.gsc.clicks >= 2;

        if (sampleStatus === "insufficient_sample") {
          item.gapStatus = "INSUFFICIENT_SAMPLE";
        } else if ((isGoodGoogleRank || hasGoogleVolume) && citationRate < 25) {
          item.gapStatus = "AI_CITATION_GAP";
        } else if (isGoodGoogleRank && citationRate >= 50) {
          item.gapStatus = "STRONG_IN_BOTH";
        } else if (!isGoodGoogleRank && citationRate >= 50) {
          item.gapStatus = "AI_WIN";
        } else {
          item.gapStatus = "RANK_OPPORTUNITY";
        }
      }
    }

    const keywordsList = Array.from(keywordMap.values());

    // Sort order: AI citation gaps first, then highest clicks/impressions
    keywordsList.sort((a, b) => {
      if (a.gapStatus === "AI_CITATION_GAP" && b.gapStatus !== "AI_CITATION_GAP") return -1;
      if (b.gapStatus === "AI_CITATION_GAP" && a.gapStatus !== "AI_CITATION_GAP") return 1;
      return b.gsc.clicks - a.gsc.clicks || b.gsc.impressions - a.gsc.impressions;
    });

    const aiGapsCount = keywordsList.filter((k) => k.gapStatus === "AI_CITATION_GAP").length;
    const strongCount = keywordsList.filter((k) => k.gapStatus === "STRONG_IN_BOTH").length;
    const unprobedCount = keywordsList.filter((k) => k.gapStatus === "UNPROBED").length;

    return NextResponse.json({
      success: true,
      website: {
        id: website.id,
        title: website.title,
        brandName: website.title,
      },
      summary: {
        totalKeywords: keywordsList.length,
        aiCitationGapsCount: aiGapsCount,
        strongInBothCount: strongCount,
        unprobedCount,
        gscConnected: isGscConnected,
        liveModeEnabled: isLiveAiVisibilityEnabled(),
        lastSyncedAt: gscIntegration?.last_synced_at || null,
      },
      keywords: keywordsList,
    });
  } catch (err: any) {
    console.error("GET Rank Intelligence Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load rank intelligence data." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const { data: website, error: siteErr } = await supabase
      .from("websites")
      .select("id, title")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteErr || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "probe_keyword";
    const keyword = String(body.keyword || body.query || "").trim();

    if (!keyword) {
      return NextResponse.json({ error: "Keyword parameter is required." }, { status: 400 });
    }

    // ACTION 1: Targeted Probe on Keyword
    if (action === "probe_keyword" || action === "probe_query") {
      // 0. Server-Side PRO Subscription Entitlement Check
      const entitlement = await checkAiVisibilityEntitlement(user.id, supabase);
      if (!entitlement.entitled) {
        return NextResponse.json(
          {
            error: entitlement.reason || "PRO subscription required for AI Visibility probes.",
            code: "UPGRADE_REQUIRED",
            requiredPlan: "pro",
            currentPlan: entitlement.planId,
            upgradeUrl: "/dashboard/billing",
          },
          { status: 403 }
        );
      }

      const provider = body.provider || "openai";
      const prompt = `What are the top recommended solutions and providers for: ${keyword}?`;

      // 1. Credit Check & Safeguards
      const eligibility = await checkProbeCreditEligibility(
        supabase,
        user.id,
        websiteId,
        prompt,
        [provider]
      );

      if (!eligibility.allowed) {
        return NextResponse.json(
          {
            error: eligibility.error || "Probe request declined.",
            code: eligibility.code || "PROBE_FORBIDDEN",
            creditsRequired: eligibility.creditsRequired,
            currentBalance: eligibility.currentBalance,
          },
          { status: eligibility.code === "INSUFFICIENT_CREDITS" ? 402 : 400 }
        );
      }

      // 2. Deduct credits if live
      let deductedCredits = 0;
      if (eligibility.liveMode && eligibility.creditsRequired > 0) {
        const deduction = await deductProbeCredits(
          supabase,
          user.id,
          websiteId,
          eligibility.creditsRequired,
          prompt
        );
        if (!deduction.success) {
          return NextResponse.json(
            { error: deduction.error || "Failed to deduct AI credits.", code: "INSUFFICIENT_CREDITS" },
            { status: 402 }
          );
        }
        deductedCredits = deduction.creditsDeducted;
      }

      // 3. Execute Probe Safe & Track Unique Request
      const probeRequestId = crypto.randomUUID();
      const adapter = new OpenAiVisibilityAdapter();
      const probeInput: AiVisibilityProbeInput = {
        websiteId,
        userId: user.id,
        brandName: website.title || "Brand",
        prompt,
        category: "commercial",
        options: { timeoutMs: 8000 },
      };

      const result = await executeProviderProbeSafe(adapter, probeInput);

      // Refund safeguard if failure in live mode
      if (eligibility.liveMode && deductedCredits > 0 && result.status !== "success") {
        const adminDb = createAdminClient();
        await refundProbeCredits(
          adminDb || supabase,
          user.id,
          websiteId,
          deductedCredits,
          result.errorMessage || "Probe failed",
          `rank_intel_${probeRequestId}`
        );
        deductedCredits = 0;
      }

      // Persist results
      await persistProbeResults(supabase, websiteId, user.id, result);

      return NextResponse.json({
        success: true,
        probeRequestId,
        keyword,
        brandMentioned: result.brandMentioned,
        citationsCount: (result.citations || []).length,
        liveMode: eligibility.liveMode,
        creditsDeducted: deductedCredits,
        result,
      });
    }

    // ACTION 2: Create Opportunity for AI Citation Gap
    if (action === "create_gap_opportunity" || action === "generate_opportunity") {
      const gscAvgPosition = body.gscAvgPosition ? Number(body.gscAvgPosition) : 5.0;
      const gscImpressions = body.gscImpressions ? Number(body.gscImpressions) : 50;
      const aiCitationRate = body.aiCitationRate !== undefined ? Number(body.aiCitationRate) : 0;

      // Check existing open opportunities to prevent duplicate
      const { data: existing } = await supabase
        .from("seo_opportunities")
        .select("id")
        .eq("website_id", websiteId)
        .eq("category", "ai_citation_gap")
        .eq("affected_keyword", keyword)
        .in("status", ["new", "viewed", "in_progress"])
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          success: true,
          message: "An active opportunity already exists for this keyword.",
          opportunityId: existing.id,
          alreadyExists: true,
        });
      }

      const { priorityScore, priority } = calculateOpportunityPriority({
        impact: "high",
        severity: "high",
        effort: "low",
        gscImpressions,
      });

      const newOpportunity = {
        website_id: websiteId,
        user_id: user.id,
        type: "ai_visibility",
        category: "ai_citation_gap",
        title: `AI Citation Gap: "${keyword}" (Page 1 on Google, Absent in AI)`,
        description: `Query "${keyword}" averages GSC position #${gscAvgPosition.toFixed(1)} with ${gscImpressions} impressions, but currently has ${aiCitationRate}% citation coverage across AI search answers.`,
        affected_page: `query/${encodeURIComponent(keyword.toLowerCase())}`,
        affected_keyword: keyword,
        severity: "high",
        impact: "high",
        effort: "low",
        priority,
        priority_score: priorityScore,
        source: "ai_visibility",
        recommended_action: `Create an authoritative, answer-first content piece in Content Studio optimized for LLM citations to capture demand for "${keyword}".`,
        action_type: "create_content_brief",
        action_payload: {
          topic: `Complete Guide to ${keyword.charAt(0).toUpperCase() + keyword.slice(1)}`,
          primary_keyword: keyword,
          search_intent: "informational",
          gscAvgPosition,
          gscImpressions,
          aiCitationRate,
        },
        status: "new",
      };

      const { data: inserted, error: insertErr } = await supabase
        .from("seo_opportunities")
        .insert(newOpportunity)
        .select("id")
        .single();

      if (insertErr) {
        console.error("Insert opportunity error:", insertErr);
        return NextResponse.json({ error: "Failed to create SEO opportunity." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Opportunity created for "${keyword}".`,
        opportunityId: inserted?.id,
      });
    }

    return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 });
  } catch (err: any) {
    console.error("POST Rank Intelligence Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to process rank intelligence action." },
      { status: 500 }
    );
  }
}
