import * as cheerio from "cheerio";
import { auditFactualConsistency, calculateCitationReadiness } from "./factual-consistency";
import { redisGet, redisSet } from "../redis";
import { getWebsitePublicUrl } from "../domain-resolver";

export interface EntityRelationshipNode {
  type: "Business" | "Brand" | "Website" | "Service" | "Product" | "Location" | "Contact";
  name: string;
  relationship: string;
  target?: string;
  details?: Record<string, any>;
}

export interface EntityRelationshipGraph {
  business: {
    name: string | null;
    type: string | null;
    description: string | null;
  };
  brand: {
    name: string | null;
    relationship: "represents" | "unknown";
  };
  website: {
    url: string | null;
    relationship: "official_website";
  };
  services: Array<{ name: string; relationship: "offers" }>;
  products: Array<{ name: string; relationship: "offers" }>;
  location: {
    city: string | null;
    relationship: "located_in";
  };
  contact: {
    phone: string | null;
    email: string | null;
    relationship: "contact_info";
  };
  nodes: EntityRelationshipNode[];
}

export interface StructuredDataDepthResult {
  score: number; // 0 - 100
  foundTypes: string[];
  relevantTypes: string[];
  findings: Array<{ key: string; status: "present" | "missing" | "optional"; score: number }>;
  recommendations: string[];
}

export interface EntityClarityResult {
  score: number; // 0 - 100
  findings: Array<{ key: string; status: "present" | "missing" | "conflict"; evidence: string; score: number }>;
  recommendations: string[];
}

export interface GEOScoreResult {
  score: number; // 0 - 100
  entityClarity: EntityClarityResult;
  factualConsistency: {
    score: number;
    source: "phase1";
    conflictsCount: number;
  };
  structuredDataDepth: StructuredDataDepthResult;
  citationReadiness: {
    score: number;
    source: "phase1";
    level: string;
  };
  relationships: EntityRelationshipGraph;
  recommendations: string[];
}

/**
 * Deterministically evaluates Entity Clarity (0–100).
 * Checks business name, business type, location, contact details, services, description.
 */
export function calculateEntityClarity(context: {
  businessName?: string | null;
  businessType?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  services?: string[];
  description?: string | null;
}): EntityClarityResult {
  const findings: Array<{ key: string; status: "present" | "missing" | "conflict"; evidence: string; score: number }> = [];
  const recommendations: string[] = [];

  let totalScore = 0;

  // 1. Business Name (30 pts)
  if (context.businessName && context.businessName.length >= 2 && context.businessName !== "Business Website") {
    totalScore += 30;
    findings.push({ key: "business_name", status: "present", evidence: context.businessName, score: 30 });
  } else {
    findings.push({ key: "business_name", status: "missing", evidence: "Not specified", score: 0 });
    recommendations.push("Specify a clear official business name in site settings.");
  }

  // 2. Business Type (15 pts)
  if (context.businessType && context.businessType.length >= 3) {
    totalScore += 15;
    findings.push({ key: "business_type", status: "present", evidence: context.businessType, score: 15 });
  } else {
    findings.push({ key: "business_type", status: "missing", evidence: "Not specified", score: 0 });
    recommendations.push("Define your business industry or service type.");
  }

  // 3. Location / City (15 pts)
  if (context.city && context.city.length >= 2) {
    totalScore += 15;
    findings.push({ key: "city", status: "present", evidence: context.city, score: 15 });
  } else {
    findings.push({ key: "city", status: "missing", evidence: "Global / Online", score: 0 });
  }

  // 4. Contact Phone (10 pts)
  if (context.phone && context.phone.length >= 7) {
    totalScore += 10;
    findings.push({ key: "phone", status: "present", evidence: context.phone, score: 10 });
  } else {
    findings.push({ key: "phone", status: "missing", evidence: "Not specified", score: 0 });
  }

  // 5. Contact Email (10 pts)
  if (context.email && context.email.length >= 5) {
    totalScore += 10;
    findings.push({ key: "email", status: "present", evidence: context.email, score: 10 });
  } else {
    findings.push({ key: "email", status: "missing", evidence: "Not specified", score: 0 });
  }

  // 6. Services / Products (10 pts)
  if (context.services && context.services.length > 0) {
    totalScore += 10;
    findings.push({ key: "services", status: "present", evidence: context.services.join(", "), score: 10 });
  } else {
    findings.push({ key: "services", status: "missing", evidence: "None listed", score: 0 });
    recommendations.push("Add core services or products to clarify business offerings.");
  }

  // 7. Business Description (10 pts)
  if (context.description && context.description.length >= 15) {
    totalScore += 10;
    findings.push({ key: "description", status: "present", evidence: context.description.substring(0, 40) + "...", score: 10 });
  } else {
    findings.push({ key: "description", status: "missing", evidence: "Not specified", score: 0 });
  }

  return {
    score: Math.min(100, totalScore),
    findings,
    recommendations,
  };
}

/**
 * Analyzes Schema.org JSON-LD depth based on website context and relevance.
 * Does NOT penalize websites for schema types that are not applicable (e.g. online SaaS without physical address).
 */
export function analyzeStructuredDataDepth(
  schemaMarkup: any,
  context: { isLocalBusiness?: boolean; hasFaq?: boolean }
): StructuredDataDepthResult {
  const foundTypes: string[] = [];
  const findings: Array<{ key: string; status: "present" | "missing" | "optional"; score: number }> = [];
  const recommendations: string[] = [];

  if (schemaMarkup) {
    const schemas = Array.isArray(schemaMarkup["@graph"])
      ? schemaMarkup["@graph"]
      : Array.isArray(schemaMarkup)
      ? schemaMarkup
      : [schemaMarkup];

    schemas.forEach((s: any) => {
      if (s && s["@type"]) {
        foundTypes.push(s["@type"]);
      }
    });
  }

  const relevantTypes: string[] = ["WebSite", "Organization"];
  if (context.isLocalBusiness) relevantTypes.push("LocalBusiness");
  if (context.hasFaq) relevantTypes.push("FAQPage");

  let totalScore = 0;

  // WebSite schema (25 pts)
  if (foundTypes.includes("WebSite")) {
    totalScore += 25;
    findings.push({ key: "WebSite", status: "present", score: 25 });
  } else {
    findings.push({ key: "WebSite", status: "missing", score: 0 });
    recommendations.push("Add WebSite schema markup to specify canonical domain identity.");
  }

  // Organization / LocalBusiness schema (35 pts)
  if (foundTypes.includes("LocalBusiness") || foundTypes.includes("Organization")) {
    totalScore += 35;
    findings.push({ key: "EntitySchema", status: "present", score: 35 });
  } else {
    findings.push({ key: "EntitySchema", status: "missing", score: 0 });
    recommendations.push("Add Organization or LocalBusiness schema markup.");
  }

  // FAQPage schema (20 pts - only required if visible FAQ content exists)
  if (context.hasFaq) {
    if (foundTypes.includes("FAQPage")) {
      totalScore += 20;
      findings.push({ key: "FAQPage", status: "present", score: 20 });
    } else {
      findings.push({ key: "FAQPage", status: "missing", score: 0 });
      recommendations.push("Add FAQPage schema markup for visible FAQ items.");
    }
  } else {
    totalScore += 20; // Automatically grant pts if no FAQ content exists (not applicable)
    findings.push({ key: "FAQPage", status: "optional", score: 20 });
  }

  // Additional Rich Schemas (BreadcrumbList, Service, Brand) (20 pts)
  const richTypes = ["Service", "Product", "Brand", "BreadcrumbList", "WebPage"];
  const hasRichType = foundTypes.some((t) => richTypes.includes(t));
  if (hasRichType) {
    totalScore += 20;
    findings.push({ key: "RichSchemas", status: "present", score: 20 });
  } else {
    findings.push({ key: "RichSchemas", status: "optional", score: 0 });
  }

  return {
    score: Math.min(100, totalScore),
    foundTypes,
    relevantTypes,
    findings,
    recommendations,
  };
}

/**
 * Builds a deterministic structured JSON Entity Relationship Graph from website data.
 */
export function buildEntityRelationshipGraph(context: {
  businessName?: string | null;
  businessType?: string | null;
  description?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  canonicalUrl?: string | null;
  services?: string[];
}): EntityRelationshipGraph {
  const bName = context.businessName || "Business Entity";
  const nodes: EntityRelationshipNode[] = [];

  // Business Node
  nodes.push({
    type: "Business",
    name: bName,
    relationship: "self",
    details: { type: context.businessType || "Organization" },
  });

  // Website Node
  if (context.canonicalUrl) {
    nodes.push({
      type: "Website",
      name: context.canonicalUrl,
      relationship: "official_website",
      target: bName,
    });
  }

  // Brand Node
  nodes.push({
    type: "Brand",
    name: bName,
    relationship: "represents",
    target: bName,
  });

  // Services Nodes
  const serviceList: Array<{ name: string; relationship: "offers" }> = [];
  if (context.services && context.services.length > 0) {
    context.services.forEach((s) => {
      serviceList.push({ name: s, relationship: "offers" });
      nodes.push({
        type: "Service",
        name: s,
        relationship: "offers",
        target: bName,
      });
    });
  }

  // Location Node
  if (context.city) {
    nodes.push({
      type: "Location",
      name: context.city,
      relationship: "located_in",
      target: bName,
    });
  }

  // Contact Node
  if (context.phone || context.email) {
    nodes.push({
      type: "Contact",
      name: context.phone || context.email || "Contact",
      relationship: "contact_info",
      target: bName,
      details: { phone: context.phone, email: context.email },
    });
  }

  return {
    business: {
      name: context.businessName || null,
      type: context.businessType || null,
      description: context.description || null,
    },
    brand: {
      name: context.businessName || null,
      relationship: "represents",
    },
    website: {
      url: context.canonicalUrl || null,
      relationship: "official_website",
    },
    services: serviceList,
    products: [],
    location: {
      city: context.city || null,
      relationship: "located_in",
    },
    contact: {
      phone: context.phone || null,
      email: context.email || null,
      relationship: "contact_info",
    },
    nodes,
  };
}

/**
 * Calculates GEO Score (0–100) using 30% Entity Clarity, 25% Factual Consistency, 25% Structured Data Depth, 20% Citation Readiness.
 */
export function calculateGEOScore(
  context: {
    businessName?: string | null;
    businessType?: string | null;
    city?: string | null;
    phone?: string | null;
    email?: string | null;
    services?: string[];
    description?: string | null;
    canonicalUrl?: string | null;
    schemaMarkup?: any;
    htmlContent?: string;
  },
  pages: Array<{ path: string; html_content: string }>
): GEOScoreResult {
  // 1. Entity Clarity
  const entityClarity = calculateEntityClarity(context);

  // 2. Phase 1: Factual Consistency
  const factualResult = auditFactualConsistency(
    {
      businessName: context.businessName,
      city: context.city,
      phone: context.phone,
      email: context.email,
      services: context.services,
    },
    pages
  );

  // 3. Structured Data Depth
  const hasFaq = Boolean(context.htmlContent && context.htmlContent.includes("faq"));
  const structuredDataDepth = analyzeStructuredDataDepth(context.schemaMarkup, {
    isLocalBusiness: Boolean(context.city),
    hasFaq,
  });

  // 4. Phase 1: Citation Readiness
  const citationResult = calculateCitationReadiness({
    businessName: context.businessName,
    city: context.city,
    canonicalUrl: context.canonicalUrl,
    schemaMarkup: context.schemaMarkup,
    htmlContent: context.htmlContent,
    factualScore: factualResult.score,
  });

  // 5. Entity Relationship Graph
  const relationships = buildEntityRelationshipGraph(context);

  // Formula: 30% Entity Clarity + 25% Factual Consistency + 25% Structured Data Depth + 20% Citation Readiness
  const rawScore =
    0.3 * entityClarity.score +
    0.25 * factualResult.score +
    0.25 * structuredDataDepth.score +
    0.2 * citationResult.score;

  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  const recommendations = [
    ...entityClarity.recommendations,
    ...structuredDataDepth.recommendations,
    ...citationResult.recommendations,
  ].slice(0, 5);

  return {
    score,
    entityClarity,
    factualConsistency: {
      score: factualResult.score,
      source: "phase1",
      conflictsCount: factualResult.conflicts.length,
    },
    structuredDataDepth,
    citationReadiness: {
      score: citationResult.score,
      source: "phase1",
      level: citationResult.level,
    },
    relationships,
    recommendations,
  };
}

/**
 * Main server-side GEO analysis function with Redis caching.
 */
export async function runGEOAnalysis(
  supabase: any,
  websiteId: string,
  userId: string
): Promise<GEOScoreResult> {
  // 1. Verify Ownership
  const { data: website } = await supabase
    .from("websites")
    .select("id, title, prompt, slug, published_slug")
    .eq("id", websiteId)
    .eq("user_id", userId)
    .single();

  if (!website) {
    throw new Error("Website not found or access denied.");
  }

  // 2. Redis Cache Check
  const cacheKey = `seo:geo:${websiteId}`;
  const cached = await redisGet<GEOScoreResult>(cacheKey);
  if (cached) {
    return cached;
  }

  // 3. Parallel Fetch of website_seo, website_local_seo, website_pages
  const [seoRes, localRes, pagesRes] = await Promise.all([
    supabase.from("website_seo").select("*").eq("website_id", websiteId).maybeSingle(),
    supabase.from("website_local_seo").select("*").eq("website_id", websiteId).maybeSingle(),
    supabase.from("website_pages").select("path, html_content").eq("website_id", websiteId),
  ]);

  const seoRow = seoRes.data;
  const localRow = localRes.data;
  const pageList = pagesRes.data || [];
  const indexHtml = pageList.find((p: any) => p.path === "index.html")?.html_content || "";

  const context = {
    businessName: localRow?.business_name || website.title,
    businessType: localRow?.business_type || "Business Services",
    city: localRow?.city || null,
    phone: localRow?.phone || null,
    email: null,
    services: seoRow?.focus_keywords ? (Array.isArray(seoRow.focus_keywords) ? seoRow.focus_keywords : typeof seoRow.focus_keywords === "string" ? seoRow.focus_keywords.split(",").map((s: string) => s.trim()) : []) : [],
    description: seoRow?.meta_description || website.prompt,
    canonicalUrl: seoRow?.canonical_url || getWebsitePublicUrl(website),
    schemaMarkup: seoRow?.schema_markup,
    htmlContent: indexHtml,
  };

  // 4. Calculate GEO Score
  const geoResult = calculateGEOScore(context, pageList);

  // 5. Generate SEO Opportunities if weaknesses detected
  const geoOpps: any[] = [];
  if (geoResult.entityClarity.score < 70) {
    geoOpps.push({
      website_id: websiteId,
      user_id: userId,
      type: "geo",
      category: "geo_missing_entity_identity",
      title: "Incomplete Entity Identity",
      description: "Business name, location, or core service details are incomplete. Clarify entity parameters to improve machine understanding.",
      affected_page: "index.html",
      severity: "high",
      impact: "high",
      effort: "low",
      priority: "high",
      priority_score: 80,
      source: "geo_engine",
      recommended_action: "Update business name, city, and phone details in site settings.",
      action_type: "fix_entity",
      action_payload: {},
      status: "new",
    });
  }

  if (geoResult.structuredDataDepth.score < 60) {
    geoOpps.push({
      website_id: websiteId,
      user_id: userId,
      type: "geo",
      category: "geo_incomplete_structured_graph",
      title: "Incomplete Structured Entity Graph",
      description: "Schema.org structured data graph is missing WebSite or Organization node references.",
      affected_page: "index.html",
      severity: "medium",
      impact: "medium",
      effort: "low",
      priority: "medium",
      priority_score: 65,
      source: "geo_engine",
      recommended_action: "Generate and inject full Organization and LocalBusiness schema markup.",
      action_type: "generate_schema",
      action_payload: {},
      status: "new",
    });
  }

  for (const opp of geoOpps) {
    await supabase.from("seo_opportunities").upsert(opp, {
      onConflict: "website_id,category,affected_page",
      ignoreDuplicates: true,
    });
  }

  // 6. Write Redis Cache (TTL 3600s)
  await redisSet(cacheKey, geoResult, 3600);

  return geoResult;
}
