import { createAdminClient } from "../marketing/meta-client";
import { buildMarketingBusinessContext, MarketingBusinessContext } from "../marketing/business-context";
import { buildSEOContext, SEOAgentContext } from "../seo-agent";
import { UnifiedRoutingResult, UnifiedDomain } from "./unified-conversation-core";
import { getGeminiConfig } from "../gemini";
import { GoogleGenAI } from "@google/genai";
import { sanitizeGeminiContents } from "../assistant-gemini";

export interface UnifiedWebsiteContext {
  id: string;
  title: string;
  domain: string | null;
  isPublished: boolean;
  publishedUrl: string | null;
  totalPages: number;
  creationType: string;
  pages: Array<{ id: string; path: string; title: string; metaDescription?: string }>;
}

export interface UnifiedSEOContext {
  seoScore: number | null;
  status: string | null;
  topIssues: Array<{ title: string; severity: string; details?: string }>;
  issueSummary: { criticalCount: number; warningCount: number; opportunityCount: number; passedCount: number };
  topQueries: Array<{ query: string; clicks: number; impressions: number; position: number }>;
  localSeoScore: number | null;
  gscConnected: boolean;
  opportunitiesCount: number;
}

export interface UnifiedMarketingContext {
  businessName: string;
  category: string;
  selectedAccount: { id: string; name: string } | null;
  selectedPage: { id: string; name: string } | null;
  campaignDraft: { id: string; objective: string; dailyBudget: number; durationDays: number; status: string } | null;
  recentLeads: { totalCount: number; recent: Array<{ id: string; name: string; email: string; createdAt: string }> } | null;
  analytics: { spend: number; impressions: number; clicks: number; ctr: number; leads: number; cpl: number } | null;
  optimizations: { pendingCount: number; latestRecommendation: string | null } | null;
}

export interface CapabilityIndex {
  websiteCapabilities: string[];
  seoCapabilities: string[];
  marketingCapabilities: string[];
  generalCapabilities: string[];
}

export interface UnifiedContextPayload {
  websiteContext: UnifiedWebsiteContext | null;
  seoContext: UnifiedSEOContext | null;
  marketingContext: UnifiedMarketingContext | null;
  capabilityIndex: CapabilityIndex | null;
  activeDomain: UnifiedDomain;
  activeRoute: string;
  loadedDomains: string[];
}

export interface OrchestratedAgentResponse {
  message: string;
  suggestedActions: string[];
  routingResult: UnifiedRoutingResult;
  loadedContextDomains: string[];
  navigationTarget?: "marketing" | "seo" | "pages" | "editor" | "general";
}

/**
 * Static metadata catalog of existing Codeaxys AI capabilities.
 * Supplied to Gemini for zero-DB general capability & cross-agent questions.
 */
export function getCapabilityIndex(): CapabilityIndex {
  return {
    websiteCapabilities: [
      "AI website generation from natural language business descriptions",
      "Real-time visual section editing (hero, headers, footers, typography, colors)",
      "Automated WordPress site migration & full site import",
      "Migration + Redesign modernizer",
      "Custom domain linking & SSL publishing",
      "Multi-page layout engine & responsive previews",
    ],
    seoCapabilities: [
      "Automated Technical SEO crawler & health audit",
      "AEO (AI Engine Optimization for Perplexity, ChatGPT & Claude discovery)",
      "GEO (Generative Engine Optimization) & AIO (AI Overview Optimization)",
      "Google Search Console (GSC) live integration & search performance tracking",
      "Local SEO schema generator & GBP (Google Business Profile) audit",
      "Automated internal link graph optimizer & topic authority scoring",
      "Dedicated SEO Autopilot with explicit fix approval boundaries",
    ],
    marketingCapabilities: [
      "Conversational Meta Ads (Facebook & Instagram) campaign planner",
      "Ad copy & creative concept generation tailored to business context",
      "Automated target audience & geo-location recommendation",
      "Meta OAuth integration for direct Ad Account & Facebook Page discovery",
      "Lead generation forms & landing page mapping",
      "Campaign draft review & explicit Approve & Launch safety controls",
      "Lead management dashboard & lead capture tracking",
      "Ad performance analytics & budget optimization suggestions",
    ],
    generalCapabilities: [
      "Unified Gemini conversational intelligence across all agents",
      "Multi-turn context retention & entity resolution",
      "Multilingual support (English, Malayalam, Manglish, mixed language)",
      "Cross-agent capability awareness and navigation guidance",
      "Deterministic security, permission boundaries, and user approval safety",
    ],
  };
}

/**
 * Unified Context Orchestrator
 * Selective, route-aware data loading from existing Codeaxys database tables.
 */
export async function getUnifiedContext({
  websiteId,
  userId,
  routingResult,
  supabase,
  history = [],
}: {
  websiteId: string;
  userId?: string;
  routingResult: UnifiedRoutingResult;
  supabase?: any;
  history?: any[];
}): Promise<UnifiedContextPayload> {
  const db = supabase || createAdminClient();
  const domain = routingResult.domain;
  const route = routingResult.route;
  const loadedDomains: string[] = [];

  let websiteContext: UnifiedWebsiteContext | null = null;
  let seoContext: UnifiedSEOContext | null = null;
  let marketingContext: UnifiedMarketingContext | null = null;
  let capabilityIndex: CapabilityIndex | null = null;

  // Always populate Capability Index for general, capability questions, or cross-agent routing
  if (
    domain === "general" ||
    route.includes("capability") ||
    route.includes("product") ||
    routingResult.requiresClarification
  ) {
    capabilityIndex = getCapabilityIndex();
    loadedDomains.push("capabilities");
  }

  // 1. WEBSITE CONTEXT (Selective loading for website domain or website-specific routes)
  if (domain === "website" || route.startsWith("website_")) {
    try {
      const [{ data: webRow }, { data: pageRows }] = await Promise.all([
        db
          .from("websites")
          .select("id, title, domain, is_published, published_url, total_pages, creation_type")
          .eq("id", websiteId)
          .single(),
        db
          .from("website_pages")
          .select("id, path, title, meta_description")
          .eq("website_id", websiteId)
          .limit(10),
      ]);

      if (webRow) {
        websiteContext = {
          id: webRow.id,
          title: webRow.title || "My Codeaxys Website",
          domain: webRow.domain || null,
          isPublished: Boolean(webRow.is_published),
          publishedUrl: webRow.published_url || null,
          totalPages: webRow.total_pages || (pageRows ? pageRows.length : 1),
          creationType: webRow.creation_type || "new",
          pages: (pageRows || []).map((p: any) => ({
            id: p.id,
            path: p.path,
            title: p.title,
            metaDescription: p.meta_description || undefined,
          })),
        };
      } else {
        websiteContext = {
          id: websiteId,
          title: "My Codeaxys Website",
          domain: null,
          isPublished: false,
          publishedUrl: null,
          totalPages: 1,
          creationType: "new",
          pages: [{ id: "p1", path: "/", title: "Home" }],
        };
      }
      loadedDomains.push("website");
    } catch (err) {
      console.warn("Unified Context Orchestrator: website fetch error", err);
      websiteContext = {
        id: websiteId,
        title: "My Codeaxys Website",
        domain: null,
        isPublished: false,
        publishedUrl: null,
        totalPages: 1,
        creationType: "new",
        pages: [],
      };
      loadedDomains.push("website");
    }
  }

  // 2. SEO CONTEXT (Selective loading for SEO domain or SEO routes)
  if (domain === "seo" || route.startsWith("seo_")) {
    try {
      const fullSeoContext: SEOAgentContext = await buildSEOContext(db, websiteId).catch(() => ({
        website: { title: "Website", publishedUrl: null, prompt: null },
        seoHealth: { seoScore: 70, analysisStatus: "completed", lastAnalyzedAt: null, isDirty: false },
        issueSummary: { criticalCount: 0, warningCount: 0, opportunityCount: 0, passedCount: 0, categories: [] },
        topIssues: [],
        pageHealth: { totalPages: 1, healthyPages: 1, criticalPages: 0, orphanedPages: 0 },
        history: [],
        gsc: { connected: false, propertyUrl: null, totals: null, topQueries: [] },
        blogSummary: { totalPosts: 0, publishedPosts: 0, draftPosts: 0, latestPosts: [] },
        internalLinkSummary: { internalLinkScore: null, totalInternalLinks: 0, orphanPagesCount: 0, weaklyLinkedCount: 0, brokenLinksCount: 0, topOpportunities: [] },
        localSeoSummary: { localSeoScore: null, businessName: null, businessType: null, city: null, phone: null, napDetails: null, hasSchema: false, gbpConfigured: false, topIssuesCount: 0 },
        monitoringSummary: { enabled: false, frequency: "weekly", lastRunAt: null, nextRunAt: null, failureCount: 0, recentAlerts: [] },
        thirdPartyIntegrations: [],
      }));

      seoContext = {
        seoScore: fullSeoContext.seoHealth?.seoScore ?? null,
        status: fullSeoContext.seoHealth?.analysisStatus || "ready",
        topIssues: (fullSeoContext.topIssues || []).slice(0, 5).map((i) => ({
          title: i.title,
          severity: i.severity,
          details: i.details,
        })),
        issueSummary: {
          criticalCount: fullSeoContext.issueSummary?.criticalCount || 0,
          warningCount: fullSeoContext.issueSummary?.warningCount || 0,
          opportunityCount: fullSeoContext.issueSummary?.opportunityCount || 0,
          passedCount: fullSeoContext.issueSummary?.passedCount || 0,
        },
        topQueries: (fullSeoContext.gsc?.topQueries || []).slice(0, 5),
        localSeoScore: fullSeoContext.localSeoSummary?.localSeoScore ?? null,
        gscConnected: Boolean(fullSeoContext.gsc?.connected),
        opportunitiesCount: fullSeoContext.opportunitySummary?.total || 0,
      };
      loadedDomains.push("seo");
    } catch (err) {
      console.warn("Unified Context Orchestrator: SEO fetch error", err);
      seoContext = {
        seoScore: 75,
        status: "ready",
        topIssues: [],
        issueSummary: { criticalCount: 0, warningCount: 0, opportunityCount: 0, passedCount: 0 },
        topQueries: [],
        localSeoScore: null,
        gscConnected: false,
        opportunitiesCount: 0,
      };
      loadedDomains.push("seo");
    }
  }

  // 3. MARKETING CONTEXT (Selective loading for Marketing domain or Marketing routes)
  if (domain === "marketing" || route.startsWith("marketing_") || route === "campaign_planning" || route === "leads" || route === "analytics" || route === "optimization") {
    try {
      const mktBusiness: MarketingBusinessContext = await buildMarketingBusinessContext(db, websiteId).catch(() => ({
        websiteId,
        userId: userId || "",
        business: { name: "Business", category: "General", description: "", location: { address: null, city: null, state: null, country: null, postalCode: null }, contact: { phone: null, email: null, openingHours: null }, services: [], products: [], pricingInfo: [], offers: [] },
        website: { title: "Website", domain: null, isPublished: false, publishedUrl: null, totalPages: 1, creationType: "new" },
        pages: [],
        seo: { seoTitle: null, metaDescription: null, focusKeywords: [], topSearchQueries: [] },
        localSeo: { localSeoScore: null, gbpProfileUrl: null },
        brand: { logoUrl: null, primaryColor: null, featuredImages: [] },
      }));

      // Concurrently query marketing specific tables depending on route safely
      let accountRow: any = null;
      let pageRow: any = null;
      let draftRow: any = null;
      let leadRows: any[] = [];
      let leadCount: number = 0;
      let insightRows: any[] = [];
      let recRows: any[] = [];

      try {
        const [aRes, pRes, dRes, lRes, iRes, rRes] = await Promise.all([
          db.from("marketing_ad_accounts").select("account_id, name").eq("website_id", websiteId).eq("is_selected", true).maybeSingle().catch(() => ({ data: null })),
          db.from("marketing_pages").select("page_id, name").eq("website_id", websiteId).eq("is_selected", true).maybeSingle().catch(() => ({ data: null })),
          db.from("marketing_campaign_drafts").select("id, objective, daily_budget, duration_days, status").eq("website_id", websiteId).order("created_at", { ascending: false }).limit(1).maybeSingle().catch(() => ({ data: null })),
          db.from("marketing_leads").select("id, full_name, email, created_at", { count: "exact" }).eq("website_id", websiteId).order("created_at", { ascending: false }).limit(5).catch(() => ({ data: [], count: 0 })),
          db.from("marketing_insights").select("spend, impressions, clicks, ctr, leads, cpl").eq("website_id", websiteId).limit(1).catch(() => ({ data: [] })),
          db.from("marketing_optimization_recommendations").select("id, title, status").eq("website_id", websiteId).eq("status", "PENDING").limit(5).catch(() => ({ data: [] })),
        ]);
        accountRow = aRes?.data || null;
        pageRow = pRes?.data || null;
        draftRow = dRes?.data || null;
        leadRows = lRes?.data || [];
        leadCount = lRes?.count || leadRows.length;
        insightRows = iRes?.data || [];
        recRows = rRes?.data || [];
      } catch (e) {}

      marketingContext = {
        businessName: mktBusiness.business.name || "My Business",
        category: mktBusiness.business.category || "General Business",
        selectedAccount: accountRow ? { id: accountRow.account_id, name: accountRow.name } : null,
        selectedPage: pageRow ? { id: pageRow.page_id, name: pageRow.name } : null,
        campaignDraft: draftRow
          ? {
              id: draftRow.id,
              objective: draftRow.objective,
              dailyBudget: draftRow.daily_budget,
              durationDays: draftRow.duration_days,
              status: draftRow.status,
            }
          : null,
        recentLeads: {
          totalCount: leadCount,
          recent: (leadRows || []).map((l: any) => ({
            id: l.id,
            name: l.full_name || "Lead",
            email: l.email || "",
            createdAt: l.created_at,
          })),
        },
        analytics: insightRows && insightRows.length > 0
          ? {
              spend: Number(insightRows[0].spend || 0),
              impressions: Number(insightRows[0].impressions || 0),
              clicks: Number(insightRows[0].clicks || 0),
              ctr: Number(insightRows[0].ctr || 0),
              leads: Number(insightRows[0].leads || 0),
              cpl: Number(insightRows[0].cpl || 0),
            }
          : null,
        optimizations: {
          pendingCount: recRows ? recRows.length : 0,
          latestRecommendation: recRows && recRows.length > 0 ? recRows[0].title : null,
        },
      };
      loadedDomains.push("marketing");
    } catch (err) {
      console.warn("Unified Context Orchestrator: Marketing fetch error", err);
      marketingContext = {
        businessName: "My Business",
        category: "General Business",
        selectedAccount: null,
        selectedPage: null,
        campaignDraft: null,
        recentLeads: { totalCount: 0, recent: [] },
        analytics: null,
        optimizations: { pendingCount: 0, latestRecommendation: null },
      };
      loadedDomains.push("marketing");
    }
  }

  return {
    websiteContext,
    seoContext,
    marketingContext,
    capabilityIndex,
    activeDomain: domain,
    activeRoute: route,
    loadedDomains,
  };
}

/**
 * Executes a Gemini context-aware response using Phase A routing + Phase B context payload.
 */
export async function generateOrchestratedAgentReply({
  websiteId,
  userId,
  userPrompt,
  history = [],
  activeMode = "general",
  routingResult,
  supabase,
}: {
  websiteId: string;
  userId?: string;
  userPrompt: string;
  history?: any[];
  activeMode: UnifiedDomain;
  routingResult: UnifiedRoutingResult;
  supabase?: any;
}): Promise<OrchestratedAgentResponse> {
  // 1. Fetch compact, route-aware context via Phase B Orchestrator
  const contextPayload = await getUnifiedContext({
    websiteId,
    userId,
    routingResult,
    supabase,
    history,
  });

  // 2. Prepare System Prompt for Gemini with strict anti-fabrication rules
  const systemPrompt = `You are Codeaxys AI — an intelligent, context-aware digital assistant for website building, SEO optimization, and Meta/Google ad marketing.

CURRENT ACTIVE CONVERSATIONAL MODE: "${activeMode.toUpperCase()}"
ROUTING DECISION: Domain = "${routingResult.domain}", Route = "${routingResult.route}", Intent = "${routingResult.intent}"

RELEVANT CODEAXYS DOMAIN CONTEXT (FACTUAL SOURCE OF TRUTH):
${JSON.stringify(contextPayload, null, 2)}

STRICT RULES FOR YOUR RESPONSE:
1. Speak naturally, professionally, and directly in English (or match the user's language preference if they spoke Malayalam/Manglish).
2. DO NOT FABRICATE DATA. Never invent metrics, campaign spend, leads, or SEO health scores. If a domain context field is null or empty, state naturally that no data is currently connected or available yet.
3. If the user asks about a capability belonging to another agent (e.g. asking Marketing Agent "Can you change my homepage?"), answer politely using the provided capability information and offer clear guidance/navigation.
4. Keep answers clear, concise, and structured with clean markdown bullet points where appropriate.
5. If campaign strategy or approval is required, explicitly remind the user that campaign strategy requires their explicit review and approval before publishing (zero automatic ad spending).`;

  let responseText = "";
  try {
    const config = getGeminiConfig();
    if (config?.apiKey) {
      const ai = new GoogleGenAI({ apiKey: config.apiKey });

      const contents = sanitizeGeminiContents(history.slice(-12), userPrompt);

      const primaryModel = config.model || "gemini-3.8-flash";
      const candidateModels = Array.from(new Set([primaryModel, "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash"]));

      for (const currentModel of candidateModels) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const res = await ai.models.generateContent({
              model: currentModel,
              contents,
              config: {
                systemInstruction: systemPrompt,
                temperature: 0.3,
                maxOutputTokens: 600,
              },
            });

            if (res.text && res.text.trim()) {
              responseText = res.text.trim();
              break;
            }
          } catch (err: any) {
            console.warn(`Orchestrator model ${currentModel} attempt ${attempt} failed:`, err?.message || err);
            if (attempt === 1 && (String(err?.message || "").includes("429") || String(err?.message || "").includes("Quota"))) {
              await new Promise((resolve) => setTimeout(resolve, 1200));
            }
          }
        }
        if (responseText) break;
      }
    }
  } catch (err: any) {
    console.warn("Unified Orchestrator Gemini call error:", err?.message || err);
  }

  if (!responseText) {
    return {
      message: "",
      suggestedActions: [],
      routingResult,
      loadedContextDomains: contextPayload.loadedDomains,
    };
  }

  // Determine navigation target for cross-agent recommendations
  let navigationTarget: "marketing" | "seo" | "pages" | "editor" | "general" | undefined;
  if (activeMode !== routingResult.domain) {
    if (routingResult.domain === "marketing") navigationTarget = "marketing";
    else if (routingResult.domain === "seo") navigationTarget = "seo";
    else if (routingResult.domain === "website") navigationTarget = "editor";
  }

  return {
    message: responseText,
    suggestedActions: routingResult.suggestedActions?.length
      ? routingResult.suggestedActions
      : activeMode !== routingResult.domain
      ? [`Switch to ${routingResult.domain.toUpperCase()} Agent`]
      : ["Ask another question", "View Details"],
    routingResult,
    loadedContextDomains: contextPayload.loadedDomains,
    navigationTarget,
  };
}
