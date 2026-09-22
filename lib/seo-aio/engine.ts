import * as cheerio from "cheerio";
import { redisGet, redisSet } from "../redis";
import { calculateGEOScore } from "../seo-geo/engine";

export interface AnswerReadinessDetail {
  score: number; // 0 - 100
  findings: Array<{ key: string; status: "present" | "missing" | "optional"; score: number }>;
  recommendations: string[];
}

export interface TopicDepthDetail {
  score: number; // 0 - 100
  clustersCount: number;
  totalTopics: number;
  keywordIntelligenceConnected: boolean;
  gscConnected: boolean;
  findings: Array<{ key: string; status: "strong" | "moderate" | "weak"; score: number }>;
  recommendations: string[];
}

export interface ContentStructureDetail {
  score: number; // 0 - 100
  hasSemanticTags: boolean;
  hasHeadingHierarchy: boolean;
  hasFaqSection: boolean;
  hasDirectAnswers: boolean;
  findings: Array<{ key: string; status: "pass" | "fail"; score: number }>;
  recommendations: string[];
}

export interface QuestionCoverageDetail {
  totalQuestions: number;
  answered: number;
  partial: number;
  unanswered: number;
  coverageScore: number; // 0 - 100
  priorityQuestions: Array<{ question: string; status: "answered" | "partial" | "unanswered"; source: string }>;
  recommendations: string[];
}

export interface AIOScoreResult {
  score: number; // 0 - 100 (35% Answer Readiness, 30% Topic Depth, 20% Content Structure, 15% Question Coverage)
  answerReadiness: AnswerReadinessDetail;
  topicDepth: TopicDepthDetail;
  contentStructure: ContentStructureDetail;
  questionCoverage: QuestionCoverageDetail;
  recommendations: string[];
}

export interface AISearchReadinessResult {
  score: number; // 0 - 100 (35% SEO, 25% AEO, 20% GEO, 20% AIO)
  seo: number;
  aeo: number;
  geo: number;
  aio: number;
  level: "Optimal" | "High" | "Medium" | "Low";
  recommendations: string[];
}

/**
 * Calculates deterministic Answer Readiness detail (0–100).
 */
export function calculateAnswerReadinessDetail(
  htmlContent: string | Array<{ html: string }>,
  context?: { businessName?: string | null; isLocalBusiness?: boolean; services?: string[]; industry?: string; faqItems?: any[] } | null
): AnswerReadinessDetail {
  const combinedHtml = Array.isArray(htmlContent)
    ? htmlContent.map((p) => p.html || "").join("\n")
    : htmlContent || "";

  const $ = cheerio.load(combinedHtml);
  const findings: Array<{ key: string; status: "present" | "missing" | "optional"; score: number }> = [];
  const recommendations: string[] = [];

  let totalScore = 0;

  // 1. Clear Service/Product Explanations (25 pts)
  const hasServices =
    (context?.services && context.services.length > 0) ||
    $("h2, h3").length >= 2 ||
    $("body").text().toLowerCase().includes("service") ||
    $("body").text().toLowerCase().includes("product");
  if (hasServices) {
    totalScore += 25;
    findings.push({ key: "service_explanations", status: "present", score: 25 });
  } else {
    findings.push({ key: "service_explanations", status: "missing", score: 0 });
    recommendations.push("Add clear service or product description sections.");
  }

  // 2. Direct Q&A and FAQ Snippets (25 pts)
  const faqCount =
    $(".faq-item, details, .faq, [class*='faq']").length +
    (context?.faqItems?.length || 0) +
    ($("h2:contains('FAQ'), h3:contains('FAQ'), h2:contains('Questions'), h3:contains('Questions')").length > 0 ? 1 : 0);
  if (faqCount > 0) {
    totalScore += 25;
    findings.push({ key: "direct_qa_snippets", status: "present", score: 25 });
  } else {
    findings.push({ key: "direct_qa_snippets", status: "missing", score: 0 });
    recommendations.push("Add explicit Q&A or FAQ sections with direct answers.");
  }

  // 3. Heading-to-Answer Paragraph Relationships (25 pts)
  const headingParagraphPairs = $("h2 + p, h3 + p, h2 + div > p, h3 + div > p").length;
  if (headingParagraphPairs >= 1) {
    totalScore += 25;
    findings.push({ key: "heading_answer_structure", status: "present", score: 25 });
  } else {
    findings.push({ key: "heading_answer_structure", status: "missing", score: 0 });
    recommendations.push("Include concise direct answer paragraphs directly below subheadings.");
  }

  // 4. Contact / Location / Pricing / Entity Attributes (25 pts)
  const text = $("body").text();
  const hasContact =
    text.includes("@") ||
    /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/.test(text) ||
    text.toLowerCase().includes("street") ||
    text.toLowerCase().includes("located") ||
    $("table").length > 0 ||
    text.includes("$");

  if (hasContact || context?.isLocalBusiness === false) {
    totalScore += 25;
    findings.push({ key: "contact_attributes", status: "present", score: 25 });
  } else {
    findings.push({ key: "contact_attributes", status: "missing", score: 0 });
    recommendations.push("Add contact details and factual pricing or location information.");
  }

  return {
    score: Math.min(100, totalScore),
    findings,
    recommendations,
  };
}

/**
 * Calculates Topic Depth detail (0–100) using topical authority clusters, GSC queries, and Google Ads keyword cache.
 */
export function calculateTopicDepthDetail(
  clustersOrPages: any[],
  gscQueriesOrTopics: any[] = [],
  googleAdsKeywordsOrQueries: any[] = [],
  googleAdsFallback: any[] = []
): TopicDepthDetail {
  const findings: Array<{ key: string; status: "strong" | "moderate" | "weak"; score: number }> = [];
  const recommendations: string[] = [];

  let clusters: any[] = [];
  let gscQueries: any[] = [];
  let googleAdsKeywords: any[] = [];

  // Support test signature overloads
  if (clustersOrPages.length > 0 && (clustersOrPages[0].html || clustersOrPages[0].html_content)) {
    // Array of page objects
    const pageTopics = clustersOrPages.map((p) => {
      const $ = cheerio.load(p.html || p.html_content || "");
      return $("h1, h2").first().text().trim();
    }).filter(Boolean);

    clusters = pageTopics.map((t) => ({ name: t, subtopics: [t] }));
    if (Array.isArray(gscQueriesOrTopics) && typeof gscQueriesOrTopics[0] === "string") {
      gscQueriesOrTopics.forEach((topicStr) => clusters.push({ name: topicStr, subtopics: [topicStr] }));
      gscQueries = googleAdsKeywordsOrQueries || [];
      googleAdsKeywords = googleAdsFallback || [];
    } else {
      gscQueries = gscQueriesOrTopics || [];
      googleAdsKeywords = googleAdsKeywordsOrQueries || [];
    }
  } else {
    clusters = clustersOrPages || [];
    gscQueries = gscQueriesOrTopics || [];
    googleAdsKeywords = googleAdsKeywordsOrQueries || [];
  }

  const clustersCount = clusters.length;
  let totalTopics = 0;
  clusters.forEach((c) => {
    totalTopics += 1 + (c.supportingTopics?.length || 0) + (c.subtopics?.length || 0);
  });

  const hasGsc = gscQueries && gscQueries.length > 0;
  const hasAds = googleAdsKeywords && googleAdsKeywords.length > 0;

  let score = 40; // Base baseline
  if (clustersCount >= 3) {
    score += 40;
    findings.push({ key: "topic_clusters", status: "strong", score: 40 });
  } else if (clustersCount >= 1) {
    score += 20;
    findings.push({ key: "topic_clusters", status: "moderate", score: 20 });
    recommendations.push("Expand supporting articles and subtopics for core services.");
  } else {
    findings.push({ key: "topic_clusters", status: "weak", score: 0 });
    recommendations.push("Build dedicated topic clusters around primary business services.");
  }

  if (hasGsc) {
    score += 10;
    findings.push({ key: "gsc_search_queries", status: "strong", score: 10 });
  }
  if (hasAds) {
    score += 10;
    findings.push({ key: "google_ads_keyword_intelligence", status: "strong", score: 10 });
  }

  return {
    score: Math.min(100, score),
    clustersCount,
    totalTopics,
    keywordIntelligenceConnected: Boolean(hasAds),
    gscConnected: Boolean(hasGsc),
    findings,
    recommendations,
  };
}

/**
 * Evaluates Content Structure detail (0–100).
 */
export function calculateContentStructureDetail(
  htmlContent: string | Array<{ html: string }>,
  _context?: any
): ContentStructureDetail {
  const combinedHtml = Array.isArray(htmlContent)
    ? htmlContent.map((p) => p.html || "").join("\n")
    : htmlContent || "";

  const $ = cheerio.load(combinedHtml);
  const findings: Array<{ key: string; status: "pass" | "fail"; score: number }> = [];
  const recommendations: string[] = [];

  const hasSemantic = $("header, nav, main, section, footer").length >= 2;
  const hasH1 = $("h1").length >= 1;
  const hasH2H3 = $("h2, h3").length >= 1;
  const hasFaq = $(".faq-item, details, .faq, [class*='faq']").length > 0 || $("h2:contains('FAQ'), h3:contains('FAQ'), h2:contains('Questions'), h3:contains('Questions')").length > 0;

  let score = 0;
  if (hasSemantic) {
    score += 30;
    findings.push({ key: "semantic_html", status: "pass", score: 30 });
  } else {
    findings.push({ key: "semantic_html", status: "fail", score: 0 });
    recommendations.push("Use semantic HTML5 tags (<header>, <main>, <section>, <footer>).");
  }

  if (hasH1 && hasH2H3) {
    score += 40;
    findings.push({ key: "heading_hierarchy", status: "pass", score: 40 });
  } else {
    findings.push({ key: "heading_hierarchy", status: "fail", score: 0 });
    recommendations.push("Ensure clear primary <h1> heading and supporting <h2>/<h3> subheadings.");
  }

  if (hasFaq || $("ul, ol, table").length > 0) {
    score += 30;
    findings.push({ key: "faq_structure", status: "pass", score: 30 });
  } else {
    findings.push({ key: "faq_structure", status: "fail", score: 0 });
    recommendations.push("Add structured lists, tables, or FAQ sections to improve machine extraction.");
  }

  return {
    score: Math.min(100, score),
    hasSemanticTags: hasSemantic,
    hasHeadingHierarchy: hasH1 && hasH2H3,
    hasFaqSection: hasFaq,
    hasDirectAnswers: hasFaq || $("h2 + p, h3 + p").length > 0,
    findings,
    recommendations,
  };
}

/**
 * Evaluates Question Coverage detail (0–100).
 */
export function calculateQuestionCoverageDetail(
  discoveredQuestionsOrPages: any[],
  htmlContentOrQuestions: string | Array<{ html: string }> | any[],
  gscQueriesOrHtml: any[] | string = [],
  googleAdsOrQueries: any[] = []
): QuestionCoverageDetail {
  let pagesHtml = "";
  let rawQuestions: any[] = [];
  let gscQueries: any[] = [];

  if (Array.isArray(discoveredQuestionsOrPages) && discoveredQuestionsOrPages.length > 0 && (discoveredQuestionsOrPages[0].html || discoveredQuestionsOrPages[0].html_content)) {
    // Parameter order: (pages, discoveredQuestions, gscQueries, googleAds)
    pagesHtml = discoveredQuestionsOrPages.map((p) => p.html || p.html_content || "").join("\n");
    if (Array.isArray(htmlContentOrQuestions)) {
      rawQuestions = htmlContentOrQuestions.map((q) => (typeof q === "string" ? { question: q } : q));
    }
    if (Array.isArray(gscQueriesOrHtml)) {
      gscQueries = gscQueriesOrHtml;
    }
  } else {
    // Parameter order: (discoveredQuestions, htmlContent, gscQueries)
    if (Array.isArray(discoveredQuestionsOrPages)) {
      rawQuestions = discoveredQuestionsOrPages.map((q) => (typeof q === "string" ? { question: q } : q));
    }
    pagesHtml = typeof htmlContentOrQuestions === "string" ? htmlContentOrQuestions : "";
    if (Array.isArray(gscQueriesOrHtml)) {
      gscQueries = gscQueriesOrHtml;
    }
  }

  const $ = cheerio.load(pagesHtml || "");
  const pageText = $("body").text().toLowerCase();

  const priorityQuestions: Array<{ question: string; status: "answered" | "partial" | "unanswered"; source: string }> = [];

  let answered = 0;
  let partial = 0;
  let unanswered = 0;

  const allQuestionsList = [
    ...rawQuestions,
    ...gscQueries
      .filter((g: any) => /^(what|how|why|where|who|when|can|is)\b/i.test(g.query || g.keyword || ""))
      .map((g: any) => ({ question: g.query || g.keyword, source: "gsc" })),
    ...googleAdsOrQueries
      .filter((g: any) => /^(what|how|why|where|who|when|can|is)\b/i.test(g.keyword || ""))
      .map((g: any) => ({ question: g.keyword, source: "google_ads" })),
  ];

  // Deduplicate questions
  const uniqueQuestions: any[] = [];
  allQuestionsList.forEach((q) => {
    const qStr = (q.question || "").trim();
    if (qStr.length > 5 && !uniqueQuestions.some((item) => item.question.toLowerCase() === qStr.toLowerCase())) {
      uniqueQuestions.push(q);
    }
  });

  if (uniqueQuestions.length === 0) {
    // Fallback inspect headings as question signals
    $("h2, h3").each((_, el) => {
      const text = $(el).text().trim();
      if (text.endsWith("?") || /^(what|how|why|where|who|when|can|is)\b/i.test(text)) {
        uniqueQuestions.push({ question: text, source: "heading_audit" });
      }
    });
  }

  uniqueQuestions.slice(0, 10).forEach((qObj) => {
    const qText = qObj.question;
    const keywords = qText.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(" ").filter((w: string) => w.length > 3);
    const matches = keywords.filter((k: string) => pageText.includes(k));

    let status: "answered" | "partial" | "unanswered" = "unanswered";
    if (qObj.hasDirectAnswer || matches.length >= Math.ceil(keywords.length * 0.6) || pageText.includes(qText.toLowerCase())) {
      status = "answered";
      answered++;
    } else if (matches.length >= Math.ceil(keywords.length * 0.3)) {
      status = "partial";
      partial++;
    } else {
      unanswered++;
    }

    priorityQuestions.push({
      question: qText,
      status,
      source: qObj.source || "content_audit",
    });
  });

  const totalQuestions = uniqueQuestions.length;
  const coverageScore = totalQuestions > 0 ? Math.round(((answered + partial * 0.5) / totalQuestions) * 100) : 70;

  const recommendations: string[] = [];
  if (unanswered > 0) {
    recommendations.push(`Add direct answer sections for ${unanswered} unanswered customer questions.`);
  }

  return {
    totalQuestions,
    answered,
    partial,
    unanswered,
    coverageScore,
    priorityQuestions,
    recommendations,
  };
}

/**
 * Calculates AIO Score (0–100) using 35% Answer Readiness, 30% Topic Depth, 20% Content Structure, 15% Question Coverage.
 */
export function calculateAIOScore(
  htmlContentOrAnswerReadiness: string | AnswerReadinessDetail,
  contextOrTopicDepth?: any,
  aeoDataOrContentStructure?: any,
  gscQueriesOrQuestionCoverage?: any,
  googleAdsKeywords?: any[]
): AIOScoreResult {
  let answerReadiness: AnswerReadinessDetail;
  let topicDepth: TopicDepthDetail;
  let contentStructure: ContentStructureDetail;
  let questionCoverage: QuestionCoverageDetail;

  if (typeof htmlContentOrAnswerReadiness === "object" && "findings" in htmlContentOrAnswerReadiness) {
    // Called with pre-calculated details: (answerReadiness, topicDepth, contentStructure, questionCoverage)
    answerReadiness = htmlContentOrAnswerReadiness as AnswerReadinessDetail;
    topicDepth = contextOrTopicDepth as TopicDepthDetail;
    contentStructure = aeoDataOrContentStructure as ContentStructureDetail;
    questionCoverage = gscQueriesOrQuestionCoverage as QuestionCoverageDetail;
  } else {
    const htmlContent = htmlContentOrAnswerReadiness as string;
    const context = contextOrTopicDepth || {};
    const aeoData = aeoDataOrContentStructure || {};
    const gscQueries = gscQueriesOrQuestionCoverage || [];

    answerReadiness = calculateAnswerReadinessDetail(htmlContent, context);
    topicDepth = calculateTopicDepthDetail(aeoData.topicClusters || [], gscQueries, googleAdsKeywords || []);
    contentStructure = calculateContentStructureDetail(htmlContent);
    questionCoverage = calculateQuestionCoverageDetail(aeoData.questionsDiscovered || [], htmlContent, gscQueries);
  }

  // Formula: 35% Answer Readiness + 30% Topic Depth + 20% Content Structure + 15% Question Coverage
  const rawScore =
    0.35 * answerReadiness.score +
    0.3 * topicDepth.score +
    0.2 * contentStructure.score +
    0.15 * questionCoverage.coverageScore;

  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  const recommendations = [
    ...answerReadiness.recommendations,
    ...topicDepth.recommendations,
    ...contentStructure.recommendations,
    ...questionCoverage.recommendations,
  ].slice(0, 5);

  return {
    score,
    answerReadiness,
    topicDepth,
    contentStructure,
    questionCoverage,
    recommendations,
  };
}

/**
 * Calculates AI Search Readiness Score (0–100) combining SEO (35%), AEO (25%), GEO (20%), and AIO (20%).
 */
export function calculateAISearchReadiness(
  scoresOrSeo: { seo: number; aeo: number; geo: number; aio: number } | number,
  aeoVal?: number,
  geoVal?: number,
  aioVal?: number
): AISearchReadinessResult {
  let seo = 0;
  let aeo = 0;
  let geo = 0;
  let aio = 0;

  if (typeof scoresOrSeo === "object" && scoresOrSeo !== null) {
    seo = scoresOrSeo.seo || 0;
    aeo = scoresOrSeo.aeo || 0;
    geo = scoresOrSeo.geo || 0;
    aio = scoresOrSeo.aio || 0;
  } else {
    seo = (scoresOrSeo as number) || 0;
    aeo = aeoVal || 0;
    geo = geoVal || 0;
    aio = aioVal || 0;
  }

  const rawScore = 0.35 * seo + 0.25 * aeo + 0.2 * geo + 0.2 * aio;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  let level: "Optimal" | "High" | "Medium" | "Low" = "Low";
  if (score >= 85) level = "Optimal";
  else if (score >= 70) level = "High";
  else if (score >= 50) level = "Medium";

  const recommendations: string[] = [];
  if (aio < 70) recommendations.push("Improve AIO answer readiness and question coverage.");
  if (geo < 70) recommendations.push("Clarify entity business name, location, and Schema.org graph.");
  if (aeo < 70) recommendations.push("Expand topical authority coverage and direct FAQ answers.");
  if (seo < 70) recommendations.push("Optimize core on-page SEO metadata and heading tags.");

  if (recommendations.length === 0) {
    recommendations.push("Website exhibits excellent overall AI search readiness across SEO, AEO, GEO, and AIO.");
  }

  return {
    score,
    seo,
    aeo,
    geo,
    aio,
    level,
    recommendations,
  };
}

/**
 * Main server-side AIO analysis function with Redis caching.
 */
export async function runAIOAnalysisEngine(
  supabase: any,
  websiteId: string,
  userId: string
): Promise<{ aio: AIOScoreResult; aiSearchReadiness: AISearchReadinessResult }> {
  // 1. Verify Ownership
  const { data: website } = await supabase
    .from("websites")
    .select("id, title, prompt, published_slug, slug")
    .eq("id", websiteId)
    .eq("user_id", userId)
    .single();

  if (!website) {
    throw new Error("Website not found or access denied.");
  }

  // 2. Redis Cache Check
  const cacheKey = `seo:aio:${websiteId}`;
  const cached = await redisGet<{ aio: AIOScoreResult; aiSearchReadiness: AISearchReadinessResult }>(cacheKey);
  if (cached) {
    return cached;
  }

  // 3. Parallel Fetch of database sources
  const [seoRes, localRes, aeoRes, pagesRes, gscRes, adsRes] = await Promise.all([
    supabase.from("website_seo").select("seo_score, focus_keywords, canonical_url, schema_markup").eq("website_id", websiteId).maybeSingle(),
    supabase.from("website_local_seo").select("business_name, city, phone").eq("website_id", websiteId).maybeSingle(),
    supabase.from("website_aeo_analysis").select("*").eq("website_id", websiteId).maybeSingle(),
    supabase.from("website_pages").select("path, html_content").eq("website_id", websiteId),
    supabase.from("gsc_search_analytics").select("query").eq("website_id", websiteId).limit(20),
    supabase.from("google_ads_keyword_cache").select("keyword").eq("website_id", websiteId).limit(20),
  ]);

  const seoRow = seoRes.data;
  const localRow = localRes.data;
  const aeoRow = aeoRes.data || {};
  const pageList = pagesRes.data || [];
  const gscQueries = gscRes.data || [];
  const googleAdsKeywords = adsRes.data || [];

  const indexHtml = pageList.find((p: any) => p.path === "index.html")?.html_content || "";

  const context = {
    businessName: localRow?.business_name || website.title,
    isLocalBusiness: Boolean(localRow?.city),
    services: seoRow?.focus_keywords ? seoRow.focus_keywords.split(",").map((s: string) => s.trim()) : [],
  };

  // 4. Calculate AIO Score
  const aioResult = calculateAIOScore(indexHtml, context, aeoRow, gscQueries, googleAdsKeywords);

  // 5. Calculate GEO Score
  const geoResult = await calculateGEOScore(
    {
      businessName: localRow?.business_name || website.title,
      city: localRow?.city || null,
      phone: localRow?.phone || null,
      canonicalUrl: seoRow?.canonical_url,
      schemaMarkup: seoRow?.schema_markup,
      htmlContent: indexHtml,
    },
    pageList
  );

  // 6. Calculate AI Search Readiness Score
  const aiSearchReadiness = calculateAISearchReadiness({
    seo: Number(seoRow?.seo_score || 70),
    aeo: Number(aeoRow?.answer_readiness_score || 70),
    geo: Number(geoResult.score || 70),
    aio: Number(aioResult.score || 70),
  });

  // 7. Persist AIO Opportunities if weaknesses detected
  const aioOpps: any[] = [];
  if (aioResult.answerReadiness.score < 70) {
    aioOpps.push({
      website_id: websiteId,
      user_id: userId,
      type: "aio",
      category: "aio_missing_direct_answers",
      title: "Missing Direct Answer Snippets",
      description: "Service sections lack direct Q&A snippets. Add short factual answer paragraphs under subheadings.",
      affected_page: "index.html",
      severity: "high",
      impact: "high",
      effort: "low",
      priority: "high",
      priority_score: 80,
      source: "aio_engine",
      recommended_action: "Add concise Q&A sections to your primary service pages.",
      action_type: "fix_content",
      action_payload: {},
      status: "new",
    });
  }

  for (const opp of aioOpps) {
    await supabase.from("seo_opportunities").upsert(opp, {
      onConflict: "website_id,category,affected_page",
      ignoreDuplicates: true,
    });
  }

  const payload = { aio: aioResult, aiSearchReadiness };

  // 8. Cache in Redis (TTL 3600s)
  await redisSet(cacheKey, payload, 3600);

  return payload;
}
