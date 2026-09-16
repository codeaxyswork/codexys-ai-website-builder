import { ContentBrief } from './types';

export async function generateContentBrief(
  supabase: any,
  websiteId: string,
  userId: string,
  params: {
    topic: string;
    primary_keyword?: string;
    secondary_keywords?: string[];
    search_intent?: 'informational' | 'transactional' | 'commercial' | 'navigational';
    target_audience?: string;
    content_type?: 'blog_post' | 'landing_page' | 'guide' | 'faq';
    desired_tone?: string;
    opportunity_id?: string;
    competitor_domain?: string;
  }
): Promise<ContentBrief> {
  const topic = params.topic.trim();
  const primaryKw = params.primary_keyword?.trim() || topic;
  const secondaryKws = params.secondary_keywords || [];
  const searchIntent = params.search_intent || 'informational';
  const targetAudience = params.target_audience || 'General Industry Audience';
  const contentType = params.content_type || 'blog_post';
  const desiredTone = params.desired_tone || 'Professional, Authoritative & Engaging';

  const sourceRecommendations: ContentBrief['source_recommendations'] = [];

  // 1. Fetch Website Details
  const { data: website } = await supabase
    .from('websites')
    .select('id, title, prompt')
    .eq('id', websiteId)
    .single();

  const brandName = website?.title || 'Our Website';

  // 2. Fetch GSC Queries if available
  let gscQueries: string[] = [];
  try {
    const { data: gscData } = await supabase
      .from('gsc_search_analytics')
      .select('query, impressions, clicks')
      .eq('website_id', websiteId)
      .order('impressions', { ascending: false })
      .limit(10);

    if (gscData && gscData.length > 0) {
      gscQueries = gscData.map((g: any) => g.query);
      sourceRecommendations.push({
        source: 'GSC',
        label: 'Google Search Console Performance',
        details: `Identified ${gscQueries.length} top performing queries including: ${gscQueries.slice(0, 3).join(', ')}`,
      });
    }
  } catch (_e) {
    // GSC optional
  }

  // 3. Fetch Competitor Gaps (Phase 13)
  let competitorGapCtx: ContentBrief['competitor_gap_context'] = undefined;
  try {
    const { data: compAnalyses } = await supabase
      .from('competitor_analyses')
      .select('content_gaps, extracted_topics, competitor_id')
      .eq('website_id', websiteId)
      .limit(5);

    if (compAnalyses && compAnalyses.length > 0) {
      const allGaps: string[] = [];
      compAnalyses.forEach((ca: any) => {
        if (Array.isArray(ca.content_gaps)) {
          ca.content_gaps.forEach((g: any) => {
            if (typeof g === 'string') allGaps.push(g);
            else if (g?.topic) allGaps.push(g.topic);
          });
        }
      });

      if (allGaps.length > 0) {
        competitorGapCtx = {
          competitor_domain: params.competitor_domain || 'Tracked Competitors',
          missing_topic: allGaps[0],
          missing_keywords: allGaps.slice(0, 5),
        };
        sourceRecommendations.push({
          source: 'COMPETITOR_GAP',
          label: 'Competitor Intelligence',
          details: `Incorporated missing competitor coverage area: "${allGaps[0]}"`,
        });
      }
    }
  } catch (_e) {
    // Competitor gap optional
  }

  // 4. Fetch Topical Authority Clusters (Phase 12)
  let topicClusterName = 'Core Industry Cluster';
  try {
    const { data: aeoRow } = await supabase
      .from('website_aeo_analysis')
      .select('topic_clusters')
      .eq('website_id', websiteId)
      .maybeSingle();

    if (aeoRow && Array.isArray(aeoRow.topic_clusters) && aeoRow.topic_clusters.length > 0) {
      const matched = aeoRow.topic_clusters.find(
        (tc: any) => tc.core_topic?.toLowerCase().includes(primaryKw.toLowerCase())
      );
      topicClusterName = matched ? matched.core_topic : aeoRow.topic_clusters[0].core_topic || topicClusterName;

      sourceRecommendations.push({
        source: 'TOPICAL_AUTHORITY',
        label: 'Phase 12 Topical Authority Map',
        details: `Aligned with core topic cluster: "${topicClusterName}"`,
      });
    }
  } catch (_e) {
    // Topic cluster optional
  }

  // 5. Fetch Internal Linking Opportunities
  let internalLinks: NonNullable<ContentBrief['internal_link_opportunities']> = [];
  try {
    const { data: pages } = await supabase
      .from('website_pages')
      .select('path, seo_title')
      .eq('website_id', websiteId)
      .limit(5);

    if (pages && pages.length > 0) {
      internalLinks = pages.map((p: any) => ({
        target_path: p.path || '/',
        target_title: p.seo_title || 'Website Page',
        anchor_suggestion: p.seo_title || p.path || 'Learn More',
      }));

      sourceRecommendations.push({
        source: 'INTERNAL_LINKING',
        label: 'Internal Linking Engine',
        details: `Found ${internalLinks.length} existing website pages for contextual internal links.`,
      });
    }
  } catch (_e) {
    // Internal link engine optional
  }

  if (sourceRecommendations.length === 0) {
    sourceRecommendations.push({
      source: 'USER',
      label: 'Direct Input',
      details: `Generated brief based on user specified topic and targets for ${brandName}.`,
    });
  }

  const compKws = competitorGapCtx?.missing_keywords || [];
  const mergedSecondaryKws = Array.from(
    new Set([...secondaryKws, ...gscQueries.slice(0, 3), ...compKws.slice(0, 3)])
  );

  return {
    website_id: websiteId,
    user_id: userId,
    topic,
    primary_keyword: primaryKw,
    secondary_keywords: mergedSecondaryKws,
    search_intent: searchIntent,
    target_audience: targetAudience,
    content_type: contentType,
    topic_cluster: topicClusterName,
    desired_tone: desiredTone,
    opportunity_id: params.opportunity_id,
    source_recommendations: sourceRecommendations,
    gsc_context: gscQueries.length > 0 ? { queries: gscQueries } : undefined,
    competitor_gap_context: competitorGapCtx,
    internal_link_opportunities: internalLinks,
    created_at: new Date().toISOString(),
  };
}
