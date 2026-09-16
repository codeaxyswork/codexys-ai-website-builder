import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { fetchAndParseRobotsTxt } from '@/lib/seo-technical/robots-parser';
import { fetchAndParseSitemap } from '@/lib/seo-technical/sitemap-parser';
import { runTechnicalCrawl } from '@/lib/seo-technical/crawler';
import { analyzeTechnicalCrawl } from '@/lib/seo-technical/technical-analyzer';

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

    const { data: website, error: webErr } = await supabase
      .from('websites')
      .select('id, title, published_slug, custom_domain')
      .eq('id', websiteId)
      .eq('user_id', user.id)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ error: 'Website not found or access denied.' }, { status: 404 });
    }

    // Determine start URL (custom domain > published slug > localhost fallback)
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost:3000';
    const baseUrl = website.custom_domain
      ? `https://${website.custom_domain}`
      : website.published_slug
      ? `https://${appDomain}/site/${website.published_slug}`
      : `http://${appDomain}`;

    const startTime = Date.now();

    // 1. Robots.txt Analysis
    const robotsData = await fetchAndParseRobotsTxt(baseUrl);

    // 2. XML Sitemap Analysis
    const sitemapData = await fetchAndParseSitemap(baseUrl, robotsData.sitemaps);

    // 3. Run Bounded Crawler
    const crawledPages = await runTechnicalCrawl(baseUrl, robotsData.disallowedRules, {
      maxPages: 15,
      maxDepth: 3,
      timeoutMs: 5000,
      maxResponseBodyBytes: 1000000,
    });

    const crawlDurationMs = Date.now() - startTime;

    // 4. Run Technical Analysis Engine & Persistence
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
      result,
    });
  } catch (err: any) {
    console.error('POST Technical Crawl Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to execute technical crawl.' }, { status: 500 });
  }
}
