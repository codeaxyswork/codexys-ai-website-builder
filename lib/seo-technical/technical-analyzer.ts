import { CrawledPageData, TechnicalCrawlIssue, TechnicalCrawlResult, TechnicalBreakdownScores } from './types';
import { RobotsTxtData } from './robots-parser';
import { SitemapData } from './sitemap-parser';

export async function analyzeTechnicalCrawl(
  supabase: any,
  websiteId: string,
  userId: string,
  crawledPages: CrawledPageData[],
  robotsData: RobotsTxtData,
  sitemapData: SitemapData,
  crawlDurationMs: number = 0
): Promise<TechnicalCrawlResult> {
  const issues: TechnicalCrawlIssue[] = [];

  // Status counts
  let ok2xx = 0;
  let redirect3xx = 0;
  let clientError4xx = 0;
  let serverError5xx = 0;
  let blockedCount = 0;
  let noindexCount = 0;
  let orphanCount = 0;

  // Trackers for duplicates
  const titleMap: Record<string, string[]> = {};
  const metaMap: Record<string, string[]> = {};

  crawledPages.forEach((p) => {
    if (p.statusCode >= 200 && p.statusCode < 300) ok2xx++;
    else if (p.statusCode >= 300 && p.statusCode < 400) redirect3xx++;
    else if (p.statusCode >= 400 && p.statusCode < 500) clientError4xx++;
    else if (p.statusCode >= 500) serverError5xx++;

    if (p.isDisallowedByRobots) blockedCount++;
    if (p.isNoindex) noindexCount++;
    if (p.inboundLinksCount === 0 && p.depth > 0) orphanCount++;

    // Collect titles & meta descriptions for duplicate signals
    if (p.title) {
      titleMap[p.title] = titleMap[p.title] || [];
      titleMap[p.title].push(p.url);
    }
    if (p.metaDescription) {
      metaMap[p.metaDescription] = metaMap[p.metaDescription] || [];
      metaMap[p.metaDescription].push(p.url);
    }
  });

  // 1. HTTP Status Issues
  crawledPages.forEach((p) => {
    if (p.statusCode >= 400 && p.statusCode < 500) {
      issues.push({
        issue_type: 'broken_page_4xx',
        url: p.url,
        category: 'status_codes',
        severity: 'critical',
        explanation: `URL returned HTTP ${p.statusCode} client error.`,
        evidence: `HTTP Status ${p.statusCode}`,
        recommended_action: 'Fix or remove the broken page or redirect it to a relevant live destination.',
      });
    } else if (p.statusCode >= 500) {
      issues.push({
        issue_type: 'server_error_5xx',
        url: p.url,
        category: 'status_codes',
        severity: 'critical',
        explanation: `URL returned HTTP ${p.statusCode} server error.`,
        evidence: `HTTP Status ${p.statusCode}`,
        recommended_action: 'Inspect server logs and backend handlers to resolve server errors.',
      });
    }
  });

  // 2. Redirect Intelligence
  crawledPages.forEach((p) => {
    if (p.isRedirectLoop) {
      issues.push({
        issue_type: 'redirect_loop',
        url: p.url,
        category: 'redirects',
        severity: 'critical',
        explanation: 'Redirect loop detected. URL points back to itself or an earlier step in the chain.',
        evidence: `Chain: ${(p.redirectChain || []).join(' -> ')}`,
        recommended_action: 'Break the loop and point directly to the final 200 destination.',
      });
    } else if (p.isRedirectChain) {
      issues.push({
        issue_type: 'redirect_chain',
        url: p.url,
        category: 'redirects',
        severity: 'high',
        explanation: 'Redirect chain detected. Requires multiple HTTP redirects to reach destination.',
        evidence: `Chain: ${(p.redirectChain || []).join(' -> ')}`,
        recommended_action: 'Update initial redirect and internal links to point directly to the final URL.',
      });
    }
  });

  // 3. Canonical Intelligence
  crawledPages.forEach((p) => {
    if (p.statusCode === 200) {
      if (!p.canonical) {
        issues.push({
          issue_type: 'missing_canonical',
          url: p.url,
          category: 'canonicals',
          severity: 'medium',
          explanation: 'Page is missing a canonical link tag.',
          recommended_action: 'Add a self-referencing <link rel="canonical"> tag to declare the authoritative URL.',
        });
      } else if (p.canonical.startsWith('http:')) {
        issues.push({
          issue_type: 'canonical_http_mismatch',
          url: p.url,
          category: 'canonicals',
          severity: 'high',
          explanation: 'Canonical tag points to an insecure HTTP URL on an HTTPS site.',
          evidence: `Canonical: ${p.canonical}`,
          recommended_action: 'Update canonical tag to use the secure https:// URL.',
        });
      }
    }
  });

  // 4. Indexability Intelligence & Robots
  crawledPages.forEach((p) => {
    if (p.isNoindex && p.depth === 0) {
      issues.push({
        issue_type: 'homepage_noindex',
        url: p.url,
        category: 'indexability',
        severity: 'critical',
        explanation: 'Homepage is marked noindex, preventing search engines from indexing the site.',
        evidence: `Robots directive: ${p.robotsDirectives}`,
        recommended_action: 'Remove noindex directive from homepage meta tags.',
      });
    }
    if (p.isDisallowedByRobots && sitemapData.urls.includes(p.url)) {
      issues.push({
        issue_type: 'robots_sitemap_conflict',
        url: p.url,
        category: 'robots',
        severity: 'high',
        explanation: 'URL is disallowed in robots.txt but listed in XML sitemap.',
        evidence: `Disallowed path in robots.txt vs XML sitemap inclusion`,
        recommended_action: 'Allow URL in robots.txt or remove it from sitemap.xml.',
      });
    }
  });

  // 5. XML Sitemap Intelligence
  if (sitemapData.exists) {
    sitemapData.urls.forEach((sUrl) => {
      const crawled = crawledPages.find((c) => c.url === sUrl);
      if (crawled && crawled.statusCode >= 400) {
        issues.push({
          issue_type: 'sitemap_broken_url',
          url: sUrl,
          category: 'sitemap',
          severity: 'high',
          explanation: `Sitemap contains a broken URL returning HTTP ${crawled.statusCode}.`,
          evidence: `Status Code: ${crawled.statusCode}`,
          recommended_action: 'Remove broken URL from XML sitemap.',
        });
      } else if (crawled && crawled.isNoindex) {
        issues.push({
          issue_type: 'sitemap_noindex_url',
          url: sUrl,
          category: 'sitemap',
          severity: 'high',
          explanation: 'Sitemap contains a URL marked noindex.',
          evidence: `Robots directive: ${crawled.robotsDirectives}`,
          recommended_action: 'Remove noindex tag or remove URL from sitemap.',
        });
      }
    });
  }

  // 6. Duplicate Signals
  Object.entries(titleMap).forEach(([t, urls]) => {
    if (urls.length > 1 && t.length > 5) {
      urls.forEach((u) => {
        issues.push({
          issue_type: 'duplicate_title',
          url: u,
          category: 'page_quality',
          severity: 'medium',
          explanation: `Identical title tag shared with ${urls.length - 1} other page(s).`,
          evidence: `Title: "${t}"`,
          recommended_action: 'Provide a unique, descriptive SEO title for each page.',
        });
      });
    }
  });

  // 7. Structured Data Intelligence
  crawledPages.forEach((p) => {
    if (p.schemaIssues.hasSchema && !p.schemaIssues.validJsonLd) {
      issues.push({
        issue_type: 'invalid_json_ld',
        url: p.url,
        category: 'structured_data',
        severity: 'high',
        explanation: 'JSON-LD structured data contains syntax errors.',
        evidence: p.schemaIssues.syntaxError || 'Syntax error in script tag',
        recommended_action: 'Fix JSON-LD syntax formatting so search engines can parse rich snippets.',
      });
    }
  });

  // 8. Image & Resource SEO
  crawledPages.forEach((p) => {
    if (p.imageIssues.missingAltCount > 0) {
      issues.push({
        issue_type: 'missing_image_alt',
        url: p.url,
        category: 'page_quality',
        severity: 'low',
        explanation: `${p.imageIssues.missingAltCount} image(s) missing descriptive ALT attributes.`,
        evidence: `${p.imageIssues.missingAltCount} / ${p.imageIssues.totalImages} images missing ALT`,
        recommended_action: 'Add descriptive alt text to all informative images.',
      });
    }
  });

  // 9. HTTPS & Security Signals
  crawledPages.forEach((p) => {
    if (p.securityIssues.hasMixedContent) {
      issues.push({
        issue_type: 'mixed_content',
        url: p.url,
        category: 'security',
        severity: 'medium',
        explanation: 'Page loads unencrypted HTTP resources over an HTTPS connection.',
        recommended_action: 'Update resource URLs to use secure https:// protocol.',
      });
    }
  });

  // Calculate Deterministic Technical SEO Health Score (0-100)
  const totalCrawled = Math.max(1, crawledPages.length);

  const crawlabilityScore = Math.max(0, 100 - (blockedCount / totalCrawled) * 30);
  const indexabilityScore = Math.max(0, 100 - (noindexCount / totalCrawled) * 40);
  const statusCodesScore = Math.max(0, 100 - ((clientError4xx * 25 + serverError5xx * 40) / totalCrawled));
  const redirectsScore = Math.max(0, 100 - (redirect3xx / totalCrawled) * 20);
  const canonicalsScore = Math.max(
    0,
    100 - (issues.filter((i) => i.category === 'canonicals').length / totalCrawled) * 30
  );
  const sitemapScore = sitemapData.exists ? Math.max(0, 100 - sitemapData.invalidUrlsCount * 10) : 70;
  const robotsScore = robotsData.exists ? 100 : 80;
  const linksScore = Math.max(0, 100 - (orphanCount / totalCrawled) * 25);
  const schemaScore = Math.max(
    0,
    100 - (issues.filter((i) => i.category === 'structured_data').length / totalCrawled) * 30
  );
  const pageQualityScore = Math.max(
    0,
    100 - (issues.filter((i) => i.category === 'page_quality').length / totalCrawled) * 20
  );

  const breakdownScores: TechnicalBreakdownScores = {
    crawlability: Math.round(crawlabilityScore),
    indexability: Math.round(indexabilityScore),
    statusCodes: Math.round(statusCodesScore),
    redirects: Math.round(redirectsScore),
    canonicals: Math.round(canonicalsScore),
    sitemap: Math.round(sitemapScore),
    robots: Math.round(robotsScore),
    links: Math.round(linksScore),
    structuredData: Math.round(schemaScore),
    pageQuality: Math.round(pageQualityScore),
  };

  const overallTechnicalScore = Math.round(
    breakdownScores.statusCodes * 0.25 +
      breakdownScores.indexability * 0.2 +
      breakdownScores.canonicals * 0.15 +
      breakdownScores.redirects * 0.1 +
      breakdownScores.sitemap * 0.1 +
      breakdownScores.links * 0.1 +
      breakdownScores.structuredData * 0.1
  );

  const finalScore = Math.min(100, Math.max(0, overallTechnicalScore));

  // Build Crawl Graph
  const graphNodes = crawledPages.map((p) => ({
    url: p.normalizedUrl,
    depth: p.depth,
    statusCode: p.statusCode,
    title: p.title || p.normalizedUrl,
    isOrphan: p.inboundLinksCount === 0 && p.depth > 0,
  }));

  const graphEdges: Array<{ source: string; target: string }> = [];
  crawledPages.forEach((p) => {
    p.outboundLinks.forEach((t) => {
      graphEdges.push({ source: p.normalizedUrl, target: t });
    });
  });

  // Save Technical Run & Issues to Supabase
  const { data: runRecord } = await supabase
    .from('technical_crawl_runs')
    .insert({
      website_id: websiteId,
      user_id: userId,
      technical_score: finalScore,
      total_urls_crawled: crawledPages.length,
      total_issues_count: issues.length,
      summary_breakdown: {
        statusCounts: { ok2xx, redirect3xx, clientError4xx, serverError5xx, blocked: blockedCount, noindex: noindexCount, orphans: orphanCount },
        breakdownScores,
      },
      crawl_graph: { nodes: graphNodes, edges: graphEdges.slice(0, 100) },
      crawl_duration_ms: crawlDurationMs,
    })
    .select('id')
    .single();

  const runId = runRecord?.id;

  if (runId && issues.length > 0) {
    const issueRows = issues.map((iss) => ({
      crawl_id: runId,
      website_id: websiteId,
      user_id: userId,
      issue_type: iss.issue_type,
      url: iss.url,
      category: iss.category,
      severity: iss.severity,
      explanation: iss.explanation,
      evidence: iss.evidence || null,
      recommended_action: iss.recommended_action,
      status: 'open',
    }));

    await supabase.from('technical_crawl_issues').insert(issueRows);
  }

  // Auto Register Opportunities into Phase 11 Opportunity Engine (seo_opportunities)
  for (const iss of issues.slice(0, 10)) {
    try {
      await supabase.from('seo_opportunities').upsert(
        {
          website_id: websiteId,
          user_id: userId,
          type: `technical_${iss.issue_type}`,
          category: 'technical',
          title: `Fix Technical Issue: ${iss.issue_type.replace(/_/g, ' ')} on ${iss.url}`,
          description: iss.explanation,
          impact: iss.severity === 'critical' || iss.severity === 'high' ? 'high' : 'medium',
          effort: 'low',
          priority_score: iss.severity === 'critical' ? 95 : iss.severity === 'high' ? 80 : 60,
          priority: iss.severity === 'critical' ? 'critical' : iss.severity === 'high' ? 'high' : 'medium',
          action_payload: {
            url: iss.url,
            recommended_action: iss.recommended_action,
          },
          status: 'open',
        },
        { onConflict: 'website_id, type' }
      );
    } catch (_e) {}
  }

  return {
    runId,
    technicalScore: finalScore,
    totalUrlsCrawled: crawledPages.length,
    totalIssuesCount: issues.length,
    statusCounts: {
      ok2xx,
      redirect3xx,
      clientError4xx,
      serverError5xx,
      blocked: blockedCount,
      noindex: noindexCount,
      orphans: orphanCount,
    },
    breakdownScores,
    crawlGraph: {
      nodes: graphNodes,
      edges: graphEdges.slice(0, 100),
    },
    issues,
    robotsTxtAnalysis: {
      exists: robotsData.exists,
      disallowedPathsCount: robotsData.disallowedRules.length,
      sitemapsDeclared: robotsData.sitemaps,
    },
    sitemapAnalysis: {
      exists: sitemapData.exists,
      totalUrls: sitemapData.urls.length,
      sitemapVsCrawlMismatchesCount: issues.filter((i) => i.category === 'sitemap').length,
    },
  };
}
