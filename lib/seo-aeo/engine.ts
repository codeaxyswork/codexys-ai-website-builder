import { calculateAnswerReadinessScore } from "./scorer";
import { AEOBreakdown, DiscoveredQuestion, EntityClarity, WebsiteAEOAnalysis } from "./types";
import { calculateOpportunityPriority } from "../seo-opportunities/prioritizer";
import { auditFactualConsistency, calculateCitationReadiness } from "../seo-geo/factual-consistency";

export async function runAEOAnalysis(
  supabase: any,
  websiteId: string,
  userId: string
): Promise<WebsiteAEOAnalysis> {
  // 1. Fetch Website Data
  const { data: website } = await supabase
    .from("websites")
    .select("id, title, prompt, is_published, published_slug")
    .eq("id", websiteId)
    .single();

  const { data: seoRow } = await supabase
    .from("website_seo")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  const { data: pages } = await supabase
    .from("website_pages")
    .select("id, path, html_content, seo_title, meta_description, focus_keywords")
    .eq("website_id", websiteId);

  const { data: blogPosts } = await supabase
    .from("blog_posts")
    .select("id, title, slug, content, excerpt, status")
    .eq("website_id", websiteId);

  const { data: localSeo } = await supabase
    .from("website_local_seo")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  const { data: gscData } = await supabase
    .from("gsc_search_analytics")
    .select("query, clicks, impressions, position")
    .eq("website_id", websiteId)
    .limit(30);

  // -------------------------------------------------------------
  // 2. QUESTION DISCOVERY & CONVERSATIONAL INTENT AUDIT
  // -------------------------------------------------------------
  const questionsDiscovered: DiscoveredQuestion[] = [];
  const questionRegex = /\b(what|how|why|where|who|when|which|can|is|does)\b[^.?!]*\?/gi;

  const pageList = pages || [];
  const postList = blogPosts || [];

  pageList.forEach((p: any) => {
    const text = (p.html_content || "").replace(/<[^>]+>/g, " ");
    const matches = text.match(questionRegex) || [];
    matches.slice(0, 5).forEach((q: string, idx: number) => {
      const cleanQ = q.trim();
      if (cleanQ.length > 10 && !questionsDiscovered.some((item) => item.question === cleanQ)) {
        questionsDiscovered.push({
          id: `q_p_${p.id}_${idx}`,
          question: cleanQ.charAt(0).toUpperCase() + cleanQ.slice(1),
          source: "content_audit",
          intent: cleanQ.toLowerCase().startsWith("how") ? "informational" : "informational",
          hasDirectAnswer: text.length > 300,
          pagePath: p.path || "/",
        });
      }
    });
  });

  postList.forEach((b: any) => {
    const text = (b.content || "").replace(/<[^>]+>/g, " ");
    const matches = text.match(questionRegex) || [];
    matches.slice(0, 3).forEach((q: string, idx: number) => {
      const cleanQ = q.trim();
      if (cleanQ.length > 10 && !questionsDiscovered.some((item) => item.question === cleanQ)) {
        questionsDiscovered.push({
          id: `q_b_${b.id}_${idx}`,
          question: cleanQ.charAt(0).toUpperCase() + cleanQ.slice(1),
          source: "faq_section",
          intent: "informational",
          hasDirectAnswer: true,
          pagePath: `/blog/${b.slug}`,
        });
      }
    });
  });

  // GSC Question queries discovery if available
  if (gscData && Array.isArray(gscData)) {
    gscData.forEach((g: any, idx: number) => {
      const q = (g.query || "").trim();
      if (/^(what|how|why|where|who|when|can|is)\b/i.test(q)) {
        if (!questionsDiscovered.some((item) => item.question.toLowerCase() === q.toLowerCase())) {
          questionsDiscovered.push({
            id: `q_gsc_${idx}`,
            question: q.charAt(0).toUpperCase() + q.slice(1) + "?",
            source: "gsc",
            intent: "informational",
            hasDirectAnswer: pageList.length > 0,
            pagePath: "index.html",
          });
        }
      }
    });
  }

  // -------------------------------------------------------------
  // 3. ENTITY CLARITY EVALUATION
  // -------------------------------------------------------------
  const missingEntities: string[] = [];
  const businessName = localSeo?.business_name || website?.title || null;
  const city = localSeo?.city || null;
  const phone = localSeo?.phone || null;
  const brand = website?.title || null;
  const productsServices: string[] = [];

  if (!businessName) missingEntities.push("Business/Organization Name");
  if (!city) missingEntities.push("Geographic Location / City");
  if (!phone) missingEntities.push("Contact Phone Number");
  if (!seoRow?.focus_keywords) missingEntities.push("Core Products/Services Keywords");

  if (seoRow?.focus_keywords) {
    productsServices.push(...seoRow.focus_keywords.split(",").map((s: string) => s.trim()).filter(Boolean));
  }

  const clarityScore = Math.max(0, 100 - missingEntities.length * 25);

  const entityClarity: EntityClarity = {
    businessName,
    organization: businessName,
    city,
    phone,
    brand,
    productsServices,
    missingEntities,
    clarityScore,
  };

  // -------------------------------------------------------------
  // 4. AEO BREAKDOWN SUB-SCORES (0–100 total via weighted categories)
  // -------------------------------------------------------------
  const answerClarity = Math.min(20, (seoRow?.seo_title ? 10 : 0) + (seoRow?.meta_description ? 10 : 0));
  const questionCoverage = Math.min(15, questionsDiscovered.length * 3);
  const contentStructure = Math.min(15, pageList.length > 0 ? 12 : 5);
  const entityUnderstanding = Math.min(15, Math.round((clarityScore / 100) * 15));
  const semanticRelevance = Math.min(15, productsServices.length > 0 ? 15 : 5);
  const structuredData = Math.min(10, seoRow?.schema_markup ? 10 : 0);
  const topicDepth = Math.min(10, postList.length > 0 ? 10 : Math.min(10, pageList.length * 2));

  const breakdown: AEOBreakdown = {
    answerClarity,
    questionCoverage,
    contentStructure,
    entityUnderstanding,
    semanticRelevance,
    structuredData,
    topicDepth,
  };

  const answerReadiness = calculateAnswerReadinessScore(breakdown);

  // -------------------------------------------------------------
  // 5. REGISTER AEO OPPORTUNITIES INTO seo_opportunities (PHASE 11 REUSE)
  // -------------------------------------------------------------
  const aeoOpps: any[] = [];

  // Missing entity information
  if (missingEntities.length > 0) {
    const { priorityScore, priority } = calculateOpportunityPriority({
      impact: "high",
      severity: "high",
      effort: "low",
    });
    aeoOpps.push({
      website_id: websiteId,
      user_id: userId,
      type: "aeo",
      category: "entity_clarity_missing",
      title: "Missing Entity Clarity Signals",
      description: `Search engines require clear entity signals. Missing: ${missingEntities.join(", ")}.`,
      affected_page: "index.html",
      severity: "high",
      impact: "high",
      effort: "low",
      priority,
      priority_score: priorityScore,
      source: "aeo_engine",
      recommended_action: "Update Business Name, Location, and Contact Info in Local SEO & Settings.",
      action_type: "update_entity_profile",
      action_payload: { missingEntities },
      status: "new",
    });
  }

  // Missing FAQ / Question Coverage
  if (questionsDiscovered.length < 3) {
    const { priorityScore, priority } = calculateOpportunityPriority({
      impact: "medium",
      severity: "medium",
      effort: "low",
    });
    aeoOpps.push({
      website_id: websiteId,
      user_id: userId,
      type: "aeo",
      category: "aeo_missing_faq",
      title: "Low Conversational Question Coverage",
      description: "Website has fewer than 3 clear question-and-answer sections formatted for conversational search intent.",
      affected_page: "index.html",
      severity: "medium",
      impact: "medium",
      effort: "low",
      priority,
      priority_score: priorityScore,
      source: "aeo_engine",
      recommended_action: "Add an FAQ section with concise 50-word direct answer blocks under question subheadings.",
      action_type: "add_faq_section",
      action_payload: {},
      status: "new",
    });
  }

  // Missing Schema Markup for AEO
  if (!seoRow?.schema_markup) {
    const { priorityScore, priority } = calculateOpportunityPriority({
      impact: "high",
      severity: "high",
      effort: "low",
    });
    aeoOpps.push({
      website_id: websiteId,
      user_id: userId,
      type: "aeo",
      category: "aeo_missing_schema_markup",
      title: "Missing Structured Data for AI Search",
      description: "No JSON-LD schema markup found. Structured Organization/WebSite schema helps search engines interpret site entities.",
      affected_page: "index.html",
      severity: "high",
      impact: "high",
      effort: "low",
      priority,
      priority_score: priorityScore,
      source: "aeo_engine",
      recommended_action: "Generate and validate Organization/FAQPage schema markup.",
      action_type: "generate_schema",
      action_payload: {},
      status: "new",
    });
  }

  // Sequence 3 Phase 1: Factual Consistency & Citation Readiness
  const factualAudit = auditFactualConsistency(
    {
      businessName: localSeo?.business_name || website?.title,
      city: localSeo?.city,
      phone: localSeo?.phone,
    },
    pageList.map((p: any) => ({ path: p.path || "/", html_content: p.html_content || "" }))
  );

  const indexHtml = pageList.find((p: any) => p.path === "index.html")?.html_content || "";
  const citationReadiness = calculateCitationReadiness({
    businessName: localSeo?.business_name || website?.title,
    city: localSeo?.city,
    canonicalUrl: seoRow?.canonical_url,
    schemaMarkup: seoRow?.schema_markup,
    htmlContent: indexHtml,
    factualScore: factualAudit.score,
  });

  for (const conflict of factualAudit.conflicts) {
    const { priorityScore, priority } = calculateOpportunityPriority({
      impact: "high",
      severity: conflict.severity,
      effort: "low",
    });
    aeoOpps.push({
      website_id: websiteId,
      user_id: userId,
      type: "aeo",
      category: "factual_consistency",
      title: `Factual Conflict: ${conflict.field} mismatch on ${conflict.pagePath}`,
      description: conflict.description,
      affected_page: conflict.pagePath,
      severity: conflict.severity,
      impact: "high",
      effort: "low",
      priority,
      priority_score: priorityScore,
      source: "geo_engine",
      recommended_action: "Ensure uniform business details across all site pages.",
      action_type: "fix_content",
      action_payload: conflict as any,
      status: "new",
    });
  }

  // Persist discovered AEO opportunities into seo_opportunities table
  for (const opp of aeoOpps) {
    await supabase.from("seo_opportunities").upsert(opp, {
      onConflict: "website_id,category,affected_page",
      ignoreDuplicates: true,
    });
  }

  const analysisPayload: WebsiteAEOAnalysis = {
    website_id: websiteId,
    user_id: userId,
    answer_readiness_score: answerReadiness.totalScore,
    topic_coverage_score: 0, // Will be updated by topical-authority module
    aeo_breakdown: {
      ...breakdown,
      factualConsistency: factualAudit.score,
      citationReadiness: citationReadiness.score,
    } as any,
    entity_clarity: {
      ...entityClarity,
      citationReadinessLevel: citationReadiness.level,
      factualConflictsCount: factualAudit.conflicts.length,
    } as any,
    questions_discovered: questionsDiscovered,
    topic_clusters: [],
    content_gaps: [],
    last_analyzed_at: new Date().toISOString(),
  };

  return analysisPayload;
}
