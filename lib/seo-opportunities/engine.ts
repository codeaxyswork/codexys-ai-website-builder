import { calculateOpportunityPriority } from "./prioritizer";
import { SEOOpportunity } from "./types";

export interface ScanResult {
  totalScanned: number;
  newDiscovered: number;
  opportunities: SEOOpportunity[];
}

/**
 * Deterministic Opportunity Engine Scanner.
 * Evaluates existing website SEO audit data, GSC metrics, Blog Engine,
 * Internal Links, Local SEO, Monitoring events, and 3rd party integrations.
 * Consumes 0 AI credits.
 */
export async function runOpportunityScan(
  supabase: any,
  websiteId: string,
  userId: string
): Promise<ScanResult> {
  const discovered: Array<Omit<SEOOpportunity, "id" | "created_at" | "updated_at">> = [];

  // 1. Fetch Website Data & Pages
  const { data: website } = await supabase
    .from("websites")
    .select("id, title, slug, is_published, published_slug")
    .eq("id", websiteId)
    .single();

  const { data: seoData } = await supabase
    .from("website_seo")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  const { data: pages } = await supabase
    .from("website_pages")
    .select("id, path, html_content, seo_title, meta_description, focus_keywords")
    .eq("website_id", websiteId);

  // -------------------------------------------------------------
  // SCANNER MODULE 1: TECHNICAL SEO & METADATA
  // -------------------------------------------------------------
  if (seoData) {
    // Missing or weak main SEO title
    if (!seoData.seo_title || seoData.seo_title.trim().length === 0) {
      const { priorityScore, priority } = calculateOpportunityPriority({
        impact: "high",
        severity: "critical",
        effort: "low",
      });
      discovered.push({
        website_id: websiteId,
        user_id: userId,
        type: "technical_seo",
        category: "missing_seo_title",
        title: "Missing Main SEO Title",
        description: "The website home page does not have an optimized SEO title tag configured.",
        affected_page: "index.html",
        affected_keyword: null,
        severity: "critical",
        impact: "high",
        effort: "low",
        priority,
        priority_score: priorityScore,
        source: "audit",
        recommended_action: "Generate and configure a high-impact SEO title tag (50–60 characters).",
        action_type: "ai_fix_meta",
        action_payload: { field: "seo_title" },
        status: "new",
      });
    } else if (seoData.seo_title.trim().length < 20) {
      const { priorityScore, priority } = calculateOpportunityPriority({
        impact: "medium",
        severity: "medium",
        effort: "low",
      });
      discovered.push({
        website_id: websiteId,
        user_id: userId,
        type: "technical_seo",
        category: "weak_seo_title",
        title: "Weak / Short Main SEO Title",
        description: `Current title "${seoData.seo_title}" is under 20 characters and lacks search intent terms.`,
        affected_page: "index.html",
        affected_keyword: null,
        severity: "medium",
        impact: "medium",
        effort: "low",
        priority,
        priority_score: priorityScore,
        source: "audit",
        recommended_action: "Expand SEO title tag to include primary business keywords.",
        action_type: "ai_fix_meta",
        action_payload: { field: "seo_title" },
        status: "new",
      });
    }

    // Missing Meta Description
    if (!seoData.meta_description || seoData.meta_description.trim().length === 0) {
      const { priorityScore, priority } = calculateOpportunityPriority({
        impact: "high",
        severity: "high",
        effort: "low",
      });
      discovered.push({
        website_id: websiteId,
        user_id: userId,
        type: "technical_seo",
        category: "missing_meta_description",
        title: "Missing Search Meta Description",
        description: "Search engines are missing a curated snippet preview for your primary website URL.",
        affected_page: "index.html",
        affected_keyword: null,
        severity: "high",
        impact: "high",
        effort: "low",
        priority,
        priority_score: priorityScore,
        source: "audit",
        recommended_action: "Write a compelling meta description (140–160 characters) with call-to-action.",
        action_type: "ai_fix_meta",
        action_payload: { field: "meta_description" },
        status: "new",
      });
    }

    // Missing Focus Keywords
    const hasFocusKeywords = Array.isArray(seoData.focus_keywords)
      ? seoData.focus_keywords.length > 0
      : Boolean(seoData.focus_keywords && typeof seoData.focus_keywords === "string" && seoData.focus_keywords.trim().length > 0);

    if (!hasFocusKeywords) {
      const { priorityScore, priority } = calculateOpportunityPriority({
        impact: "medium",
        severity: "medium",
        effort: "low",
      });
      discovered.push({
        website_id: websiteId,
        user_id: userId,
        type: "content",
        category: "missing_focus_keywords",
        title: "No Target Focus Keywords Configured",
        description: "No primary focus keywords set to guide AI optimization and ranking tracking.",
        affected_page: "index.html",
        affected_keyword: null,
        severity: "medium",
        impact: "medium",
        effort: "low",
        priority,
        priority_score: priorityScore,
        source: "audit",
        recommended_action: "Define 3–5 core focus keywords relevant to your target audience.",
        action_type: "ai_fix_meta",
        action_payload: { field: "focus_keywords" },
        status: "new",
      });
    }

    // Missing Schema Markup
    if (!seoData.schema_markup) {
      const { priorityScore, priority } = calculateOpportunityPriority({
        impact: "medium",
        severity: "medium",
        effort: "low",
      });
      discovered.push({
        website_id: websiteId,
        user_id: userId,
        type: "technical_seo",
        category: "missing_schema_markup",
        title: "Missing JSON-LD Schema Markup",
        description: "Structured Organization/WebSite schema markup is missing from page headers.",
        affected_page: "index.html",
        affected_keyword: null,
        severity: "medium",
        impact: "medium",
        effort: "low",
        priority,
        priority_score: priorityScore,
        source: "audit",
        recommended_action: "Add validated JSON-LD schema markup for rich snippet SERP features.",
        action_type: "ai_fix_schema",
        action_payload: { schemaType: "Organization" },
        status: "new",
      });
    }
  }

  // Check subpages for missing metadata & thin content
  if (pages && Array.isArray(pages)) {
    for (const page of pages) {
      const plainText = (page.html_content || "").replace(/<[^>]+>/g, " ").trim();
      const wordCount = plainText.split(/\s+/).filter(Boolean).length;

      if (wordCount < 100 && page.path !== "index.html") {
        const { priorityScore, priority } = calculateOpportunityPriority({
          impact: "medium",
          severity: "high",
          effort: "medium",
        });
        discovered.push({
          website_id: websiteId,
          user_id: userId,
          type: "content",
          category: "thin_content_page",
          title: `Thin Content Detected on ${page.path}`,
          description: `Page ${page.path} contains only ${wordCount} words, below search engine depth guidelines.`,
          affected_page: page.path,
          affected_keyword: null,
          severity: "high",
          impact: "medium",
          effort: "medium",
          priority,
          priority_score: priorityScore,
          source: "audit",
          recommended_action: "Expand page body text with descriptive headings and FAQs.",
          action_type: "ai_expand_content",
          action_payload: { pagePath: page.path },
          status: "new",
        });
      }
    }
  }

  // -------------------------------------------------------------
  // SCANNER MODULE 2: GOOGLE SEARCH CONSOLE (GSC)
  // -------------------------------------------------------------
  const { data: gscData } = await supabase
    .from("seo_gsc_performance")
    .select("*")
    .eq("website_id", websiteId)
    .order("impressions", { ascending: false })
    .limit(20);

  if (gscData && Array.isArray(gscData) && gscData.length > 0) {
    for (const row of gscData) {
      // High Impressions but Low CTR (< 2%)
      if (row.impressions >= 100 && (row.ctr < 0.02 || row.clicks === 0)) {
        const { priorityScore, priority } = calculateOpportunityPriority({
          impact: "high",
          severity: "high",
          effort: "low",
          gscImpressions: row.impressions,
        });
        discovered.push({
          website_id: websiteId,
          user_id: userId,
          type: "gsc",
          category: "high_impression_low_ctr",
          title: `High Impressions / Low CTR Query: "${row.query}"`,
          description: `Query "${row.query}" received ${row.impressions} impressions but only ${row.clicks} clicks (${(row.ctr * 100).toFixed(1)}% CTR).`,
          affected_page: row.page || "index.html",
          affected_keyword: row.query,
          severity: "high",
          impact: "high",
          effort: "low",
          priority,
          priority_score: priorityScore,
          source: "gsc",
          recommended_action: "Optimize SERP title tag and meta description to increase click-through rate.",
          action_type: "ai_fix_meta",
          action_payload: { query: row.query, page: row.page },
          status: "new",
        });
      }
    }
  }

  // -------------------------------------------------------------
  // SCANNER MODULE 2.1: CONTENT DECAY DETECTION
  // -------------------------------------------------------------
  if (pages && Array.isArray(pages)) {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    for (const page of pages) {
      const pageUpdatedAt = (page as any).updated_at ? new Date((page as any).updated_at) : null;
      const isStale = !pageUpdatedAt || pageUpdatedAt < sixtyDaysAgo;

      // Match with GSC performance if available
      const pageGsc = gscData?.find((g: any) => g.page === page.path);
      const hasLowCtr = pageGsc ? pageGsc.ctr < 0.015 : false;

      if (isStale || hasLowCtr) {
        const { priorityScore, priority } = calculateOpportunityPriority({
          impact: "high",
          severity: "medium",
          effort: "medium",
          gscImpressions: pageGsc?.impressions || 50,
        });

        discovered.push({
          website_id: websiteId,
          user_id: userId,
          type: "content_decay",
          category: "content_decay_detected",
          title: `Content Decay Warning: ${page.path}`,
          description: `Page ${page.path} shows signs of content decay (not updated in >60 days or dropping search engagement).`,
          affected_page: page.path,
          affected_keyword: page.focus_keywords?.[0] || null,
          severity: "medium",
          impact: "high",
          effort: "medium",
          priority,
          priority_score: priorityScore,
          source: "audit",
          recommended_action: "Refresh page body content, update statistics, and insert new direct Q&A sections to restore ranking freshness.",
          action_type: "ai_expand_content",
          action_payload: { pagePath: page.path, type: "content_decay" },
          status: "new",
        });
      }
    }
  }

  // -------------------------------------------------------------
  // SCANNER MODULE 3: INTERNAL LINKING
  // -------------------------------------------------------------
  const { data: internalLinkSummary } = await supabase
    .from("website_internal_links")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  if (internalLinkSummary) {
    if (internalLinkSummary.orphan_pages_count > 0) {
      const { priorityScore, priority } = calculateOpportunityPriority({
        impact: "high",
        severity: "high",
        effort: "low",
        isOrphanPage: true,
      });
      discovered.push({
        website_id: websiteId,
        user_id: userId,
        type: "internal_linking",
        category: "orphan_pages_detected",
        title: `${internalLinkSummary.orphan_pages_count} Orphan Page(s) Found`,
        description: `Discovered ${internalLinkSummary.orphan_pages_count} published page(s) receiving zero internal inbound links.`,
        affected_page: null,
        affected_keyword: null,
        severity: "high",
        impact: "high",
        effort: "low",
        priority,
        priority_score: priorityScore,
        source: "internal_links",
        recommended_action: "Link to orphan pages from main site navigation or blog articles.",
        action_type: "apply_internal_link",
        action_payload: { orphanCount: internalLinkSummary.orphan_pages_count },
        status: "new",
      });
    }

    if (internalLinkSummary.broken_links_count > 0) {
      const { priorityScore, priority } = calculateOpportunityPriority({
        impact: "high",
        severity: "critical",
        effort: "low",
      });
      discovered.push({
        website_id: websiteId,
        user_id: userId,
        type: "internal_linking",
        category: "broken_internal_links",
        title: `${internalLinkSummary.broken_links_count} Broken Internal Link(s)`,
        description: `Found ${internalLinkSummary.broken_links_count} broken internal links leading to 404 targets.`,
        affected_page: null,
        affected_keyword: null,
        severity: "critical",
        impact: "high",
        effort: "low",
        priority,
        priority_score: priorityScore,
        source: "internal_links",
        recommended_action: "Repair broken link targets or remove broken 404 anchors.",
        action_type: "fix_broken_links",
        action_payload: { brokenCount: internalLinkSummary.broken_links_count },
        status: "new",
      });
    }
  }

  // -------------------------------------------------------------
  // SCANNER MODULE 4: LOCAL SEO
  // -------------------------------------------------------------
  const { data: localSeo } = await supabase
    .from("website_local_seo")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  if (localSeo) {
    if (!localSeo.business_name || !localSeo.city || !localSeo.phone) {
      const { priorityScore, priority } = calculateOpportunityPriority({
        impact: "medium",
        severity: "medium",
        effort: "low",
      });
      discovered.push({
        website_id: websiteId,
        user_id: userId,
        type: "local_seo",
        category: "incomplete_local_profile",
        title: "Incomplete Local Business Profile",
        description: "Local Business NAP profile (Name, Address, Phone, City) is missing key information.",
        affected_page: null,
        affected_keyword: null,
        severity: "medium",
        impact: "medium",
        effort: "low",
        priority,
        priority_score: priorityScore,
        source: "local_seo",
        recommended_action: "Complete Business Name, Phone, and City details in Local SEO Control Center.",
        action_type: "update_local_profile",
        action_payload: {},
        status: "new",
      });
    }

    if (!localSeo.has_schema) {
      const { priorityScore, priority } = calculateOpportunityPriority({
        impact: "medium",
        severity: "medium",
        effort: "low",
      });
      discovered.push({
        website_id: websiteId,
        user_id: userId,
        type: "local_seo",
        category: "missing_local_schema",
        title: "Missing LocalBusiness Schema Markup",
        description: "LocalBusiness structured data is not active to support local map pack rankings.",
        affected_page: "index.html",
        affected_keyword: null,
        severity: "medium",
        impact: "medium",
        effort: "low",
        priority,
        priority_score: priorityScore,
        source: "local_seo",
        recommended_action: "Generate and inject LocalBusiness schema markup into site header.",
        action_type: "update_local_schema",
        action_payload: {},
        status: "new",
      });
    }
  }

  // -------------------------------------------------------------
  // SCANNER MODULE 5: BLOG ENGINE & CONTENT
  // -------------------------------------------------------------
  const { data: blogPosts } = await supabase
    .from("blog_posts")
    .select("id, title, slug, status, created_at")
    .eq("website_id", websiteId);

  if (!blogPosts || blogPosts.length === 0) {
    const { priorityScore, priority } = calculateOpportunityPriority({
      impact: "high",
      severity: "medium",
      effort: "medium",
    });
    discovered.push({
      website_id: websiteId,
      user_id: userId,
      type: "blog_content",
      category: "no_blog_articles",
      title: "No SEO Blog Content Published",
      description: "Website has 0 blog articles. Regular blog content builds topical authority and organic long-tail traffic.",
      affected_page: "/blog",
      affected_keyword: null,
      severity: "medium",
      impact: "high",
      effort: "medium",
      priority,
      priority_score: priorityScore,
      source: "blog",
      recommended_action: "Generate first SEO blog article using Codeaxys Blog Engine AI.",
      action_type: "create_blog_post",
      action_payload: {},
      status: "new",
    });
  }

  // -------------------------------------------------------------
  // SCANNER MODULE 6: MONITORING EVENTS
  // -------------------------------------------------------------
  const { data: recentAlerts } = await supabase
    .from("seo_monitoring_events")
    .select("*")
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (recentAlerts && Array.isArray(recentAlerts)) {
    for (const alert of recentAlerts) {
      if (alert.severity === "critical" || alert.event_type === "seo_score_drop") {
        const { priorityScore, priority } = calculateOpportunityPriority({
          impact: "high",
          severity: "critical",
          effort: "low",
          scoreDelta: -10,
        });
        discovered.push({
          website_id: websiteId,
          user_id: userId,
          type: "monitoring",
          category: `monitoring_${alert.event_type}`,
          title: `Monitoring Alert: ${alert.title}`,
          description: alert.message || "Critical SEO monitoring alert detected.",
          affected_page: alert.affected_page || null,
          affected_keyword: null,
          severity: "critical",
          impact: "high",
          effort: "low",
          priority,
          priority_score: priorityScore,
          source: "monitoring",
          recommended_action: "Review monitoring alert details and resolve root cause.",
          action_type: "resolve_monitoring_alert",
          action_payload: { eventId: alert.id },
          status: "new",
        });
      }
    }
  }

  // -------------------------------------------------------------
  // SCANNER MODULE 7: THIRD-PARTY SEO INTEGRATIONS
  // -------------------------------------------------------------
  const { data: thirdParty } = await supabase
    .from("website_third_party_seo_integrations")
    .select("provider, status, capabilities, last_tested_at")
    .eq("website_id", websiteId);

  if (thirdParty && Array.isArray(thirdParty) && thirdParty.length > 0) {
    for (const integration of thirdParty) {
      if (integration.status === "connected") {
        const { priorityScore, priority } = calculateOpportunityPriority({
          impact: "medium",
          severity: "low",
          effort: "low",
        });
        discovered.push({
          website_id: websiteId,
          user_id: userId,
          type: "third_party",
          category: `third_party_${integration.provider}_connected`,
          title: `Connected Provider: ${integration.provider.toUpperCase()}`,
          description: `Customer-owned ${integration.provider} account is connected. Leverage backlink and competitor insights.`,
          affected_page: null,
          affected_keyword: null,
          severity: "low",
          impact: "medium",
          effort: "low",
          priority,
          priority_score: priorityScore,
          source: "third_party",
          recommended_action: `Run ${integration.provider} backlink and keyword gap report.`,
          action_type: "run_third_party_report",
          action_payload: { provider: integration.provider },
          status: "new",
        });
      }
    }
  }

  // -------------------------------------------------------------
  // SCANNER MODULE 8: GEO (GENERATIVE ENGINE OPTIMIZATION) GAPS
  // -------------------------------------------------------------
  try {
    const { runGEOAnalysis } = await import("@/lib/seo-geo/engine");
    const geoResult = await runGEOAnalysis(supabase, websiteId, userId);
    if (geoResult) {
      if (geoResult.entityClarity.score < 70) {
        const { priorityScore, priority } = calculateOpportunityPriority({
          impact: "high",
          severity: "high",
          effort: "low",
        });
        discovered.push({
          website_id: websiteId,
          user_id: userId,
          type: "geo",
          category: "geo_missing_entity_identity",
          title: "Incomplete Entity Identity",
          description: "Business name, location, or core service details are incomplete, hindering AI search understanding.",
          affected_page: "index.html",
          affected_keyword: null,
          severity: "high",
          impact: "high",
          effort: "low",
          priority,
          priority_score: priorityScore,
          source: "geo",
          recommended_action: "Update business name, city, and phone details in site settings.",
          action_type: "update_local_profile",
          action_payload: { field: "entity_identity" },
          status: "new",
        });
      }

      if (geoResult.structuredDataDepth.score < 60) {
        const { priorityScore, priority } = calculateOpportunityPriority({
          impact: "medium",
          severity: "medium",
          effort: "low",
        });
        discovered.push({
          website_id: websiteId,
          user_id: userId,
          type: "geo",
          category: "geo_incomplete_structured_graph",
          title: "Incomplete Structured Entity Graph",
          description: "Schema.org structured data graph is missing WebSite, Organization, or LocalBusiness node references.",
          affected_page: "index.html",
          affected_keyword: null,
          severity: "medium",
          impact: "medium",
          effort: "low",
          priority,
          priority_score: priorityScore,
          source: "geo",
          recommended_action: "Generate and inject full Organization and LocalBusiness schema markup into site header.",
          action_type: "update_local_schema",
          action_payload: { schemaType: "Organization" },
          status: "new",
        });
      }

      if (geoResult.citationReadiness.score < 65) {
        const { priorityScore, priority } = calculateOpportunityPriority({
          impact: "high",
          severity: "medium",
          effort: "low",
        });
        discovered.push({
          website_id: websiteId,
          user_id: userId,
          type: "geo",
          category: "geo_citation_readiness_gap",
          title: "Low Citation Readiness & Fact Consistency",
          description: "Entity facts across HTML content and Schema markup lack consistency needed for high AI citation readiness.",
          affected_page: "index.html",
          affected_keyword: null,
          severity: "medium",
          impact: "high",
          effort: "low",
          priority,
          priority_score: priorityScore,
          source: "geo",
          recommended_action: "Align NAP (Name, Address, Phone) details across all landing pages and Schema markup.",
          action_type: "update_local_profile",
          action_payload: { field: "citation_readiness" },
          status: "new",
        });
      }
    }
  } catch (geoErr) {
    // Gracefully handle missing GEO data or errors
  }

  // -------------------------------------------------------------
  // SCANNER MODULE 9: AIO (ANSWER INTELLIGENCE OPTIMIZATION) GAPS
  // -------------------------------------------------------------
  try {
    const { runAIOAnalysisEngine } = await import("@/lib/seo-aio/engine");
    const aioPayload = await runAIOAnalysisEngine(supabase, websiteId, userId);
    if (aioPayload?.aio) {
      const aio = aioPayload.aio;

      if (aio.answerReadiness.score < 70) {
        const { priorityScore, priority } = calculateOpportunityPriority({
          impact: "high",
          severity: "high",
          effort: "low",
        });
        discovered.push({
          website_id: websiteId,
          user_id: userId,
          type: "aio",
          category: "aio_missing_direct_answers",
          title: "Missing Direct Answer Snippets",
          description: "Primary landing pages lack direct Q&A answer blocks under subheadings for AI search extractability.",
          affected_page: "index.html",
          affected_keyword: null,
          severity: "high",
          impact: "high",
          effort: "low",
          priority,
          priority_score: priorityScore,
          source: "aio",
          recommended_action: "Add concise 2-sentence direct answer paragraphs directly below primary subheadings.",
          action_type: "ai_expand_content",
          action_payload: { section: "direct_answers" },
          status: "new",
        });
      }

      if (aio.questionCoverage.unanswered > 0) {
        const unansweredCount = aio.questionCoverage.unanswered;
        const topUnanswered = aio.questionCoverage.priorityQuestions?.find(
          (q) => q.status === "unanswered"
        );

        const { priorityScore, priority } = calculateOpportunityPriority({
          impact: "high",
          severity: "high",
          effort: "medium",
        });
        discovered.push({
          website_id: websiteId,
          user_id: userId,
          type: "aio",
          category: "aio_unanswered_questions",
          title: `${unansweredCount} Unanswered High-Priority Question(s)`,
          description: `Discovered ${unansweredCount} target customer question(s) without direct answers on the website${
            topUnanswered ? ` (e.g., "${topUnanswered.question}")` : ""
          }.`,
          affected_page: "index.html",
          affected_keyword: topUnanswered?.question || null,
          severity: "high",
          impact: "high",
          effort: "medium",
          priority,
          priority_score: priorityScore,
          source: "aio",
          recommended_action: "Add a structured FAQ section addressing unanswered target questions.",
          action_type: "ai_expand_content",
          action_payload: { section: "faq", targetQuestion: topUnanswered?.question },
          status: "new",
        });
      }

      if (aio.contentStructure.score < 60) {
        const { priorityScore, priority } = calculateOpportunityPriority({
          impact: "medium",
          severity: "medium",
          effort: "low",
        });
        discovered.push({
          website_id: websiteId,
          user_id: userId,
          type: "aio",
          category: "aio_weak_content_structure",
          title: "Weak AI Search Content Structure",
          description: "HTML pages are missing semantic tags or clean heading hierarchy required for AI snippet parsing.",
          affected_page: "index.html",
          affected_keyword: null,
          severity: "medium",
          impact: "medium",
          effort: "low",
          priority,
          priority_score: priorityScore,
          source: "aio",
          recommended_action: "Structure content using semantic HTML tags and hierarchical H1/H2 headings.",
          action_type: "ai_fix_meta",
          action_payload: { field: "content_structure" },
          status: "new",
        });
      }
    }
  } catch (aioErr) {
    // Gracefully handle missing AIO data or errors
  }

  // -------------------------------------------------------------
  // PERSIST DISCOVERED OPPORTUNITIES (DEDUPLICATING CONFLICTS)
  // -------------------------------------------------------------
  let insertedCount = 0;
  for (const item of discovered) {
    const { error } = await supabase
      .from("seo_opportunities")
      .upsert(item, {
        onConflict: "website_id,category,affected_page",
        ignoreDuplicates: true,
      });

    if (!error) {
      insertedCount++;
    }
  }

  // Fetch all current open/active opportunities for return
  const { data: finalOpps } = await supabase
    .from("seo_opportunities")
    .select("*")
    .eq("website_id", websiteId)
    .order("priority_score", { ascending: false });

  return {
    totalScanned: discovered.length,
    newDiscovered: insertedCount,
    opportunities: (finalOpps as SEOOpportunity[]) || [],
  };
}
