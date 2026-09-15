import { GoogleGenAI } from "@google/genai";
import { getGeminiConfig } from "./gemini";

export interface SEOAgentContext {
  website: {
    title: string;
    publishedUrl: string | null;
    prompt: string | null;
  };
  seoHealth: {
    seoScore: number | null;
    analysisStatus: string | null;
    lastAnalyzedAt: string | null;
    isDirty: boolean;
  };
  issueSummary: {
    criticalCount: number;
    warningCount: number;
    opportunityCount: number;
    passedCount: number;
    categories: Array<{ name: string; score: number; status: string }>;
  };
  topIssues: Array<{ title: string; severity: string; details: string }>;
  pageHealth: {
    totalPages: number;
    healthyPages: number;
    criticalPages: number;
    orphanedPages: number;
  };
  history: Array<{ seoScore: number; triggerType: string; createdAt: string }>;
  gsc: {
    connected: boolean;
    propertyUrl: string | null;
    totals: { clicks: number; impressions: number; ctr: number; position: number } | null;
    topQueries: Array<{ query: string; clicks: number; impressions: number; position: number }>;
  };
  blogSummary: {
    totalPosts: number;
    publishedPosts: number;
    draftPosts: number;
    latestPosts: Array<{ title: string; slug: string; status: string }>;
  };
  internalLinkSummary: {
    internalLinkScore: number | null;
    totalInternalLinks: number;
    orphanPagesCount: number;
    weaklyLinkedCount: number;
    brokenLinksCount: number;
    topOpportunities: Array<{ sourcePath: string; destinationPath: string; suggestedAnchor: string; reason: string }>;
  };
  localSeoSummary: {
    localSeoScore: number | null;
    businessName: string | null;
    businessType: string | null;
    city: string | null;
    phone: string | null;
    napDetails: string | null;
    hasSchema: boolean;
    gbpConfigured: boolean;
    topIssuesCount: number;
  };
  monitoringSummary: {
    enabled: boolean;
    frequency: string;
    lastRunAt: string | null;
    nextRunAt: string | null;
    failureCount: number;
    recentAlerts: Array<{
      eventType: string;
      severity: string;
      title: string;
      message: string;
      previousValue: string | null;
      currentValue: string | null;
      affectedPage: string | null;
      createdAt: string;
    }>;
  };
}

/**
 * Builds a bounded, website-specific SEO context payload from existing database records.
 * Limits query sizes to ensure context remains lightweight and scalable.
 */
export async function buildSEOContext(supabase: any, websiteId: string): Promise<SEOAgentContext> {
  // 1. Fetch Website Metadata
  const { data: website } = await supabase
    .from("websites")
    .select("title, published_slug, prompt")
    .eq("id", websiteId)
    .single();

  const publishedUrl = website?.published_slug
    ? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost:3000"}/site/${website.published_slug}`
    : null;

  // 2. Fetch website_seo
  const { data: seoRow } = await supabase
    .from("website_seo")
    .select("seo_score, analysis_status, last_analyzed_at, is_dirty, seo_analysis")
    .eq("website_id", websiteId)
    .single();

  const analysis = seoRow?.seo_analysis || {};
  let criticalCount = 0;
  let warningCount = 0;
  let opportunityCount = 0;
  let passedCount = 0;
  const topIssues: Array<{ title: string; severity: string; details: string }> = [];

  const categories: Array<{ name: string; score: number; status: string }> = [];

  if (analysis && Object.keys(analysis).length > 0) {
    Object.entries(analysis).forEach(([key, item]: [string, any]) => {
      if (!item || typeof item.max !== "number" || item.max <= 0) return;
      const pct = (item.score / item.max) * 100;
      if (pct === 100) {
        passedCount++;
      } else if (pct >= 60) {
        warningCount++;
        topIssues.push({
          title: `Optimize ${key.replace("_", " ")}`,
          severity: "warning",
          details: item.details || `${key} can be further optimized.`,
        });
      } else {
        criticalCount++;
        topIssues.push({
          title: `Fix ${key.replace("_", " ")}`,
          severity: "critical",
          details: item.details || `${key} requires critical SEO attention.`,
        });
      }
    });

    if (analysis.open_graph?.score < analysis.open_graph?.max) opportunityCount++;
    if (analysis.schema?.score < analysis.schema?.max) opportunityCount++;

    // Category breakdown
    const a = analysis;
    const organicEarned = (a.title?.score || 0) + (a.description?.score || 0) + (a.headings?.score || 0);
    const organicScore = Math.round((organicEarned / 50) * 100);
    categories.push({ name: "Organic & On-Page SEO", score: organicScore, status: organicScore >= 80 ? "Optimal" : organicScore >= 50 ? "Needs Improvement" : "Critical" });

    const techEarned = (a.technical?.score || 0) + (a.canonical?.score || 0) + (a.robots?.score || 0);
    const techScore = Math.round((techEarned / 20) * 100);
    categories.push({ name: "Technical SEO & Indexing", score: techScore, status: techScore >= 80 ? "Optimal" : techScore >= 50 ? "Needs Improvement" : "Critical" });

    const contentEarned = (a.schema?.score || 0) + (a.images?.score || 0);
    const contentScore = Math.round((contentEarned / 20) * 100);
    categories.push({ name: "Content & Structured Data", score: contentScore, status: contentScore >= 80 ? "Optimal" : contentScore >= 50 ? "Needs Improvement" : "Critical" });

    const ogEarned = a.open_graph?.score || 0;
    const ogScore = Math.round((ogEarned / 10) * 100);
    categories.push({ name: "Open Graph & Social Sharing", score: ogScore, status: ogScore >= 80 ? "Optimal" : ogScore >= 50 ? "Needs Improvement" : "Critical" });
  }

  // 3. Fetch Page Health Summary (website_page_seo)
  const { data: pageSeoRows } = await supabase
    .from("website_page_seo")
    .select("seo_score, critical_issues_count, is_orphaned")
    .eq("website_id", websiteId);

  const pagesList = pageSeoRows || [];
  const totalPages = pagesList.length;
  const healthyPages = pagesList.filter((p: any) => (p.seo_score || 0) >= 80).length;
  const criticalPages = pagesList.filter((p: any) => (p.critical_issues_count || 0) > 0).length;
  const orphanedPages = pagesList.filter((p: any) => p.is_orphaned).length;

  // 4. Fetch Analysis History (limited to top 5)
  const { data: historyRows } = await supabase
    .from("seo_analysis_history")
    .select("seo_score, trigger_type, created_at")
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false })
    .limit(5);

  const history = (historyRows || []).map((h: any) => ({
    seoScore: h.seo_score,
    triggerType: h.trigger_type,
    createdAt: h.created_at,
  }));

  // 5. Fetch GSC Integration & Performance Context
  const { data: integration } = await supabase
    .from("seo_integrations")
    .select("status, selected_property_url")
    .eq("website_id", websiteId)
    .eq("provider", "google_search_console")
    .maybeSingle();

  const isGscConnected = integration?.status === "connected" && !!integration?.selected_property_url;
  let gscTotals: { clicks: number; impressions: number; ctr: number; position: number } | null = null;
  let topQueries: Array<{ query: string; clicks: number; impressions: number; position: number }> = [];

  if (isGscConnected) {
    const { data: analyticsRows } = await supabase
      .from("gsc_search_analytics")
      .select("query, clicks, impressions, ctr, position")
      .eq("website_id", websiteId)
      .order("clicks", { ascending: false })
      .limit(10);

    if (analyticsRows && analyticsRows.length > 0) {
      let totalClicks = 0;
      let totalImpressions = 0;
      let sumCtr = 0;
      let sumPosition = 0;

      analyticsRows.forEach((r: any) => {
        totalClicks += r.clicks || 0;
        totalImpressions += r.impressions || 0;
        sumCtr += r.ctr || 0;
        sumPosition += r.position || 0;
      });

      gscTotals = {
        clicks: totalClicks,
        impressions: totalImpressions,
        ctr: analyticsRows.length > 0 ? Number((sumCtr / analyticsRows.length).toFixed(2)) : 0,
        position: analyticsRows.length > 0 ? Number((sumPosition / analyticsRows.length).toFixed(1)) : 0,
      };

      topQueries = analyticsRows.map((r: any) => ({
        query: r.query,
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        position: r.position ? Number(r.position.toFixed(1)) : 0,
      }));
    }
  }

  // 6. Fetch Blog Summary (blog_posts)
  const { data: blogRows } = await supabase
    .from("blog_posts")
    .select("title, slug, status, created_at")
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false });

  const blogList = blogRows || [];
  const totalBlogPosts = blogList.length;
  const publishedBlogPosts = blogList.filter((b: any) => b.status === "published").length;
  const draftBlogPosts = blogList.filter((b: any) => b.status === "draft").length;
  const latestBlogPosts = blogList.slice(0, 5).map((b: any) => ({
    title: b.title,
    slug: b.slug,
    status: b.status,
  }));

  // 7. Fetch Internal Links Summary (website_internal_links)
  const { data: linkRow } = await supabase
    .from("website_internal_links")
    .select("internal_link_score, summary, opportunities")
    .eq("website_id", websiteId)
    .maybeSingle();

  const internalLinkScore = linkRow?.internal_link_score ?? null;
  const linkSummary = linkRow?.summary || {};
  const linkOpps = (linkRow?.opportunities || []).slice(0, 5).map((o: any) => ({
    sourcePath: o.sourcePath,
    destinationPath: o.destinationPath,
    suggestedAnchor: o.suggestedAnchor,
    reason: o.reason,
  }));

  // 8. Fetch Local SEO Summary (website_local_seo)
  const { data: localRow } = await supabase
    .from("website_local_seo")
    .select("business_name, business_type, city, phone, local_seo_score, analysis_result, gbp_profile_url")
    .eq("website_id", websiteId)
    .maybeSingle();

  const localRes = localRow?.analysis_result || {};
  const localIssues = localRes.issues || [];

  // 9. Fetch Monitoring Summary & Recent Events (website_monitoring_schedules & seo_monitoring_events)
  const { data: schedRow } = await supabase
    .from("website_monitoring_schedules")
    .select("enabled, frequency, last_run_at, next_run_at, failure_count")
    .eq("website_id", websiteId)
    .maybeSingle();

  const { data: eventRows } = await supabase
    .from("seo_monitoring_events")
    .select("event_type, severity, title, message, previous_value, current_value, affected_page, created_at")
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false })
    .limit(5);

  const recentAlerts = (eventRows || []).map((e: any) => ({
    eventType: e.event_type,
    severity: e.severity,
    title: e.title,
    message: e.message,
    previousValue: e.previous_value || null,
    currentValue: e.current_value || null,
    affectedPage: e.affected_page || null,
    createdAt: e.created_at,
  }));

  return {
    website: {
      title: website?.title || "Untitled Website",
      publishedUrl,
      prompt: website?.prompt || null,
    },
    seoHealth: {
      seoScore: seoRow?.seo_score ?? null,
      analysisStatus: seoRow?.analysis_status ?? null,
      lastAnalyzedAt: seoRow?.last_analyzed_at ?? null,
      isDirty: !!seoRow?.is_dirty,
    },
    issueSummary: {
      criticalCount,
      warningCount,
      opportunityCount,
      passedCount,
      categories,
    },
    topIssues: topIssues.slice(0, 10),
    pageHealth: {
      totalPages,
      healthyPages,
      criticalPages,
      orphanedPages,
    },
    history,
    gsc: {
      connected: isGscConnected,
      propertyUrl: integration?.selected_property_url || null,
      totals: gscTotals,
      topQueries,
    },
    blogSummary: {
      totalPosts: totalBlogPosts,
      publishedPosts: publishedBlogPosts,
      draftPosts: draftBlogPosts,
      latestPosts: latestBlogPosts,
    },
    internalLinkSummary: {
      internalLinkScore,
      totalInternalLinks: linkSummary.total_internal_links || 0,
      orphanPagesCount: linkSummary.orphan_pages_count || 0,
      weaklyLinkedCount: linkSummary.weakly_linked_count || 0,
      brokenLinksCount: linkSummary.broken_links_count || 0,
      topOpportunities: linkOpps,
    },
    localSeoSummary: {
      localSeoScore: localRow?.local_seo_score ?? null,
      businessName: localRow?.business_name || null,
      businessType: localRow?.business_type || null,
      city: localRow?.city || null,
      phone: localRow?.phone || null,
      napDetails: localRes.nap_health?.details || null,
      hasSchema: !!localRes.schema_markup,
      gbpConfigured: !!(localRow?.gbp_profile_url && localRow.gbp_profile_url.startsWith("http")),
      topIssuesCount: localIssues.length,
    },
    monitoringSummary: {
      enabled: schedRow?.enabled ?? true,
      frequency: schedRow?.frequency || "weekly",
      lastRunAt: schedRow?.last_run_at || null,
      nextRunAt: schedRow?.next_run_at || null,
      failureCount: schedRow?.failure_count || 0,
      recentAlerts,
    },
  };
}

export interface StructuredSEOFix {
  issueType: "seo_title" | "meta_description" | "focus_keywords" | "og_title" | "og_description" | "alt_text" | "canonical_url" | "robots_config" | "heading_structure";
  pagePath?: string;
  currentValue?: string;
  recommendedValue: string;
  reason: string;
  severity?: "critical" | "warning" | "opportunity";
  instruction: string;
}

export interface SEOAgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SEOAgentResponsePayload {
  message: string;
  suggestedActions?: string[];
  navigationTarget?: "overview" | "performance" | "monitoring" | "organic" | "technical" | "internal-links" | "local-seo" | "blog" | "pages" | "keywords" | "integrations" | "settings";
  proposedFix?: StructuredSEOFix | null;
}

/**
 * Invokes Gemini process to generate an intelligent SEO Specialist response.
 */
export async function generateSEOAgentResponse(params: {
  userPrompt: string;
  seoContext: SEOAgentContext;
  conversationHistory?: SEOAgentMessage[];
}): Promise<SEOAgentResponsePayload> {
  const { apiKey, model } = getGeminiConfig();
  const ai = new GoogleGenAI({ apiKey });

  const systemPrompt = `You are the Codeaxys AI SEO Specialist — a highly skilled, objective, and customer-friendly SEO Intelligence Agent.
Your role is to analyze the provided website's REAL SEO data, explain search engine health, interpret Search Console traffic, prioritize improvements, provide local SEO & content strategy guidance, and answer user questions.

CRITICAL RULES & SAFETY BOUNDARIES:
1. DATA TRUTH: Base all answers strictly on the provided real website SEO context (including website health, Search Console analytics, blogSummary, internalLinkSummary, and localSeoSummary data). Do NOT invent fake scores, fake clicks, fake rankings, or fake search queries.
2. MISSING DATA HANDLING: If Search Console is disconnected or has no data, explicitly state that Search Console data is unavailable and recommend connecting it in the Integrations tab. If page-level audits are empty, state that page indexing is needed.
3. LOCAL SEO & MONITORING ALERTS: You understand NAP consistency, LocalBusiness JSON-LD schema, local keyword signals, and background monitoring alerts. Use monitoringSummary data to answer questions like "What changed recently?", "Why did my score drop?", or "Did my local SEO improve?".
4. NO RANKING GUARANTEES: NEVER say "You will rank #1", "Guaranteed first page", or "Traffic will increase by X%". Use accurate, non-overpromising phrasing such as "This can improve technical search signals" or "This helps search engines better understand your page content."
5. ADVISORY ONLY: You are providing advice and recommendations. You do NOT apply fixes directly to the website. Never claim that a fix has already been applied.
6. MULTILINGUAL SUPPORT: Respond in the user's conversation language (including English, Malayalam, Manglish, or code-switching) while keeping core technical SEO terms clear.
7. NAVIGATION ADVICE: When recommending where a user should fix an issue or manage content, suggest the exact tab destination: "overview", "performance", "monitoring", "organic", "technical", "internal-links", "local-seo", "blog", "pages", "keywords", "integrations", or "settings".
8. DETERMINISTIC FIX PROPOSALS: When you identify a specific SEO issue that can be fixed deterministically (e.g. SEO title, meta description, focus keywords, OG title, OG description, canonical URL, robots settings, or image alt text), include a "proposedFix" object in your JSON output. If no specific fix applies, set "proposedFix" to null.

OUTPUT FORMAT:
Return strictly a single JSON object with no markdown fences, no wrapping, matching this shape:
{
  "message": "Detailed, friendly, customer-focused markdown response answering the question, explaining reasoning, and giving prioritized action steps.",
  "suggestedActions": ["Actionable tip 1", "Actionable tip 2"],
  "navigationTarget": "monitoring", // (optional target tab: "overview" | "performance" | "monitoring" | "organic" | "technical" | "internal-links" | "local-seo" | "blog" | "pages" | "keywords" | "integrations" | "settings")
  "proposedFix": { // (optional proposed fix object if a specific fix can be applied)
    "issueType": "seo_title", // "seo_title" | "meta_description" | "focus_keywords" | "og_title" | "og_description" | "alt_text" | "canonical_url" | "robots_config" | "heading_structure"
    "pagePath": "index.html",
    "currentValue": "Current title or copy",
    "recommendedValue": "Recommended title or copy",
    "reason": "This improves search engine understanding of homepage focus keywords.",
    "severity": "critical", // "critical" | "warning" | "opportunity"
    "instruction": "Update SEO title to recommended value"
  }
}`;

  const historyText = (params.conversationHistory || [])
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Customer" : "SEO Agent"}: ${m.content}`)
    .join("\n\n");

  const promptText = `
=== LIVE WEBSITE SEO CONTEXT ===
${JSON.stringify(params.seoContext, null, 2)}

${historyText ? `=== RECENT CONVERSATION HISTORY ===\n${historyText}\n` : ""}

=== CUSTOMER QUESTION ===
${params.userPrompt}
`;

  const candidateModels = Array.from(new Set([model || "gemini-3.6-flash", "gemini-3.6-flash", "gemini-3.5-flash"]));

  let lastError: Error | null = null;
  for (const targetModel of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\n${promptText}` }] },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      const rawText = response.text || "";
      const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      return {
        message: parsed.message || rawText || "I have analyzed your website SEO context.",
        suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [],
        navigationTarget: parsed.navigationTarget || undefined,
        proposedFix: parsed.proposedFix || null,
      };
    } catch (err: any) {
      console.warn(`SEO Agent Gemini model ${targetModel} failed:`, err?.message || err);
      lastError = err;
    }
  }

  throw new Error(lastError?.message || "Failed to generate response from SEO AI Agent.");
}
