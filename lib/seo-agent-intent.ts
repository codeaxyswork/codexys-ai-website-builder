export type SEOIntentType =
  | "OVERALL_SEO"
  | "SEO_SCORE"
  | "SEO_IMPROVEMENT"
  | "SEO_PRIORITY"
  | "GOOGLE_PERFORMANCE"
  | "GOOGLE_RANKINGS"
  | "KEYWORD_PERFORMANCE"
  | "PAGE_PERFORMANCE"
  | "TECHNICAL_ISSUES"
  | "INDEXABILITY"
  | "CRAWLABILITY"
  | "CANONICAL"
  | "ROBOTS"
  | "SITEMAP"
  | "INTERNAL_LINKING"
  | "ORPHAN_PAGES"
  | "CONTENT_GAPS"
  | "CONTENT_RECOMMENDATION"
  | "BLOG_RECOMMENDATION"
  | "BLOG_GENERATION"
  | "CONTENT_REFRESH"
  | "AEO"
  | "TOPICAL_AUTHORITY"
  | "COMPETITOR_ANALYSIS"
  | "LOCAL_SEO"
  | "MONITORING"
  | "SEO_CHANGE_DETECTION"
  | "SEO_ALERT"
  | "GSC"
  | "OPPORTUNITY"
  | "AUTOPILOT"
  | "SEO_FIX"
  | "NAVIGATION"
  | "EXPLANATION"
  | "GENERAL_SEO_QUESTION";

export interface SEOAgentMessageRef {
  role: "user" | "assistant";
  content: string;
}

export interface DetectedSEOIntent {
  primaryIntent: SEOIntentType;
  secondaryIntents: SEOIntentType[];
  resolvedContextTopic?: string;
  isFixRequest: boolean;
  isNavigationRequest: boolean;
  targetTabRoute?: string;
  detectedLanguage: "english" | "malayalam" | "manglish" | "mixed";
}

/**
 * Detects intent from prompt and optional conversation history.
 * Supports English, Malayalam (Malayalam script), Manglish (Malayalam in Latin script), and code-switching.
 */
export function detectSEOIntent(
  userPrompt: string,
  history?: SEOAgentMessageRef[]
): DetectedSEOIntent {
  const text = (userPrompt || "").trim();
  const lower = text.toLowerCase();

  // 1. Language Detection
  const hasMalayalamScript = /[\u0D00-\u0D7F]/.test(text);
  const manglishKeywords = [
    "ente",
    "engane",
    "und",
    "cheyyan",
    "cheyyam",
    "enthokke",
    "evide",
    "ithu",
    "ath",
    "aanu",
    "alle",
    "undo",
    "ezhuthendath",
    "cheyyamo",
    "kanikku",
    "parayu",
  ];
  const isManglish = manglishKeywords.some((kw) => lower.includes(kw));

  let detectedLanguage: "english" | "malayalam" | "manglish" | "mixed" = "english";
  if (hasMalayalamScript && /[a-zA-Z]/.test(text)) {
    detectedLanguage = "mixed";
  } else if (hasMalayalamScript) {
    detectedLanguage = "malayalam";
  } else if (isManglish) {
    detectedLanguage = "manglish";
  }

  // 2. Reference & Pronoun Resolution from Conversation History
  let resolvedContextTopic: string | undefined = undefined;
  const lastAssistantMsg = history
    ? [...history].reverse().find((m) => m.role === "assistant")?.content
    : undefined;

  const isPronounRef =
    /\b(that|this|it|that issue|previous issue|this issue|that page|fix that|fix it|show me|show that)\b/i.test(
      lower
    ) ||
    lower.includes("ithu") ||
    lower.includes("ath");

  if (isPronounRef && lastAssistantMsg) {
    const lastLower = lastAssistantMsg.toLowerCase();
    if (lastLower.includes("canonical")) resolvedContextTopic = "canonical";
    else if (lastLower.includes("robots")) resolvedContextTopic = "robots";
    else if (lastLower.includes("title")) resolvedContextTopic = "seo_title";
    else if (lastLower.includes("description")) resolvedContextTopic = "meta_description";
    else if (lastLower.includes("internal link") || lastLower.includes("orphan"))
      resolvedContextTopic = "internal-links";
    else if (lastLower.includes("crawl") || lastLower.includes("technical"))
      resolvedContextTopic = "technical";
    else if (lastLower.includes("local")) resolvedContextTopic = "local-seo";
    else if (lastLower.includes("competitor")) resolvedContextTopic = "competitors";
  }

  const primaryIntentsSet = new Set<SEOIntentType>();

  // 3. Action / Fix Intent
  const isFixRequest =
    /\b(fix|correct|apply|update|repair|solve|cheyyamo|nannakku|mattoo)\b/i.test(lower) ||
    lower.includes("canonical issue") ||
    lower.includes("fix that") ||
    lower.includes("fix it");

  if (isFixRequest) {
    primaryIntentsSet.add("SEO_FIX");
  }

  // 4. Navigation Request
  const isNavigationRequest =
    /\b(show me|take me|open|go to|navigate|show|kanikku|thurakku)\b/i.test(lower) &&
    !lower.includes("fix");

  let targetTabRoute: string | undefined = undefined;
  if (lower.includes("technical crawl") || lower.includes("crawl")) targetTabRoute = "technical-crawl";
  else if (lower.includes("content studio")) targetTabRoute = "content-studio";
  else if (lower.includes("competitor")) targetTabRoute = "competitors";
  else if (lower.includes("content gap")) targetTabRoute = "content-gaps";
  else if (lower.includes("aeo") || lower.includes("ai search")) targetTabRoute = "aeo";
  else if (lower.includes("topical authority") || lower.includes("topic cluster")) targetTabRoute = "topical-authority";
  else if (lower.includes("opportunity") || lower.includes("opportunities")) targetTabRoute = "opportunities";
  else if (lower.includes("autopilot")) targetTabRoute = "autopilot";
  else if (lower.includes("performance") || lower.includes("traffic")) targetTabRoute = "performance";
  else if (lower.includes("monitoring") || lower.includes("alert")) targetTabRoute = "monitoring";
  else if (lower.includes("internal link")) targetTabRoute = "internal-links";
  else if (lower.includes("local seo") || lower.includes("local")) targetTabRoute = "local-seo";
  else if (lower.includes("blog")) targetTabRoute = "blog";
  else if (lower.includes("page")) targetTabRoute = "pages";
  else if (lower.includes("keyword") || lower.includes("ranking")) targetTabRoute = "keywords";
  else if (lower.includes("integration") || lower.includes("gsc connect")) targetTabRoute = "integrations";
  else if (lower.includes("setting")) targetTabRoute = "settings";

  if (isNavigationRequest && targetTabRoute) {
    primaryIntentsSet.add("NAVIGATION");
  }

  // 5. Keyword Matching for SEO Domains
  // A. GOOGLE / SEARCH CONSOLE / RANKINGS / TRAFFIC
  if (
    /\b(google|rank|ranking|clicks|impressions|ctr|traffic|position|search console|gsc)\b/i.test(
      lower
    ) ||
    lower.includes("google-il") ||
    lower.includes("traffic")
  ) {
    if (lower.includes("rank") || lower.includes("evide") || lower.includes("position")) {
      primaryIntentsSet.add("GOOGLE_RANKINGS");
    } else {
      primaryIntentsSet.add("GOOGLE_PERFORMANCE");
    }
    primaryIntentsSet.add("GSC");
  }

  // B. TECHNICAL / CRAWL / CANONICAL / ROBOTS / ORPHAN / BROKEN
  if (
    /\b(technical|crawl|broken|orphan|canonical|robots|sitemap|indexing|crawlability|indexability|404|500)\b/i.test(
      lower
    ) ||
    lower.includes("technical issues")
  ) {
    primaryIntentsSet.add("TECHNICAL_ISSUES");
    if (lower.includes("canonical")) primaryIntentsSet.add("CANONICAL");
    if (lower.includes("robots")) primaryIntentsSet.add("ROBOTS");
    if (lower.includes("sitemap")) primaryIntentsSet.add("SITEMAP");
    if (lower.includes("orphan") || lower.includes("broken")) primaryIntentsSet.add("ORPHAN_PAGES");
  }

  // C. INTERNAL LINKS
  if (/\b(internal link|internal links|linking|anchor|backlink)\b/i.test(lower)) {
    primaryIntentsSet.add("INTERNAL_LINKING");
  }

  // D. CONTENT / BLOG / WRITE / ARTICLES
  if (
    /\b(content|blog|write|article|gap|gaps|topic|post|draft|refresh)\b/i.test(lower) ||
    lower.includes("ezhuthendath")
  ) {
    if (lower.includes("gap")) primaryIntentsSet.add("CONTENT_GAPS");
    if (lower.includes("blog") || lower.includes("ezhuthendath"))
      primaryIntentsSet.add("BLOG_RECOMMENDATION");
    else primaryIntentsSet.add("CONTENT_RECOMMENDATION");
  }

  // E. AEO / AI SEARCH / TOPICAL AUTHORITY
  if (
    /\b(aeo|ai search|topic|topical|authority|cluster|answer|chatgpt|perplexity|gemini)\b/i.test(
      lower
    )
  ) {
    if (lower.includes("aeo") || lower.includes("ai search") || lower.includes("answer")) {
      primaryIntentsSet.add("AEO");
    }
    if (lower.includes("topical") || lower.includes("cluster") || lower.includes("authority")) {
      primaryIntentsSet.add("TOPICAL_AUTHORITY");
    }
  }

  // F. COMPETITORS
  if (/\b(competitor|competitors|rival|benchmark|ahead)\b/i.test(lower)) {
    primaryIntentsSet.add("COMPETITOR_ANALYSIS");
  }

  // G. LOCAL SEO
  if (/\b(local|nap|google business|gbp|map|city|phone|address)\b/i.test(lower)) {
    primaryIntentsSet.add("LOCAL_SEO");
  }

  // H. MONITORING / RECENT CHANGES / SCORE DROPS
  if (
    /\b(change|changed|drop|dropped|recent|alert|monitoring|history)\b/i.test(lower) ||
    lower.includes("undo")
  ) {
    primaryIntentsSet.add("MONITORING");
    primaryIntentsSet.add("SEO_CHANGE_DETECTION");
  }

  // I. OPPORTUNITIES / PRIORITY / AUTOPILOT
  if (/\b(opportunity|opportunities|priority|fix first|autopilot)\b/i.test(lower)) {
    primaryIntentsSet.add("OPPORTUNITY");
    if (lower.includes("fix first") || lower.includes("priority")) primaryIntentsSet.add("SEO_PRIORITY");
    if (lower.includes("autopilot")) primaryIntentsSet.add("AUTOPILOT");
  }

  // J. OVERALL / SCORE / GENERAL HEALTH
  if (
    /\b(how is|how\'s|score|overall|health|overview|engane|engane und|improve|quality)\b/i.test(
      lower
    ) ||
    primaryIntentsSet.size === 0
  ) {
    if (lower.includes("score") || lower.includes("why is my score")) {
      primaryIntentsSet.add("SEO_SCORE");
    }
    if (lower.includes("improve") || lower.includes("improve cheyyam")) {
      primaryIntentsSet.add("SEO_IMPROVEMENT");
    }
    if (primaryIntentsSet.size === 0 || lower.includes("how is my seo") || lower.includes("engane und")) {
      primaryIntentsSet.add("OVERALL_SEO");
    }
  }

  const intentsList = Array.from(primaryIntentsSet);
  const primaryIntent = intentsList[0] || "OVERALL_SEO";
  const secondaryIntents = intentsList.slice(1);

  return {
    primaryIntent,
    secondaryIntents,
    resolvedContextTopic,
    isFixRequest,
    isNavigationRequest,
    targetTabRoute,
    detectedLanguage,
  };
}
