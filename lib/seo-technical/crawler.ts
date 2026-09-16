import * as cheerio from 'cheerio';
import { CrawledPageData, TechnicalCrawlConfig } from './types';
import { isPathDisallowed } from './robots-parser';

export function normalizeTechnicalUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    parsed.hash = '';
    // Normalize trailing slash for non-root
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch (_e) {
    return urlStr;
  }
}

export async function runTechnicalCrawl(
  startUrl: string,
  disallowedRules: string[] = [],
  config: Partial<TechnicalCrawlConfig> = {}
): Promise<CrawledPageData[]> {
  const maxPages = config.maxPages || 15;
  const maxDepth = config.maxDepth || 3;
  const timeoutMs = config.timeoutMs || 5000;
  const maxBytes = config.maxResponseBodyBytes || 1000000;

  const startNormalized = normalizeTechnicalUrl(startUrl);
  const parsedStart = new URL(startNormalized);
  const allowedDomain = parsedStart.hostname;

  const queue: Array<{ url: string; depth: number; chain: string[] }> = [
    { url: startNormalized, depth: 0, chain: [startNormalized] },
  ];
  const visited = new Set<string>();
  const results: CrawledPageData[] = [];

  while (queue.length > 0 && results.length < maxPages) {
    const item = queue.shift()!;
    const currentUrl = normalizeTechnicalUrl(item.url);

    if (visited.has(currentUrl) || item.depth > maxDepth) continue;
    visited.add(currentUrl);

    let parsedCurrent: URL;
    try {
      parsedCurrent = new URL(currentUrl);
    } catch (_e) {
      continue;
    }

    // Check domain boundary
    if (parsedCurrent.hostname !== allowedDomain) continue;

    // Check robots.txt disallow
    const isDisallowed = isPathDisallowed(parsedCurrent.pathname, disallowedRules);

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual', // Manual handling to inspect 3xx chains
        headers: {
          'User-Agent': 'CodeaxysTechnicalBot/1.0 (+https://codeaxys.com/bot)',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const responseTimeMs = Date.now() - startTime;
      const statusCode = res.status;
      const contentType = res.headers.get('content-type') || '';

      // Handle 3xx Redirects
      if (statusCode >= 300 && statusCode < 400) {
        const location = res.headers.get('location');
        let redirectTarget: string | null = null;

        if (location) {
          try {
            redirectTarget = normalizeTechnicalUrl(new URL(location, currentUrl).toString());
          } catch (_e) {}
        }

        const isLoop = item.chain.includes(redirectTarget || '');
        const isChain = item.chain.length >= 2;

        results.push({
          url: currentUrl,
          normalizedUrl: currentUrl,
          depth: item.depth,
          statusCode,
          contentType,
          title: '',
          metaDescription: '',
          h1Count: 0,
          wordCount: 0,
          canonical: null,
          robotsDirectives: null,
          isNoindex: false,
          isNofollow: false,
          isDisallowedByRobots: isDisallowed,
          redirectTarget,
          redirectChain: [...item.chain, redirectTarget || ''],
          isRedirectChain: isChain,
          isRedirectLoop: isLoop,
          responseTimeMs,
          outboundLinks: redirectTarget ? [redirectTarget] : [],
          inboundLinksCount: 0,
          imageIssues: { totalImages: 0, missingAltCount: 0, brokenImagesCount: 0 },
          schemaIssues: { hasSchema: false, validJsonLd: true, typesFound: [] },
          securityIssues: { isHttps: currentUrl.startsWith('https:'), hasMixedContent: false },
        });

        // Enqueue redirect target if not in loop
        if (redirectTarget && !isLoop && item.depth < maxDepth) {
          queue.push({ url: redirectTarget, depth: item.depth + 1, chain: [...item.chain, redirectTarget] });
        }
        continue;
      }

      // Read response text up to maxBytes
      let htmlText = '';
      if (contentType.includes('html') || contentType.includes('xml')) {
        const rawText = await res.text();
        htmlText = rawText.slice(0, maxBytes);
      }

      const $ = cheerio.load(htmlText);

      // Title & Meta
      const title = $('title').first().text().trim() || '';
      const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';

      // Headings & Text Signals
      const h1Count = $('h1').length;
      const cleanBodyText = $('body').text().replace(/\s+/g, ' ').trim();
      const wordCount = cleanBodyText ? cleanBodyText.split(/\s+/).length : 0;

      // Canonicals & Robots
      const canonicalTag = $('link[rel="canonical"]').attr('href')?.trim() || null;
      const canonical = canonicalTag ? normalizeTechnicalUrl(new URL(canonicalTag, currentUrl).toString()) : null;

      const metaRobots = $('meta[name="robots"]').attr('content')?.toLowerCase() || null;
      const xRobotsTag = res.headers.get('x-robots-tag')?.toLowerCase() || null;
      const combinedRobots = [metaRobots, xRobotsTag].filter(Boolean).join(', ');

      const isNoindex = combinedRobots.includes('noindex');
      const isNofollow = combinedRobots.includes('nofollow');

      // Structured Data JSON-LD Analysis
      let hasSchema = false;
      let validJsonLd = true;
      let syntaxError: string | undefined = undefined;
      const typesFound: string[] = [];

      $('script[type="application/ld+json"]').each((_, el) => {
        hasSchema = true;
        const scriptText = $(el).html() || '';
        try {
          const parsed = JSON.parse(scriptText);
          if (parsed['@type']) {
            if (Array.isArray(parsed['@type'])) typesFound.push(...parsed['@type']);
            else typesFound.push(parsed['@type']);
          }
        } catch (err: any) {
          validJsonLd = false;
          syntaxError = err?.message || 'Invalid JSON-LD syntax';
        }
      });

      // Images Analysis
      let missingAltCount = 0;
      let brokenImagesCount = 0;
      const totalImages = $('img').length;

      $('img').each((_, el) => {
        const alt = $(el).attr('alt');
        const src = $(el).attr('src');
        if (alt === undefined || alt.trim() === '') {
          missingAltCount++;
        }
        if (!src) {
          brokenImagesCount++;
        }
      });

      // Security / Mixed Content
      let hasMixedContent = false;
      if (currentUrl.startsWith('https:')) {
        $('[src], [href]').each((_, el) => {
          const attr = $(el).attr('src') || $(el).attr('href') || '';
          if (attr.startsWith('http:')) hasMixedContent = true;
        });
      }

      // Outbound Links discovery
      const outboundLinks: string[] = [];
      $('a[href]').each((_, el) => {
        const rawHref = $(el).attr('href')?.trim();
        if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) return;

        try {
          const resolved = normalizeTechnicalUrl(new URL(rawHref, currentUrl).toString());
          const resolvedParsed = new URL(resolved);

          if (resolvedParsed.hostname === allowedDomain) {
            outboundLinks.push(resolved);
            if (!visited.has(resolved) && item.depth + 1 <= maxDepth) {
              queue.push({ url: resolved, depth: item.depth + 1, chain: [resolved] });
            }
          }
        } catch (_e) {}
      });

      results.push({
        url: currentUrl,
        normalizedUrl: currentUrl,
        depth: item.depth,
        statusCode,
        contentType,
        title,
        metaDescription,
        h1Count,
        wordCount,
        canonical,
        robotsDirectives: combinedRobots || null,
        isNoindex,
        isNofollow,
        isDisallowedByRobots: isDisallowed,
        redirectTarget: null,
        isRedirectChain: false,
        isRedirectLoop: false,
        responseTimeMs,
        outboundLinks: Array.from(new Set(outboundLinks)),
        inboundLinksCount: 0,
        imageIssues: { totalImages, missingAltCount, brokenImagesCount },
        schemaIssues: { hasSchema, validJsonLd, typesFound, syntaxError },
        securityIssues: { isHttps: currentUrl.startsWith('https:'), hasMixedContent },
      });
    } catch (_err: any) {
      // Crawl failure handling for this URL
      results.push({
        url: currentUrl,
        normalizedUrl: currentUrl,
        depth: item.depth,
        statusCode: 0,
        contentType: '',
        title: '',
        metaDescription: '',
        h1Count: 0,
        wordCount: 0,
        canonical: null,
        robotsDirectives: null,
        isNoindex: false,
        isNofollow: false,
        isDisallowedByRobots: isDisallowed,
        redirectTarget: null,
        isRedirectChain: false,
        isRedirectLoop: false,
        responseTimeMs: Date.now() - startTime,
        outboundLinks: [],
        inboundLinksCount: 0,
        imageIssues: { totalImages: 0, missingAltCount: 0, brokenImagesCount: 0 },
        schemaIssues: { hasSchema: false, validJsonLd: true, typesFound: [] },
        securityIssues: { isHttps: currentUrl.startsWith('https:'), hasMixedContent: false },
      });
    }
  }

  // Calculate inbound link counts across crawled results
  const inboundMap: Record<string, number> = {};
  results.forEach((r) => {
    r.outboundLinks.forEach((target) => {
      inboundMap[target] = (inboundMap[target] || 0) + 1;
    });
  });

  results.forEach((r) => {
    r.inboundLinksCount = inboundMap[r.normalizedUrl] || 0;
  });

  return results;
}
