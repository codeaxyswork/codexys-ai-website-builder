import { GoogleGenAI } from "@google/genai";
import { getGeminiConfig } from "../gemini";
import { analyzeUnifiedConversationIntent } from "../ai/unified-conversation-core";
import { buildMarketingBusinessContext, MarketingBusinessContext } from "./business-context";
import { generateCampaignPlan, recommendMarketingChannels } from "./campaign-planner";
import { getNormalizedCampaignAnalytics } from "./analytics-engine";
import { generateAIPerformanceAnalysis, sanitizeProposedBudget } from "./performance-analyzer";

export interface MarketingAgentChatMessage {
  role: "user" | "model" | "assistant";
  content: string;
}

export interface MarketingAgentResponsePayload {
  message: string;
  suggestedActions?: string[];
  navigationTarget?: string;
  draftId?: string | null;
  proposedStrategy?: any | null;
  remainingCredits?: number;
}

/**
 * Feature flag configuration for current customer-facing marketing experience:
 * META: ENABLED
 * GOOGLE_ADS: TEMPORARILY HIDDEN
 */
export const FEATURE_FLAGS = {
  META_ENABLED: true,
  GOOGLE_ADS_ENABLED: false, // Temporarily hidden from customer UI recommendations
};

const MARKETING_AGENT_SYSTEM_PROMPT = `
You are Codeaxys Marketing Agent — an expert AI Paid Ads Specialist for Codeaxys AI Website Builder.
Your mission is to guide business owners in planning, reviewing, and launching high-performing paid marketing campaigns (primarily Meta Ads: Facebook & Instagram), understanding their marketing leads, analyzing ad metrics, and optimizing campaign performance.

--------------------------------------------------
1. CONVERSATIONAL BEHAVIOR & REUSE OF BUSINESS CONTEXT
--------------------------------------------------
• Name: Codeaxys Marketing Agent
• You already have full access to the business context (Company Name, Category, Location, Services, Target Audience, Landing Pages, Forms, and SEO keywords).
• NEVER ask for information already present in business context (e.g. Do NOT ask for company name, location, or business category if already known!).
• Ask ONLY what is actually missing (e.g., target daily budget or campaign duration).
• Keep responses warm, professional, actionable, and structured using markdown bolding (**bold**).

--------------------------------------------------
2. CHANNEL SCOPE (META-FIRST)
--------------------------------------------------
• Currently, Meta Ads (Facebook & Instagram Ads) is the active primary channel.
• Focus campaign strategy generation on Meta Ads (Outcome Leads, Traffic, or Sales).
• Do NOT recommend Google Search Ads while Google Ads is temporarily disabled in customer UI.

--------------------------------------------------
3. NON-PUBLISHING SAFETY & EXPLICIT APPROVAL
--------------------------------------------------
• Strategy generation creates a DRAFT ONLY.
• NEVER publish campaigns or activate spend automatically.
• ALWAYS emphasize: "Your campaign strategy is saved as a draft. You must explicitly review and click 'Approve & Launch' to publish."
`;




export interface ResolvedBudgetDuration {
  dailyBudget?: number;
  durationDays?: number;
  totalBudget?: number;
  isAmbiguousBudgetOnly?: boolean;
  ambiguousAmount?: number;
  askingClarificationText?: string;
  clarificationActions?: string[];
}

export function resolveMultiTurnBudgetAndDuration(
  userPrompt: string,
  history: MarketingAgentChatMessage[] = []
): ResolvedBudgetDuration {
  const promptLower = userPrompt.toLowerCase().trim();

  // Helper to extract duration from a string
  const extractDuration = (text: string): number | undefined => {
    const textLower = text.toLowerCase();
    if (textLower.includes("one week") || textLower.includes("1 week")) return 7;
    if (textLower.includes("two weeks") || textLower.includes("2 weeks")) return 14;
    const durMatch = textLower.match(/(\d{1,3})\s*(?:day|days|week|weeks|month|months)/i);
    if (durMatch && durMatch[1]) {
      const val = parseInt(durMatch[1], 10);
      if (textLower.includes("week")) return val * 7;
      if (textLower.includes("month")) return val * 30;
      return val;
    }
    return undefined;
  };

  // Find preceding assistant message if present
  let lastAssistantMsg = "";
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.role === "assistant" || h.role === "model") {
      lastAssistantMsg = h.content || "";
      break;
    }
  }
  const lastAssistantLower = lastAssistantMsg.toLowerCase();
  const askedDailyBudget = lastAssistantLower.includes("daily budget") || lastAssistantLower.includes("what daily budget");
  const askedClarification = lastAssistantLower.includes("total campaign budget or your daily budget");

  // Extract duration from prompt or history
  let durationDays = extractDuration(promptLower);
  if (!durationDays) {
    for (let i = history.length - 1; i >= 0; i--) {
      const prevDur = extractDuration(history[i].content || "");
      if (prevDur) {
        durationDays = prevDur;
        break;
      }
    }
  }
  if (!durationDays) {
    durationDays = 7;
  }

  // CASE A & B: Explicit Daily Budget (e.g. "₹1000/day", "₹1000 per day", "1000 daily", "daily budget ₹1000")
  const explicitDailyMatch = promptLower.match(/(?:rs|₹|\$)?\s*([\d,]{3,7})\s*(?:\/|\s*per\s*|\s*a\s*)day/i)
    || promptLower.match(/(?:rs|₹|\$)?\s*([\d,]{3,7})\s*daily/i)
    || promptLower.match(/daily\s*(?:budget)?\s*(?:of|=|:)?\s*(?:rs|₹|\$)?\s*([\d,]{3,7})/i);

  if (explicitDailyMatch) {
    const matchedStr = explicitDailyMatch[1] || explicitDailyMatch[2] || explicitDailyMatch[3];
    if (matchedStr) {
      const dailyBudget = parseInt(matchedStr.replace(/,/g, ""), 10);
      if (dailyBudget > 0) {
        return {
          dailyBudget,
          durationDays,
          totalBudget: dailyBudget * durationDays,
        };
      }
    }
  }

  // CASE C: Explicit Total Budget (e.g. "₹7000 total", "total budget ₹7000", "7000 total for 7 days")
  const explicitTotalMatch = promptLower.match(/(?:rs|₹|\$)?\s*([\d,]{3,7})\s*total/i)
    || promptLower.match(/total\s*(?:budget)?\s*(?:of|=|:)?\s*(?:rs|₹|\$)?\s*([\d,]{3,7})/i);

  if (explicitTotalMatch && explicitTotalMatch[1]) {
    const totalBudget = parseInt(explicitTotalMatch[1].replace(/,/g, ""), 10);
    if (totalBudget > 0) {
      const dailyBudget = Math.round(totalBudget / durationDays);
      return {
        dailyBudget,
        durationDays,
        totalBudget,
      };
    }
  }

  // CASE D: Slash / Pair / Compound Format: Duration & Currency Amount provided together
  // e.g., "7 days / ₹7,000", "7 days, ₹7000", "₹7,000 for 7 days", "7000 rupees for 7 days"
  // (when NOT explicitly qualified by "per day" or "/day")
  const compoundMatch = promptLower.match(/(?:(\d{1,3})\s*(?:days?|weeks?))\s*(?:\/|-|,|\s+for\s+|\s+with\s+)\s*(?:rs|₹|\$)?\s*([\d,]{3,7})/i)
    || promptLower.match(/(?:rs|₹|\$)\s*([\d,]{3,7})\s*(?:\/|-|,|\s+for\s+)\s*(\d{1,3})\s*(?:days?|weeks?)/i);

  if (compoundMatch) {
    let amount = 0;
    let dur = durationDays;
    if (compoundMatch[1] && compoundMatch[2]) {
      if (promptLower.indexOf(compoundMatch[1]) < promptLower.indexOf(compoundMatch[2])) {
        dur = extractDuration(compoundMatch[1]) || durationDays;
        amount = parseInt(compoundMatch[2].replace(/,/g, ""), 10);
      } else {
        amount = parseInt(compoundMatch[1].replace(/,/g, ""), 10);
        dur = extractDuration(compoundMatch[2]) || durationDays;
      }
    }
    if (amount > 0) {
      const totalBudget = amount;
      durationDays = dur || 7;
      const dailyBudget = Math.round(totalBudget / durationDays);
      return {
        dailyBudget,
        durationDays,
        totalBudget,
      };
    }
  }

  // CASE F & G: Standalone Currency Amount or raw number (e.g., "₹7000", "7000", "₹1000", "1000")
  const genericAmountMatch = promptLower.match(/(?:budget|rs|₹|\$)\s*=?\s*([\d,]{3,7})/i)
    || promptLower.match(/\b([\d,]{3,7})\b/);

  if (genericAmountMatch && genericAmountMatch[1]) {
    const rawDigits = genericAmountMatch[1].replace(/,/g, "");
    const amount = parseInt(rawDigits, 10);

    if (amount >= 100) {
      // CASE G: Preceding assistant message explicitly asked for daily budget
      if (askedDailyBudget || askedClarification) {
        if (promptLower.includes("total")) {
          const totalBudget = amount;
          return {
            dailyBudget: Math.round(totalBudget / durationDays),
            durationDays,
            totalBudget,
          };
        }
        return {
          dailyBudget: amount,
          durationDays,
          totalBudget: amount * durationDays,
        };
      }

      // CASE F: Standalone amount without context (e.g. "₹7000" or "7000")
      return {
        isAmbiguousBudgetOnly: true,
        ambiguousAmount: amount,
        askingClarificationText: `Is **₹${amount.toLocaleString()}** your total campaign budget or your daily budget?`,
        clarificationActions: [`₹${amount.toLocaleString()} Total Budget`, `₹${amount.toLocaleString()} / day`],
      };
    }
  }

  // Check history for previously resolved budget if current user prompt didn't supply any budget
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.role === "user") {
      const pastResult = resolveMultiTurnBudgetAndDuration(h.content, history.slice(0, i));
      if (pastResult.dailyBudget && !pastResult.isAmbiguousBudgetOnly) {
        return {
          dailyBudget: pastResult.dailyBudget,
          durationDays: durationDays || pastResult.durationDays || 7,
          totalBudget: pastResult.totalBudget || (pastResult.dailyBudget * (durationDays || 7)),
        };
      }
    }
  }

  // CASE E: Duration Only or Initial prompt with no budget
  return {
    durationDays,
  };
}

export async function generateMarketingAgentReply(
  supabase: any,
  websiteId: string,
  userId: string,
  userPrompt: string,
  history: MarketingAgentChatMessage[] = [],
  conversationLanguage: string = "auto"
): Promise<MarketingAgentResponsePayload> {
  const context: MarketingBusinessContext = await buildMarketingBusinessContext(supabase, websiteId).catch(() => ({
    websiteId,
    userId,
    business: {
      name: "Codeaxys Business",
      category: "Services",
      description: "Business services",
      location: { address: null, city: "Kannur", state: "Kerala", country: "India", postalCode: null },
      contact: { phone: null, email: null, openingHours: null },
      services: ["Consultation"],
      products: [],
      pricingInfo: [],
      offers: [],
    },
    website: {
      title: "Codeaxys Business Website",
      domain: null,
      isPublished: true,
      publishedUrl: "/",
      totalPages: 1,
      creationType: "new" as const,
    },
    pages: [],
    seo: { seoTitle: null, metaDescription: null, focusKeywords: [], topSearchQueries: [] },
    localSeo: { localSeoScore: null, gbpProfileUrl: null },
    brand: { logoUrl: null, primaryColor: "#9333ea", featuredImages: [] },
  }));

  const promptLower = userPrompt.toLowerCase().trim();

  // -----------------------------------------------------------------
  // PHASE A: UNIFIED GEMINI INTENT & ROUTING CORE
  // -----------------------------------------------------------------
  const unifiedResult = await analyzeUnifiedConversationIntent({
    userPrompt,
    history,
    activeMode: "marketing",
    timeoutMs: 4000,
  }).catch(() => null);

  if (unifiedResult && unifiedResult.success) {
    // 1. Cross-Agent Guidance for Website Requests (e.g. "Change my homepage")
    if (unifiedResult.domain === "website") {
      return {
        message: unifiedResult.responseMessage ||
          `It looks like you're asking to edit or update your website design or homepage layout.\n\n` +
          `To modify website structure, colors, or page content, please use the **Website Editor** or consult the **Website Agent**! I'm here in Marketing to help you run Meta & Google lead campaigns and manage ad analytics.`,
        suggestedActions: ["Open Website Editor", "Switch to Website Agent"],
        navigationTarget: "overview",
      };
    }

    // 2. Cross-Agent Guidance for SEO Requests (e.g. "How is my SEO?")
    if (unifiedResult.domain === "seo") {
      return {
        message: unifiedResult.responseMessage ||
          `Our dedicated **SEO Agent** handles search engine rankings, technical crawls, AEO/AI Search readiness, and keyword optimization.\n\n` +
          `You can navigate directly to the **SEO Agent** tab from your dashboard!`,
        suggestedActions: ["Open SEO Agent", "Run Technical Crawl"],
        navigationTarget: "seo",
      };
    }

    // 3. General / Capability Questions (e.g. "What is your SEO Agent?", "What can you do?")
    if (
      unifiedResult.domain === "general" &&
      (unifiedResult.route === "agent_capability_question" || unifiedResult.route === "product_question")
    ) {
      return {
        message: unifiedResult.responseMessage ||
          `I am your **Codeaxys Marketing Agent**! Here is how I can help grow **${context.business.name}**:\n\n` +
          `• **Meta & Google Ads**: Plan high-converting lead ad campaigns (with zero automatic spend).\n` +
          `• **Lead Inbox**: Track customer inquiries captured from ads and website forms.\n` +
          `• **Ad Analytics**: Monitor total ad spend, CPL (Cost Per Lead), CTR, and channel metrics.\n` +
          `• **AI Performance Scaling**: Proposal recommendations with strict 20% max budget increase safeguards.\n\n` +
          `How would you like to grow your business today?`,
        suggestedActions: ["Run Meta Lead Campaign", "View Lead Inbox", "Check Performance Analytics"],
        navigationTarget: "overview",
      };
    }
  }

  // -----------------------------------------------------------------
  // INTENT 1: LEADS QUERY
  // -----------------------------------------------------------------
  const isLeadInboxQuery =
    !promptLower.includes("want") &&
    !promptLower.includes("get") &&
    !promptLower.includes("create") &&
    !promptLower.includes("run") &&
    !promptLower.includes("promote") &&
    (
      promptLower.includes("my leads") ||
      promptLower.includes("show leads") ||
      promptLower.includes("view leads") ||
      promptLower.includes("recent leads") ||
      promptLower.includes("lead inbox") ||
      promptLower.includes("who contacted") ||
      promptLower.includes("recent inquiries") ||
      promptLower.includes("customer list") ||
      promptLower.includes("leads list") ||
      (promptLower.includes("how many leads") && !promptLower.includes("budget"))
    );

  if (isLeadInboxQuery) {
    const { data: leads, count } = await supabase
      .from("marketing_leads")
      .select("id, name, email, phone, source, created_at, status", { count: "exact" })
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .limit(5);

    const totalLeads = count || 0;
    let leadSummary = `You have captured **${totalLeads} total lead${totalLeads === 1 ? "" : "s"}** for **${context.business.name}**.`;

    if (leads && leads.length > 0) {
      leadSummary += `\n\n**Recent Inquiries:**\n`;
      leads.forEach((l: any, idx: number) => {
        const leadName = l.name || l.email || l.phone || "Anonymous Lead";
        const channel = l.source === "meta" ? "Meta Ads" : l.source === "google_ads" ? "Google Ads" : "Website Form";
        leadSummary += `${idx + 1}. **${leadName}** via ${channel} (${new Date(l.created_at).toLocaleDateString()}) • Status: \`${l.status || "new"}\`\n`;
      });
    } else {
      leadSummary += `\n\nNo leads captured yet. Running a targeted Meta Lead Ad campaign is the fastest way to get inquiries!`;
    }

    return {
      message: leadSummary,
      suggestedActions: ["View Lead Inbox", "Run Meta Lead Campaign"],
      navigationTarget: "leads",
    };
  }

  // -----------------------------------------------------------------
  // INTENT 2: ANALYTICS & METRICS QUERY
  // -----------------------------------------------------------------
  if (
    promptLower.includes("analytics") ||
    promptLower.includes("performing") ||
    promptLower.includes("metrics") ||
    promptLower.includes("cpl") ||
    promptLower.includes("ctr") ||
    promptLower.includes("total spend") ||
    promptLower.includes("performance report")
  ) {
    try {
      const analyticsReport = await getNormalizedCampaignAnalytics(supabase, websiteId, { datePreset: "last_30d" });
      const summary = analyticsReport.summary;

      const currency = analyticsReport.currency === "INR" ? "₹" : "$";
      const spendFormatted = `${currency}${summary.spend.toLocaleString()}`;
      const cplFormatted = summary.blendedCpl > 0 ? `${currency}${summary.blendedCpl.toFixed(2)}` : "N/A";

      const reportText = `Here is your **Last 30 Days Marketing Performance** for **${context.business.name}**:\n\n` +
        `• **Total Ad Spend**: ${spendFormatted}\n` +
        `• **Impressions**: ${summary.impressions.toLocaleString()}\n` +
        `• **Clicks**: ${summary.clicks.toLocaleString()} (CTR: ${(summary.ctr * 100).toFixed(2)}%)\n` +
        `• **Total Leads Captured**: ${summary.totalLeads} (Meta: ${summary.metaLeads}, Website: ${summary.websiteLeads})\n` +
        `• **Cost Per Lead (CPL)**: ${cplFormatted}\n\n` +
        `All metrics preserve exact channel attribution. Zero unverified revenue is reported.`;

      return {
        message: reportText,
        suggestedActions: ["Open Analytics Dashboard", "Optimize Campaign"],
        navigationTarget: "analytics",
      };
    } catch {
      return {
        message: `Currently no active analytics data recorded for **${context.business.name}**. Once your Meta campaign is approved and active, daily impression, click, and lead metrics will populate here automatically.`,
        suggestedActions: ["Create Campaign Plan"],
        navigationTarget: "overview",
      };
    }
  }

  // -----------------------------------------------------------------
  // INTENT 3: PERFORMANCE OPTIMIZATION QUERY
  // -----------------------------------------------------------------
  if (
    promptLower.includes("optimize") ||
    promptLower.includes("performance analysis") ||
    promptLower.includes("budget increase recommendation") ||
    promptLower.includes("optimization proposals")
  ) {
    try {
      const analyticsReport = await getNormalizedCampaignAnalytics(supabase, websiteId, { datePreset: "last_30d" }).catch(() => null);
      if (analyticsReport) {
        const optAnalysis = await generateAIPerformanceAnalysis(supabase, websiteId, userId, analyticsReport);
        let optMsg = `AI Performance Analysis for **${context.business.name}**:\n\n${optAnalysis.performanceSummary}\n\n`;
        if (optAnalysis.recommendations.length > 0) {
          optMsg += `**Proposed Optimizations:**\n`;
          optAnalysis.recommendations.forEach((rec: any, i: number) => {
            optMsg += `${i + 1}. **${rec.targetObjectName}**: ${rec.reason} *(Proposed: ${rec.proposedValue}, Risk: ${rec.riskLevel})*\n`;
          });
          optMsg += `\n*Note: Zero automatic budget mutations. Explicit customer approval is required before applying any optimization.*`;
        } else {
          optMsg += `Your campaigns are operating efficiently. No budget changes required at this time.`;
        }

        return {
          message: optMsg,
          suggestedActions: ["View Recommendations", "Approve Optimization"],
          navigationTarget: "optimization",
        };
      }
    } catch {
      // Fallback if analytics report is empty
    }

    return {
      message: `Optimization engine for **${context.business.name}** is ready. Run your Meta campaign to generate AI optimization proposals (with strict 20% max budget increase safeguards).`,
      suggestedActions: ["Create Meta Strategy"],
      navigationTarget: "optimization",
    };
  }



  // -----------------------------------------------------------------
  // INTENT 4: CAMPAIGN PLANNING & STRATEGY GENERATION (DEFAULT)
  // -----------------------------------------------------------------
  const resolved = resolveMultiTurnBudgetAndDuration(userPrompt, history);

  // If budget clarification is required (e.g. standalone ambiguous number like "₹7000")
  if (resolved.isAmbiguousBudgetOnly && resolved.askingClarificationText) {
    return {
      message: resolved.askingClarificationText,
      suggestedActions: resolved.clarificationActions || [],
      navigationTarget: "planner",
    };
  }

  const missingInputs: { dailyBudget?: number; durationDays?: number } = {
    dailyBudget: resolved.dailyBudget,
    durationDays: resolved.durationDays,
  };

  // If daily budget is missing, return conversational budget prompt without arbitrary financial defaults
  if (!missingInputs.dailyBudget) {
    const city = context.business.location.city || context.business.location.state || "your area";
    const hasUserProvidedDuration = promptLower.includes("day") || promptLower.includes("week");

    const questionText = hasUserProvidedDuration
      ? `Got it! **${missingInputs.durationDays} days** campaign duration noted for **${context.business.name}**.\n\n` +
        `What daily budget would you like to allocate for your campaign?`
      : `I can help you get more leads for **${context.business.name}** (${context.business.category} in ${city}).\n\n` +
        `I already understand your business context, target audience, and website landing pages.\n\n` +
        `To tailor the optimal Meta (Facebook & Instagram) ad strategy, please specify:\n\n` +
        `• **What daily budget would you like to allocate?** (e.g. ₹500 or ₹1000/day)\n` +
        `• **Recommended Duration**: ${missingInputs.durationDays || 7} days\n\n` +
        `*(Note: Your target audience, landing page, and business context have already been resolved from your website!)*`;

    return {
      message: questionText,
      suggestedActions: ["₹500 / day for 7 days", "₹1000 / day for 7 days", "₹2000 / day for 14 days"],
      navigationTarget: "planner",
    };
  }

  // Generate Meta Campaign Strategy Plan using canonical planner when budget is provided
  let planResult: any;
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Campaign planner LLM call timed out, fallback to local strategy generator")), 6000)
    );
    planResult = await Promise.race([
      generateCampaignPlan(supabase, websiteId, userId, userPrompt, missingInputs),
      timeoutPromise,
    ]);
  } catch (planErr: any) {
    console.warn("generateCampaignPlan notice (using fallback strategy payload):", planErr?.message || planErr);

    const { scoreLandingPage } = require("./campaign-planner");
    const bestLanding = scoreLandingPage(context.pages);

    const cleanBizName = context.business.name.replace(/^\[.*?\]\s*/, "").trim();
    const inferredCat = context.business.category;

    const interestsList = context.business.services.length > 0
      ? [inferredCat, ...context.business.services].slice(0, 4)
      : [inferredCat, "Holistic Wellness", "Consultation Services", "Kerala Healthcare"];

    const landingPath = bestLanding.page ? bestLanding.page.path : "/";
    const landingUrl = bestLanding.page
      ? (context.website.publishedUrl ? `${context.website.publishedUrl.replace(/\/$/, "")}/${bestLanding.page.path.replace(/^\//, "")}` : bestLanding.page.path)
      : (context.website.publishedUrl || "/");

    const fallbackStrategyPayload = {
      budgetRecommendation: {
        dailyBudgetAmount: missingInputs.dailyBudget || 1000,
        recommendedDurationDays: missingInputs.durationDays || 7,
        totalBudgetAmount: (missingInputs.dailyBudget || 1000) * (missingInputs.durationDays || 7),
        currency: "INR",
        source: "customer_input",
      },
      platformStrategy: {
        platform: "meta",
        channels: ["facebook", "instagram"],
        objective: "OUTCOME_LEADS",
      },
      targetAudience: {
        location: context.business.location.city || context.business.location.state || "Kerala, India",
        ageRange: "18-65+",
        gender: "All",
        interests: interestsList,
        demographicsSummary: `Targeting audience in ${context.business.location.city || "Kerala"} interested in ${inferredCat}.`,
      },
      landingPageRecommendation: {
        path: landingPath,
        title: bestLanding.page ? bestLanding.page.title : context.website.title,
        url: landingUrl,
        rationale: bestLanding.rationale,
      },
      adCopyVariations: [
        {
          headline: `Book Consultation - ${cleanBizName}`.slice(0, 50),
          primaryText: `Get expert ${inferredCat} services from ${cleanBizName}. Contact us today to book your consultation!`,
          callToAction: "LEARN_MORE",
        },
      ],
    };

    let generatedDraftId = `draft_fallback_${Date.now()}`;
    try {
      const { data: dbDraftRow } = await supabase
        .from("marketing_campaign_drafts")
        .insert({
          website_id: websiteId,
          user_id: userId,
          status: "review_ready",
          strategy_payload: fallbackStrategyPayload,
        })
        .select("id")
        .single();
      if (dbDraftRow?.id) {
        generatedDraftId = dbDraftRow.id;
      }
    } catch (dbErr: any) {
      console.warn("Failed to persist fallback draft into marketing_campaign_drafts:", dbErr?.message || dbErr);
    }

    planResult = {
      success: true,
      needsMoreInfo: false,
      draftId: generatedDraftId,
      strategy: fallbackStrategyPayload,
    };
  }

  const strat = planResult.strategy;
  const currency = strat?.budgetRecommendation.currency === "INR" ? "₹" : "$";

  const selectedAccountText = context.metaAssets?.adAccount
    ? `${context.metaAssets.adAccount.name} (${context.metaAssets.adAccount.id})`
    : "Meta Ad Account";
  const selectedPageText = context.metaAssets?.facebookPage
    ? `${context.metaAssets.facebookPage.name}`
    : "Facebook Page";
  const selectedIgText = context.metaAssets?.instagramAccount
    ? `@${context.metaAssets.instagramAccount.username}`
    : "Instagram Account";

  const strategySummary = `✦ **Meta Campaign Strategy Generated!**\n\n` +
    `Here is the recommended Meta Ads strategy for **${context.business.name}**:\n\n` +
    `• **Ad Account**: ${selectedAccountText}\n` +
    `• **Facebook Page**: ${selectedPageText}\n` +
    `• **Instagram**: ${selectedIgText}\n` +
    `• **Channel**: Meta Ads (Facebook & Instagram)\n` +
    `• **Objective**: \`${strat?.platformStrategy.objective || "OUTCOME_LEADS"}\`\n` +
    `• **Daily Budget**: ${currency}${strat?.budgetRecommendation.dailyBudgetAmount || 500} / day (${strat?.budgetRecommendation.recommendedDurationDays || 7} Days • Total: ${currency}${strat?.budgetRecommendation.totalBudgetAmount || 3500})\n` +
    `• **Target Location**: ${strat?.targetAudience.location || context.business.location.city || "Local Area"}\n` +
    `• **Target Audience**: ${strat?.targetAudience.ageRange || "18-65+"}, Interests: ${(strat?.targetAudience.interests || []).slice(0, 3).join(", ")}\n` +
    `• **Landing Page**: \`${strat?.landingPageRecommendation.path || "/"}\`\n` +
    `• **Ad Copy Concept**: "${strat?.adCopyVariations[0]?.headline || "Book Your Consultation Today"}"\n\n` +
    `⚠️ **PAUSED Safety Enforcement**: Your campaign strategy is saved as a draft (\`ID: ${planResult.draftId}\`). **Zero automatic spending**. You must explicitly review and click **Approve & Launch** to publish.`;

  return {
    message: strategySummary,
    suggestedActions: ["Review Campaign Strategy", "Approve & Launch Meta Campaign"],
    navigationTarget: "planner",
    draftId: planResult.draftId,
    proposedStrategy: strat,
  };
}
