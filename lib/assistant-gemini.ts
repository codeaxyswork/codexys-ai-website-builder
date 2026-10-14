import { GoogleGenAI } from "@google/genai";
import { getGeminiConfig, getCandidateModels } from "./gemini";
import {
  logAITelemetry,
  classifyGeminiError,
  calculateBackoffWithJitter,
  withTimeout,
} from "./gemini-telemetry";
import { buildMultilingualSystemDirective } from "./multilingual";
import { analyzeUnifiedConversationIntent } from "./ai/unified-conversation-core";
import { generateOrchestratedAgentReply } from "./ai/unified-context-orchestrator";

export interface AssistantChatMessage {
  role: "user" | "model" | "assistant";
  content: string;
}

export interface AssistantResponse {
  text: string;
  suggestedPrompt?: string | null;
}

const GENERAL_ASSISTANT_SYSTEM_PROMPT = `
You are Codeaxys AI — an expert, open-ended, highly intelligent AI Consultant for the Codeaxys AI platform.
You act as a natural, open-ended conversational partner (like ChatGPT), NOT a form, wizard, or questionnaire.

==================================================
PLATFORM CAPABILITIES
==================================================
1. Website Builder & Visual Editor:
   - AI layout generation from natural language descriptions.
   - Real-time visual section editing (hero, about, services, testimonials, contact, footer, colors, fonts).
   - Multi-page site engine, import/migration, custom domains.

2. SEO Agent:
   - Technical health crawl audits, broken links, canonicals, robots.txt.
   - Answer Engine Optimization (AEO) for ChatGPT / Perplexity / Claude discovery.
   - Google Search Console metrics (clicks, impressions, positions) & local SEO schema.

3. Marketing Agent:
   - Meta Ads (Facebook & Instagram) campaign planning & ad copy concept design.
   - Target audience, location, and daily budget optimization.
   - Lead form inbox & CPL/CTR performance analytics.

==================================================
CONVERSATIONAL BEHAVIOR RULES
==================================================
1. REAL CONVERSATIONAL AI & REASONING:
   - Always read the FULL conversation history!
   - Converse naturally, intelligently, and empathetically.
   - You have complete freedom to choose how to respond: answer questions, ask clarifying questions when helpful, suggest ideas, explain concepts, handle corrections, switch topics, summarize progress, or recommend website structures.
   - NEVER follow a fixed sequence or checklist of questions (NO mandatory businessName -> logo -> colors -> products sequence).
   - Tailor your responses to what the user actually says and what their specific business requires.
   - If the user says "I don't know" or asks "What do you recommend?", offer intelligent, creative recommendations tailored to their business type instead of repeating the question.
   - If the user makes corrections (e.g., "Actually I want dark green and gold"), update your understanding gracefully.
   - Handle unexpected user responses, multi-requirement statements, or off-topic questions naturally.

2. TOPIC SWITCHING & RECOVERY:
   - If the user switches topics (e.g., from Website to SEO or Marketing), switch naturally and answer their questions thoroughly.
   - If the user asks to return to their website conversation (e.g., "Go back to my website" or "What did I tell you about it?"), recall all accumulated details from the conversation history and summarize them naturally.

3. USER-CONTROLLED FINISH & CREATION PROMPT:
   - The user controls when they are ready to proceed (e.g., "Create it", "Build it", "That's enough", "Let's build", "Generate website", or requesting their complete prompt).
   - When requested or when details are complete:
     a) Summarize what you have understood about their website.
     b) Generate the finalized website creation prompt enclosed strictly inside ===PROMPT_START=== and ===PROMPT_END=== tags!
`;

export function sanitizeGeminiContents(
  history: Array<{ role: string; content?: string; text?: string; message?: string }>,
  userPrompt: string
): Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> {
  const sanitized: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  for (const h of history) {
    const rawRole = (h.role || "").toLowerCase();
    const role: "user" | "model" = rawRole === "user" || rawRole === "human" ? "user" : "model";
    const text = (h.content || h.text || h.message || "").trim();
    if (!text) continue;

    if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === role) {
      sanitized[sanitized.length - 1].parts[0].text += `\n${text}`;
    } else {
      sanitized.push({ role, parts: [{ text }] });
    }
  }

  while (sanitized.length > 0 && sanitized[0].role === "model") {
    sanitized.shift();
  }

  const promptText = userPrompt.trim();
  if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === "user") {
    sanitized[sanitized.length - 1].parts[0].text += `\n${promptText}`;
  } else {
    sanitized.push({ role: "user", parts: [{ text: promptText }] });
  }

  return sanitized;
}

export async function generateAssistantReply(
  history: AssistantChatMessage[],
  userMessage: string,
  conversationLanguage?: string
): Promise<AssistantResponse> {
  const lowerMsg = userMessage.toLowerCase().trim();

  const isExplicitPromptRequest =
    lowerMsg.includes("prompt") &&
    (
      lowerMsg.includes("give") ||
      lowerMsg.includes("prepare") ||
      lowerMsg.includes("show") ||
      lowerMsg.includes("generate") ||
      lowerMsg.includes("get") ||
      lowerMsg.includes("create") ||
      lowerMsg.includes("write") ||
      lowerMsg.includes("provide") ||
      lowerMsg.includes("can you") ||
      lowerMsg === "prompt" ||
      lowerMsg === "give me the prompt"
    );

  const isCreationTrigger =
    lowerMsg === "create it" ||
    lowerMsg === "build it" ||
    lowerMsg === "generate it" ||
    lowerMsg === "let's create" ||
    lowerMsg === "create website" ||
    lowerMsg.includes("create it now") ||
    lowerMsg.includes("generate website now");

  try {
    const { apiKey, model } = getGeminiConfig();
    if (!apiKey) {
      throw new Error("Gemini API Key is missing.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const langDirective = buildMultilingualSystemDirective(conversationLanguage);

    let finalPrompt = userMessage;
    if (isExplicitPromptRequest || isCreationTrigger) {
      finalPrompt += `\n\n[MANDATORY INSTRUCTION: The user is requesting their complete website prompt/creation now. Summarize what you understood and output the finalized website prompt enclosed strictly inside ===PROMPT_START=== and ===PROMPT_END===!]`;
    }

    const contents = sanitizeGeminiContents(history.slice(-20), finalPrompt);

    const candidateModels = getCandidateModels(model);

    for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
      const currentModel = candidateModels[mIdx];
      const maxAttempts = mIdx === 0 ? 2 : 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const t0 = Date.now();
        try {
          const response = await withTimeout(
            ai.models.generateContent({
              model: currentModel,
              contents,
              config: {
                systemInstruction: `${GENERAL_ASSISTANT_SYSTEM_PROMPT}\n\n${langDirective}`,
                temperature: 0.7,
                maxOutputTokens: 1024,
              },
            }),
            25000,
            `Assistant model ${currentModel} timed out after 25s.`
          );

          if (response.text && response.text.trim()) {
            const servedModel = response.modelVersion || currentModel;
            const latencyMs = Date.now() - t0;

            logAITelemetry({
              timestamp: new Date().toISOString(),
              operation: "assistant_chat",
              requestedModel: currentModel,
              servedModel,
              status: "SUCCESS",
              statusCode: 200,
              latencyMs,
              attempt,
              fallbackIndex: mIdx,
              promptTokenCount: response.usageMetadata?.promptTokenCount,
              candidatesTokenCount: response.usageMetadata?.candidatesTokenCount,
              totalTokenCount: response.usageMetadata?.totalTokenCount,
              promptLengthChars: finalPrompt.length,
              responseLengthChars: response.text.length,
            });

            console.log(`[Assistant] Successful response (requested: ${currentModel}, served: ${servedModel}, latency: ${latencyMs}ms)`);

            const replyText = response.text.trim();
            let suggestedPrompt: string | null = null;
            const promptMatch = replyText.match(/===PROMPT_START===([\s\S]*?)===PROMPT_END===/);
            if (promptMatch && promptMatch[1]) {
              suggestedPrompt = promptMatch[1].trim();
            } else if (isExplicitPromptRequest || isCreationTrigger) {
              suggestedPrompt = replyText.trim();
            }

            const cleanedText = replyText.replace(/===PROMPT_START===[\s\S]*?===PROMPT_END===/g, "").trim();

            return {
              text: cleanedText || replyText,
              suggestedPrompt,
            };
          }
        } catch (err: any) {
          const latencyMs = Date.now() - t0;
          const classified = classifyGeminiError(err);

          logAITelemetry({
            timestamp: new Date().toISOString(),
            operation: "assistant_chat",
            requestedModel: currentModel,
            status: "FAILED",
            statusCode: classified.statusCode,
            failureCategory: classified.failureCategory,
            latencyMs,
            attempt,
            fallbackIndex: mIdx,
            promptLengthChars: finalPrompt.length,
          });

          console.warn(`Assistant model ${currentModel} attempt ${attempt} failed (${classified.failureCategory}):`, err?.message || err);

          if (classified.isAuthError) {
            console.error(`[Assistant] Non-retryable authentication error on ${currentModel}: ${err?.message || err}`);
            break;
          }

          if (attempt < maxAttempts && classified.isTransient) {
            const delayMs = calculateBackoffWithJitter(attempt, 1000, 2500);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else if (mIdx < candidateModels.length - 1 && classified.isTransient) {
            const delayMs = calculateBackoffWithJitter(1, 800, 1500);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
      }
    }
  } catch (err: any) {
    console.error("Direct Gemini Assistant failed completely:", err?.message || err);
  }

  // NO CANNED FAKE AI FALLBACK. Return honest service-unavailable error message.
  return {
    text: "⚠️ **Service Unavailable**: Codeaxys AI is temporarily unable to connect to the language model. Please try again in a moment.",
    suggestedPrompt: null,
  };
}


