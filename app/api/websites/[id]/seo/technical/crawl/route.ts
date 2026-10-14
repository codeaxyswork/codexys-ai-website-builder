import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { fetchAndParseRobotsTxt } from '@/lib/seo-technical/robots-parser';
import { fetchAndParseSitemap } from '@/lib/seo-technical/sitemap-parser';
import { runTechnicalCrawl } from '@/lib/seo-technical/crawler';
import { analyzeTechnicalCrawl } from '@/lib/seo-technical/technical-analyzer';
import { getWebsitePublicUrl } from '@/lib/domain-resolver';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: recentRun, error } = await supabase
      .from('technical_crawl_runs')
      .select('*')
      .eq('website_id', websiteId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !recentRun) {
      return NextResponse.json({ success: true, result: null });
    }

    const { data: cachedIssues } = await supabase
      .from('technical_crawl_issues')
      .select('*')
      .eq('crawl_id', recentRun.id);

    return NextResponse.json({
      success: true,
      result: {
        runId: recentRun.id,
        technicalScore: recentRun.technical_score,
        totalUrlsCrawled: recentRun.total_urls_crawled,
        totalIssuesCount: recentRun.total_issues_count,
        statusCounts: recentRun.summary_breakdown?.statusCounts || {},
        breakdownScores: recentRun.summary_breakdown?.breakdownScores || {},
        crawlGraph: recentRun.crawl_graph || { nodes: [], edges: [] },
        issues: cachedIssues || [],
        robotsTxtAnalysis: recentRun.summary_breakdown?.robotsTxtAnalysis || { exists: true, disallowedPathsCount: 0, sitemapsDeclared: [] },
        sitemapAnalysis: recentRun.summary_breakdown?.sitemapAnalysis || { exists: true, totalUrls: 0, sitemapVsCrawlMismatchesCount: 0 },
        createdAt: recentRun.created_at,
      },
    });
  } catch (err: any) {
    console.error('GET Technical Crawl Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to fetch technical crawl.' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Per-User Rate Limiting (max 2 crawl requests per minute)
    const rl = checkRateLimit(`crawl_user_${user.id}`, { limit: 2, windowMs: 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        {
          error: 'Too many crawl requests. You can run at most 2 crawls per minute.',
          code: 'RATE_LIMITED',
          retryAfterSeconds: Math.ceil(rl.resetMs / 1000),
        },
        { status: 429 }
      );
    }

    const { data: website, error: webErr } = await supabase
      .from('websites')
      .select('id, title, published_slug, custom_domain')
      .eq('id', websiteId)
      .eq('user_id', user.id)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ error: 'Website not found or access denied.' }, { status: 404 });
    }

    // 2. Appropriate 15-Minute Caching Check (unless forceRefresh is requested)
    const body = await request.json().catch(() => ({}));
    const forceRefresh = body?.forceRefresh === true;
    const CRAWL_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

    if (!forceRefresh) {
      const { data: recentRun } = await supabase
        .from('technical_crawl_runs')
        .select('*')
        .eq('website_id', websiteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentRun && Date.now() - new Date(recentRun.created_at).getTime() < CRAWL_CACHE_TTL_MS) {
        const { data: cachedIssues } = await supabase
          .from('technical_crawl_issues')
          .select('*')
          .eq('crawl_id', recentRun.id);

        return NextResponse.json({
          success: true,
          cached: true,
          cachedAt: recentRun.created_at,
          result: {
            runId: recentRun.id,
            technicalScore: recentRun.technical_score,
            totalUrlsCrawled: recentRun.total_urls_crawled,
            totalIssuesCount: recentRun.total_issues_count,
            statusCounts: recentRun.summary_breakdown?.statusCounts || {},
            breakdownScores: recentRun.summary_breakdown?.breakdownScores || {},
            crawlGraph: recentRun.crawl_graph || { nodes: [], edges: [] },
            issues: cachedIssues || [],
            robotsTxtAnalysis: recentRun.summary_breakdown?.robotsTxtAnalysis || { exists: true, disallowedPathsCount: 0, sitemapsDeclared: [] },
            sitemapAnalysis: recentRun.summary_breakdown?.sitemapAnalysis || { exists: true, totalUrls: 0, sitemapVsCrawlMismatchesCount: 0 },
            createdAt: recentRun.created_at,
          },
        });
      }
    }

    // Determine start URL via canonical getWebsitePublicUrl
    const baseUrl = getWebsitePublicUrl(website);

    const startTime = Date.now();

    // 3. Robots.txt Analysis
    const robotsData = await fetchAndParseRobotsTxt(baseUrl);

    // 4. XML Sitemap Analysis
    const sitemapData = await fetchAndParseSitemap(baseUrl, robotsData.sitemaps);

    // 5. Run Bounded Crawler (max 15 pages)
    const crawledPages = await runTechnicalCrawl(baseUrl, robotsData.disallowedRules, {
      maxPages: 15,
      maxDepth: 3,
      timeoutMs: 5000,
      maxResponseBodyBytes: 1000000,
    });

    const crawlDurationMs = Date.now() - startTime;

    // 6. Run Technical Analysis Engine & Persistence
    const result = await analyzeTechnicalCrawl(
      supabase,
      websiteId,
      user.id,
      crawledPages,
      robotsData,
      sitemapData,
      crawlDurationMs
    );

    return NextResponse.json({
      success: true,
      cached: false,
      result,
    });
  } catch (err: any) {
    console.error('POST Technical Crawl Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to execute technical crawl.' }, { status: 500 });
  }
}
