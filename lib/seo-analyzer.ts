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

export function analyzeWebsiteSEO(
  htmlContent: string = "",
  settings: SEOSettingsInput = {}
): SEOAnalysisResult {
  let score = 0;
  const recommendations: Array<{ type: "success" | "warning" | "error"; text: string }> = [];

  const title = settings.seo_title?.trim() || extractTagContent(htmlContent, "title");
  const metaDesc =
    settings.meta_description?.trim() ||
    extractMetaAttribute(htmlContent, "name", "description", "content");
  const keywords = settings.focus_keywords || [];
  const primaryKeyword = (keywords[0] || "").toLowerCase().trim();

  // 1. TITLE — 20 Points
  let titleScore = 0;
  let titleDetails = "";
  if (title) {
    titleScore += 5;
    if (title.length >= 30 && title.length <= 60) {
      titleScore += 10;
      titleDetails = `Title length (${title.length} chars) is optimal.`;
    } else {
      titleScore += 5;
      titleDetails = `Title length (${title.length} chars) should ideally be between 30-60 characters.`;
    }
    if (primaryKeyword && title.toLowerCase().includes(primaryKeyword)) {
      titleScore += 5;
      recommendations.push({ type: "success", text: `Title contains focus keyword "${primaryKeyword}".` });
    } else if (primaryKeyword) {
      recommendations.push({ type: "warning", text: `Consider adding primary keyword "${primaryKeyword}" to the title.` });
    } else {
      recommendations.push({ type: "success", text: "SEO Title is set." });
    }
  } else {
    titleDetails = "SEO Title is missing!";
    recommendations.push({ type: "error", text: "SEO Title is missing." });
  }

  // 2. META DESCRIPTION — 15 Points
  let descScore = 0;
  let descDetails = "";
  if (metaDesc) {
    descScore += 5;
    if (metaDesc.length >= 70 && metaDesc.length <= 160) {
      descScore += 5;
      descDetails = `Meta description length (${metaDesc.length} chars) is optimal.`;
    } else {
      descScore += 2;
      descDetails = `Meta description length (${metaDesc.length} chars) should be between 70-160 characters.`;
    }
    if (primaryKeyword && metaDesc.toLowerCase().includes(primaryKeyword)) {
      descScore += 5;
      recommendations.push({ type: "success", text: `Meta description contains focus keyword "${primaryKeyword}".` });
    } else {
      recommendations.push({ type: "success", text: "Meta description is set." });
    }
  } else {
    descDetails = "Meta description is missing!";
    recommendations.push({ type: "warning", text: "Meta description is missing." });
  }

  // 3. HEADINGS — 15 Points
  let headingScore = 0;
  let headingDetails = "";
  const h1Matches = htmlContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const h2Matches = htmlContent.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || [];

  if (h1Matches.length === 1) {
    headingScore += 5;
    headingDetails += "Single H1 tag detected. ";
  } else if (h1Matches.length === 0) {
    recommendations.push({ type: "warning", text: "No H1 tag found in body content." });
  } else {
    headingScore += 2;
    recommendations.push({ type: "warning", text: "Multiple H1 tags found. It is best practice to use exactly one H1 per page." });
  }

  if (h2Matches.length > 0) {
    headingScore += 5;
    headingDetails += `${h2Matches.length} H2 tag(s) found. `;
  } else {
    recommendations.push({ type: "warning", text: "No H2 heading tags found to structure content." });
  }

  const allHeadingText = [...h1Matches, ...h2Matches].join(" ").toLowerCase();
  if (primaryKeyword && allHeadingText.includes(primaryKeyword)) {
    headingScore += 5;
    recommendations.push({ type: "success", text: `Headings naturally include key term "${primaryKeyword}".` });
  } else {
    headingScore += 2;
  }

  // 4. IMAGES & ALT TEXT — 10 Points
  let imageScore = 0;
  let imageDetails = "";
  const imgMatches = htmlContent.match(/<img[^>]*>/gi) || [];
  let totalImgs = imgMatches.length;
  let withAlt = 0;
  let missingAlt = 0;

  for (const imgTag of imgMatches) {
    const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
    if (altMatch && altMatch[1].trim().length > 0) {
      withAlt++;
    } else {
      missingAlt++;
    }
  }

  if (totalImgs === 0) {
    imageScore = 10;
    imageDetails = "No images present on page.";
    recommendations.push({ type: "success", text: "No images requiring alt text." });
  } else if (missingAlt === 0) {
    imageScore = 10;
    imageDetails = `All ${totalImgs} image(s) have alt attributes.`;
    recommendations.push({ type: "success", text: `All ${totalImgs} image(s) have alt attributes.` });
  } else {
    const ratio = withAlt / totalImgs;
    imageScore = Math.floor(ratio * 10);
    imageDetails = `${withAlt} of ${totalImgs} images have alt attributes (${missingAlt} missing).`;
    recommendations.push({ type: "warning", text: `${missingAlt} image(s) missing alt text.` });
  }

  // 5. CANONICAL — 5 Points
  let canonicalScore = 0;
  let canonicalDetails = "";
  if (settings.canonical_url && settings.canonical_url.trim().startsWith("http")) {
    canonicalScore = 5;
    canonicalDetails = "Canonical URL is validly configured.";
    recommendations.push({ type: "success", text: "Canonical URL configured." });
  } else {
    canonicalDetails = "No canonical URL configured.";
    recommendations.push({ type: "warning", text: "No canonical URL defined." });
  }

  // 6. OPEN GRAPH — 10 Points
  let ogScore = 0;
  let ogDetails = "";
  if (settings.og_title && settings.og_title.trim().length > 0) {
    ogScore += 5;
  }
  if (settings.og_description && settings.og_description.trim().length > 0) {
    ogScore += 5;
  }

  if (ogScore === 10) {
    ogDetails = "Open Graph title and description are set.";
    recommendations.push({ type: "success", text: "Open Graph metadata configured." });
  } else {
    ogDetails = "Open Graph metadata incomplete.";
    recommendations.push({ type: "warning", text: "Complete Open Graph tags for better social sharing." });
  }

  // 7. SCHEMA MARKUP — 10 Points
  let schemaScore = 0;
  let schemaDetails = "";
  if (settings.schema_markup && Object.keys(settings.schema_markup).length > 0) {
    schemaScore = 10;
    schemaDetails = "Structured JSON-LD Schema markup is present.";
    recommendations.push({ type: "success", text: "Structured Schema markup configured." });
  } else {
    schemaDetails = "No structured data schema found.";
    recommendations.push({ type: "warning", text: "Add JSON-LD Schema markup for rich snippet visibility." });
  }

  // 8. ROBOTS SETTINGS — 5 Points
  let robotsScore = 0;
  let robotsDetails = "";
  if (settings.robots_index !== false) {
    robotsScore = 5;
    robotsDetails = "Search engine indexing is allowed.";
    recommendations.push({ type: "success", text: "Search engines allowed to index site." });
  } else {
    robotsScore = 0;
    robotsDetails = "Search engine indexing is set to NOINDEX!";
    recommendations.push({ type: "warning", text: "Site is configured to block search engine indexing (noindex)." });
  }

  // 9. TECHNICAL SEO — 10 Points
  let techScore = 0;
  let techDetails = "";
  if (htmlContent.includes("<!DOCTYPE html") || htmlContent.includes("<!doctype html")) {
    techScore += 4;
  }
  if (htmlContent.includes('name="viewport"') || htmlContent.includes("name='viewport'")) {
    techScore += 3;
  }
  if (htmlContent.includes("<meta charset")) {
    techScore += 3;
  }
  if (techScore === 10) {
    techDetails = "Valid HTML5 doctype, viewport meta tag, and character set detected.";
    recommendations.push({ type: "success", text: "Technical HTML structure is clean." });
  } else {
    techDetails = "Minor technical metadata issues found.";
  }

  score = titleScore + descScore + headingScore + imageScore + canonicalScore + ogScore + schemaScore + robotsScore + techScore;

  return {
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
  };
}

function extractTagContent(html: string, tag: string): string {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].replace(/<[^>]+>/g, "").trim() : "";
}

function extractMetaAttribute(
  html: string,
  attrName: string,
  attrVal: string,
  targetAttr: string
): string {
  const reg = new RegExp(
    `<meta[^>]*${attrName}=["']${attrVal}["'][^>]*${targetAttr}=["']([^"']*)["']`,
    "i"
  );
  const match = html.match(reg);
  if (match) return match[1].trim();

  // Reverse attribute order check
  const regAlt = new RegExp(
    `<meta[^>]*${targetAttr}=["']([^"']*)["'][^>]*${attrName}=["']${attrVal}["']`,
    "i"
  );
  const matchAlt = html.match(regAlt);
  return matchAlt ? matchAlt[1].trim() : "";
}
