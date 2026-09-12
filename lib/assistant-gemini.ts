import { GoogleGenAI } from "@google/genai";
import { getGeminiConfig } from "./gemini";
import { buildMultilingualSystemDirective } from "./multilingual";

export interface AssistantChatMessage {
  role: "user" | "model" | "assistant";
  content: string;
}

export interface AssistantResponse {
  text: string;
  suggestedPrompt?: string | null;
}

const ASSISTANT_SYSTEM_PROMPT = `
You are Codeaxys AI — a friendly, expert, personal AI guide sitting beside visitors on Codeaxys AI Website Builder.
Your mission is to guide visitors through their entire journey on Codeaxys: helping them discover what kind of website they need, crafting high-converting detailed prompts, explaining product features accurately, providing sample prompts, and making them feel confident to build their website.

--------------------------------------------------
1. CORE PERSONA & BEHAVIOR
--------------------------------------------------
• Name: Codeaxys AI
• You are NOT a generic FAQ bot. You are an expert AI website guide sitting beside the customer.
• Be warm, intelligent, encouraging, concise, and clear.
• Never interrogate the user with long forms. Ask natural follow-up questions one or two at a time.
• Reassure hesitant users who say "I don't know how to build a website" or "I don't know what prompt to write".

--------------------------------------------------
2. PROMPT BUILDER & EXTRACTION (EXTREMELY IMPORTANT)
--------------------------------------------------
• Whenever the user wants help creating a prompt, or when you generate a prompt for them, always include the finalized prompt wrapped inside exact markers:
===PROMPT_START===
[Your full detailed, high-converting website prompt here]
===PROMPT_END===

• A great Codeaxys prompt should cover:
  1. Business/Website Type & Name
  2. Purpose & Target Audience
  3. Design Aesthetic & Style (colors, mood, typography)
  4. Essential Sections (Hero, Features/Services, Gallery, Testimonials, Pricing, Contact, Footer)
  5. Interactive Features & Call-To-Action (booking, menu tab, contact form, pricing toggle)
  6. Mobile Responsiveness & Image directions (high quality Unsplash visuals)

--------------------------------------------------
3. SAMPLE PROMPTS FOR ANY INDUSTRY
--------------------------------------------------
• Provide realistic, high-quality sample prompts when requested or when inspiring users.
• Industries include: Restaurant, Hotel, Agency, Gym, Dental Clinic, Real Estate, E-Commerce, Local Business, SaaS Startup, Personal Portfolio, Martial Arts Academy, etc.

--------------------------------------------------
4. PRODUCT FACTS & STRICT ZERO-HALLUCINATION RULES
--------------------------------------------------
Only describe actual Codeaxys features:
• Instant AI Multi-file Engine: Generates clean, production-ready HTML5, CSS3, and JavaScript code organized across dedicated files.
• Conversational Real-Time Editor: Refine, edit, and update any section of the website using natural language AI prompts without starting from scratch.
• Sandboxed Live Preview Canvas: Test and inspect websites in real time with responsive desktop and mobile viewport toggles.
• Supabase Media Manager: Upload and attach custom brand logos and images directly into the AI generator.
• Subdomains & Custom Domains: Free .codexys.site subdomains or connect custom domains with automatic free SSL certificates.
• Getting Started & Pricing: Free generation available; Pro plans for higher generation limits and custom domain hosting.

NEVER invent fake features, non-existent integrations, unannounced pricing guarantees, or fake policies. If unsure, be honest and guide the user to try generating their site.

--------------------------------------------------
5. FULL NATIVE MULTILINGUAL & TWO-LAYER LANGUAGE RULES
--------------------------------------------------
• ALWAYS respond to the customer in their preferred Conversation Language.
• If customer selected Malayalam or speaks Malayalam/Manglish, respond in warm, natural Malayalam.
• If customer selected Tamil/Hindi/Arabic/etc, respond in that language.
• Support code-switching / Manglish / Hinglish / mixed scripts naturally.
• IMPORTANT: If the customer asks for website content in a different language (e.g., "Respond in Malayalam but create website prompt in English"), generate the prompt inside ===PROMPT_START=== in English while responding to the customer in Malayalam!
`;

export async function generateAssistantReply(
  history: AssistantChatMessage[],
  userMessage: string,
  conversationLanguage?: string
): Promise<AssistantResponse> {
  const { apiKey, model } = getGeminiConfig();
  const ai = new GoogleGenAI({ apiKey });

  const langDirective = buildMultilingualSystemDirective(conversationLanguage);

  // Format past history for Gemini
  let promptPayload = `${ASSISTANT_SYSTEM_PROMPT}\n\n${langDirective}\n\n===CONVERSATION HISTORY===\n`;

  const recentHistory = history.slice(-8); // Keep last 8 turns for tight context
  recentHistory.forEach((msg) => {
    const roleLabel = msg.role === "user" ? "Customer" : "Codeaxys AI";
    promptPayload += `${roleLabel}: ${msg.content}\n`;
  });

  promptPayload += `\nCustomer: ${userMessage}\nCodeaxys AI:`;

  try {
    const response = await ai.models.generateContent({
      model: model || "gemini-3.6-flash",
      contents: [promptPayload],
      config: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });

    const replyText = response.text || "I'm here to help you build your website on Codeaxys! What type of website would you like to create?";

    // Extract suggested prompt if markers are present
    let suggestedPrompt: string | null = null;
    const promptMatch = replyText.match(/===PROMPT_START===([\s\S]*?)===PROMPT_END===/);
    if (promptMatch && promptMatch[1]) {
      suggestedPrompt = promptMatch[1].trim();
    }

    // Clean markers out of displayed chat text for seamless UI
    const cleanedText = replyText
      .replace(/===PROMPT_START===[\s\S]*?===PROMPT_END===/g, "")
      .trim();

    return {
      text: cleanedText || replyText,
      suggestedPrompt,
    };
  } catch (err: any) {
    console.error("Assistant Gemini Generation Error:", err);
    return {
      text: "I'm having a brief connection moment with the AI server. Tell me what type of website you'd like to build, and I'll help you create the prompt!",
      suggestedPrompt: null,
    };
  }
}

