import { GoogleGenAI } from "@google/genai";
import { getGeminiConfig } from "../gemini";
import { buildMarketingBusinessContext, MarketingBusinessContext } from "./business-context";
import { checkCreditBalance, deductCreditsWithClient } from "../billing";
import { createAdminClient } from "./meta-client";

export interface AdCopyVariation {
  variationId: string;
  style: "Direct / Benefit Driven" | "Trust / Social Proof Driven" | "Offer / Urgency Driven";
  headline: string;
  primaryText: string;
  description: string;
  cta: string;
  targetPersona: string;
}

export interface MarketingCampaignStrategy {
  id: string;
  websiteId: string;
  userGoal: string;
  targetAudience: {
    location: string;
    ageRange: string;
    gender: string;
    interests: string[];
    demographicsSummary: string;
  };
  budgetRecommendation: {
    dailyBudgetAmount: number;
    recommendedDurationDays: number;
    totalBudgetAmount: number;
    currency: string;
    source: "customer_input" | "ai_recommendation";
  };
  platformStrategy: {
    platform: "meta";
    channels: Array<"facebook" | "instagram">;
    objective: "OUTCOME_LEADS" | "OUTCOME_TRAFFIC" | "OUTCOME_SALES";
  };
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
  adCopyVariations: AdCopyVariation[];
  creativeBrief: {
    visualConcept: string;
    brandColorPalette: string[];
    recommendedImages: string[];
    formatGuidelines: string;
  };
  assumptions: string[];
  missingInformationAsked: string[];
  createdAt: string;
  spec?: StructuredMetaCampaignSpec;
}

// In-memory fallback cache for campaign drafts (ensures resilience when DB table migrations are pending)
const fallbackDraftMap = new Map<string, { id: string; website_id: string; user_id: string; status: string; strategy_payload: MarketingCampaignStrategy; created_at: string }>();

export function saveFallbackDraft(websiteId: string, userId: string, draftId: string, strategy: MarketingCampaignStrategy, status = "review_ready") {
  const record = {
    id: draftId,
    website_id: websiteId,
    user_id: userId,
    status,
    strategy_payload: strategy,
    created_at: strategy.createdAt || new Date().toISOString(),
  };
  fallbackDraftMap.set(draftId, record);
  fallbackDraftMap.set(`${websiteId}:${userId}`, record);
  fallbackDraftMap.set(`latest:${websiteId}`, record);
}

export function getFallbackDraft(websiteId: string, userId?: string, draftId?: string) {
  if (draftId && draftId !== "latest" && fallbackDraftMap.has(draftId)) {
    return fallbackDraftMap.get(draftId);
  }
  if (userId && fallbackDraftMap.has(`${websiteId}:${userId}`)) {
    return fallbackDraftMap.get(`${websiteId}:${userId}`);
  }
  if (fallbackDraftMap.has(`latest:${websiteId}`)) {
    return fallbackDraftMap.get(`latest:${websiteId}`);
  }
  return null;
}


export interface StructuredMetaCampaignSpec {
  campaign_name: string;
  objective: "OUTCOME_LEADS" | "OUTCOME_TRAFFIC" | "OUTCOME_SALES";
  buying_type: "AUCTION";
  special_ad_category: "NONE" | "HOUSING" | "EMPLOYMENT" | "CREDIT" | "ISSUES_ELECTIONS_POLITICS";
  campaign_description: string;
  selected_ad_account: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
  } | null;
  selected_facebook_page: {
    id: string;
    name: string;
    category?: string;
  } | null;
  selected_instagram_account: {
    id: string;
    username: string;
    name?: string;
  } | null;
  target_locations: string[];
  target_age_range: { min: number; max: number };
  gender: "ALL" | "MALE" | "FEMALE";
  audience_description: string;
  interests: string[];
  daily_budget: number;
  lifetime_budget: number | null;
  campaign_duration_days: number;
  start_date: string;
  end_date: string;
  ad_set_name: string;
  optimization_goal: "LEADS" | "LINK_CLICKS" | "LANDING_PAGE_VIEWS" | "CONVERSIONS";
  billing_event: "IMPRESSIONS";
  ad_name: string;
  primary_text_variations: string[];
  headline_variations: string[];
  description_variations: string[];
  cta: "LEARN_MORE" | "BOOK_NOW" | "GET_QUOTE" | "CONTACT_US" | "SIGN_UP";
  destination_url: string;
  creative_references: {
    visual_concept: string;
    recommended_images: string[];
    format_guidelines: string;
    has_creative: boolean;
  };
  campaign_notes: string;
  validation_warnings: string[];
  validation_errors: string[];
  is_valid: boolean;
}

/**
 * Validates a Meta campaign specification against production Facebook Graph API criteria.
 */
export function validateCampaignSpec(spec: Partial<StructuredMetaCampaignSpec>): {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!spec.selected_ad_account || !spec.selected_ad_account.id) {
    errors.push("No Meta Ad Account selected. Please select a Meta Ad Account.");
  }

  if (!spec.selected_facebook_page || !spec.selected_facebook_page.id) {
    errors.push("No Facebook Page selected. Please select a Facebook Page.");
  }

  if (!spec.selected_instagram_account) {
    warnings.push("No Instagram Professional Account connected to selected Facebook Page. Ads will run on Facebook placements only.");
  }

  if (!spec.daily_budget || spec.daily_budget <= 0) {
    errors.push("Daily budget must be greater than zero.");
  } else if (spec.daily_budget < 100) {
    warnings.push("Daily budget is below recommended threshold of ₹100/day for Meta Lead Ads.");
  }

  if (!spec.campaign_duration_days || spec.campaign_duration_days < 1) {
    errors.push("Campaign duration must be at least 1 day.");
  }

  if (!spec.destination_url || (!spec.destination_url.startsWith("http://") && !spec.destination_url.startsWith("https://"))) {
    errors.push("Valid destination URL (starting with http:// or https://) is required.");
  }

  if (!spec.headline_variations || spec.headline_variations.length === 0 || !spec.headline_variations[0].trim()) {
    errors.push("At least 1 valid ad headline variation is required.");
  }

  if (!spec.primary_text_variations || spec.primary_text_variations.length === 0 || !spec.primary_text_variations[0].trim()) {
    errors.push("At least 1 valid primary text ad copy variation is required.");
  }

  if (!spec.creative_references?.recommended_images || spec.creative_references.recommended_images.length === 0) {
    warnings.push("No image asset selected. Meta Ad will rely on landing page media fallback.");
  }

  const is_valid = errors.length === 0;

  return { is_valid, errors, warnings };
}

/**
 * Builds a structured Meta campaign specification from business context and strategy object.
 */
export function buildCampaignSpecFromStrategy(
  context: MarketingBusinessContext,
  strategy: Partial<MarketingCampaignStrategy>
): StructuredMetaCampaignSpec {
  const selectedAdAccount = context.metaAssets?.adAccount || null;
  const selectedFacebookPage = context.metaAssets?.facebookPage || null;
  const selectedInstagramAccount = context.metaAssets?.instagramAccount || null;

  const primaryTexts = (strategy.adCopyVariations || []).map((v) => v.primaryText).filter(Boolean);
  const headlines = (strategy.adCopyVariations || []).map((v) => v.headline).filter(Boolean);
  const descriptions = (strategy.adCopyVariations || []).map((v) => v.description).filter(Boolean);

  const rawCta = strategy.adCopyVariations?.[0]?.cta || "LEARN_MORE";
  let cta: "LEARN_MORE" | "BOOK_NOW" | "GET_QUOTE" | "CONTACT_US" | "SIGN_UP" = "LEARN_MORE";
  if (rawCta.includes("Book")) cta = "BOOK_NOW";
  else if (rawCta.includes("Quote")) cta = "GET_QUOTE";
  else if (rawCta.includes("Contact")) cta = "CONTACT_US";
  else if (rawCta.includes("Sign")) cta = "SIGN_UP";

  const dailyBudget = strategy.budgetRecommendation?.dailyBudgetAmount || 1000;
  const duration = strategy.budgetRecommendation?.recommendedDurationDays || 7;
  const startDate = new Date().toISOString();
  const endDateObj = new Date();
  endDateObj.setDate(endDateObj.getDate() + duration);
  const endDate = endDateObj.toISOString();

  const bizName = context.business.name.replace(/^\[.*?\]\s*/, "").trim();
  const targetLocation = strategy.targetAudience?.location || context.business.location.city || "Local Area";

  const partialSpec: Partial<StructuredMetaCampaignSpec> = {
    campaign_name: `[Meta Leads] - ${bizName} - ${targetLocation}`,
    objective: strategy.platformStrategy?.objective || "OUTCOME_LEADS",
    buying_type: "AUCTION",
    special_ad_category: "NONE",
    campaign_description: `Meta lead generation campaign for ${bizName} in ${targetLocation}.`,
    selected_ad_account: selectedAdAccount,
    selected_facebook_page: selectedFacebookPage,
    selected_instagram_account: selectedInstagramAccount,
    target_locations: [targetLocation],
    target_age_range: { min: 21, max: 65 },
    gender: "ALL",
    audience_description: strategy.targetAudience?.demographicsSummary || "Broad local audience interest targeting.",
    interests: strategy.targetAudience?.interests || [context.business.category],
    daily_budget: dailyBudget,
    lifetime_budget: null,
    campaign_duration_days: duration,
    start_date: startDate,
    end_date: endDate,
    ad_set_name: `AdSet - ${targetLocation} - ${strategy.platformStrategy?.objective || "Leads"}`,
    optimization_goal: "LEADS",
    billing_event: "IMPRESSIONS",
    ad_name: `Ad - ${bizName} - Variation 1`,
    primary_text_variations: primaryTexts.length > 0 ? primaryTexts : [`Discover expert ${context.business.category} services with ${bizName}.`],
    headline_variations: headlines.length > 0 ? headlines : [`Book Consultation - ${bizName}`],
    description_variations: descriptions.length > 0 ? descriptions : ["Book your consultation today."],
    cta,
    destination_url: strategy.landingPageRecommendation?.url || context.website.publishedUrl || "https://localhost:3000",
    creative_references: {
      visual_concept: strategy.creativeBrief?.visualConcept || `Visual highlighting ${bizName} services.`,
      recommended_images: strategy.creativeBrief?.recommendedImages || [],
      format_guidelines: strategy.creativeBrief?.formatGuidelines || "1:1 Square Feed & 9:16 Vertical Stories",
      has_creative: Boolean(strategy.creativeBrief?.recommendedImages && strategy.creativeBrief.recommendedImages.length > 0),
    },
    campaign_notes: "Generated by Codeaxys Marketing AI Agent. Phase 3 Draft status enforced. Zero active spend until Phase 4 launch.",
  };

  const validation = validateCampaignSpec(partialSpec);

  return {
    ...partialSpec,
    validation_errors: validation.errors,
    validation_warnings: validation.warnings,
    is_valid: validation.is_valid,
  } as StructuredMetaCampaignSpec;
}

export interface PlanGenerationInput {
  websiteId: string;
  userGoal: string;
  missingInputs?: {
    dailyBudget?: number;
    durationDays?: number;
    targetLocation?: string;
  };
}

/**
 * Score and recommend the best landing page from existing website pages.
 * Scoring: hasForm (+50), path contains contact/booking/consultation (+30), isLandingPage (+20).
 */
export function scoreLandingPage(pages: MarketingBusinessContext["pages"]): {
  page: MarketingBusinessContext["pages"][0] | null;
  rationale: string;
} {
  if (!pages || pages.length === 0) {
    return {
      page: null,
      rationale: "No published website pages found. Recommending homepage fallback.",
    };
  }

  let bestPage = pages[0];
  let maxScore = -1;

  pages.forEach((p) => {
    let score = 0;
    const pathLower = (p.path || "").toLowerCase();

    if (p.hasForm) score += 50;
    if (pathLower.includes("contact") || pathLower.includes("booking") || pathLower.includes("consultation") || pathLower.includes("appointment")) {
      score += 35;
    }
    if (pathLower.includes("treatment") || pathLower.includes("service") || pathLower.includes("naturopathy") || pathLower.includes("healing")) {
      score += 25;
    }
    if (p.isLandingPage && pathLower !== "/") score += 15;
    if (pathLower === "/" || pathLower === "index.html") score += 10;

    if (score > maxScore) {
      maxScore = score;
      bestPage = p;
    }
  });

  let rationale = `Selected page '${bestPage.path}'`;
  if (bestPage.hasForm) {
    rationale += ` because it contains an active lead capture form`;
  }
  if (bestPage.isLandingPage) {
    rationale += ` and is optimized as a primary landing page.`;
  } else {
    rationale += `.`;
  }

  return { page: bestPage, rationale };
}

/**
 * Recommend lead destination based on existing context and selected landing page.
 */
export function recommendLeadDestination(
  context: MarketingBusinessContext,
  landingPage: MarketingBusinessContext["pages"][0] | null
): {
  destinationType: "website_form" | "phone_call" | "whatsapp" | "meta_lead_form";
  details: string;
  rationale: string;
} {
  if (landingPage && landingPage.hasForm) {
    return {
      destinationType: "website_form",
      details: `On-page lead form at ${landingPage.path}`,
      rationale: `The selected landing page (${landingPage.path}) has a functional web lead form ready to receive campaign leads directly.`,
    };
  }

  if (context.business.contact.phone) {
    return {
      destinationType: "phone_call",
      details: `Direct Phone Call: ${context.business.contact.phone}`,
      rationale: `Direct phone number is configured in business details (${context.business.contact.phone}). High-intent mobile ad traffic can call directly.`,
    };
  }

  return {
    destinationType: "meta_lead_form",
    details: "Meta On-Facebook Instant Lead Form",
    rationale: "No active web form detected on landing page. Using Meta Instant Form ensures maximum mobile conversion rate without website friction.",
  };
}

/**
 * Detect genuinely missing inputs without asking redundant questions for existing data.
 */
export function detectMissingQuestions(
  context: MarketingBusinessContext,
  userGoal: string,
  missingInputs?: { dailyBudget?: number; durationDays?: number; targetLocation?: string }
): string[] {
  const missingQuestions: string[] = [];

  const goalLower = userGoal.toLowerCase();
  const hasBudgetInGoal = goalLower.includes("budget") || goalLower.includes("rs") || goalLower.includes("₹") || goalLower.includes("$") || /\b\d{3,6}\b/.test(goalLower);
  const hasDurationInGoal = goalLower.includes("day") || goalLower.includes("week") || goalLower.includes("month");

  const dailyBudget = missingInputs?.dailyBudget;
  const durationDays = missingInputs?.durationDays;

  if (!hasBudgetInGoal && !dailyBudget) {
    missingQuestions.push("What is your target daily budget (e.g. ₹500 or $20 per day)?");
  }

  if (!hasDurationInGoal && !durationDays) {
    missingQuestions.push("How many days would you like this campaign to run (e.g. 7 days or 14 days)?");
  }

  return missingQuestions;
}

/**
 * Generate structured AI Marketing Campaign Strategy & 3 Ad Copy Variations
 */
export async function generateCampaignPlan(
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
  id?: string;
  strategy?: MarketingCampaignStrategy;
}> {
  // 1. Load authoritative read-only Business Context from Phase 2B
  const context = await buildMarketingBusinessContext(supabase, websiteId);

  // 2. Evaluate Landing Page Scoring
  const { page: recommendedPage, rationale: pageRationale } = scoreLandingPage(context.pages);
  const pageUrl = recommendedPage
    ? context.website.publishedUrl
      ? `${context.website.publishedUrl.replace(/\/$/, "")}/${recommendedPage.path.replace(/^\//, "")}`
      : `https://${context.website.domain || "localhost:3000"}/${recommendedPage.path}`
    : context.website.publishedUrl || "https://localhost:3000";

  // 3. Evaluate Lead Destination Recommendation
  const leadDest = recommendLeadDestination(context, recommendedPage);

  // 4. Check for missing information (budget & duration)
  const missingQuestions = detectMissingQuestions(context, userGoal, missingInputs);

  // 5. Derive budget details (Customer input vs AI recommendation)
  let dailyBudgetAmount = missingInputs?.dailyBudget || 1000;
  let recommendedDurationDays = missingInputs?.durationDays || 7;
  let budgetSource: "customer_input" | "ai_recommendation" = "ai_recommendation";

  // Parse numbers from userGoal if present
  const goalNumbers = userGoal.match(/\b\d+\b/g);
  if (missingInputs?.dailyBudget) {
    budgetSource = "customer_input";
  } else if (goalNumbers && goalNumbers.length > 0) {
    const num = parseInt(goalNumbers[0], 10);
    if (num >= 100 && num <= 100000) {
      dailyBudgetAmount = num;
      budgetSource = "customer_input";
    }
  }

  // 6. Check credit balance (Strategy = 3 credits, Ad Copy = 2 credits => Total 5 credits)
  const REQUIRED_CREDITS = 5;
  const creditCheck = await checkCreditBalance(userId, REQUIRED_CREDITS);
  if (!creditCheck.allowed) {
    throw new Error(`Insufficient AI credits. Required: ${REQUIRED_CREDITS}, Current Balance: ${creditCheck.balance}`);
  }

  // 7. Invoke Gemini AI engine for Campaign Strategy & 3 Ad Copy Variations
  const { apiKey, model } = getGeminiConfig();
  const ai = new GoogleGenAI({ apiKey });

  const systemDirective = `
You are Codeaxys AI Marketing Strategist & Copywriter.
Your task is to generate a highly targeted, realistic Meta (Facebook & Instagram) advertising campaign strategy and 3 distinct ad copy variations.

CRITICAL TRUTH & SECURITY RULES:
1. NEVER fabricate fake testimonials, fake patient counts, fake awards, fake guarantees, or non-existent discount prices.
2. Use ONLY facts explicitly provided in the BUSINESS CONTEXT or USER GOAL below.
3. Generate exactly 3 ad copy variations matching the 3 requested personas/styles:
   - Variation 1: "Direct / Benefit Driven"
   - Variation 2: "Trust / Social Proof Driven"
   - Variation 3: "Offer / Urgency Driven"
4. Headlines must be concise (max 40 characters).
5. Output your response strictly enclosed in ===CAMPAIGN_PLAN_START=== and ===CAMPAIGN_PLAN_END=== as a clean JSON object.

===JSON SCHEMA TO RETURN===
{
  "targetAudience": {
    "location": "string (e.g. Kerala, India)",
    "ageRange": "string (e.g. 25-55)",
    "gender": "string (e.g. All / Male / Female)",
    "interests": ["string", "string"],
    "demographicsSummary": "string"
  },
  "platformStrategy": {
    "platform": "meta",
    "channels": ["facebook", "instagram"],
    "objective": "OUTCOME_LEADS" | "OUTCOME_TRAFFIC" | "OUTCOME_SALES"
  },
  "adCopyVariations": [
    {
      "variationId": "v1",
      "style": "Direct / Benefit Driven",
      "headline": "string (max 40 chars)",
      "primaryText": "string",
      "description": "string (max 30 chars)",
      "cta": "Book Now" | "Learn More" | "Contact Us" | "Sign Up" | "Apply Now",
      "targetPersona": "string"
    },
    {
      "variationId": "v2",
      "style": "Trust / Social Proof Driven",
      "headline": "string",
      "primaryText": "string",
      "description": "string",
      "cta": "string",
      "targetPersona": "string"
    },
    {
      "variationId": "v3",
      "style": "Offer / Urgency Driven",
      "headline": "string",
      "primaryText": "string",
      "description": "string",
      "cta": "string",
      "targetPersona": "string"
    }
  ],
  "creativeBrief": {
    "visualConcept": "string",
    "brandColorPalette": ["hex string"],
    "recommendedImages": ["url string"],
    "formatGuidelines": "string"
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
Offers: ${context.business.offers.join(", ")}

Website Title: ${context.website.title}
Published URL: ${context.website.publishedUrl}
SEO Keywords: ${context.seo.focusKeywords.join(", ")}
Top Search Queries: ${context.seo.topSearchQueries.map((q) => q.query).join(", ")}

===BRAND ASSETS===
Primary Color: ${context.brand.primaryColor || "#6366f1"}
Featured Images: ${JSON.stringify(context.brand.featuredImages)}

===CUSTOMER CAMPAIGN GOAL===
"${userGoal}"

===TARGET BUDGET===
Daily Budget: ${dailyBudgetAmount} INR
Duration: ${recommendedDurationDays} days
Budget Source: ${budgetSource}

Generate the complete JSON campaign plan inside ===CAMPAIGN_PLAN_START=== and ===CAMPAIGN_PLAN_END=== now:
`;

  const primaryModel = model || "gemini-3.6-flash";
  const candidateModels = Array.from(new Set([primaryModel, "gemini-3.6-flash", "gemini-3.5-flash"]));
  let responseText: string | null = null;
  let lastError: any = null;

  for (const currentModel of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: [promptText],
        config: { temperature: 0.4 },
      });

      if (response.text && response.text.trim()) {
        responseText = response.text;
        break;
      }
    } catch (err: any) {
      console.warn(`Campaign planner model ${currentModel} failed:`, err?.message || err);
      lastError = err;
    }
  }

  let parsed: any = null;

  if (!responseText) {
    console.warn("AI Engine rate limited, generating business context fallback strategy...");
    const bizName = context.business.name.replace(/^\[.*?\]\s*/, "").trim();
    parsed = {
      targetAudience: {
        location: context.business.location.city || context.business.location.state || "Kerala, India",
        ageRange: "21-55",
        gender: "All",
        interests: [context.business.category || "Consultations"],
        demographicsSummary: `Targeting audience in ${context.business.location.city || "Kerala"} interested in ${context.business.category || "consultations"}.`,
      },
      platformStrategy: {
        platform: "meta",
        channels: ["facebook", "instagram"],
        objective: "OUTCOME_LEADS",
      },
      adCopyVariations: [
        {
          variationId: "v1",
          style: "Direct / Benefit Driven",
          headline: `Book Consultation - ${bizName}`,
          primaryText: `Transform your well-being with personalized ${context.business.category} services at ${bizName}. Book your consultation today.`,
          description: "Book your appointment.",
          cta: "Book Now",
          targetPersona: "High-intent individuals looking for wellness & consultation",
        },
        {
          variationId: "v2",
          style: "Trust / Social Proof Driven",
          headline: `Trusted Care - ${bizName}`,
          primaryText: `Experience proven care and expert guidance at ${bizName}. Contact our specialists today for a personalized consultation.`,
          description: "Expert care & guidance.",
          cta: "Contact Us",
          targetPersona: "Families & wellness seekers prioritizing reputation",
        },
        {
          variationId: "v3",
          style: "Offer / Urgency Driven",
          headline: `Limited Slots - ${bizName}`,
          primaryText: `Consultation slots available this week at ${bizName}. Secure your appointment now to start your recovery journey.`,
          description: "Limited appointments available.",
          cta: "Sign Up",
          targetPersona: "Immediate intent prospective clients",
        },
      ],
      creativeBrief: {
        visualConcept: `Clean professional visual showcasing ${bizName} facility and services.`,
        brandColorPalette: [context.brand.primaryColor || "#6366f1"],
        recommendedImages: context.brand.featuredImages.slice(0, 4),
        formatGuidelines: "1:1 Square Feed & 9:16 Vertical Stories & Reels video",
      },
      assumptions: [`Derived from ${bizName} verified business context.`],
    };
  } else {
    // 8. Extract & Validate JSON payload
    let rawJson = responseText;
    const match = responseText.match(/===CAMPAIGN_PLAN_START===([\s\S]*?)===CAMPAIGN_PLAN_END===/);
    if (match && match[1]) {
      rawJson = match[1].trim();
    }

    try {
      const cleaned = rawJson.replace(/```json/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error("Failed to parse AI campaign plan JSON:", rawJson);
      throw new Error("AI Engine generated malformed campaign plan. Please retry.");
    }
  }

  if (!parsed || !parsed.targetAudience || !Array.isArray(parsed.adCopyVariations) || parsed.adCopyVariations.length === 0) {
    throw new Error("Invalid campaign plan output from AI engine.");
  }

  // 9. Assemble normalized MarketingCampaignStrategy
  const totalBudgetAmount = dailyBudgetAmount * recommendedDurationDays;

  const strategy: MarketingCampaignStrategy = {
    id: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    websiteId,
    userGoal,
    targetAudience: {
      location: parsed.targetAudience.location || context.business.location.city || context.business.location.state || "Kerala, India",
      ageRange: parsed.targetAudience.ageRange || "21-55",
      gender: parsed.targetAudience.gender || "All",
      interests: (Array.isArray(parsed.targetAudience.interests) ? parsed.targetAudience.interests : [context.business.category])
        .map((i: string) => (i === "General Business" || i === "Services" ? context.business.category : i))
        .filter(Boolean),
      demographicsSummary: parsed.targetAudience.demographicsSummary || `Targeting audience in ${context.business.location.city || "Kerala"} interested in ${context.business.category}.`,
    },
    budgetRecommendation: {
      dailyBudgetAmount,
      recommendedDurationDays,
      totalBudgetAmount,
      currency: "INR",
      source: budgetSource,
    },
    platformStrategy: {
      platform: "meta",
      channels: parsed.platformStrategy?.channels || ["facebook", "instagram"],
      objective: parsed.platformStrategy?.objective || "OUTCOME_LEADS",
    },
    landingPageRecommendation: {
      path: recommendedPage?.path || "/",
      title: recommendedPage?.title || context.website.title,
      url: pageUrl,
      rationale: pageRationale,
    },
    leadDestinationRecommendation: leadDest,
    adCopyVariations: parsed.adCopyVariations.map((v: any, idx: number) => {
      let rawHeadline = v.headline || `Book Consultation - ${context.business.name.replace(/^\[.*?\]\s*/, "")}`;
      if (rawHeadline.includes("General Business")) {
        rawHeadline = rawHeadline.replace("General Business", context.business.category);
      }
      let rawPrimary = v.primaryText || `Discover expert ${context.business.category} services with ${context.business.name}.`;
      if (rawPrimary.includes("General Business")) {
        rawPrimary = rawPrimary.replace("General Business", context.business.category);
      }
      return {
        variationId: v.variationId || `v${idx + 1}`,
        style: v.style || (idx === 0 ? "Direct / Benefit Driven" : idx === 1 ? "Trust / Social Proof Driven" : "Offer / Urgency Driven"),
        headline: rawHeadline.slice(0, 50),
        primaryText: rawPrimary,
        description: (v.description || "Book your consultation today.").slice(0, 40),
        cta: v.cta || "Book Now",
        targetPersona: v.targetPersona || "General Audience",
      };
    }),
    creativeBrief: {
      visualConcept: parsed.creativeBrief?.visualConcept || `Clean visual highlighting ${context.business.name} services.`,
      brandColorPalette: Array.isArray(parsed.creativeBrief?.brandColorPalette) && parsed.creativeBrief.brandColorPalette.length > 0
        ? parsed.creativeBrief.brandColorPalette
        : [context.brand.primaryColor || "#6366f1"],
      recommendedImages: Array.isArray(parsed.creativeBrief?.recommendedImages) && parsed.creativeBrief.recommendedImages.length > 0
        ? parsed.creativeBrief.recommendedImages
        : context.brand.featuredImages.slice(0, 4),
      formatGuidelines: parsed.creativeBrief?.formatGuidelines || "Recommended formats: 1:1 Square Feed image/video and 9:16 Vertical Stories & Reels video.",
    },
    assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [`Based on ${context.business.name} business context.`],
    missingInformationAsked: missingQuestions,
    createdAt: new Date().toISOString(),
  };

  // Build & Validate Structured Campaign Spec for Phase 3 Execution
  strategy.spec = buildCampaignSpecFromStrategy(context, strategy);

  // 10. Deduct AI credits (5 credits total for strategy + copy generation)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

  await deductCreditsWithClient(dbClient, userId, REQUIRED_CREDITS, "MARKETING_CAMPAIGN_PLAN", websiteId);

  // 11. Persist reviewable draft to marketing_campaign_drafts
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
    console.error("Failed to save marketing_campaign_drafts:", draftErr.message);
  }

  const draftId = draftRow?.id || strategy.id;
  saveFallbackDraft(websiteId, userId, draftId, strategy, "review_ready");

  return {
    success: true,
    needsMoreInfo: false,
    draftId,
    id: draftId,
    strategy,
  };
}

/**
 * Retrieve the latest review_ready campaign strategy draft for a website
 */
export async function getLatestCampaignDraft(
  supabase: any,
  websiteId: string,
  userId?: string
): Promise<{ draftId: string; id: string; status: string; website_id: string; strategy: MarketingCampaignStrategy } | null> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

  try {
    let query = dbClient
      .from("marketing_campaign_drafts")
      .select("*")
      .eq("website_id", websiteId);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query
      .in("status", ["draft", "review_ready", "approved"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return {
        draftId: data.id,
        id: data.id,
        status: data.status,
        website_id: data.website_id,
        strategy: data.strategy_payload as MarketingCampaignStrategy,
      };
    }
  } catch (err) {
    console.warn("DB draft fetch error, falling back to in-memory draft cache:", err);
  }

  const fallback = getFallbackDraft(websiteId, userId, "latest");
  if (fallback) {
    return {
      draftId: fallback.id,
      id: fallback.id,
      status: fallback.status || "review_ready",
      website_id: fallback.website_id || websiteId,
      strategy: fallback.strategy_payload,
    };
  }

  return null;
}


export type MarketingChannelType = "META_ADS" | "GOOGLE_SEARCH_ADS";

export interface ChannelRecommendationResult {
  recommendedChannels: MarketingChannelType[];
  rationale: string;
}

/**
 * Channel Selection Intelligence: Evaluates Business Context & User Goal
 * to recommend Meta Ads, Google Search Ads, or both.
 */
export function recommendMarketingChannels(
  context: MarketingBusinessContext,
  userGoal: string
): ChannelRecommendationResult {
  const categoryLower = (context.business.category || "").toLowerCase();
  const goalLower = userGoal.toLowerCase();
  const servicesLower = (context.business.services || []).join(" ").toLowerCase();

  const isSearchIntent =
    categoryLower.includes("clinic") ||
    categoryLower.includes("hospital") ||
    categoryLower.includes("doctor") ||
    categoryLower.includes("naturopathy") ||
    categoryLower.includes("plumber") ||
    categoryLower.includes("repair") ||
    categoryLower.includes("legal") ||
    categoryLower.includes("service") ||
    goalLower.includes("google") ||
    goalLower.includes("search") ||
    goalLower.includes("patient") ||
    goalLower.includes("client") ||
    servicesLower.includes("consultation") ||
    servicesLower.includes("treatment");

  const isVisualIntent =
    categoryLower.includes("fashion") ||
    categoryLower.includes("apparel") ||
    categoryLower.includes("spa") ||
    categoryLower.includes("hotel") ||
    categoryLower.includes("restaurant") ||
    categoryLower.includes("food") ||
    goalLower.includes("facebook") ||
    goalLower.includes("instagram") ||
    goalLower.includes("awareness");

  if (isSearchIntent && isVisualIntent) {
    return {
      recommendedChannels: ["META_ADS", "GOOGLE_SEARCH_ADS"],
      rationale: `Combining Meta Ads (for visual brand reach) and Google Search Ads (for active search intent in ${context.business.category}) maximizes qualified customer acquisition.`,
    };
  }

  if (isSearchIntent) {
    return {
      recommendedChannels: ["GOOGLE_SEARCH_ADS", "META_ADS"],
      rationale: `Google Search Ads targets users actively searching for ${context.business.category} in ${context.business.location.city || "your area"}, complemented by Meta Ads for retargeting.`,
    };
  }

  return {
    recommendedChannels: ["META_ADS", "GOOGLE_SEARCH_ADS"],
    rationale: `Multi-channel growth strategy targeting social audiences on Meta (FB/IG) and active searchers on Google Search.`,
  };
}

