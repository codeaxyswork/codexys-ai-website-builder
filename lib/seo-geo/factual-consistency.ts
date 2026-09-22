import * as cheerio from "cheerio";

export interface FactualConflict {
  field: "businessName" | "phone" | "email" | "city" | "service";
  baselineValue: string;
  conflictingValue: string;
  pagePath: string;
  severity: "high" | "medium" | "low";
  description: string;
}

export interface FactualConsistencyResult {
  score: number; // 0 - 100
  conflicts: FactualConflict[];
  checkedFields: {
    businessName: boolean;
    phone: boolean;
    email: boolean;
    city: boolean;
    servicesCount: number;
  };
  passed: string[];
  recommendations: string[];
}

export interface CitationReadinessCheck {
  id: string;
  name: string;
  points: number;
  maxPoints: number;
  passed: boolean;
  explanation: string;
}

export interface CitationReadinessResult {
  score: number; // 0 - 100
  level: "Optimal" | "High" | "Medium" | "Low";
  checks: CitationReadinessCheck[];
  passedChecksCount: number;
  totalChecksCount: number;
  recommendations: string[];
}

/**
 * Normalizes phone numbers by stripping non-digit characters except leading plus.
 * Prevents treating formatting differences (e.g. "(312) 555-0199" vs "312.555.0199") as conflicts.
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned.startsWith("+") ? cleaned : cleaned.replace(/^0+/, "");
}

/**
 * Normalizes text for case-insensitive, whitespace-collapsed comparisons.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Audits factual consistency across all pages of a website using baseline business context.
 * Strictly avoids fabricating missing facts or flagging harmless formatting variations.
 */
export function auditFactualConsistency(
  baseline: {
    businessName?: string | null;
    city?: string | null;
    phone?: string | null;
    email?: string | null;
    services?: string[];
  },
  pages: Array<{ path: string; html_content: string }>
): FactualConsistencyResult {
  const conflicts: FactualConflict[] = [];
  const passed: string[] = [];
  const recommendations: string[] = [];

  const normBaselineName = normalizeText(baseline.businessName);
  const normBaselinePhone = normalizePhone(baseline.phone);
  const normBaselineEmail = normalizeText(baseline.email);
  const normBaselineCity = normalizeText(baseline.city);

  let checkedName = false;
  let checkedPhone = false;
  let checkedEmail = false;
  let checkedCity = false;

  const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  pages.forEach((page) => {
    const $ = cheerio.load(page.html_content || "");
    const pageText = $("body").text();

    // 1. Business Name Check across H1 & Title
    const h1Text = $("h1").first().text().trim();
    const titleText = $("title").first().text().trim();

    if (normBaselineName) {
      checkedName = true;
      // Search for candidate business names in H1/title
      const candidates = [h1Text, titleText].filter((t) => t.length > 3 && t.length < 60);
      candidates.forEach((candidate) => {
        const normCand = normalizeText(candidate);
        // Flag only if candidate contains entity keywords but differs completely from baseline name
        if (
          normCand.includes("clinic") ||
          normCand.includes("care") ||
          normCand.includes("center") ||
          normCand.includes("motors") ||
          normCand.includes("group") ||
          normCand.includes("solutions") ||
          normCand.includes("inc") ||
          normCand.includes("llc")
        ) {
          if (
            normCand !== normBaselineName &&
            !normCand.includes(normBaselineName) &&
            !normBaselineName.includes(normCand)
          ) {
            if (!conflicts.some((c) => c.field === "businessName" && c.pagePath === page.path)) {
              conflicts.push({
                field: "businessName",
                baselineValue: baseline.businessName || "",
                conflictingValue: candidate,
                pagePath: page.path,
                severity: "high",
                description: `Discrepancy in business name detected on ${page.path}: "${candidate}" vs official name "${baseline.businessName}".`,
              });
            }
          }
        }
      });
    }

    // 2. Phone Number Check
    if (normBaselinePhone) {
      checkedPhone = true;
      const foundPhones = pageText.match(phoneRegex) || [];
      foundPhones.forEach((p) => {
        const normP = normalizePhone(p);
        if (normP.length >= 7 && normP !== normBaselinePhone) {
          if (!conflicts.some((c) => c.field === "phone" && c.pagePath === page.path)) {
            conflicts.push({
              field: "phone",
              baselineValue: baseline.phone || "",
              conflictingValue: p.trim(),
              pagePath: page.path,
              severity: "high",
              description: `Conflicting phone number found on ${page.path}: "${p.trim()}" vs baseline "${baseline.phone}".`,
            });
          }
        }
      });
    }

    // 3. Email Check
    if (normBaselineEmail) {
      checkedEmail = true;
      const foundEmails = pageText.match(emailRegex) || [];
      foundEmails.forEach((e) => {
        const normE = normalizeText(e);
        if (normE !== normBaselineEmail) {
          if (!conflicts.some((c) => c.field === "email" && c.pagePath === page.path)) {
            conflicts.push({
              field: "email",
              baselineValue: baseline.email || "",
              conflictingValue: e.trim(),
              pagePath: page.path,
              severity: "medium",
              description: `Conflicting email address found on ${page.path}: "${e.trim()}" vs baseline "${baseline.email}".`,
            });
          }
        }
      });
    }
  });

  // Calculate Deterministic Score (0–100)
  let score = 100;
  conflicts.forEach((c) => {
    if (c.severity === "high") score -= 25;
    else if (c.severity === "medium") score -= 15;
    else score -= 10;
  });
  score = Math.max(0, Math.min(100, score));

  if (checkedName && !conflicts.some((c) => c.field === "businessName")) {
    passed.push("Business name is consistent across all indexed pages.");
  }
  if (checkedPhone && !conflicts.some((c) => c.field === "phone")) {
    passed.push("Phone number is consistent across all indexed pages.");
  }
  if (checkedEmail && !conflicts.some((c) => c.field === "email")) {
    passed.push("Email address is consistent across all indexed pages.");
  }

  if (conflicts.length > 0) {
    recommendations.push("Ensure your official business name and contact information are identical across all pages.");
  } else {
    recommendations.push("Factual consistency is high across all site pages.");
  }

  return {
    score,
    conflicts,
    checkedFields: {
      businessName: checkedName,
      phone: checkedPhone,
      email: checkedEmail,
      city: checkedCity,
      servicesCount: baseline.services?.length || 0,
    },
    passed,
    recommendations,
  };
}

/**
 * Calculates a deterministic Citation Readiness score (0–100) with explainable checks.
 * Evaluates entity identity, page structure, JSON-LD, direct answers, canonical URLs, and factual consistency.
 */
export function calculateCitationReadiness(
  context: {
    businessName?: string | null;
    city?: string | null;
    canonicalUrl?: string | null;
    schemaMarkup?: any;
    htmlContent?: string;
    factualScore?: number;
  }
): CitationReadinessResult {
  const checks: CitationReadinessCheck[] = [];
  const recommendations: string[] = [];

  const html = context.htmlContent || "";
  const $ = cheerio.load(html);

  // Check 1: Entity Identity (20 pts)
  const hasEntity = Boolean(context.businessName && context.businessName.length >= 2);
  checks.push({
    id: "entity_identity",
    name: "Entity Identity Clarity",
    points: hasEntity ? 20 : 0,
    maxPoints: 20,
    passed: hasEntity,
    explanation: hasEntity
      ? `Clear entity identity detected for "${context.businessName}".`
      : "Business name or entity identity is ambiguous.",
  });

  // Check 2: Page Context & Title (15 pts)
  const titleText = $("title").first().text().trim();
  const metaDesc = $('meta[name="description"]').attr("content")?.trim() || "";
  const hasPageContext = titleText.length > 5 && metaDesc.length > 10;
  checks.push({
    id: "page_context",
    name: "Page Metadata & Context",
    points: hasPageContext ? 15 : 0,
    maxPoints: 15,
    passed: hasPageContext,
    explanation: hasPageContext
      ? "Page possesses descriptive title and meta description tags."
      : "Page title or meta description is incomplete or too short.",
  });

  // Check 3: Structured Data Presence (15 pts)
  const hasSchema = Boolean(context.schemaMarkup && (context.schemaMarkup["@context"] || context.schemaMarkup["@graph"]));
  checks.push({
    id: "structured_data",
    name: "Schema.org Structured Data",
    points: hasSchema ? 15 : 0,
    maxPoints: 15,
    passed: hasSchema,
    explanation: hasSchema
      ? "Valid Schema.org JSON-LD structured data is present."
      : "No valid JSON-LD schema markup found.",
  });

  // Check 4: Direct Answer & FAQ Structure (15 pts)
  const faqCount = $(".faq-item, details, .faq, [class*='faq']").length;
  const hasDirectAnswers = faqCount > 0 || $("h2, h3").length >= 2;
  checks.push({
    id: "direct_answers",
    name: "Direct Answer & FAQ Readiness",
    points: hasDirectAnswers ? 15 : 0,
    maxPoints: 15,
    passed: hasDirectAnswers,
    explanation: hasDirectAnswers
      ? `Direct answer sections and ${faqCount} FAQ items identified.`
      : "Add clear Q&A or FAQ sections under section headings to improve answer readiness.",
  });

  // Check 5: Stable Canonical URL (15 pts)
  const hasCanonical = Boolean(context.canonicalUrl && context.canonicalUrl.startsWith("http"));
  checks.push({
    id: "canonical_url",
    name: "Canonical URL Stability",
    points: hasCanonical ? 15 : 0,
    maxPoints: 15,
    passed: hasCanonical,
    explanation: hasCanonical
      ? `Canonical URL is configured (${context.canonicalUrl}).`
      : "Canonical URL tag is missing or invalid.",
  });

  // Check 6: Semantic HTML Layout (10 pts)
  const hasSemanticHtml = $("header, nav, main, section, footer").length >= 3;
  checks.push({
    id: "semantic_html",
    name: "Semantic HTML5 Structure",
    points: hasSemanticHtml ? 10 : 0,
    maxPoints: 10,
    passed: hasSemanticHtml,
    explanation: hasSemanticHtml
      ? "Semantic HTML5 layout tags (<header>, <main>, <section>, <footer>) present."
      : "Use standard HTML5 semantic elements to improve structural machine readability.",
  });

  // Check 7: Absence of Factual Conflicts (10 pts)
  const factScore = typeof context.factualScore === "number" ? context.factualScore : 100;
  const passedFactual = factScore >= 80;
  checks.push({
    id: "factual_consistency",
    name: "Factual Cross-Page Consistency",
    points: passedFactual ? 10 : Math.round((factScore / 100) * 10),
    maxPoints: 10,
    passed: passedFactual,
    explanation: passedFactual
      ? "High cross-page factual consistency maintained."
      : "Conflicting business details detected across pages.",
  });

  const totalScore = Math.min(100, checks.reduce((sum, c) => sum + c.points, 0));

  let level: "Optimal" | "High" | "Medium" | "Low" = "Low";
  if (totalScore >= 85) level = "Optimal";
  else if (totalScore >= 70) level = "High";
  else if (totalScore >= 50) level = "Medium";

  checks.filter((c) => !c.passed).forEach((c) => recommendations.push(c.explanation));
  if (recommendations.length === 0) {
    recommendations.push("Website exhibits excellent citation readiness and attributable entity structure.");
  }

  return {
    score: totalScore,
    level,
    checks,
    passedChecksCount: checks.filter((c) => c.passed).length,
    totalChecksCount: checks.length,
    recommendations,
  };
}
