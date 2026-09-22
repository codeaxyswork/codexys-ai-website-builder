import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  loadGoogleAdsCredentials,
  refreshGoogleAdsAccessToken,
  saveGoogleAdsCredentials,
  generateKeywordIdeas,
  checkDeveloperTokenStatus,
} from "@/lib/google-ads-client";
import { normalizeGoogleAdsKeywordResults } from "@/lib/seo-keyword-intelligence/normalizer";
import { KeywordIntelligenceResponse, NormalizedKeywordItem } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const body = await req.json().catch(() => ({}));
    const {
      keywords,
      pageUrl,
      locationId = "2840", // Default US
      languageId = "1000", // Default English
      forceRefresh = false,
    } = body;

    if (!websiteId) {
      return NextResponse.json({ error: "Website ID is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    // Verify website ownership
    const { data: website, error: webErr } = await supabase
      .from("websites")
      .select("id, title")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (webErr || !website) {
      return NextResponse.json(
        { error: "Website not found or unauthorized access." },
        { status: 403 }
      );
    }

    // Load credentials
    let creds = await loadGoogleAdsCredentials(supabase, websiteId);
    if (!creds || !creds.refresh_token) {
      return NextResponse.json(
        { error: "Google Ads is not connected. Please connect Google Ads first.", connected: false },
        { status: 400 }
      );
    }

    if (!creds.google_ads_customer_id) {
      return NextResponse.json(
        { error: "No Google Ads Customer Account selected. Please select a customer account in SEO Integrations.", connected: true, selectedCustomerId: null },
        { status: 400 }
      );
    }

    const devTokenStatus = checkDeveloperTokenStatus();
    const cleanCustomerId = creds.google_ads_customer_id.replace(/-/g, "").trim();

    // Determine seed values
    const seedKeywords = Array.isArray(keywords) && keywords.length > 0 ? keywords.map((k) => String(k).trim()).filter(Boolean) : [];
    const seedUrl = pageUrl && typeof pageUrl === "string" ? pageUrl.trim() : "";

    let seedType: "keyword" | "url" | "keyword_url" = "keyword";
    let seedValue = seedKeywords.join(",");

    if (seedKeywords.length > 0 && seedUrl) {
      seedType = "keyword_url";
      seedValue = `${seedKeywords.join(",")}|${seedUrl}`;
    } else if (seedUrl) {
      seedType = "url";
      seedValue = seedUrl;
    } else if (seedKeywords.length === 0) {
      // Fallback: Use focus keywords from website_seo or title
      const { data: seoRow } = await supabase
        .from("website_seo")
        .select("focus_keywords")
        .eq("website_id", websiteId)
        .maybeSingle();

      const siteFocus = (seoRow?.focus_keywords || "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

      if (siteFocus.length > 0) {
        seedKeywords.push(...siteFocus.slice(0, 3));
        seedValue = seedKeywords.join(",");
      } else {
        seedKeywords.push(website.title || "SEO Marketing");
        seedValue = seedKeywords.join(",");
      }
    }

    // Check DB cache if not forcing refresh
    if (!forceRefresh) {
      const { data: cachedRows } = await supabase
        .from("google_ads_keyword_cache")
        .select("*")
        .eq("website_id", websiteId)
        .eq("customer_id", cleanCustomerId)
        .eq("seed_type", seedType)
        .eq("seed_value", seedValue)
        .gt("expires_at", new Date().toISOString())
        .order("avg_monthly_searches", { ascending: false });

      if (cachedRows && cachedRows.length > 0) {
        const cachedItems: NormalizedKeywordItem[] = cachedRows.map((r: any) => ({
          keyword: r.keyword,
          avgMonthlySearches: r.avg_monthly_searches || 0,
          competition: r.competition || "UNSPECIFIED",
          competitionIndex: r.competition_index || 0,
          lowTopOfPageBidMicros: Number(r.low_top_of_page_bid_micros || 0),
          highTopOfPageBidMicros: Number(r.high_top_of_page_bid_micros || 0),
          lowTopOfPageBidFormatted: `$${(Number(r.low_top_of_page_bid_micros || 0) / 1000000).toFixed(2)}`,
          highTopOfPageBidFormatted: `$${(Number(r.high_top_of_page_bid_micros || 0) / 1000000).toFixed(2)}`,
          monthlySearchMetrics: r.monthly_search_metrics || [],
          source: r.source || "google_ads_api",
          fetchedAt: r.fetched_at || new Date().toISOString(),
        }));

        const responsePayload: KeywordIntelligenceResponse = {
          connected: true,
          selectedCustomerId: cleanCustomerId,
          seedType,
          seedValue,
          totalKeywords: cachedItems.length,
          keywords: cachedItems,
          developerTokenStatus: devTokenStatus.status as any,
          fetchedAt: cachedRows[0]?.fetched_at || new Date().toISOString(),
          cached: true,
        };

        return NextResponse.json(responsePayload);
      }
    }

    // Refresh access token if expired
    let accessToken = creds.access_token;
    if (!accessToken || (creds.token_expires_at && Date.now() >= creds.token_expires_at - 60000)) {
      const refreshed = await refreshGoogleAdsAccessToken(creds.refresh_token);
      accessToken = refreshed.access_token;
      await saveGoogleAdsCredentials(supabase, websiteId, user.id, {
        access_token: refreshed.access_token,
        expires_in: refreshed.expires_in,
      });
    }

    // Fetch keyword ideas from Google Ads API
    let rawIdeas: any[] = [];
    let apiError: string | null = null;

    try {
      rawIdeas = await generateKeywordIdeas(accessToken, cleanCustomerId, {
        keywords: seedKeywords,
        pageUrl: seedUrl || undefined,
        locationId,
        languageId,
      });
    } catch (err: any) {
      console.warn("generateKeywordIdeas API error:", err?.message || err);
      apiError = err?.message || "Failed to fetch keyword ideas from Google Ads API.";
    }

    const normalizedKeywords = normalizeGoogleAdsKeywordResults(rawIdeas);

    // Save fetched keywords into google_ads_keyword_cache if results returned
    if (normalizedKeywords.length > 0) {
      const cacheRecords = normalizedKeywords.map((item) => ({
        website_id: websiteId,
        user_id: user.id,
        customer_id: cleanCustomerId,
        seed_type: seedType,
        seed_value: seedValue,
        keyword: item.keyword,
        avg_monthly_searches: item.avgMonthlySearches,
        competition: item.competition,
        competition_index: item.competitionIndex,
        low_top_of_page_bid_micros: item.lowTopOfPageBidMicros,
        high_top_of_page_bid_micros: item.highTopOfPageBidMicros,
        location_id: locationId,
        language_id: languageId,
        monthly_search_metrics: item.monthlySearchMetrics,
        source: "google_ads_api",
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }));

      for (const rec of cacheRecords) {
        await supabase.from("google_ads_keyword_cache").upsert(rec, {
          onConflict: "website_id,customer_id,seed_type,seed_value,keyword",
        });
      }
    }

    const responsePayload: KeywordIntelligenceResponse = {
      connected: true,
      selectedCustomerId: cleanCustomerId,
      seedType,
      seedValue,
      totalKeywords: normalizedKeywords.length,
      keywords: normalizedKeywords,
      developerTokenStatus: devTokenStatus.status as any,
      fetchedAt: new Date().toISOString(),
      cached: false,
      error: apiError || undefined,
    };

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error("API /api/websites/[id]/seo/google-ads/keywords Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to retrieve Keyword Intelligence." },
      { status: 500 }
    );
  }
}
