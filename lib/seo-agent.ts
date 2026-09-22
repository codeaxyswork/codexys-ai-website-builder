import { GoogleGenAI } from "@google/genai";
import { getGeminiConfig } from "./gemini";
import { DetectedSEOIntent, detectSEOIntent } from "./seo-agent-intent";

export interface SEOAgentContext {
  website: {
    title: string;
    publishedUrl: string | null;
    prompt: string | null;
  };
  seoHealth: {
    seoScore: number | null;
    analysisStatus: string | null;
    lastAnalyzedAt: string | null;
    isDirty: boolean;
  };
  issueSummary: {
    criticalCount: number;
    warningCount: number;
    opportunityCount: number;
    passedCount: number;
    categories: Array<{ name: string; score: number; status: string }>;
  };
  topIssues: Array<{ title: string; severity: string; details: string }>;
  pageHealth: {
    totalPages: number;
    healthyPages: number;
    criticalPages: number;
    orphanedPages: number;
  };
  history: Array<{ seoScore: number; triggerType: string; createdAt: string }>;
  gsc: {
    connected: boolean;
    propertyUrl: string | null;
    totals: { clicks: number; impressions: number; ctr: number; position: number } | null;
    topQueries: Array<{ query: string; clicks: number; impressions: number; position: number }>;
  };
  blogSummary: {
    totalPosts: number;
    publishedPosts: number;
    draftPosts: number;
    latestPosts: Array<{ title: string; slug: string; status: string }>;
  };
  internalLinkSummary: {
    internalLinkScore: number | null;
    totalInternalLinks: number;
    orphanPagesCount: number;
    weaklyLinkedCount: number;
    brokenLinksCount: number;
    topOpportunities: Array<{ sourcePath: string; destinationPath: string; suggestedAnchor: string; reason: string }>;
  };
  localSeoSummary: {
    localSeoScore: number | null;
    businessName: string | null;
    businessType: string | null;
    city: string | null;
    phone: string | null;
    napDetails: string | null;
    hasSchema: boolean;
    gbpConfigured: boolean;
    topIssuesCount: number;
  };
  monitoringSummary: {
    enabled: boolean;
    frequency: string;
    lastRunAt: string | null;
    nextRunAt: string | null;
    failureCount: number;
    recentAlerts: Array<{
      eventType: string;
      severity: string;
      title: string;
      message: string;
      previousValue: string | null;
      currentValue: string | null;
      affectedPage: string | null;
      createdAt: string;
    }>;
  };
  thirdPartyIntegrations: Array<{
    provider: string;
    status: string;
    capabilities: string[];
    lastTestedAt: string | null;
  }>;
  opportunitySummary?: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    avgPriorityScore: number;
    autopilotEligible: number;
    topOpportunities: Array<{ title: string; priorityScore: number; category: string; description: string }>;
  };
  autopilotSummary?: {
    status: string;
    scanFrequency: string;
    autoApplySafeFixes: boolean;
    requireApprovalForStaging: boolean;
    lastRunAt: string | null;
    nextRunAt: string | null;
  };
  aeoSummary?: {
    answerReadinessScore: number;
    clarityScore: number;
    questionsCount: number;
    topQuestions: Array<{ question: string; hasDirectAnswer: boolean }>;
  };
  topicalAuthoritySummary?: {
    topicCoverageScore: number;
    clustersCount: number;
    topClusters: Array<{ mainTopic: string; clusterCoverageScore: number }>;
    missingSubtopicsCount: number;
  };
  competitorSummary?: {
    totalCompetitors: number;
    trackedDomains: string[];
    totalGapsCount: number;
    topGaps: Array<{ title: string; gapType: string; competitorDomain?: string }>;
  };
  contentStudioSummary?: {
    totalBriefs: number;
    latestBriefTopic?: string;
    totalRefreshRuns: number;
  };
  technicalCrawlSummary?: {
    technicalScore: number;
    totalUrlsCrawled: number;
    totalIssuesCount: number;
    statusCounts: { ok2xx: number; redirect3xx: number; clientError4xx: number; serverError5xx: number };
    topTechnicalIssues: Array<{ title: string; severity: string; url: string }>;
  };
  geoSummary?: {
    geoScore: number;
    entityClarityScore: number;
    structuredDataDepthScore: number;
    factualConsistencyScore: number;
    citationReadinessScore: number;
    topRecommendations: string[];
  };
  aioSummary?: {
    aioScore: number;
    answerReadinessScore: number;
    topicDepthScore: number;
    contentStructureScore: number;
    questionCoverageScore: number;
    unansweredQuestionsCount: number;
    topRecommendations: string[];
  };
  aiSearchReadiness?: {
    score: number;
    seo: number;
    aeo: number;
    geo: number;
    aio: number;
    level: string;
    recommendations: string[];
  };
}

/**
 * Builds a bounded, website-specific SEO context payload from existing database records.
 * Uses intent routing to selectively load deep module data while keeping payload lightweight.
 */
export async function buildSEOContext(
  supabase: any,
  websiteId: string,
  detectedIntent?: DetectedSEOIntent
): Promise<SEOAgentContext> {
  const activeIntents = detectedIntent
    ? [detectedIntent.primaryIntent, ...detectedIntent.secondaryIntents]
    : [];
  const shouldFetchAll =
    activeIntents.length === 0 ||
    activeIntents.includes("OVERALL_SEO") ||
    activeIntents.includes("SEO_IMPROVEMENT") ||
    activeIntents.includes("SEO_SCORE");

  // 1. Fetch Website Metadata
  const { data: website } = await supabase
    .from("websites")
    .select("user_id, title, published_slug, prompt")
    .eq("id", websiteId)
    .single();

  const publishedUrl = website?.published_slug
    ? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost:3000"}/site/${website.published_slug}`
    : null;

  // 2. Fetch website_seo Core Baseline
  const { data: seoRow } = await supabase
    .from("website_seo")
    .select("seo_score, analysis_status, last_analyzed_at, is_dirty, seo_analysis")
    .eq("website_id", websiteId)
    .single();

  const analysis = seoRow?.seo_analysis || {};
  let criticalCount = 0;
  let warningCount = 0;
  let opportunityCount = 0;
  let passedCount = 0;
  const topIssues: Array<{ title: string; severity: string; details: string }> = [];

  const categories: Array<{ name: string; score: number; status: string }> = [];

  if (analysis && Object.keys(analysis).length > 0) {
    Object.entries(analysis).forEach(([key, item]: [string, any]) => {
      if (!item || typeof item.max !== "number" || item.max <= 0) return;
      const pct = (item.score / item.max) * 100;
      if (pct === 100) {
        passedCount++;
      } else if (pct >= 60) {
        warningCount++;
        topIssues.push({
          title: `Optimize ${key.replace("_", " ")}`,
          severity: "warning",
          details: item.details || `${key} can be further optimized.`,
        });
      } else {
        criticalCount++;
        topIssues.push({
          title: `Fix ${key.replace("_", " ")}`,
          severity: "critical",
          details: item.details || `${key} requires critical SEO attention.`,
        });
      }
    });

    if (analysis.open_graph?.score < analysis.open_graph?.max) opportunityCount++;
    if (analysis.schema?.score < analysis.schema?.max) opportunityCount++;

    // Category breakdown
    const a = analysis;
    const organicEarned = (a.title?.score || 0) + (a.description?.score || 0) + (a.headings?.score || 0);
    const organicScore = Math.round((organicEarned / 50) * 100);
    categories.push({ name: "Organic & On-Page SEO", score: organicScore, status: organicScore >= 80 ? "Optimal" : organicScore >= 50 ? "Needs Improvement" : "Critical" });

    const techEarned = (a.technical?.score || 0) + (a.canonical?.score || 0) + (a.robots?.score || 0);
    const techScore = Math.round((techEarned / 20) * 100);
    categories.push({ name: "Technical SEO & Indexing", score: techScore, status: techScore >= 80 ? "Optimal" : techScore >= 50 ? "Needs Improvement" : "Critical" });

    const contentEarned = (a.schema?.score || 0) + (a.images?.score || 0);
    const contentScore = Math.round((contentEarned / 20) * 100);
    categories.push({ name: "Content & Structured Data", score: contentScore, status: contentScore >= 80 ? "Optimal" : contentScore >= 50 ? "Needs Improvement" : "Critical" });

    const ogEarned = a.open_graph?.score || 0;
    const ogScore = Math.round((ogEarned / 10) * 100);
    categories.push({ name: "Open Graph & Social Sharing", score: ogScore, status: ogScore >= 80 ? "Optimal" : ogScore >= 50 ? "Needs Improvement" : "Critical" });
  }

  // 3. Fetch Page Health Summary (website_page_seo)
  const { data: pageSeoRows } = await supabase
    .from("website_page_seo")
    .select("seo_score, critical_issues_count, is_orphaned")
    .eq("website_id", websiteId);

  const pagesList = pageSeoRows || [];
  const totalPages = pagesList.length;
  const healthyPages = pagesList.filter((p: any) => (p.seo_score || 0) >= 80).length;
  const criticalPages = pagesList.filter((p: any) => (p.critical_issues_count || 0) > 0).length;
  const orphanedPages = pagesList.filter((p: any) => p.is_orphaned).length;

  // 4. Fetch Analysis History (limited to top 5)
  const { data: historyRows } = await supabase
    .from("seo_analysis_history")
    .select("seo_score, trigger_type, created_at")
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false })
    .limit(5);

  const history = (historyRows || []).map((h: any) => ({
    seoScore: h.seo_score,
    triggerType: h.trigger_type,
    createdAt: h.created_at,
  }));

  // 5. Fetch GSC Context if relevant
  const shouldFetchGsc =
    shouldFetchAll ||
    activeIntents.some((i) =>
      ["GOOGLE_PERFORMANCE", "GOOGLE_RANKINGS", "GSC", "KEYWORD_PERFORMANCE", "PAGE_PERFORMANCE"].includes(i)
    );

  let isGscConnected = false;
  let gscPropertyUrl: string | null = null;
  let gscTotals: { clicks: number; impressions: number; ctr: number; position: number } | null = null;
  let topQueries: Array<{ query: string; clicks: number; impressions: number; position: number }> = [];

  if (shouldFetchGsc) {
    const { data: integration } = await supabase
      .from("seo_integrations")
      .select("status, selected_property_url")
      .eq("website_id", websiteId)
      .eq("provider", "google_search_console")
      .maybeSingle();

    isGscConnected = integration?.status === "connected" && !!integration?.selected_property_url;
    gscPropertyUrl = integration?.selected_property_url || null;

    if (isGscConnected) {
      const { data: analyticsRows } = await supabase
        .from("gsc_search_analytics")
        .select("query, clicks, impressions, ctr, position")
        .eq("website_id", websiteId)
        .order("clicks", { ascending: false })
        .limit(10);

      if (analyticsRows && analyticsRows.length > 0) {
        let totalClicks = 0;
        let totalImpressions = 0;
        let sumCtr = 0;
        let sumPosition = 0;

        analyticsRows.forEach((r: any) => {
          totalClicks += r.clicks || 0;
          totalImpressions += r.impressions || 0;
          sumCtr += r.ctr || 0;
          sumPosition += r.position || 0;
        });

        gscTotals = {
          clicks: totalClicks,
          impressions: totalImpressions,
          ctr: analyticsRows.length > 0 ? Number((sumCtr / analyticsRows.length).toFixed(2)) : 0,
          position: analyticsRows.length > 0 ? Number((sumPosition / analyticsRows.length).toFixed(1)) : 0,
        };

        topQueries = analyticsRows.map((r: any) => ({
          query: r.query,
          clicks: r.clicks || 0,
          impressions: r.impressions || 0,
          position: r.position ? Number(r.position.toFixed(1)) : 0,
        }));
      }
    }
  }

  // 6. Fetch Blog Summary
  const { data: blogRows } = await supabase
    .from("blog_posts")
    .select("title, slug, status, created_at")
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false });

  const blogList = blogRows || [];
  const totalBlogPosts = blogList.length;
  const publishedBlogPosts = blogList.filter((b: any) => b.status === "published").length;
  const draftBlogPosts = blogList.filter((b: any) => b.status === "draft").length;
  const latestBlogPosts = blogList.slice(0, 5).map((b: any) => ({
    title: b.title,
    slug: b.slug,
    status: b.status,
  }));

  // 7. Fetch Internal Links Summary
  const { data: linkRow } = await supabase
    .from("website_internal_links")
    .select("internal_link_score, summary, opportunities")
    .eq("website_id", websiteId)
    .maybeSingle();

  const internalLinkScore = linkRow?.internal_link_score ?? null;
  const linkSummary = linkRow?.summary || {};
  const linkOpps = (linkRow?.opportunities || []).slice(0, 5).map((o: any) => ({
    sourcePath: o.sourcePath,
    destinationPath: o.destinationPath,
    suggestedAnchor: o.suggestedAnchor,
    reason: o.reason,
  }));

  // 8. Fetch Local SEO Summary
  const { data: localRow } = await supabase
    .from("website_local_seo")
    .select("business_name, business_type, city, phone, local_seo_score, analysis_result, gbp_profile_url")
    .eq("website_id", websiteId)
    .maybeSingle();

  const localRes = localRow?.analysis_result || {};
  const localIssues = localRes.issues || [];

  // 9. Fetch Monitoring Summary & Alerts
  const { data: schedRow } = await supabase
    .from("website_monitoring_schedules")
    .select("enabled, frequency, last_run_at, next_run_at, failure_count")
    .eq("website_id", websiteId)
    .maybeSingle();

  const { data: eventRows } = await supabase
    .from("seo_monitoring_events")
    .select("event_type, severity, title, message, previous_value, current_value, affected_page, created_at")
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false })
    .limit(5);

  const recentAlerts = (eventRows || []).map((e: any) => ({
    eventType: e.event_type,
    severity: e.severity,
    title: e.title,
    message: e.message,
    previousValue: e.previous_value || null,
    currentValue: e.current_value || null,
    affectedPage: e.affected_page || null,
    createdAt: e.created_at,
  }));

  // 10. Fetch Third-Party SEO Integrations
  const { data: thirdPartyRows } = await supabase
    .from("website_third_party_seo_integrations")
    .select("provider, status, capabilities, last_tested_at")
    .eq("website_id", websiteId);

  const thirdPartyIntegrations = (thirdPartyRows || []).map((t: any) => ({
    provider: t.provider,
    status: t.status,
    capabilities: t.capabilities || [],
    lastTestedAt: t.last_tested_at || null,
  }));

  // 11. Fetch Opportunities & Autopilot Context
  const { data: oppRows } = await supabase
    .from("seo_opportunities")
    .select("title, priority_score, priority_level, category, description, is_autopilot_eligible, status")
    .eq("website_id", websiteId)
    .in("status", ["new", "viewed", "in_progress"])
    .order("priority_score", { ascending: false });

  const opportunitiesList = oppRows || [];
  const oppTotal = opportunitiesList.length;
  const oppCritical = opportunitiesList.filter((o: any) => o.priority_level === "critical").length;
  const oppHigh = opportunitiesList.filter((o: any) => o.priority_level === "high").length;
  const oppMedium = opportunitiesList.filter((o: any) => o.priority_level === "medium").length;
  const oppLow = opportunitiesList.filter((o: any) => o.priority_level === "low").length;
  const oppAvgScore = oppTotal > 0 ? Math.round(opportunitiesList.reduce((acc: number, o: any) => acc + (o.priority_score || 0), 0) / oppTotal) : 0;
  const oppAutopilotCount = opportunitiesList.filter((o: any) => o.is_autopilot_eligible).length;

  const topOpportunities = opportunitiesList.slice(0, 5).map((o: any) => ({
    title: o.title,
    priorityScore: o.priority_score,
    category: o.category,
    description: o.description,
  }));

  const { data: autoRow } = await supabase
    .from("seo_autopilot_settings")
    .select("status, scan_frequency, auto_apply_safe_fixes, require_approval_for_staging, last_run_at, next_run_at")
    .eq("website_id", websiteId)
    .maybeSingle();

  // 12. Fetch AEO & Topical Authority Data
  const { data: aeoRow } = await supabase
    .from("website_aeo_analysis")
    .select("answer_readiness_score, topic_coverage_score, entity_clarity, questions_discovered, topic_clusters, content_gaps")
    .eq("website_id", websiteId)
    .maybeSingle();

  const questionsList = (aeoRow?.questions_discovered as any[]) || [];
  const clustersList = (aeoRow?.topic_clusters as any[]) || [];
  const gapsList = (aeoRow?.content_gaps as any[]) || [];

  // 13. Fetch Competitor Intelligence Data
  const { data: compRows } = await supabase
    .from("seo_competitors")
    .select("domain, name, status")
    .eq("website_id", websiteId);

  const { data: compAnalyses } = await supabase
    .from("competitor_analyses")
    .select("content_gaps")
    .eq("website_id", websiteId);

  const competitorList = compRows || [];
  const allCompGaps: any[] = [];
  (compAnalyses || []).forEach((ca: any) => {
    if (Array.isArray(ca.content_gaps)) allCompGaps.push(...ca.content_gaps);
  });

  // 14. Fetch Technical Crawl Data
  const { data: latestTechRun } = await supabase
    .from("technical_crawl_runs")
    .select("id, technical_score, total_urls_crawled, total_issues_count, summary_breakdown")
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let topTechIssues: Array<{ title: string; severity: string; url: string }> = [];
  if (latestTechRun?.id) {
    const { data: techIssRows } = await supabase
      .from("technical_crawl_issues")
      .select("issue_type, severity, url")
      .eq("crawl_id", latestTechRun.id)
      .limit(5);

    if (techIssRows) {
      topTechIssues = techIssRows.map((i: any) => ({
        title: i.issue_type.replace(/_/g, " "),
        severity: i.severity,
        url: i.url,
      }));
    }
  }

  let geoSummary: SEOAgentContext["geoSummary"] = undefined;
  if (website?.user_id) {
    try {
      const { runGEOAnalysis } = await import("@/lib/seo-geo/engine");
      const geoData = await runGEOAnalysis(supabase, websiteId, website.user_id);
      if (geoData) {
        geoSummary = {
          geoScore: geoData.score,
          entityClarityScore: geoData.entityClarity.score,
          structuredDataDepthScore: geoData.structuredDataDepth.score,
          factualConsistencyScore: geoData.factualConsistency.score,
          citationReadinessScore: geoData.citationReadiness.score,
          topRecommendations: geoData.recommendations,
        };
      }
    } catch (e) {
      // Gracefully handle GEO context load
    }
  }

  let aioSummary: SEOAgentContext["aioSummary"] = undefined;
  let aiSearchReadiness: SEOAgentContext["aiSearchReadiness"] = undefined;
  if (website?.user_id) {
    try {
      const { runAIOAnalysisEngine } = await import("@/lib/seo-aio/engine");
      const aioPayload = await runAIOAnalysisEngine(supabase, websiteId, website.user_id);
      if (aioPayload) {
        aioSummary = {
          aioScore: aioPayload.aio.score,
          answerReadinessScore: aioPayload.aio.answerReadiness.score,
          topicDepthScore: aioPayload.aio.topicDepth.score,
          contentStructureScore: aioPayload.aio.contentStructure.score,
          questionCoverageScore: aioPayload.aio.questionCoverage.coverageScore,
          unansweredQuestionsCount: aioPayload.aio.questionCoverage.unanswered,
          topRecommendations: aioPayload.aio.recommendations,
        };
        aiSearchReadiness = aioPayload.aiSearchReadiness;
      }
    } catch (e) {
      // Gracefully handle AIO context load
    }
  }

  return {
    website: {
      title: website?.title || "Untitled Website",
      publishedUrl,
      prompt: website?.prompt || null,
    },
    seoHealth: {
      seoScore: seoRow?.seo_score ?? null,
      analysisStatus: seoRow?.analysis_status ?? null,
      lastAnalyzedAt: seoRow?.last_analyzed_at ?? null,
      isDirty: !!seoRow?.is_dirty,
    },
    issueSummary: {
      criticalCount,
      warningCount,
      opportunityCount,
      passedCount,
      categories,
    },
    topIssues: topIssues.slice(0, 10),
    pageHealth: {
      totalPages,
      healthyPages,
      criticalPages,
      orphanedPages,
    },
    history,
    gsc: {
      connected: isGscConnected,
      propertyUrl: gscPropertyUrl,
      totals: gscTotals,
      topQueries,
    },
    blogSummary: {
      totalPosts: totalBlogPosts,
      publishedPosts: publishedBlogPosts,
      draftPosts: draftBlogPosts,
      latestPosts: latestBlogPosts,
    },
    internalLinkSummary: {
      internalLinkScore,
      totalInternalLinks: linkSummary.total_internal_links || 0,
      orphanPagesCount: linkSummary.orphan_pages_count || 0,
      weaklyLinkedCount: linkSummary.weakly_linked_count || 0,
      brokenLinksCount: linkSummary.broken_links_count || 0,
      topOpportunities: linkOpps,
    },
    localSeoSummary: {
      localSeoScore: localRow?.local_seo_score ?? null,
      businessName: localRow?.business_name || null,
      businessType: localRow?.business_type || null,
      city: localRow?.city || null,
      phone: localRow?.phone || null,
      napDetails: localRes.nap_health?.details || null,
      hasSchema: !!localRes.schema_markup,
      gbpConfigured: !!(localRow?.gbp_profile_url && localRow.gbp_profile_url.startsWith("http")),
      topIssuesCount: localIssues.length,
    },
    monitoringSummary: {
      enabled: schedRow?.enabled ?? true,
      frequency: schedRow?.frequency || "weekly",
      lastRunAt: schedRow?.last_run_at || null,
      nextRunAt: schedRow?.next_run_at || null,
      failureCount: schedRow?.failure_count || 0,
      recentAlerts,
    },
    thirdPartyIntegrations,
    opportunitySummary: {
      total: oppTotal,
      critical: oppCritical,
      high: oppHigh,
      medium: oppMedium,
      low: oppLow,
      avgPriorityScore: oppAvgScore,
      autopilotEligible: oppAutopilotCount,
      topOpportunities,
    },
    autopilotSummary: autoRow
      ? {
          status: autoRow.status || "active",
          scanFrequency: autoRow.scan_frequency || "weekly",
          autoApplySafeFixes: !!autoRow.auto_apply_safe_fixes,
          requireApprovalForStaging: !!autoRow.require_approval_for_staging,
          lastRunAt: autoRow.last_run_at || null,
          nextRunAt: autoRow.next_run_at || null,
        }
      : undefined,
    aeoSummary: aeoRow
      ? {
          answerReadinessScore: Number(aeoRow.answer_readiness_score || 0),
          clarityScore: Number(aeoRow.entity_clarity?.clarityScore || 0),
          questionsCount: questionsList.length,
          topQuestions: questionsList.slice(0, 5).map((q) => ({
            question: q.question,
            hasDirectAnswer: !!q.hasDirectAnswer,
          })),
        }
      : undefined,
    topicalAuthoritySummary: aeoRow
      ? {
          topicCoverageScore: Number(aeoRow.topic_coverage_score || 0),
          clustersCount: clustersList.length,
          topClusters: clustersList.slice(0, 5).map((c) => ({
            mainTopic: c.mainTopic,
            clusterCoverageScore: c.clusterCoverageScore,
          })),
          missingSubtopicsCount: gapsList.length,
        }
      : undefined,
    competitorSummary:
      competitorList.length > 0
        ? {
            totalCompetitors: competitorList.length,
            trackedDomains: competitorList.map((c: any) => c.domain),
            totalGapsCount: allCompGaps.length,
            topGaps: allCompGaps.slice(0, 5).map((g: any) => ({
              title: g.title,
              gapType: g.gapType,
              competitorDomain: g.competitorDomain,
            })),
          }
        : undefined,
    technicalCrawlSummary: latestTechRun
      ? {
          technicalScore: latestTechRun.technical_score,
          totalUrlsCrawled: latestTechRun.total_urls_crawled,
          totalIssuesCount: latestTechRun.total_issues_count,
          statusCounts: latestTechRun.summary_breakdown?.statusCounts || { ok2xx: 0, redirect3xx: 0, clientError4xx: 0, serverError5xx: 0 },
          topTechnicalIssues: topTechIssues,
        }
      : undefined,
    geoSummary,
    aioSummary,
    aiSearchReadiness,
  };
}

export interface StructuredSEOFix {
  issueType:
    | "seo_title"
    | "meta_description"
    | "focus_keywords"
    | "og_title"
    | "og_description"
    | "alt_text"
    | "canonical_url"
    | "robots_config"
    | "heading_structure";
  pagePath?: string;
  currentValue?: string;
  recommendedValue: string;
  reason: string;
  severity?: "critical" | "warning" | "opportunity";
  instruction: string;
}

export interface SEOAgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SEOAgentResponsePayload {
  message: string;
  suggestedActions?: string[];
  navigationTarget?:
    | "overview"
    | "technical-crawl"
    | "content-studio"
    | "competitors"
    | "content-gaps"
    | "aeo"
    | "topical-authority"
    | "opportunities"
    | "autopilot"
    | "performance"
    | "monitoring"
    | "organic"
    | "technical"
    | "internal-links"
    | "local-seo"
    | "blog"
    | "pages"
    | "keywords"
    | "integrations"
    | "settings";
  proposedFix?: StructuredSEOFix | null;
}

/**
 * Invokes Gemini process to generate an intelligent SEO Specialist response.
 */
export async function generateSEOAgentResponse(params: {
  userPrompt: string;
  seoContext: SEOAgentContext;
  conversationHistory?: SEOAgentMessage[];
  detectedIntent?: DetectedSEOIntent;
}): Promise<SEOAgentResponsePayload> {
  const { apiKey, model } = getGeminiConfig();
  const ai = new GoogleGenAI({ apiKey });

  const intent = params.detectedIntent || detectSEOIntent(params.userPrompt, params.conversationHistory);

  const systemPrompt = `You are the Codeaxys AI SEO Specialist — a world-class, objective, customer-friendly SEO Intelligence Specialist.
Your role is to orchestrate the entire website SEO system (Phase 1 - Phase 16 modules) and answer customer questions naturally in their conversation language (English, Malayalam, Manglish, or code-switching).

CRITICAL ARCHITECTURE RULES & SAFETY BOUNDARIES:
1. DATA TRUTH: Base all answers strictly on the provided REAL website SEO context. Do NOT invent fake scores, fake clicks, fake rankings, or fake search queries.
2. METRIC CLARITY:
   - "Core SEO Score": On-page technical analysis score (out of 100).
   - "Unified SEO Health Score": Multi-dimensional health score combining technical, content, GSC, local, and link metrics.
   - "GEO Score": Generative Engine Optimization readiness (30% Entity Clarity, 25% Factual Consistency, 25% Structured Data Depth, 20% Citation Readiness).
   - "AIO Score": Answer Intelligence Optimization (35% Answer Readiness, 30% Topic Depth, 20% Content Structure, 15% Question Coverage).
   - "AI Search Readiness Score": Unified readiness combining 35% SEO + 25% AEO + 20% GEO + 20% AIO.
   Never confuse or blend these distinct metrics.
3. GOOGLE & LLM RANKING SAFETY: NEVER say "You will rank #1", "Guaranteed ChatGPT recommendation", or "Guaranteed AI citation". Explain that AI Search Readiness measures structural, entity, and answer clarity for search engines and AI discovery systems, but third-party algorithm outputs cannot be guaranteed.
4. GSC RECONNECT STATE HANDLING: If Google Search Console is not connected or token has expired, state: "Your Google Search Console connection needs to be reconnected before I can retrieve current Google Search data." and recommend navigating to the "integrations" tab.
5. LOCAL SEO & MONITORING ALERTS: Use monitoringSummary and localSeoSummary to explain recent score changes, NAP consistency, JSON-LD schema, or background monitoring events.
6. AEO, GEO, AIO & AI SEARCH READINESS:
   - Answer questions on "Why is my AI Search Readiness low?", "Why is my GEO score low?", "Why is my AIO score low?", "Which questions should my website answer?", "What information about my business is inconsistent?", "Is my business entity clear?", and "What content gaps do I have?".
   - Use geoSummary, aioSummary, aiSearchReadiness, aeoSummary, and topicalAuthoritySummary from context to provide exact, evidence-based answers.
7. ACTION SAFETY & NO AUTOMATIC WRITES: Explain, recommend, guide, navigate to existing tools, and reference existing opportunities. You MUST NOT automatically rewrite user content or alter SEO metadata without explicit user confirmation (e.g. proposing a structured fix payload for user approval).
8. COMPETITOR & CONTENT STUDIO: Use competitorSummary and contentStudioSummary to answer competitor comparison questions and explain topic coverage differences evidence-based ("Based on analyzed pages...").
9. MULTILINGUAL SUPPORT: Respond in the user's natural language:
   - If user speaks Malayalam: Reply in warm, clear Malayalam.
   - If user speaks Manglish ("ente website engane und?"): Reply naturally in Manglish.
   - If user speaks English: Reply in professional English.
10. PRONOUN & REFERENCE RESOLUTION: When user asks short follow-ups ("fix that", "show me that", "what about that issue?"), resolve "that/it" using recent conversation history context.
11. NAVIGATION TARGETS: Suggest exact tab route when referring user to a specific area:
    "overview" | "technical-crawl" | "content-studio" | "competitors" | "content-gaps" | "aeo" | "topical-authority" | "opportunities" | "autopilot" | "performance" | "monitoring" | "organic" | "technical" | "internal-links" | "local-seo" | "blog" | "pages" | "keywords" | "integrations" | "settings"
12. DETERMINISTIC FIX PROPOSALS: If a safe fix applies (e.g. SEO title, meta description, OG tags, canonical URL, robots settings, image alt text), include a "proposedFix" object in your JSON output. Require user approval.

OUTPUT FORMAT:
Return strictly a single JSON object with no markdown fences, no wrapping, matching this shape:
{
  "message": "Detailed, friendly, customer-focused markdown response.",
  "suggestedActions": ["Actionable tip 1", "Actionable tip 2"],
  "navigationTarget": "technical-crawl", // (optional target tab)
  "proposedFix": { // (optional proposed fix object)
    "issueType": "seo_title",
    "pagePath": "index.html",
    "currentValue": "Current title",
    "recommendedValue": "Recommended title",
    "reason": "Why this fix is recommended",
    "severity": "critical",
    "instruction": "Update SEO title"
  }
}`;

  const historyText = (params.conversationHistory || [])
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Customer" : "SEO Agent"}: ${m.content}`)
    .join("\n\n");

  const promptText = `
=== DETECTED INTENT ===
Primary Intent: ${intent.primaryIntent}
Secondary Intents: ${intent.secondaryIntents.join(", ") || "None"}
Detected Language: ${intent.detectedLanguage}
${intent.resolvedContextTopic ? `Resolved Context Topic: ${intent.resolvedContextTopic}` : ""}

=== LIVE WEBSITE SEO CONTEXT ===
${JSON.stringify(params.seoContext, null, 2)}

${historyText ? `=== RECENT CONVERSATION HISTORY ===\n${historyText}\n` : ""}

=== CUSTOMER QUESTION ===
${params.userPrompt}
`;

  const candidateModels = Array.from(new Set([model || "gemini-3.6-flash", "gemini-3.6-flash", "gemini-3.5-flash"]));

  let lastError: Error | null = null;
  for (const targetModel of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${promptText}` }] }],
        config: {
          responseMimeType: "application/json",
        },
      });

      const rawText = response.text || "";
      const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      return {
        message: parsed.message || rawText || "I have analyzed your website SEO context.",
        suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [],
        navigationTarget: parsed.navigationTarget || (intent.targetTabRoute as any) || undefined,
        proposedFix: parsed.proposedFix || null,
      };
    } catch (err: any) {
      console.warn(`SEO Agent Gemini model ${targetModel} failed:`, err?.message || err);
      lastError = err;
    }
  }

  throw new Error(lastError?.message || "Failed to generate response from SEO AI Agent.");
}
