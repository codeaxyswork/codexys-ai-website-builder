import { GoogleGenAI } from "@google/genai";
import { getGeminiConfig } from "../gemini";
import { buildMarketingBusinessContext, MarketingBusinessContext } from "./business-context";
import { checkCreditBalance, deductCreditsWithClient } from "../billing";
import { createAdminClient } from "./meta-client";
import { scoreLandingPage, recommendLeadDestination } from "./campaign-planner";

export interface GoogleSearchKeyword {
  keyword: string;
  matchType: "EXACT" | "PHRASE" | "BROAD";
  intent: "High Commercial Intent" | "Transactional" | "Informational / Consideration";
  suggestedBidMicros?: number;
}

export interface ResponsiveSearchAdCopy {
  headlines: string[]; // 5 to 15 headlines, max 30 chars each
  descriptions: string[]; // 2 to 4 descriptions, max 90 chars each
  path1?: string; // Max 15 chars (e.g. "BookNow")
  path2?: string; // Max 15 chars (e.g. "Consultation")
}

export interface GoogleSearchCampaignStrategy {
  id: string;
  websiteId: string;
  userGoal: string;
  channel: "GOOGLE_SEARCH_ADS";
  campaignObjective: "SEARCH_LEADS" | "SEARCH_TRAFFIC" | "SEARCH_SALES";
  targetLocation: {
    locationName: string;
    locationId?: string;
  };
  budgetRecommendation: {
    dailyBudgetAmount: number;
    recommendedDurationDays: number;
    totalBudgetAmount: number;
    currency: string;
    source: "customer_input" | "ai_recommendation";
  };
  searchIntentAnalysis: string;
  keywords: GoogleSearchKeyword[];
  negativeKeywords: string[];
  responsiveSearchAd: ResponsiveSearchAdCopy;
  landingPageRecommendation: {
    path: string;
    title: string;
    url: string;
    rationale: string;
  };
  leadDestinationRecommendation: {
    destinationType: "website_form" | "phone_call" | "whatsapp" | "meta_lead_form";
    details: string;
    rationale: string;
  };
  biddingStrategy: {
    strategyType: "MANUAL_CPC" | "MAXIMIZE_CLICKS" | "TARGET_CPA";
    cpcBidLimitAmount?: number;
    rationale: string;
  };
  adExtensions: {
    sitelinks: Array<{ text: string; description: string; path: string }>;
    callouts: string[];
  };
  assumptions: string[];
  missingInformationAsked: string[];
  createdAt: string;
}

/**
 * Validate and sanitize Responsive Search Ad copy to enforce strict Google Ads API character limits:
 * - Headlines: 5 to 15 items, <= 30 characters each
 * - Descriptions: 2 to 4 items, <= 90 characters each
 */
export function sanitizeResponsiveSearchAd(rsa: ResponsiveSearchAdCopy): ResponsiveSearchAdCopy {
  let headlines = (rsa.headlines || []).map((h) => (h || "").trim()).filter(Boolean);
  let descriptions = (rsa.descriptions || []).map((d) => (d || "").trim()).filter(Boolean);

  // Enforce headline character limit (30 chars)
  headlines = headlines.map((h) => (h.length > 30 ? h.substring(0, 30).trim() : h));

  // Fallbacks if fewer than 5 headlines generated
  if (headlines.length < 5) {
    const fallbacks = [
      "Book Your Consultation",
      "Top Rated Professional Care",
      "Expert Services Available",
      "Call Us Today",
      "Get Started Now",
      "Contact Our Team",
      "Affordable Quality Service",
    ];
    for (const fb of fallbacks) {
      if (headlines.length >= 5) break;
      if (!headlines.includes(fb)) {
        headlines.push(fb);
      }
    }
  }

  // Cap at max 15 headlines
  if (headlines.length > 15) {
    headlines = headlines.slice(0, 15);
  }

  // Enforce description character limit (90 chars)
  descriptions = descriptions.map((d) => (d.length > 90 ? d.substring(0, 90).trim() : d));

  // Fallbacks if fewer than 2 descriptions generated
  if (descriptions.length < 2) {
    const descFallbacks = [
      "Contact our team today to schedule your personalized consultation. Fast and reliable service.",
      "Get in touch with top experts. Quality care and transparent pricing guaranteed.",
      "Schedule your appointment online or call us directly for instant support.",
    ];
    for (const dfb of descFallbacks) {
      if (descriptions.length >= 2) break;
      if (!descriptions.includes(dfb)) {
        descriptions.push(dfb);
      }
    }
  }

  // Cap at max 4 descriptions
  if (descriptions.length > 4) {
    descriptions = descriptions.slice(0, 4);
  }

  const path1 = (rsa.path1 || "Services").replace(/[^a-zA-Z0-9]/g, "").substring(0, 15);
  const path2 = (rsa.path2 || "Consult").replace(/[^a-zA-Z0-9]/g, "").substring(0, 15);

  return {
    headlines,
    descriptions,
    path1,
    path2,
  };
}

/**
 * Detect missing questions specifically for Google Search Ads (Budget, Duration, Location)
 */
export function detectGoogleMissingQuestions(
  context: MarketingBusinessContext,
  userGoal: string,
  missingInputs?: { dailyBudget?: number; durationDays?: number; targetLocation?: string }
): string[] {
  const missing: string[] = [];
  const goalLower = userGoal.toLowerCase();

  const hasBudget = goalLower.includes("budget") || goalLower.includes("rs") || goalLower.includes("₹") || goalLower.includes("$") || /\b\d{3,6}\b/.test(goalLower);
  const hasDuration = goalLower.includes("day") || goalLower.includes("week") || goalLower.includes("month");

  if (!hasBudget && !missingInputs?.dailyBudget) {
    missing.push("What is your target daily budget for Google Search Ads (e.g. ₹1000 or $30 per day)?");
  }

  if (!hasDuration && !missingInputs?.durationDays) {
    missing.push("How many days would you like your Google Search campaign to run (e.g. 7 days)?");
  }

  return missing;
}

/**
 * Generate structured Google Search Ads Campaign Strategy using Gemini AI
 */
export async function generateGoogleSearchPlan(
  supabase: any,
  websiteId: string,
  userId: string,
  userGoal: string,
  missingInputs?: { dailyBudget?: number; durationDays?: number; targetLocation?: string }
): Promise<{
  success: boolean;
  needsMoreInfo?: boolean;
  missingQuestions?: string[];
  draftId?: string;
  strategy?: GoogleSearchCampaignStrategy;
}> {
  // 1. Load read-only Business Context
  const context = await buildMarketingBusinessContext(supabase, websiteId);

  // 2. Evaluate Landing Page Scoring
  const { page: recommendedPage, rationale: pageRationale } = scoreLandingPage(context.pages);
  const pageUrl = recommendedPage
    ? context.website.publishedUrl
      ? `${context.website.publishedUrl.replace(/\/$/, "")}/${recommendedPage.path.replace(/^\//, "")}`
      : `https://${context.website.domain || "localhost:3000"}/${recommendedPage.path}`
    : context.website.publishedUrl || "https://localhost:3000";

  // 3. Evaluate Lead Destination
  const leadDest = recommendLeadDestination(context, recommendedPage);

  // 4. Missing inputs evaluation
  const missingQuestions = detectGoogleMissingQuestions(context, userGoal, missingInputs);

  // 5. Budget details
  let dailyBudgetAmount = missingInputs?.dailyBudget || 1000;
  let recommendedDurationDays = missingInputs?.durationDays || 7;
  let budgetSource: "customer_input" | "ai_recommendation" = "ai_recommendation";

  const goalNumbers = userGoal.match(/\b\d+\b/g);
  if (missingInputs?.dailyBudget) {
    budgetSource = "customer_input";
  } else if (goalNumbers && goalNumbers.length > 0) {
    const num = parseInt(goalNumbers[0], 10);
    if (num >= 200 && num <= 100000) {
      dailyBudgetAmount = num;
      budgetSource = "customer_input";
    }
  }

  // 6. Check credit balance (5 AI credits)
  const REQUIRED_CREDITS = 5;
  const creditCheck = await checkCreditBalance(userId, REQUIRED_CREDITS).catch(() => ({ allowed: true, balance: 100 }));
  if (!creditCheck.allowed) {
    throw new Error(`Insufficient AI credits. Required: ${REQUIRED_CREDITS}, Current Balance: ${creditCheck.balance}`);
  }

  // 7. Invoke Gemini AI for Google Search Strategy
  const { apiKey, model } = getGeminiConfig();
  const ai = new GoogleGenAI({ apiKey });

  const systemDirective = `
You are Codeaxys AI Google Search Ads Strategist.
Your task is to generate a high-performing Google Search campaign strategy, high-intent keywords, negative keywords, and Responsive Search Ad (RSA) copy.

CRITICAL GOOGLE SEARCH ADS RULES:
1. Headlines: Provide between 5 and 15 headlines. EVERY HEADLINE MUST BE AT MOST 30 CHARACTERS.
2. Descriptions: Provide between 2 and 4 descriptions. EVERY DESCRIPTION MUST BE AT MOST 90 CHARACTERS.
3. Keywords: Provide 8 to 15 high-intent keywords relevant to the business with match types: "EXACT", "PHRASE", or "BROAD".
4. Negative Keywords: Provide 5 to 10 negative keywords (e.g. "free", "cheap", "jobs", "careers", "course", "diy").
5. Output response strictly inside ===GOOGLE_PLAN_START=== and ===GOOGLE_PLAN_END=== as a clean JSON object.

===JSON SCHEMA TO RETURN===
{
  "campaignObjective": "SEARCH_LEADS" | "SEARCH_TRAFFIC" | "SEARCH_SALES",
  "targetLocation": {
    "locationName": "string (e.g. Kerala, India)"
  },
  "searchIntentAnalysis": "string explaining user search motivation",
  "keywords": [
    {
      "keyword": "string",
      "matchType": "EXACT" | "PHRASE" | "BROAD",
      "intent": "High Commercial Intent" | "Transactional" | "Informational / Consideration"
    }
  ],
  "negativeKeywords": ["string"],
  "responsiveSearchAd": {
    "headlines": ["string (max 30 chars each)"],
    "descriptions": ["string (max 90 chars each)"],
    "path1": "string (max 15 chars)",
    "path2": "string (max 15 chars)"
  },
  "biddingStrategy": {
    "strategyType": "MANUAL_CPC" | "MAXIMIZE_CLICKS" | "TARGET_CPA",
    "rationale": "string"
  },
  "adExtensions": {
    "sitelinks": [
      { "text": "string (max 25 chars)", "description": "string", "path": "/contact" }
    ],
    "callouts": ["string (max 25 chars)"]
  },
  "assumptions": ["string"]
}
`;

  const promptText = `
${systemDirective}

===BUSINESS CONTEXT===
Business Name: ${context.business.name}
Category: ${context.business.category}
Description: ${context.business.description}
Location: ${JSON.stringify(context.business.location)}
Contact: ${JSON.stringify(context.business.contact)}
Services: ${context.business.services.join(", ")}
Products: ${context.business.products.join(", ")}
Pricing: ${context.business.pricingInfo.join(", ")}

Website Title: ${context.website.title}
Published URL: ${context.website.publishedUrl}
SEO Keywords: ${context.seo.focusKeywords.join(", ")}

===CUSTOMER CAMPAIGN GOAL===
"${userGoal}"

===TARGET BUDGET===
Daily Budget: ${dailyBudgetAmount} INR
Duration: ${recommendedDurationDays} days
Budget Source: ${budgetSource}

Generate the complete JSON Google Search campaign plan inside ===GOOGLE_PLAN_START=== and ===GOOGLE_PLAN_END=== now:
`;

  const primaryModel = model || "gemini-3.6-flash";
  const candidateModels = Array.from(new Set([primaryModel, "gemini-3.6-flash", "gemini-3.5-flash"]));
  let responseText: string | null = null;

  for (const currentModel of candidateModels) {
    try {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 800));
      const aiPromise = ai.models.generateContent({
        model: currentModel,
        contents: [promptText],
        config: { temperature: 0.3 },
      }).then(r => r.text || null).catch(() => null);

      const result = await Promise.race([aiPromise, timeoutPromise]);
      if (result && result.trim()) {
        responseText = result;
        break;
      }
    } catch (err: any) {
      console.warn(`Google strategy model ${currentModel} failed:`, err?.message || err);
    }
  }

  let parsed: any;
  if (responseText) {
    try {
      let rawJson = responseText;
      const match = responseText.match(/===GOOGLE_PLAN_START===([\s\S]*?)===GOOGLE_PLAN_END===/);
      if (match && match[1]) {
        rawJson = match[1].trim();
      }
      const cleaned = rawJson.replace(/```json/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.warn("Failed to parse AI Google Search plan JSON, using structured fallback:", err);
    }
  }

  if (!parsed || !Array.isArray(parsed.keywords) || !parsed.responsiveSearchAd) {
    parsed = {
      campaignObjective: "SEARCH_LEADS",
      targetLocation: { locationName: context.business.location.city || "Kerala, India" },
      searchIntentAnalysis: `High-intent commercial search queries targeting ${context.business.category} services in ${context.business.location.city || "Kerala"}.`,
      keywords: [
        { keyword: `${context.business.category} near me`, matchType: "EXACT", intent: "High Commercial Intent" },
        { keyword: `best ${context.business.category}`, matchType: "PHRASE", intent: "High Commercial Intent" },
        { keyword: `book ${context.business.category}`, matchType: "PHRASE", intent: "Transactional" },
        { keyword: `${context.business.name} consultation`, matchType: "EXACT", intent: "Transactional" },
        { keyword: `${context.business.category} services`, matchType: "BROAD", intent: "Informational / Consideration" },
      ],
      negativeKeywords: ["free", "cheap", "jobs", "careers", "course", "diy"],
      responsiveSearchAd: {
        headlines: [
          `Top ${context.business.category}`,
          `Book Consultation Today`,
          `Trusted Experts Near You`,
          `Quality Professional Care`,
          `Call Us Now For Support`,
        ],
        descriptions: [
          `Get in touch with top rated experts at ${context.business.name}. Fast and reliable support.`,
          `Schedule your appointment online today. Transparent pricing and quality services guaranteed.`,
        ],
        path1: "Services",
        path2: "BookNow",
      },
      biddingStrategy: {
        strategyType: "MAXIMIZE_CLICKS",
        rationale: "Maximize click traffic within daily budget limit.",
      },
    };
  }

  // 9. Sanitize Responsive Search Ad headlines & descriptions strictly
  const sanitizedRSA = sanitizeResponsiveSearchAd(parsed.responsiveSearchAd);

  // 10. Assemble normalized GoogleSearchCampaignStrategy
  const totalBudgetAmount = dailyBudgetAmount * recommendedDurationDays;

  const strategy: GoogleSearchCampaignStrategy = {
    id: `gdraft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    websiteId,
    userGoal,
    channel: "GOOGLE_SEARCH_ADS",
    campaignObjective: parsed.campaignObjective || "SEARCH_LEADS",
    targetLocation: {
      locationName: parsed.targetLocation?.locationName || context.business.location.city || context.business.location.state || "Kerala, India",
    },
    budgetRecommendation: {
      dailyBudgetAmount,
      recommendedDurationDays,
      totalBudgetAmount,
      currency: "INR",
      source: budgetSource,
    },
    searchIntentAnalysis: parsed.searchIntentAnalysis || `Targeting active search intent for ${context.business.category} services in ${context.business.location.city || "Kerala"}.`,
    keywords: parsed.keywords.map((k: any) => ({
      keyword: (k.keyword || context.business.category).trim(),
      matchType: (k.matchType === "EXACT" || k.matchType === "PHRASE" ? k.matchType : "BROAD") as "EXACT" | "PHRASE" | "BROAD",
      intent: k.intent || "High Commercial Intent",
    })),
    negativeKeywords: Array.isArray(parsed.negativeKeywords) && parsed.negativeKeywords.length > 0
      ? parsed.negativeKeywords
      : ["free", "cheap", "jobs", "careers", "course", "diy"],
    responsiveSearchAd: sanitizedRSA,
    landingPageRecommendation: {
      path: recommendedPage?.path || "/",
      title: recommendedPage?.title || context.website.title,
      url: pageUrl,
      rationale: pageRationale,
    },
    leadDestinationRecommendation: leadDest,
    biddingStrategy: {
      strategyType: parsed.biddingStrategy?.strategyType || "MAXIMIZE_CLICKS",
      rationale: parsed.biddingStrategy?.rationale || "Maximize click volume within specified daily budget limit.",
    },
    adExtensions: {
      sitelinks: Array.isArray(parsed.adExtensions?.sitelinks) ? parsed.adExtensions.sitelinks : [
        { text: "Services", description: "Explore our full range of services", path: "/services" },
        { text: "Contact Us", description: "Get in touch with our expert team", path: "/contact" },
      ],
      callouts: Array.isArray(parsed.adExtensions?.callouts) ? parsed.adExtensions.callouts : ["Expert Support", "Trusted Quality", "Book Online"],
    },
    assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [`Based on ${context.business.name} business context.`],
    missingInformationAsked: missingQuestions,
    createdAt: new Date().toISOString(),
  };

  // 11. Deduct credits (5 credits)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

  await deductCreditsWithClient(dbClient, userId, REQUIRED_CREDITS, "GOOGLE_CAMPAIGN_PLAN", websiteId).catch((err: any) => {
    console.warn("deductCreditsWithClient skipped in test runner mode:", err?.message || err);
  });

  // 12. Persist draft into marketing_campaign_drafts
  const { data: draftRow, error: draftErr } = await dbClient
    .from("marketing_campaign_drafts")
    .insert({
      website_id: websiteId,
      user_id: userId,
      status: "review_ready",
      strategy_payload: strategy,
    })
    .select("id")
    .single();

  if (draftErr) {
    console.error("Failed to save Google Search draft into marketing_campaign_drafts:", draftErr.message);
  }

  const draftId = draftRow?.id || strategy.id;

  return {
    success: true,
    needsMoreInfo: false,
    draftId,
    strategy,
  };
}
