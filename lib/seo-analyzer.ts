import * as cheerio from "cheerio";

export interface SEOSettingsInput {
  seo_title?: string | null;
  meta_description?: string | null;
  focus_keywords?: string[] | null;
  canonical_url?: string | null;
  robots_index?: boolean | null;
  robots_follow?: boolean | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  twitter_card?: string | null;
  twitter_title?: string | null;
  twitter_description?: string | null;
  twitter_image_url?: string | null;
  schema_markup?: Record<string, any> | null;
  google_analytics_id?: string | null;
  google_tag_manager_id?: string | null;
}

export interface SEOAnalysisResult {
  seo_score: number;
  analysis: {
    title: { score: number; max: 20; details: string };
    description: { score: number; max: 15; details: string };
    headings: { score: number; max: 15; details: string };
    images: { score: number; max: 10; details: string };
    canonical: { score: number; max: 5; details: string };
    open_graph: { score: number; max: 10; details: string };
    schema: { score: number; max: 10; details: string };
    robots: { score: number; max: 5; details: string };
    technical: { score: number; max: 10; details: string };
  };
  recommendations: Array<{ type: "success" | "warning" | "error"; text: string }>;
  image_stats: {
    total: number;
    with_alt: number;
    missing_alt: number;
  };
}

export interface PageSEOInput {
  path: string;
  htmlContent: string;
  seoSettings?: SEOSettingsInput | null;
}

export interface PageSEOAnalysisResult extends SEOAnalysisResult {
  path: string;
  analysis_version: string;
  issue_counts: {
    critical: number;
    warning: number;
    opportunity: number;
    passed: number;
  };
  links_stats: {
    total_links: number;
    internal_links: number;
    external_links: number;
    internal_targets: string[];
    is_orphaned: boolean;
  };
}

export interface WebsiteSEOAnalysisResult {
  seo_score: number;
  analysis_version: string;
  issue_counts: {
    critical: number;
    warning: number;
    opportunity: number;
    passed: number;
  };
  pages: PageSEOAnalysisResult[];
  aggregate_analysis: SEOAnalysisResult["analysis"];
  recommendations: Array<{ type: "success" | "warning" | "error"; text: string }>;
  site_links_summary: {
    total_pages: number;
    total_internal_links: number;
    orphaned_pages: string[];
  };
}

export const CURRENT_ANALYSIS_VERSION = "seo-v1";

/**
 * Analyzes a single page deterministically using Cheerio server-side HTML DOM parsing.
 */
export function analyzePage(
  input: PageSEOInput,
  allSitePaths: string[] = []
): PageSEOAnalysisResult {
  const { path: pagePath, htmlContent = "", seoSettings = {} } = input;
  const settings = seoSettings || {};
  let score = 0;
  const recommendations: Array<{ type: "success" | "warning" | "error"; text: string }> = [];

  // Parse HTML using Cheerio (safe, fast, robust server-side DOM parser)
  const $ = cheerio.load(htmlContent || "");

  // Extract meta title & description
  const docTitle = $("title").first().text().trim();
  const docDesc = $('meta[name="description"]').attr("content")?.trim() || "";
  const docCanonical = $('link[rel="canonical"]').attr("href")?.trim() || "";

  const title = settings.seo_title?.trim() || docTitle;
  const metaDesc = settings.meta_description?.trim() || docDesc;
  const keywords = settings.focus_keywords || [];
  const primaryKeyword = (keywords[0] || "").toLowerCase().trim();

  let criticalCount = 0;
  let warningCount = 0;
  let opportunityCount = 0;
  let passedCount = 0;

  // 1. TITLE — 20 Points
  let titleScore = 0;
  let titleDetails = "";
  if (title) {
    titleScore += 5;
    if (title.length >= 30 && title.length <= 60) {
      titleScore += 10;
      titleDetails = `Title length (${title.length} chars) is optimal.`;
      passedCount++;
    } else {
      titleScore += 5;
      titleDetails = `Title length (${title.length} chars) should ideally be between 30-60 characters.`;
      opportunityCount++;
    }
    if (primaryKeyword && title.toLowerCase().includes(primaryKeyword)) {
      titleScore += 5;
      recommendations.push({ type: "success", text: `Title contains focus keyword "${primaryKeyword}".` });
      passedCount++;
    } else if (primaryKeyword) {
      recommendations.push({ type: "warning", text: `Consider adding primary keyword "${primaryKeyword}" to the title.` });
      opportunityCount++;
    } else {
      recommendations.push({ type: "success", text: "SEO Title is set." });
    }
  } else {
    titleDetails = "SEO Title is missing!";
    recommendations.push({ type: "error", text: "SEO Title is missing." });
    criticalCount++;
  }

  // 2. META DESCRIPTION — 15 Points
  let descScore = 0;
  let descDetails = "";
  if (metaDesc) {
    descScore += 5;
    if (metaDesc.length >= 70 && metaDesc.length <= 160) {
      descScore += 5;
      descDetails = `Meta description length (${metaDesc.length} chars) is optimal.`;
      passedCount++;
    } else {
      descScore += 2;
      descDetails = `Meta description length (${metaDesc.length} chars) should be between 70-160 characters.`;
      opportunityCount++;
    }
    if (primaryKeyword && metaDesc.toLowerCase().includes(primaryKeyword)) {
      descScore += 5;
      recommendations.push({ type: "success", text: `Meta description contains focus keyword "${primaryKeyword}".` });
      passedCount++;
    } else {
      recommendations.push({ type: "success", text: "Meta description is set." });
    }
  } else {
    descDetails = "Meta description is missing!";
    recommendations.push({ type: "warning", text: "Meta description is missing." });
    warningCount++;
  }

  // 3. HEADINGS — 15 Points
  let headingScore = 0;
  let headingDetails = "";
  const h1Elements = $("h1");
  const h2Elements = $("h2");

  if (h1Elements.length === 1) {
    headingScore += 5;
    headingDetails += "Single H1 tag detected. ";
    passedCount++;
  } else if (h1Elements.length === 0) {
    recommendations.push({ type: "warning", text: "No H1 tag found in body content." });
    warningCount++;
  } else {
    headingScore += 2;
    recommendations.push({ type: "warning", text: "Multiple H1 tags found. Best practice is exactly one H1 per page." });
    warningCount++;
  }

  if (h2Elements.length > 0) {
    headingScore += 5;
    headingDetails += `${h2Elements.length} H2 tag(s) found. `;
    passedCount++;
  } else {
    recommendations.push({ type: "warning", text: "No H2 heading tags found to structure content." });
    opportunityCount++;
  }

  const allHeadingsText = `${h1Elements.text()} ${h2Elements.text()}`.toLowerCase();
  if (primaryKeyword && allHeadingsText.includes(primaryKeyword)) {
    headingScore += 5;
    recommendations.push({ type: "success", text: `Headings naturally include key term "${primaryKeyword}".` });
    passedCount++;
  } else {
    headingScore += 2;
  }

  // 4. IMAGES & ALT TEXT — 10 Points
  let imageScore = 0;
  let imageDetails = "";
  const imgElements = $("img");
  const totalImgs = imgElements.length;
  let withAlt = 0;
  let missingAlt = 0;

  imgElements.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt !== undefined && alt.trim().length > 0) {
      withAlt++;
    } else {
      missingAlt++;
    }
  });

  if (totalImgs === 0) {
    imageScore = 10;
    imageDetails = "No images present on page.";
    recommendations.push({ type: "success", text: "No images requiring alt text." });
    passedCount++;
  } else if (missingAlt === 0) {
    imageScore = 10;
    imageDetails = `All ${totalImgs} image(s) have alt attributes.`;
    recommendations.push({ type: "success", text: `All ${totalImgs} image(s) have alt attributes.` });
    passedCount++;
  } else {
    const ratio = withAlt / totalImgs;
    imageScore = Math.floor(ratio * 10);
    imageDetails = `${withAlt} of ${totalImgs} images have alt attributes (${missingAlt} missing).`;
    recommendations.push({ type: "warning", text: `${missingAlt} image(s) missing alt text.` });
    warningCount++;
  }

  // 5. CANONICAL — 5 Points
  let canonicalScore = 0;
  let canonicalDetails = "";
  const canonicalVal = settings.canonical_url?.trim() || docCanonical;
  if (canonicalVal && canonicalVal.startsWith("http")) {
    canonicalScore = 5;
    canonicalDetails = "Canonical URL is validly configured.";
    recommendations.push({ type: "success", text: "Canonical URL configured." });
    passedCount++;
  } else {
    canonicalDetails = "No canonical URL configured.";
    recommendations.push({ type: "warning", text: "No canonical URL defined." });
    opportunityCount++;
  }

  // 6. OPEN GRAPH — 10 Points
  let ogScore = 0;
  let ogDetails = "";
  const ogTitleTag = $('meta[property="og:title"]').attr("content")?.trim();
  const ogDescTag = $('meta[property="og:description"]').attr("content")?.trim();

  const ogTitle = settings.og_title?.trim() || ogTitleTag;
  const ogDesc = settings.og_description?.trim() || ogDescTag;

  if (ogTitle) ogScore += 5;
  if (ogDesc) ogScore += 5;

  if (ogScore === 10) {
    ogDetails = "Open Graph title and description are set.";
    recommendations.push({ type: "success", text: "Open Graph metadata configured." });
    passedCount++;
  } else {
    ogDetails = "Open Graph metadata incomplete.";
    recommendations.push({ type: "warning", text: "Complete Open Graph tags for social sharing." });
    opportunityCount++;
  }

  // 7. SCHEMA MARKUP — 10 Points
  let schemaScore = 0;
  let schemaDetails = "";
  let scriptSchemaCount = 0;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const jsonContent = $(el).html() || "";
      if (jsonContent.trim().length > 0) scriptSchemaCount++;
    } catch {}
  });

  const hasSchema =
    (settings.schema_markup && Object.keys(settings.schema_markup).length > 0) ||
    scriptSchemaCount > 0;

  if (hasSchema) {
    schemaScore = 10;
    schemaDetails = "Structured JSON-LD Schema markup is present.";
    recommendations.push({ type: "success", text: "Structured Schema markup configured." });
    passedCount++;
  } else {
    schemaDetails = "No structured data schema found.";
    recommendations.push({ type: "warning", text: "Add JSON-LD Schema markup for rich snippet visibility." });
    opportunityCount++;
  }

  // 8. ROBOTS DIRECTIVES — 5 Points
  let robotsScore = 0;
  let robotsDetails = "";
  const robotsMeta = $('meta[name="robots"]').attr("content")?.toLowerCase() || "";
  const isNoIndex = robotsMeta.includes("noindex") || settings.robots_index === false;

  if (!isNoIndex) {
    robotsScore = 5;
    robotsDetails = "Search engine indexing is allowed.";
    recommendations.push({ type: "success", text: "Search engines allowed to index page." });
    passedCount++;
  } else {
    robotsScore = 0;
    robotsDetails = "Search engine indexing is set to NOINDEX!";
    recommendations.push({ type: "warning", text: "Page is configured to block search engine indexing (noindex)." });
    warningCount++;
  }

  // 9. TECHNICAL SEO — 10 Points
  let techScore = 0;
  let techDetails = "";
  const rawHtmlLower = htmlContent.toLowerCase();

  if (rawHtmlLower.includes("<!doctype html") || rawHtmlLower.includes("<!doctype html")) {
    techScore += 4;
  }
  if ($('meta[name="viewport"]').length > 0 || rawHtmlLower.includes('name="viewport"')) {
    techScore += 3;
  }
  if ($("meta[charset]").length > 0 || rawHtmlLower.includes("<meta charset")) {
    techScore += 3;
  }

  if (techScore === 10) {
    techDetails = "Valid HTML5 doctype, viewport meta tag, and character set detected.";
    recommendations.push({ type: "success", text: "Technical HTML structure is clean." });
    passedCount++;
  } else {
    techDetails = "Minor technical metadata issues found.";
    opportunityCount++;
  }

  // 10. LINKS & INTERNAL LINK ANALYSIS
  let totalLinks = 0;
  let internalLinks = 0;
  let externalLinks = 0;
  const internalTargetsSet = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

    totalLinks++;
    if (href.startsWith("http://") || href.startsWith("https://")) {
      externalLinks++;
    } else {
      internalLinks++;
      const cleanPath = href.split("#")[0].split("?")[0];
      if (cleanPath) {
        internalTargetsSet.add(cleanPath.startsWith("/") ? cleanPath.slice(1) : cleanPath);
      }
    }
  });

  score = titleScore + descScore + headingScore + imageScore + canonicalScore + ogScore + schemaScore + robotsScore + techScore;

  return {
    path: pagePath,
    analysis_version: CURRENT_ANALYSIS_VERSION,
    seo_score: Math.min(100, Math.max(0, score)),
    analysis: {
      title: { score: titleScore, max: 20, details: titleDetails },
      description: { score: descScore, max: 15, details: descDetails },
      headings: { score: headingScore, max: 15, details: headingDetails },
      images: { score: imageScore, max: 10, details: imageDetails },
      canonical: { score: canonicalScore, max: 5, details: canonicalDetails },
      open_graph: { score: ogScore, max: 10, details: ogDetails },
      schema: { score: schemaScore, max: 10, details: schemaDetails },
      robots: { score: robotsScore, max: 5, details: robotsDetails },
      technical: { score: techScore, max: 10, details: techDetails },
    },
    recommendations,
    image_stats: {
      total: totalImgs,
      with_alt: withAlt,
      missing_alt: missingAlt,
    },
    links_stats: {
      total_links: totalLinks,
      internal_links: internalLinks,
      external_links: externalLinks,
      internal_targets: Array.from(internalTargetsSet),
      is_orphaned: false, // Calculated during site-level cross-link analysis
    },
    issue_counts: {
      critical: criticalCount,
      warning: warningCount,
      opportunity: opportunityCount,
      passed: passedCount,
    },
  };
}

/**
 * Analyzes an entire website (all pages) deterministically and calculates aggregate website SEO state.
 */
export function analyzeWebsite(
  pages: PageSEOInput[],
  websiteSeoSettings: SEOSettingsInput = {}
): WebsiteSEOAnalysisResult {
  if (!pages || pages.length === 0) {
    return {
      seo_score: 0,
      analysis_version: CURRENT_ANALYSIS_VERSION,
      issue_counts: { critical: 0, warning: 0, opportunity: 0, passed: 0 },
      pages: [],
      aggregate_analysis: analyzePage({ path: "index.html", htmlContent: "", seoSettings: websiteSeoSettings }).analysis,
      recommendations: [{ type: "error", text: "No website pages found for analysis." }],
      site_links_summary: { total_pages: 0, total_internal_links: 0, orphaned_pages: [] },
    };
  }

  const allSitePaths = pages.map((p) => normalizePath(p.path));

  // 1. Analyze each page individually
  const pageResults: PageSEOAnalysisResult[] = pages.map((page) => {
    // For index.html, merge page settings with website-level SEO settings
    const settings = page.path === "index.html" || page.path === "index" ? websiteSeoSettings : page.seoSettings;
    return analyzePage({ ...page, seoSettings: settings }, allSitePaths);
  });

  // 2. Cross-Page Internal Link Analysis & Orphan Detection
  const inboundLinkCounts: Record<string, number> = {};
  allSitePaths.forEach((path) => {
    inboundLinkCounts[path] = 0;
  });

  pageResults.forEach((pageRes) => {
    pageRes.links_stats.internal_targets.forEach((targetPath) => {
      const normalizedTarget = normalizePath(targetPath);
      if (normalizedTarget !== normalizePath(pageRes.path)) {
        inboundLinkCounts[normalizedTarget] = (inboundLinkCounts[normalizedTarget] || 0) + 1;
      }
    });
  });

  const orphanedPages: string[] = [];
  pageResults.forEach((pageRes) => {
    const norm = normalizePath(pageRes.path);
    // index.html is root entry point, not marked orphaned
    if (norm !== "index.html" && norm !== "" && (inboundLinkCounts[norm] || 0) === 0) {
      pageRes.links_stats.is_orphaned = true;
      orphanedPages.push(pageRes.path);
      pageRes.recommendations.push({
        type: "warning",
        text: `Orphaned page: No internal links lead to "${pageRes.path}".`,
      });
      pageRes.issue_counts.warning++;
    }
  });

  // 3. Aggregate Website SEO Score
  const aggregateResult = aggregateWebsiteSEO(pageResults);

  return {
    ...aggregateResult,
    pages: pageResults,
    site_links_summary: {
      total_pages: pages.length,
      total_internal_links: pageResults.reduce((acc, p) => acc + p.links_stats.internal_links, 0),
      orphaned_pages: orphanedPages,
    },
  };
}

/**
 * Aggregates page-level SEO scores into a deterministic website-level SEO score and issue count.
 */
export function aggregateWebsiteSEO(pageResults: PageSEOAnalysisResult[]) {
  if (!pageResults || pageResults.length === 0) {
    return {
      seo_score: 0,
      analysis_version: CURRENT_ANALYSIS_VERSION,
      issue_counts: { critical: 0, warning: 0, opportunity: 0, passed: 0 },
      aggregate_analysis: analyzePage({ path: "index.html", htmlContent: "" }).analysis,
      recommendations: [],
    };
  }

  // Weight index.html 40%, other pages shared 60%
  const indexPage = pageResults.find((p) => normalizePath(p.path) === "index.html") || pageResults[0];
  const otherPages = pageResults.filter((p) => p !== indexPage);

  let siteScore = indexPage.seo_score;
  if (otherPages.length > 0) {
    const otherAvg = otherPages.reduce((acc, p) => acc + p.seo_score, 0) / otherPages.length;
    siteScore = Math.round(indexPage.seo_score * 0.4 + otherAvg * 0.6);
  }

  // Aggregate issue counts
  const totalCritical = pageResults.reduce((acc, p) => acc + p.issue_counts.critical, 0);
  const totalWarning = pageResults.reduce((acc, p) => acc + p.issue_counts.warning, 0);
  const totalOpportunity = pageResults.reduce((acc, p) => acc + p.issue_counts.opportunity, 0);
  const totalPassed = pageResults.reduce((acc, p) => acc + p.issue_counts.passed, 0);

  // Aggregate recommendations
  const recommendationMap = new Map<string, "success" | "warning" | "error">();
  pageResults.forEach((p) => {
    p.recommendations.forEach((r) => {
      if (!recommendationMap.has(r.text)) {
        recommendationMap.set(r.text, r.type);
      }
    });
  });

  const recommendations = Array.from(recommendationMap.entries()).map(([text, type]) => ({
    type,
    text,
  }));

  return {
    seo_score: Math.min(100, Math.max(0, siteScore)),
    analysis_version: CURRENT_ANALYSIS_VERSION,
    issue_counts: {
      critical: totalCritical,
      warning: totalWarning,
      opportunity: totalOpportunity,
      passed: totalPassed,
    },
    aggregate_analysis: indexPage.analysis,
    recommendations,
  };
}

/**
 * Backward compatibility wrapper function.
 * Accepts single HTML content and settings, returns standard single-page SEOAnalysisResult.
 */
export function analyzeWebsiteSEO(
  htmlContent: string = "",
  settings: SEOSettingsInput = {}
): SEOAnalysisResult {
  const result = analyzePage({ path: "index.html", htmlContent, seoSettings: settings });
  return {
    seo_score: result.seo_score,
    analysis: result.analysis,
    recommendations: result.recommendations,
    image_stats: result.image_stats,
  };
}

function normalizePath(p: string): string {
  if (!p) return "index.html";
  let clean = p.trim().toLowerCase();
  if (clean.startsWith("/")) clean = clean.slice(1);
  if (clean === "" || clean === "index") return "index.html";
  return clean;
}
