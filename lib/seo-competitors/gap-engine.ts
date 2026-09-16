import { crawlPublicCompetitor } from "./crawler";
import { CompetitorAnalysis, CompetitorDataSource, CompetitorGapItem, CompetitorTopic } from "./types";
import { calculateOpportunityPriority } from "../seo-opportunities/prioritizer";

export async function runCompetitorGapAnalysis(
  supabase: any,
  websiteId: string,
  userId: string,
  competitorId: string,
  competitorDomain: string
): Promise<CompetitorAnalysis> {
  // 1. Determine Data Source (Check Phase 10 Third Party Integrations)
  const { data: integrations } = await supabase
    .from("website_third_party_seo_integrations")
    .select("provider, status")
    .eq("website_id", websiteId)
    .eq("status", "connected");

  let dataSource: CompetitorDataSource = "PUBLIC_SITE";
  const connectedProviders = (integrations || []).map((i: any) => i.provider.toLowerCase());
  if (connectedProviders.includes("ahrefs")) dataSource = "AHREFS";
  else if (connectedProviders.includes("semrush")) dataSource = "SEMRUSH";
  else if (connectedProviders.includes("moz")) dataSource = "MOZ";

  // 2. Fetch Customer Site Data & Existing Topic Clusters
  const { data: website } = await supabase
    .from("websites")
    .select("title")
    .eq("id", websiteId)
    .single();

  const { data: customerPages } = await supabase
    .from("website_pages")
    .select("path, seo_title")
    .eq("website_id", websiteId);

  const { data: customerBlog } = await supabase
    .from("blog_posts")
    .select("title, slug, category")
    .eq("website_id", websiteId);

  const { data: customerAeo } = await supabase
    .from("website_aeo_analysis")
    .select("topic_clusters, questions_discovered")
    .eq("website_id", websiteId)
    .maybeSingle();

  const { data: gscQueries } = await supabase
    .from("gsc_search_analytics")
    .select("query, impressions, clicks")
    .eq("website_id", websiteId)
    .limit(30);

  // 3. Perform Safe Public Crawl on Competitor
  const scrapedPages = await crawlPublicCompetitor(competitorDomain);

  // 4. Extract Competitor Topics
  const topicMap = new Map<string, number>();
  const competitorPageTypes = new Set<string>();

  scrapedPages.forEach((p) => {
    // Identify page types
    const path = p.url.replace(/^https?:\/\/[^\/]+/i, "").toLowerCase();
    if (path.includes("/about")) competitorPageTypes.add("About Us / Company");
    if (path.includes("/service")) competitorPageTypes.add("Services");
    if (path.includes("/pricing")) competitorPageTypes.add("Pricing");
    if (path.includes("/blog") || path.includes("/guide")) competitorPageTypes.add("Blog / Guides");
    if (path.includes("/faq")) competitorPageTypes.add("FAQ / Help");
    if (path.includes("/case-stud") || path.includes("/testimonial")) competitorPageTypes.add("Case Studies");

    // Aggregate topics
    (p.mainTopics || []).forEach((t) => {
      topicMap.set(t, (topicMap.get(t) || 0) + 1);
    });
  });

  const extractedTopics: CompetitorTopic[] = Array.from(topicMap.entries()).map(([topic, freq]) => ({
    topic,
    category: "general",
    frequency: freq,
  }));

  // 5. Compare Customer vs Competitor Gaps
  const customerPagePaths = (customerPages || []).map((cp: any) => cp.path.toLowerCase());
  const customerTitles = (customerPages || []).map((cp: any) => (cp.seo_title || "").toLowerCase())
    .concat((customerBlog || []).map((b: any) => b.title.toLowerCase()));

  const contentGaps: CompetitorGapItem[] = [];
  const pageGaps: string[] = [];

  // A. Page Gaps
  if (competitorPageTypes.has("FAQ / Help") && !customerPagePaths.some((p: string) => p.includes("faq"))) {
    pageGaps.push("FAQ / Help Page");
    const { priorityScore, priority } = calculateOpportunityPriority({
      impact: "high",
      severity: "medium",
      effort: "low",
    });
    contentGaps.push({
      id: `gap_page_faq_${Date.now()}`,
      competitorId,
      competitorDomain,
      gapType: "page",
      title: `Competitor ${competitorDomain} Has Dedicated FAQ Page`,
      description: `Competitor ${competitorDomain} features an FAQ section to capture conversational search intent.`,
      affectedPageType: "/faq",
      severity: "medium",
      impact: "high",
      effort: "low",
      priority,
      priorityScore,
      recommendedAction: "Create a dedicated FAQ page or section addressing customer questions.",
      actionType: "add_faq_section",
      dataSource,
    });
  }

  if (competitorPageTypes.has("Case Studies") && !customerPagePaths.some((p: string) => p.includes("case") || p.includes("testimonial"))) {
    pageGaps.push("Case Studies / Customer Success");
    const { priorityScore, priority } = calculateOpportunityPriority({
      impact: "medium",
      severity: "low",
      effort: "medium",
    });
    contentGaps.push({
      id: `gap_page_case_${Date.now()}`,
      competitorId,
      competitorDomain,
      gapType: "page",
      title: `Competitor ${competitorDomain} Has Case Studies Section`,
      description: `Competitor ${competitorDomain} publishes customer success stories building brand authority.`,
      affectedPageType: "/case-studies",
      severity: "low",
      impact: "medium",
      effort: "medium",
      priority,
      priorityScore,
      recommendedAction: "Add a Customer Success or Case Studies page to display social proof.",
      actionType: "add_page",
      dataSource,
    });
  }

  // B. Topic & Content Gaps
  extractedTopics.slice(0, 5).forEach((ct, idx) => {
    const topicLower = ct.topic.toLowerCase();
    const isCovered = customerTitles.some((t: string) => t.includes(topicLower));
    if (!isCovered) {
      const { priorityScore, priority } = calculateOpportunityPriority({
        impact: "high",
        severity: "medium",
        effort: "medium",
      });
      contentGaps.push({
        id: `gap_topic_${idx}_${Date.now()}`,
        competitorId,
        competitorDomain,
        gapType: "topic",
        title: `Topic Gap: "${ct.topic}"`,
        description: `Competitor ${competitorDomain} covers "${ct.topic}" which is not explicitly covered on your site.`,
        affectedTopic: ct.topic,
        severity: "medium",
        impact: "high",
        effort: "medium",
        priority,
        priorityScore,
        recommendedAction: `Create a dedicated article or service section covering "${ct.topic}".`,
        actionType: "create_blog_post",
        dataSource,
      });
    }
  });

  // C. Keyword Gaps (if GSC query data exists)
  if (gscQueries && Array.isArray(gscQueries) && gscQueries.length > 0) {
    gscQueries.forEach((g: any, idx: number) => {
      if (g.clicks === 0 && g.impressions > 50) {
        const { priorityScore, priority } = calculateOpportunityPriority({
          impact: "high",
          severity: "high",
          effort: "low",
          gscImpressions: g.impressions,
        });
        contentGaps.push({
          id: `gap_kw_${idx}_${Date.now()}`,
          competitorId,
          competitorDomain,
          gapType: "keyword",
          title: `Keyword Gap: Low CTR query "${g.query}"`,
          description: `Query "${g.query}" received ${g.impressions} search impressions but 0 clicks. Competitors capture SERP traffic.`,
          affectedKeyword: g.query,
          severity: "high",
          impact: "high",
          effort: "low",
          priority,
          priorityScore,
          recommendedAction: `Optimize title tag and content copy to target keyword "${g.query}".`,
          actionType: "optimize_keyword",
          dataSource: "GSC",
        });
      }
    });
  }

  // 6. Register Competitor Opportunities into Phase 11 seo_opportunities Table
  for (const gap of contentGaps) {
    await supabase.from("seo_opportunities").upsert(
      {
        website_id: websiteId,
        user_id: userId,
        type: "competitor",
        category: `competitor_${gap.gapType}_gap_${gap.id}`,
        title: gap.title,
        description: gap.description,
        affected_page: gap.affectedPageType || "index.html",
        affected_keyword: gap.affectedKeyword || gap.affectedTopic || null,
        severity: gap.severity,
        impact: gap.impact,
        effort: gap.effort,
        priority: gap.priority,
        priority_score: gap.priorityScore,
        source: "competitor_intelligence",
        recommended_action: gap.recommendedAction,
        action_type: gap.actionType,
        action_payload: { competitorDomain, dataSource: gap.dataSource },
        status: "new",
      },
      {
        onConflict: "website_id,category,affected_page",
        ignoreDuplicates: true,
      }
    );
  }

  // 7. Persist to competitor_analyses Table
  const analysisRecord: Partial<CompetitorAnalysis> = {
    competitor_id: competitorId,
    website_id: websiteId,
    user_id: userId,
    scraped_pages: scrapedPages,
    extracted_topics: extractedTopics,
    content_gaps: contentGaps,
    page_gaps: pageGaps,
    data_source: dataSource,
    last_analyzed_at: new Date().toISOString(),
  };

  const { data: savedAnalysis } = await supabase
    .from("competitor_analyses")
    .insert(analysisRecord)
    .select()
    .single();

  // Update competitor last_analyzed_at & status
  await supabase
    .from("seo_competitors")
    .update({
      status: "completed",
      last_analyzed_at: new Date().toISOString(),
    })
    .eq("id", competitorId);

  return savedAnalysis || (analysisRecord as CompetitorAnalysis);
}
