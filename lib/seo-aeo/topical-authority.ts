import { calculateTopicCoverageScore } from "./scorer";
import { ContentGap, TopicCluster } from "./types";
import { calculateOpportunityPriority } from "../seo-opportunities/prioritizer";

export async function runTopicalAuthorityAnalysis(
  supabase: any,
  websiteId: string,
  userId: string
) {
  // 1. Fetch site data
  const { data: website } = await supabase
    .from("websites")
    .select("id, title, prompt")
    .eq("id", websiteId)
    .single();

  const { data: seoRow } = await supabase
    .from("website_seo")
    .select("focus_keywords, seo_title")
    .eq("website_id", websiteId)
    .maybeSingle();

  const { data: pages } = await supabase
    .from("website_pages")
    .select("id, path, seo_title")
    .eq("website_id", websiteId);

  const { data: blogPosts } = await supabase
    .from("blog_posts")
    .select("id, title, slug, category, status")
    .eq("website_id", websiteId);

  // 2. Extract Core Topics & Build Topic Clusters
  const pageList = pages || [];
  const postList = blogPosts || [];
  const siteTitle = website?.title || "Main Business Services";

  // Core Topic derived from website title or focus keywords
  const focusKwList = (seoRow?.focus_keywords || "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);

  const mainTopic = focusKwList[0] || siteTitle || "Core Business Services";

  // Build primary topic cluster
  const primaryCluster: TopicCluster = {
    id: `cluster_main_${websiteId}`,
    mainTopic,
    supportingTopics: focusKwList.slice(1, 4).concat(["Services Overview", "Customer Guides"]),
    subtopics: postList.map((b: any) => b.title).concat(pageList.map((p: any) => p.seo_title || p.path)),
    relatedPages: pageList.map((p: any) => p.path),
    relatedBlogPosts: postList.map((b: any) => `/blog/${b.slug}`),
    clusterCoverageScore: Math.min(100, (pageList.length + postList.length * 2) * 12),
    readinessScore: Math.min(100, (pageList.length > 0 ? 40 : 0) + postList.length * 15),
    missingSubtopics: [
      `${mainTopic} Buying & Selection Guide`,
      `${mainTopic} Frequently Asked Questions`,
      `${mainTopic} Pricing & Comparison Guide`,
      `Best Practices for ${mainTopic}`,
    ].filter((sub) => !postList.some((b: any) => b.title.toLowerCase().includes(mainTopic.toLowerCase()))),
  };

  const topicClusters: TopicCluster[] = [primaryCluster];

  // Secondary cluster if blog posts have categories
  const categories = Array.from(new Set(postList.map((b: any) => b.category).filter(Boolean)));
  categories.forEach((cat: any, idx: number) => {
    if (cat.toLowerCase() !== "general") {
      const catPosts = postList.filter((b: any) => b.category === cat);
      topicClusters.push({
        id: `cluster_cat_${idx}`,
        mainTopic: cat,
        supportingTopics: ["Industry Trends", "Best Practices"],
        subtopics: catPosts.map((b: any) => b.title),
        relatedPages: ["/blog"],
        relatedBlogPosts: catPosts.map((b: any) => `/blog/${b.slug}`),
        clusterCoverageScore: Math.min(100, catPosts.length * 25),
        readinessScore: Math.min(100, catPosts.length * 20),
        missingSubtopics: [`${cat} Comprehensive Guide`, `${cat} Case Studies`],
      });
    }
  });

  // 3. Identify Content Gaps
  const contentGaps: ContentGap[] = [];
  primaryCluster.missingSubtopics.forEach((missing, idx) => {
    contentGaps.push({
      id: `gap_${idx}`,
      mainTopic,
      missingTopic: missing,
      suggestedTitle: missing,
      reason: `Publishing content on "${missing}" builds topical authority for your core ${mainTopic} cluster.`,
      effort: "medium",
      impact: "high",
    });
  });

  // 4. Calculate Topic Coverage Score (0–100)
  const coverageResult = calculateTopicCoverageScore(topicClusters);

  // 5. Register Topical Authority Opportunities into seo_opportunities (PHASE 11 REUSE)
  for (const gap of contentGaps.slice(0, 3)) {
    const { priorityScore, priority } = calculateOpportunityPriority({
      impact: gap.impact,
      severity: "medium",
      effort: gap.effort,
    });

    await supabase.from("seo_opportunities").upsert(
      {
        website_id: websiteId,
        user_id: userId,
        type: "topical_authority",
        category: `topical_content_gap_${gap.id}`,
        title: `Content Gap: Missing ${gap.missingTopic}`,
        description: gap.reason,
        affected_page: "/blog",
        severity: "medium",
        impact: gap.impact,
        effort: gap.effort,
        priority,
        priority_score: priorityScore,
        source: "topical_authority_engine",
        recommended_action: `Create supporting article: "${gap.suggestedTitle}"`,
        action_type: "create_blog_post",
        action_payload: { suggestedTitle: gap.suggestedTitle, topic: gap.missingTopic },
        status: "new",
      },
      {
        onConflict: "website_id,category,affected_page",
        ignoreDuplicates: true,
      }
    );
  }

  return {
    topic_coverage_score: coverageResult.totalScore,
    topic_clusters: topicClusters,
    content_gaps: contentGaps,
    coverageResult,
  };
}
