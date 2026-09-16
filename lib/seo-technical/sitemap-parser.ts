export interface SitemapData {
  exists: boolean;
  sitemapUrl: string;
  urls: string[];
  duplicateUrlsCount: number;
  invalidUrlsCount: number;
  syntaxError?: string;
}

export async function fetchAndParseSitemap(baseUrl: string, declaredSitemaps: string[] = []): Promise<SitemapData> {
  const defaultUrl = new URL('/sitemap.xml', baseUrl).toString();
  const candidateUrls = Array.from(new Set([defaultUrl, ...declaredSitemaps]));

  for (const sUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(sUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const xmlText = await res.text();
      if (!xmlText.includes('<url') && !xmlText.includes('<sitemap')) continue;

      const locMatches = xmlText.match(/<loc>([\s\S]*?)<\/loc>/gi) || [];
      const rawUrls = locMatches.map((m) => m.replace(/<loc>/i, '').replace(/<\/loc>/i, '').trim());

      const validUrls: string[] = [];
      const seen = new Set<string>();
      let duplicateCount = 0;
      let invalidCount = 0;

      for (const u of rawUrls) {
        if (!u.startsWith('http://') && !u.startsWith('https://')) {
          invalidCount++;
          continue;
        }
        if (seen.has(u)) {
          duplicateCount++;
        } else {
          seen.add(u);
          validUrls.push(u);
        }
      }

      return {
        exists: true,
        sitemapUrl: sUrl,
        urls: validUrls,
        duplicateUrlsCount: duplicateCount,
        invalidUrlsCount: invalidCount,
      };
    } catch (_e) {
      continue;
    }
  }

  return {
    exists: false,
    sitemapUrl: defaultUrl,
    urls: [],
    duplicateUrlsCount: 0,
    invalidUrlsCount: 0,
  };
}
