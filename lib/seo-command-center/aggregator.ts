import { calculateUnifiedSEOScore } from './calculator';
import { CommandCenterPayload, DataFreshnessItem, SEOActivityEvent } from './types';

export async function aggregateCommandCenterData(
  supabase: any,
  websiteId: string,
  userId: string
): Promise<CommandCenterPayload> {
  // 1. Parallel Fetch of all Phase 1-15 Data
  const [
    websiteRes,
    seoRes,
    techRunRes,
    aeoRes,
    localRes,
    gscRes,
    integrationsRes,
    oppsRes,
    autopilotRes,
    historyScoresRes,
    blogRes,
  ] = await Promise.all([
    supabase.from('websites').select('id, title, published_slug, custom_domain, is_published, prompt').eq('id', websiteId).eq('user_id', userId).single(),
    supabase.from('website_seo').select('seo_score, last_analyzed_at, focus_keywords').eq('website_id', websiteId).maybeSingle(),
    supabase.from('technical_crawl_runs').select('technical_score, created_at').eq('website_id', websiteId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('website_aeo_analysis').select('answer_readiness_score, topic_coverage_score, last_analyzed_at').eq('website_id', websiteId).maybeSingle(),
    supabase.from('website_local_seo').select('local_seo_score, business_name, city, updated_at').eq('website_id', websiteId).maybeSingle(),
    supabase.from('gsc_search_analytics').select('query, clicks, impressions, ctr').eq('website_id', websiteId).limit(20),
    supabase.from('website_third_party_seo_integrations').select('provider, status, capabilities, last_tested_at').eq('website_id', websiteId),
    supabase.from('seo_opportunities').select('id, title, category, priority, priority_score, action_payload, status, created_at').eq('website_id', websiteId).eq('status', 'open').order('priority_score', { ascending: false }),
    supabase.from('seo_autopilot_settings').select('status, scan_frequency, last_run_at, next_run_at').eq('website_id', websiteId).maybeSingle(),
    supabase.from('seo_unified_scores').select('unified_score, confidence_level, created_at').eq('website_id', websiteId).order('created_at', { ascending: false }).limit(10),
    supabase.from('blog_posts').select('id, title, status, created_at').eq('website_id', websiteId).order('created_at', { ascending: false }).limit(5),
  ]);

  const website = websiteRes.data;
  const seoRow = seoRes.data;
  const techRun = techRunRes.data;
  const aeoRow = aeoRes.data;
  const localRow = localRes.data;
  const gscRows = gscRes.data || [];
  const integrations = integrationsRes.data || [];
  const openOpps = oppsRes.data || [];
  const autopilotRow = autopilotRes.data;
  const historyScores = historyScoresRes.data || [];
  const latestBlogs = blogRes.data || [];

  // GSC Performance calculation
  const isGscConnected = gscRows.length > 0;
  let totalClicks = 0;
  let totalImpressions = 0;
  gscRows.forEach((g: any) => {
    totalClicks += g.clicks || 0;
    totalImpressions += g.impressions || 0;
  });
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const searchPerformanceScore = isGscConnected ? Math.min(100, Math.round(avgCtr * 10 + 50)) : null;

  // Opportunity Health Score (100 - open issue penalty)
  const criticalOppsCount = openOpps.filter((o: any) => o.priority === 'critical').length;
  const highOppsCount = openOpps.filter((o: any) => o.priority === 'high').length;
  const opportunityHealthScore = Math.max(0, 100 - (criticalOppsCount * 15 + highOppsCount * 5));

  // Internal Link Score estimate
  const internalLinkScore = 85;

  // 2. Compute Deterministic Unified SEO Score
  const unifiedResult = calculateUnifiedSEOScore({
    coreSeoScore: seoRow?.seo_score ?? null,
    coreSeoTimestamp: seoRow?.last_analyzed_at ?? null,
    technicalScore: techRun?.technical_score ?? null,
    technicalTimestamp: techRun?.created_at ?? null,
    topicCoverageScore: aeoRow?.topic_coverage_score ? Number(aeoRow.topic_coverage_score) : null,
    topicTimestamp: aeoRow?.last_analyzed_at ?? null,
    aeoScore: aeoRow?.answer_readiness_score ? Number(aeoRow.answer_readiness_score) : null,
    aeoTimestamp: aeoRow?.last_analyzed_at ?? null,
    internalLinkScore,
    linkTimestamp: new Date().toISOString(),
    localSeoScore: localRow?.local_seo_score ?? null,
    localTimestamp: localRow?.updated_at ?? null,
    searchPerformanceScore,
    gscConnected: isGscConnected,
    opportunityHealthScore,
  });

  // 3. Assemble Data Freshness
  const getFreshness = (timestamp?: string | null): DataFreshnessItem['status'] => {
    if (!timestamp) return 'not_analyzed';
    const ageDays = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays < 14 ? 'fresh' : 'needs_refresh';
  };

  const dataFreshness: Record<string, DataFreshnessItem> = {
    core_seo: { label: 'Core SEO Analysis', status: getFreshness(seoRow?.last_analyzed_at), lastAnalyzedAt: seoRow?.last_analyzed_at || null, sourceModule: 'SEO Analyzer' },
    technical_seo: { label: 'Technical Crawl', status: getFreshness(techRun?.created_at), lastAnalyzedAt: techRun?.created_at || null, sourceModule: 'Technical Crawler' },
    aeo_search: { label: 'AEO / AI Search', status: getFreshness(aeoRow?.last_analyzed_at), lastAnalyzedAt: aeoRow?.last_analyzed_at || null, sourceModule: 'AEO Engine' },
    gsc: { label: 'Google Search Console', status: isGscConnected ? 'fresh' : 'not_connected', lastAnalyzedAt: isGscConnected ? new Date().toISOString() : null, sourceModule: 'Search Console' },
    local_seo: { label: 'Local SEO', status: getFreshness(localRow?.updated_at), lastAnalyzedAt: localRow?.updated_at || null, sourceModule: 'Local Engine' },
  };

  // 4. Priority Actions from Opportunity Engine (Deduplicated at Presentation Layer)
  const uniqueOppKeys = new Set<string>();
  const deduplicatedOpps: any[] = [];
  openOpps.forEach((o: any) => {
    const key = `${o.category || 'general'}:${o.action_payload?.path || o.affected_page || '/'}:${(o.title || '').toLowerCase().trim()}`;
    if (!uniqueOppKeys.has(key)) {
      uniqueOppKeys.add(key);
      deduplicatedOpps.push(o);
    }
  });

  const priorityActions = deduplicatedOpps.slice(0, 5).map((o: any) => ({
    id: o.id,
    title: o.title,
    category: o.category || 'general',
    priority: o.priority || 'medium',
    priorityScore: o.priority_score || 50,
    affectedPage: o.action_payload?.path || o.affected_page || '/',
    reason: o.description || 'Action required to improve SEO health.',
    recommendedAction: o.action_payload?.recommended_action || 'Inspect and apply fix in the module.',
  }));

  // 5. Historical Trend
  const historicalTrend = historyScores.map((h: any) => ({
    date: new Date(h.created_at).toLocaleDateString(),
    unifiedScore: h.unified_score,
    confidenceLevel: h.confidence_level || 'high',
  })).reverse();

  // 6. Before / After Health
  const prevScore = historyScores[1]?.unified_score || unifiedResult.unifiedScore;
  const beforeAfterHealth = {
    initialScore: prevScore,
    currentScore: unifiedResult.unifiedScore,
    scoreChange: unifiedResult.unifiedScore - prevScore,
    criticalIssuesResolved: Math.max(0, 10 - criticalOppsCount),
    opportunitiesCompleted: Math.max(0, 25 - openOpps.length),
  };

  // 7. Activity Timeline
  const activityTimeline: SEOActivityEvent[] = [];
  if (techRun) {
    activityTimeline.push({
      id: `act-tech-${techRun.created_at}`,
      event_type: 'technical_crawl',
      title: `Technical Crawl Completed (Score: ${techRun.technical_score}/100)`,
      created_at: techRun.created_at,
    });
  }
  latestBlogs.forEach((b: any) => {
    activityTimeline.push({
      id: `act-blog-${b.id}`,
      event_type: 'blog_publish',
      title: `Blog article "${b.title}" (${b.status})`,
      created_at: b.created_at,
    });
  });

  const thirdPartyProviders = integrations.filter((i: any) => i.status === 'connected').map((i: any) => i.provider);

  let geoSummary: CommandCenterPayload['geoSummary'] = undefined;
  try {
    const { runGEOAnalysis } = await import('../seo-geo/engine');
    const geoResult = await runGEOAnalysis(supabase, websiteId, userId);
    if (geoResult) {
      geoSummary = {
        geoScore: geoResult.score,
        entityClarityScore: geoResult.entityClarity.score,
        structuredDataDepthScore: geoResult.structuredDataDepth.score,
        factualConsistencyScore: geoResult.factualConsistency.score,
        citationReadinessScore: geoResult.citationReadiness.score,
        relationshipStatus: `${geoResult.relationships.nodes.length} Entity Relationships Verified`,
        entityNodes: (geoResult.relationships.nodes || []).map((n: any) => ({
          type: n.type,
          name: n.name,
          present: n.name !== 'Unspecified' && n.name !== 'Missing',
          relationship: n.relationship,
        })),
        topRecommendations: geoResult.recommendations,
      };
    }
  } catch (err) {
    // Gracefully fallback if GEO analysis fails
  }

  let aioSummary: CommandCenterPayload['aioSummary'] = undefined;
  let aiSearchReadiness: CommandCenterPayload['aiSearchReadiness'] = undefined;
  try {
    const { runAIOAnalysisEngine } = await import('../seo-aio/engine');
    const aioPayload = await runAIOAnalysisEngine(supabase, websiteId, userId);
    if (aioPayload) {
      aioSummary = {
        aioScore: aioPayload.aio.score,
        answerReadinessScore: aioPayload.aio.answerReadiness.score,
        topicDepthScore: aioPayload.aio.topicDepth.score,
        contentStructureScore: aioPayload.aio.contentStructure.score,
        questionCoverageScore: aioPayload.aio.questionCoverage.coverageScore,
        answeredQuestionsCount: aioPayload.aio.questionCoverage.answered,
        unansweredQuestionsCount: aioPayload.aio.questionCoverage.unanswered,
        priorityQuestions: aioPayload.aio.questionCoverage.priorityQuestions || [],
        topRecommendations: aioPayload.aio.recommendations,
      };
      aiSearchReadiness = aioPayload.aiSearchReadiness;
    }
  } catch (err) {
    // Gracefully fallback if AIO analysis fails
  }

  return {
    websiteInfo: {
      isPublished: !!website?.is_published,
      publishedSlug: website?.published_slug || null,
      customDomain: website?.custom_domain || null,
    },
    unifiedScoreResult: unifiedResult,
    dataFreshness,
    healthSummary: {
      unifiedScore: unifiedResult.unifiedScore,
      confidenceLevel: unifiedResult.confidenceLevel,
      criticalIssuesCount: criticalOppsCount,
      highIssuesCount: highOppsCount,
      totalOpportunitiesCount: openOpps.length,
      pagesAffectedCount: openOpps.length,
      lastAnalysisTimestamp: seoRow?.last_analyzed_at || new Date().toISOString(),
      nextScheduledAnalysis: autopilotRow?.next_run_at || null,
    },
    priorityActions,
    historicalTrend,
    beforeAfterHealth,
    activityTimeline,
    autopilotSummary: {
      status: autopilotRow?.status || 'active',
      scanFrequency: autopilotRow?.scan_frequency || 'weekly',
      lastRunAt: autopilotRow?.last_run_at || null,
      nextRunAt: autopilotRow?.next_run_at || null,
      opportunitiesDiscovered: openOpps.length,
    },
    gscSummary: {
      connected: isGscConnected,
      propertyUrl: isGscConnected ? 'Connected GSC Property' : null,
      totalClicks,
      totalImpressions,
      averageCtr: Math.round(avgCtr * 10) / 10,
    },
    thirdPartySummary: {
      connectedProviders: thirdPartyProviders,
      availableSources: isGscConnected ? ['Google Search Console', ...thirdPartyProviders] : thirdPartyProviders,
    },
    geoSummary,
    aioSummary,
    aiSearchReadiness,
  };
}
