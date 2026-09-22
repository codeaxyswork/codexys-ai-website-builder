import { NormalizedKeywordItem, MonthlySearchMetricItem } from "../types";

/**
 * Format micros value to currency string (e.g. 1500000 -> "$1.50")
 */
export function formatMicrosToCurrency(micros?: number | string | null, currencySymbol: string = "$"): string {
  if (micros === null || micros === undefined || micros === "") return `${currencySymbol}0.00`;
  const numMicros = Number(micros);
  if (isNaN(numMicros) || numMicros <= 0) return `${currencySymbol}0.00`;
  const dollars = numMicros / 1000000;
  return `${currencySymbol}${dollars.toFixed(2)}`;
}

/**
 * Normalize raw Google Ads API KeywordPlanIdeaService results
 */
export function normalizeGoogleAdsKeywordResults(rawResults: any[]): NormalizedKeywordItem[] {
  if (!Array.isArray(rawResults)) return [];

  const nowIso = new Date().toISOString();

  return rawResults.map((item: any) => {
    const text = item.text || item.keywordIdeaMetrics?.text || item.keyword || "Unknown Keyword";
    const metrics = item.keywordIdeaMetrics || item;

    const avgMonthlySearches = Number(metrics.avgMonthlySearches || metrics.monthlySearches || 0);

    const rawComp = (metrics.competition || "UNSPECIFIED").toUpperCase();
    let competition: "HIGH" | "MEDIUM" | "LOW" | "UNSPECIFIED" = "UNSPECIFIED";
    if (["HIGH", "MEDIUM", "LOW"].includes(rawComp)) {
      competition = rawComp as any;
    }

    const competitionIndex = Number(metrics.competitionIndex || 0);
    const lowMicros = Number(metrics.lowTopOfPageBidMicros || 0);
    const highMicros = Number(metrics.highTopOfPageBidMicros || 0);

    const monthlySearchMetrics: MonthlySearchMetricItem[] = Array.isArray(metrics.monthlySearchVolumes)
      ? metrics.monthlySearchVolumes.map((m: any) => ({
          year: Number(m.year || 0),
          month: String(m.month || ""),
          monthlySearches: Number(m.monthlySearches || 0),
        }))
      : [];

    return {
      keyword: String(text).trim(),
      avgMonthlySearches,
      competition,
      competitionIndex: Math.min(100, Math.max(0, competitionIndex)),
      lowTopOfPageBidMicros: lowMicros,
      highTopOfPageBidMicros: highMicros,
      lowTopOfPageBidFormatted: formatMicrosToCurrency(lowMicros),
      highTopOfPageBidFormatted: formatMicrosToCurrency(highMicros),
      monthlySearchMetrics,
      source: "google_ads_api",
      fetchedAt: nowIso,
    };
  });
}

/**
 * Normalize Google Search Console query rows for keyword intelligence
 */
export function normalizeGSCQueries(gscRows: any[]): NormalizedKeywordItem[] {
  if (!Array.isArray(gscRows)) return [];

  const nowIso = new Date().toISOString();

  return gscRows.map((row: any) => {
    const text = row.query || row.keys?.[0] || "Query";
    const impressions = Number(row.impressions || 0);

    return {
      keyword: String(text).trim(),
      avgMonthlySearches: impressions, // Proxy search demand from GSC impressions
      competition: "UNSPECIFIED",
      competitionIndex: 0,
      lowTopOfPageBidMicros: 0,
      highTopOfPageBidMicros: 0,
      lowTopOfPageBidFormatted: "$0.00",
      highTopOfPageBidFormatted: "$0.00",
      monthlySearchMetrics: [],
      source: "gsc_query",
      fetchedAt: nowIso,
    };
  });
}

/**
 * Combine Google Ads keyword data with Search Console query data into unified keyword records
 */
export function combineKeywordIntelligence(
  adsKeywords: NormalizedKeywordItem[],
  gscQueries: NormalizedKeywordItem[]
): NormalizedKeywordItem[] {
  const map = new Map<string, NormalizedKeywordItem>();

  // Add Google Ads items first (richer metrics)
  adsKeywords.forEach((item) => {
    map.set(item.keyword.toLowerCase(), item);
  });

  // Merge GSC queries
  gscQueries.forEach((gscItem) => {
    const key = gscItem.keyword.toLowerCase();
    if (map.has(key)) {
      const existing = map.get(key)!;
      map.set(key, {
        ...existing,
        source: "combined",
      });
    } else {
      map.set(key, gscItem);
    }
  });

  return Array.from(map.values());
}
