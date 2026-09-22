import { NormalizedKeywordItem, KeywordIntelligenceResponse } from "../types";
import { checkDeveloperTokenStatus } from "../google-ads-client";

export async function getCachedKeywordIntelligence(
  supabase: any,
  websiteId: string
): Promise<NormalizedKeywordItem[]> {
  const { data: rows, error } = await supabase
    .from("google_ads_keyword_cache")
    .select("*")
    .eq("website_id", websiteId)
    .gt("expires_at", new Date().toISOString())
    .order("avg_monthly_searches", { ascending: false });

  if (error || !rows) {
    return [];
  }

  return rows.map((r: any) => ({
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
}

export async function getWebsiteKeywordIntelligenceSummary(
  supabase: any,
  websiteId: string
): Promise<KeywordIntelligenceResponse> {
  const devTokenStatus = checkDeveloperTokenStatus();

  // Check if Google Ads credential exists
  const { data: cred } = await supabase
    .from("google_ads_oauth_credentials")
    .select("google_ads_customer_id, encrypted_access_token")
    .eq("website_id", websiteId)
    .maybeSingle();

  const isConnected = !!cred && !!cred.encrypted_access_token;
  const selectedCustomerId = cred?.google_ads_customer_id || null;

  const cachedKeywords = await getCachedKeywordIntelligence(supabase, websiteId);

  return {
    connected: isConnected,
    selectedCustomerId,
    seedType: "keyword",
    seedValue: "",
    totalKeywords: cachedKeywords.length,
    keywords: cachedKeywords,
    developerTokenStatus: devTokenStatus.status as any,
    fetchedAt: new Date().toISOString(),
    cached: cachedKeywords.length > 0,
  };
}
