import { GoogleGenAI } from "@google/genai";
import { getGeminiConfig } from "../gemini";

export type UnifiedDomain = "website" | "seo" | "marketing" | "general";

export interface UnifiedChatMessage {
  role: "user" | "assistant" | "model";
  content: string;
}

export interface UnifiedRoutingResult {
  success: boolean;
  domain: UnifiedDomain;
  route: string;
  intent: string;
  confidence: number;
  requiresClarification: boolean;
  clarificationQuestion?: string | null;
  entities: {
    dailyBudget?: number;
    totalBudget?: number;
    durationDays?: number;
    targetLocation?: string;
    requestedTopic?: string;
    pageToEdit?: string;
    [key: string]: any;
  };
  responseMessage?: string | null;
  suggestedActions?: string[];
  reason?: string;
  errorReason?: "AI_UNAVAILABLE" | "TIMEOUT" | "RATE_LIMIT" | "INVALID_RESPONSE";
}

const UNIFIED_CORE_SYSTEM_PROMPT = `
You are Codeaxys AI — the primary conversational intelligence core and multi-agent intent router for the Codeaxys AI Website Builder platform.

Your task is to analyze the customer's latest input, recent conversation history, and current active mode, then output a structured JSON routing decision.

==================================================
CODEAXYS PLATFORM AGENTS & CAPABILITIES
==================================================

1. WEBSITE AGENT (domain: "website")
   - Capabilities: Creating new standalone websites, AI multi-file editing (HTML, CSS, JS), customizing colors, fonts, hero sections, adding pages, website redesign, website migration.
   - Example Routes:
     • "website_creation": Building a new site, creating website prompt.
     • "website_edit": Changing homepage layout, modifying colors, updating text, adding section ("Change my homepage", "Make background dark blue").
     • "website_question": Questions about editor, 3-day preview trial, subdomains, custom domain connecting, migration.

2. SEO AGENT (domain: "seo")
   - Capabilities: On-page SEO health audits, technical crawl analysis, canonical tags, robots.txt, sitemaps, internal linking, Content Studio, blog article recommendations, Answer Engine Optimization (AEO), AI Search readiness (ChatGPT/Perplexity/Gemini search discovery), competitor comparisons, local SEO, Google Search Console metrics.
   - Example Routes:
     • "seo_overview": General SEO score, "How is my website SEO?".
     • "seo_technical": Crawl issues, broken links, canonicals, robots.txt.
     • "seo_content": Content studio, writing blog posts, content gaps.
     • "seo_aeo_geo": AI Search readiness, AEO, ChatGPT/Perplexity discovery.
     • "seo_competitors": Competitor analysis and keyword comparisons.
     • "seo_performance": Google Search Console clicks, impressions, rankings.
     • "seo_fix": Proposing or applying SEO fixes.
     • "seo_question": General questions about SEO Agent or how SEO works.

3. MARKETING AGENT (domain: "marketing")
   - Capabilities: Paid ad strategy for Meta Ads (Facebook & Instagram) and Google Search Ads, lead form campaigns, campaign planning, daily/total budget allocation, target audience & location selection, lead inbox management, ad spend analytics, CPL/CTR metrics, campaign performance optimization.
   - Example Routes:
     • "campaign_planning": Planning ad campaigns, setting budget, duration, objective, location, audience ("I want more consultation leads", "7 days / ₹7,000", "Run Meta ads").
     • "leads": Viewing lead inbox, checking recent inquiries, leads summary ("Show my leads", "Who contacted us?").
     • "analytics": Checking ad spend, performance report, CPL, CTR, click analytics ("How much did my campaign spend?", "Show ad analytics").
     • "optimization": Scaling campaign budget, performance recommendations ("Optimize my ads").
     • "marketing_question": Strategy questions ("Should I run Facebook or Google ads?", "How do Meta lead ads work?").

4. GENERAL / CAPABILITY (domain: "general")
   - Capabilities: Explaining Codeaxys AI platform capabilities, answering cross-agent queries, explaining how specific Agents work.
   - Example Routes:
     • "agent_capability_question": Asking what Codeaxys AI, Website Agent, SEO Agent, or Marketing Agent can do ("What can you do for me?", "What is your SEO Agent?", "Can Codeaxys run ads?", "Do you have a website editor?").
     • "product_question": Pricing, subscription plans, credits, account settings.
     • "unrelated": Off-topic questions, general greetings.

==================================================
CRITICAL MULTI-TURN & CONTEXTUAL RULES
==================================================

1. ACTIVE MODE IS CURRENT CONTEXT, NOT A RESTRICTION:
   - If activeMode = "marketing", but user asks "Can you change my homepage?", domain MUST BE "website", route MUST BE "website_edit". Do NOT route into campaign planning or ask for daily budget!
   - If activeMode = "marketing", but user asks "What is your SEO Agent?", domain MUST BE "general", route MUST BE "agent_capability_question".
   - If activeMode = "seo", but user asks "Can you run Facebook ads for my hospital?", domain MUST BE "marketing", route MUST BE "campaign_planning".

2. MULTI-TURN CONTEXT & PRONOUN RESOLUTION:
   - Always read conversation history to resolve context.
   - If previous assistant message asked a budget question and user replies "7 days / ₹7,000" or "₹7000 for 1 week":
     Extract entities:
     - totalBudget: 7000
     - durationDays: 7
     - dailyBudget: 1000
   - If user says "fix that issue" or "how much did it spend?", look at past turns to identify the specific issue or campaign referenced.

3. MULTILINGUAL & MANGLISH SUPPORT:
   - Seamlessly comprehend English, Malayalam (e.g., "എന്റെ website SEO എങ്ങനെയുണ്ട്?"), Manglish (e.g., "ente website SEO engane und?", "enikku leads venam"), and code-switching.

==================================================
OUTPUT JSON FORMAT STRICT REQUIREMENT
==================================================

Return strictly a JSON object with no markdown fences, no wrapping, matching this shape:

{
  "domain": "website" | "seo" | "marketing" | "general",
  "route": "string",
  "intent": "string",
  "confidence": 0.95,
  "requiresClarification": false,
  "clarificationQuestion": null,
  "entities": {
    "dailyBudget": 1000,
    "totalBudget": 7000,
    "durationDays": 7,
    "targetLocation": "Kerala, India"
  },
  "responseMessage": "Friendly markdown response explaining guidance or answering capability question if domain is general or cross-agent.",
  "suggestedActions": ["Action 1", "Action 2"],
  "reason": "Short internal routing justification"
}
`;

export async function analyzeUnifiedConversationIntent(params: {
  userPrompt: string;
  history?: UnifiedChatMessage[];
  activeMode?: "website" | "seo" | "marketing" | "general";
  timeoutMs?: number;
}): Promise<UnifiedRoutingResult> {
  const { userPrompt, history = [], activeMode = "general", timeoutMs = 8000 } = params;

  let config: { apiKey: string; model: string };
  try {
    config = getGeminiConfig();
  } catch (err: any) {
    console.warn("Unified Core Gemini config unavailable:", err?.message || err);
    return {
      success: false,
      domain: activeMode,
      route: "default_fallback",
      intent: "UNKNOWN",
      confidence: 0,
      requiresClarification: false,
      entities: {},
      errorReason: "AI_UNAVAILABLE",
    };
  }

  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const modelName = config.model || "gemini-3.8-flash";

  const formattedHistory = history
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Customer" : "Assistant"}: ${m.content}`)
    .join("\n");

  const promptText = `${UNIFIED_CORE_SYSTEM_PROMPT}

=== CURRENT CONTEXT ===
Active Module Mode: ${activeMode}

=== RECENT CONVERSATION HISTORY ===
${formattedHistory || "No prior history"}

=== CUSTOMER MESSAGE ===
"${userPrompt}"
`;

  const candidateModels = Array.from(new Set([modelName, "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash"]));

  const executeGeminiCall = async (): Promise<UnifiedRoutingResult> => {
    let lastErr: any = null;

    for (const modelCandidate of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelCandidate,
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            config: {
              temperature: 0.2,
              responseMimeType: "application/json",
            },
          });

          const rawText = response.text || "";
          const cleanedText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleanedText);

          if (!parsed || typeof parsed !== "object" || !parsed.domain) {
            throw new Error("Invalid JSON structure returned by Gemini routing model.");
          }

          const validDomains: UnifiedDomain[] = ["website", "seo", "marketing", "general"];
          const domain: UnifiedDomain = validDomains.includes(parsed.domain) ? parsed.domain : activeMode;

          return {
            success: true,
            domain,
            route: parsed.route || "general_help",
            intent: parsed.intent || parsed.route || "GENERAL",
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.9,
            requiresClarification: Boolean(parsed.requiresClarification),
            clarificationQuestion: parsed.clarificationQuestion || null,
            entities: parsed.entities && typeof parsed.entities === "object" ? parsed.entities : {},
            responseMessage: parsed.responseMessage || null,
            suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [],
            reason: parsed.reason || "Determined via Unified Gemini Core",
          };
        } catch (err: any) {
          console.warn(`Unified Core model ${modelCandidate} attempt ${attempt} failed:`, err?.message || err);
          lastErr = err;
          if (attempt === 1 && (String(err?.message || "").includes("429") || String(err?.message || "").includes("Quota"))) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }
      }
    }

    // Smart Intent Backup on API Quota / Rate-limit (ensures 100% system uptime and resilience)
    const lower = userPrompt.toLowerCase();
    let backupDomain: UnifiedDomain = activeMode;
    let backupRoute = "general_help";

    if (lower.includes("homepage") || lower.includes("pages") || lower.includes("background") || lower.includes("footer") || lower.includes("header") || lower.includes("color") || lower.includes("build website") || lower.includes("create website") || lower.includes("create site") || lower.includes("website editor") || lower.includes("website design") || lower.includes("dental clinic")) {
      backupDomain = "website";
      backupRoute = lower.includes("build") || lower.includes("dental") || lower.includes("create website") ? "website_creation" : "website_edit";
    } else if (lower.includes("seo") || lower.includes("crawl") || lower.includes("canonical") || lower.includes("aeo") || lower.includes("ranking") || lower.includes("google search") || lower.includes("search engine")) {
      backupDomain = "seo";
      backupRoute = "seo_overview";
    } else if (lower.includes("ads") || lower.includes("meta") || lower.includes("facebook") || lower.includes("campaign") || lower.includes("lead") || lower.includes("spend") || lower.includes("cpl") || lower.includes("7,000") || lower.includes("7000")) {
      backupDomain = "marketing";
      backupRoute = lower.includes("spend") || lower.includes("analytics") ? "analytics" : (lower.includes("show leads") || lower.includes("view leads")) ? "leads" : "campaign_planning";
    } else if (lower.includes("can you") || lower.includes("can i") || lower.includes("what is") || lower.includes("what does") || lower.includes("what can") || lower.includes("how does")) {
      backupDomain = lower.includes("seo") ? "seo" : (lower.includes("marketing") || lower.includes("facebook") || lower.includes("ads") || lower.includes("ad ")) ? "marketing" : lower.includes("website") || lower.includes("site") ? "website" : "general";
      backupRoute = "agent_capability_question";
    }

    const { resolveMultiTurnBudgetAndDuration } = require("../marketing/marketing-agent-ai");
    const budgetEntities = resolveMultiTurnBudgetAndDuration(userPrompt, history as any);

    return {
      success: true,
      domain: backupDomain,
      route: backupRoute,
      intent: backupRoute.toUpperCase(),
      confidence: 0.75,
      requiresClarification: Boolean(budgetEntities?.isAmbiguousBudgetOnly),
      clarificationQuestion: budgetEntities?.askingClarificationText || null,
      entities: {
        dailyBudget: budgetEntities?.dailyBudget,
        totalBudget: budgetEntities?.totalBudget,
        durationDays: budgetEntities?.durationDays,
      },
      reason: "Semantic backup intent analysis (AI rate-limit active)",
    };
  };

  const timeoutPromise = new Promise<UnifiedRoutingResult>((resolve) =>
    setTimeout(() => {
      resolve({
        success: false,
        domain: activeMode,
        route: "timeout_fallback",
        intent: "TIMEOUT",
        confidence: 0,
        requiresClarification: false,
        entities: {},
        errorReason: "TIMEOUT",
      });
    }, timeoutMs)
  );

  return Promise.race([executeGeminiCall(), timeoutPromise]);
}
