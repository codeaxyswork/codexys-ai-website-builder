import { normalizeTechnicalUrl } from '../lib/seo-technical/crawler';
import { isPathDisallowed } from '../lib/seo-technical/robots-parser';
import { analyzeTechnicalCrawl } from '../lib/seo-technical/technical-analyzer';
import { CrawledPageData } from '../lib/seo-technical/types';

async function runPhase15Tests() {
  console.log('=== RUNNING PHASE 15 ADVANCED TECHNICAL SEO & CRAWL INTELLIGENCE VERIFICATION ===');

  // Test 1: URL Normalization
  console.log('\n--- Test 1: URL Normalization ---');
  const u1 = normalizeTechnicalUrl('HTTPS://www.MySite.com/services/?ref=123#section');
  console.log(`Normalized "HTTPS://www.MySite.com/services/?ref=123#section" -> "${u1}"`);
  if (!u1.startsWith('https://') || u1.includes('#')) {
    throw new Error('URL Normalization failed');
  }

  // Test 2: Robots.txt Disallow Rules Parser
  console.log('\n--- Test 2: Robots.txt Disallow Rules ---');
  const disallowedRules = ['/admin', '/private/', '/tmp'];
  const check1 = isPathDisallowed('/admin/dashboard', disallowedRules);
  const check2 = isPathDisallowed('/about-us', disallowedRules);
  console.log(`Is "/admin/dashboard" disallowed? ${check1}`);
  console.log(`Is "/about-us" disallowed? ${check2}`);
  if (!check1 || check2) {
    throw new Error('Robots.txt path disallow check failed');
  }

  // Test 3: Technical Analysis Engine & Deterministic Scoring
  console.log('\n--- Test 3: Technical Analysis & Score Calculation ---');
  const mockCrawledPages: CrawledPageData[] = [
    {
      url: 'https://mysite.com/',
      normalizedUrl: 'https://mysite.com/',
      depth: 0,
      statusCode: 200,
      contentType: 'text/html',
      title: 'Home Page',
      metaDescription: 'Welcome to our homepage',
      h1Count: 1,
      wordCount: 800,
      canonical: 'https://mysite.com/',
      robotsDirectives: 'index, follow',
      isNoindex: false,
      isNofollow: false,
      isDisallowedByRobots: false,
      redirectTarget: null,
      isRedirectChain: false,
      isRedirectLoop: false,
      responseTimeMs: 120,
      outboundLinks: ['https://mysite.com/services', 'https://mysite.com/broken-page'],
      inboundLinksCount: 5,
      imageIssues: { totalImages: 2, missingAltCount: 0, brokenImagesCount: 0 },
      schemaIssues: { hasSchema: true, validJsonLd: true, typesFound: ['Organization'] },
      securityIssues: { isHttps: true, hasMixedContent: false },
    },
    {
      url: 'https://mysite.com/services',
      normalizedUrl: 'https://mysite.com/services',
      depth: 1,
      statusCode: 200,
      contentType: 'text/html',
      title: 'Services Page',
      metaDescription: 'Our services',
      h1Count: 1,
      wordCount: 500,
      canonical: 'https://mysite.com/services',
      robotsDirectives: 'index, follow',
      isNoindex: false,
      isNofollow: false,
      isDisallowedByRobots: false,
      redirectTarget: null,
      isRedirectChain: false,
      isRedirectLoop: false,
      responseTimeMs: 150,
      outboundLinks: [],
      inboundLinksCount: 1,
      imageIssues: { totalImages: 1, missingAltCount: 1, brokenImagesCount: 0 },
      schemaIssues: { hasSchema: false, validJsonLd: true, typesFound: [] },
      securityIssues: { isHttps: true, hasMixedContent: false },
    },
    {
      url: 'https://mysite.com/broken-page',
      normalizedUrl: 'https://mysite.com/broken-page',
      depth: 1,
      statusCode: 404,
      contentType: 'text/html',
      title: 'Not Found',
      metaDescription: '',
      h1Count: 0,
      wordCount: 50,
      canonical: null,
      robotsDirectives: null,
      isNoindex: false,
      isNofollow: false,
      isDisallowedByRobots: false,
      redirectTarget: null,
      isRedirectChain: false,
      isRedirectLoop: false,
      responseTimeMs: 80,
      outboundLinks: [],
      inboundLinksCount: 1,
      imageIssues: { totalImages: 0, missingAltCount: 0, brokenImagesCount: 0 },
      schemaIssues: { hasSchema: false, validJsonLd: true, typesFound: [] },
      securityIssues: { isHttps: true, hasMixedContent: false },
    },
    {
      url: 'https://mysite.com/redirect-old',
      normalizedUrl: 'https://mysite.com/redirect-old',
      depth: 1,
      statusCode: 301,
      contentType: 'text/html',
      title: '',
      metaDescription: '',
      h1Count: 0,
      wordCount: 0,
      canonical: null,
      robotsDirectives: null,
      isNoindex: false,
      isNofollow: false,
      isDisallowedByRobots: false,
      redirectTarget: 'https://mysite.com/redirect-mid',
      redirectChain: ['https://mysite.com/redirect-old', 'https://mysite.com/redirect-mid', 'https://mysite.com/services'],
      isRedirectChain: true,
      isRedirectLoop: false,
      responseTimeMs: 200,
      outboundLinks: ['https://mysite.com/redirect-mid'],
      inboundLinksCount: 0,
      imageIssues: { totalImages: 0, missingAltCount: 0, brokenImagesCount: 0 },
      schemaIssues: { hasSchema: false, validJsonLd: true, typesFound: [] },
      securityIssues: { isHttps: true, hasMixedContent: false },
    },
  ];

  const mockRobots = {
    exists: true,
    content: 'User-agent: *\nDisallow: /admin',
    disallowedRules: ['/admin'],
    allowedRules: [],
    sitemaps: ['https://mysite.com/sitemap.xml'],
  };

  const mockSitemap = {
    exists: true,
    sitemapUrl: 'https://mysite.com/sitemap.xml',
    urls: ['https://mysite.com/', 'https://mysite.com/services', 'https://mysite.com/broken-page'],
    duplicateUrlsCount: 0,
    invalidUrlsCount: 0,
  };

  const mockOpps: any[] = [];
  const mockSupabase: any = {
    from: (table: string) => ({
      insert: (row: any) => ({
        select: () => ({
          single: async () => ({ data: { id: 'run_100', ...row } }),
        }),
      }),
      upsert: async (row: any) => {
        if (table === 'seo_opportunities') mockOpps.push(row);
        return { error: null };
      },
    }),
  };

  const result = await analyzeTechnicalCrawl(
    mockSupabase,
    'site_500',
    'user_500',
    mockCrawledPages,
    mockRobots,
    mockSitemap,
    1200
  );

  console.log(`Technical Health Score: ${result.technicalScore}/100`);
  console.log(`Total Crawled URLs: ${result.totalUrlsCrawled}`);
  console.log(`Total Technical Issues Discovered: ${result.totalIssuesCount}`);
  console.log(`Registered Opportunities: ${mockOpps.length}`);

  if (result.technicalScore <= 0 || result.totalIssuesCount === 0) {
    throw new Error('Technical SEO Analysis failed to compute issues and score');
  }

  // Check specific issue types
  const has404Issue = result.issues.some((i) => i.issue_type === 'broken_page_4xx');
  const hasChainIssue = result.issues.some((i) => i.issue_type === 'redirect_chain');
  const hasSitemapBroken = result.issues.some((i) => i.issue_type === 'sitemap_broken_url');

  console.log(`Detected 404 Issue: ${has404Issue}`);
  console.log(`Detected Redirect Chain Issue: ${hasChainIssue}`);
  console.log(`Detected Sitemap Broken URL Mismatch: ${hasSitemapBroken}`);

  if (!has404Issue || !hasChainIssue || !hasSitemapBroken) {
    throw new Error('Specific technical issue detectors failed');
  }

  console.log('\n✅ ALL PHASE 15 ADVANCED TECHNICAL SEO & CRAWL INTELLIGENCE VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runPhase15Tests().catch((err) => {
  console.error('\n❌ Phase 15 Verification Failed:', err);
  process.exit(1);
});
