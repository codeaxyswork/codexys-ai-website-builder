import { GoogleGenAI } from "@google/genai";
import { getGeminiConfig } from "./gemini";

export interface AISEOSuggestions {
  seo_title: string;
  meta_description: string;
  focus_keywords: string[];
  og_title: string;
  og_description: string;
  schema_markup: Record<string, any>;
  recommendations: string[];
}

export async function generateAISEOSuggestions(params: {
  websiteTitle: string;
  prompt?: string;
  htmlContent?: string;
  designPlan?: any;
}): Promise<AISEOSuggestions> {
  const { apiKey, model } = getGeminiConfig();
  const ai = new GoogleGenAI({ apiKey });

  const htmlExcerpt = (params.htmlContent || "").slice(0, 4000);
  const planSummary = params.designPlan ? JSON.stringify(params.designPlan).slice(0, 1000) : "";

  const systemPrompt = `You are an expert SEO Strategist & Schema Specialist.
Your task is to analyze website content and context, then generate optimal SEO metadata and structured JSON-LD schema markup.

Return strictly a single JSON object with no markdown fences, no formatting wrappers, matching this exact shape:
{
  "seo_title": "Optimized SEO title (50-60 chars)",
  "meta_description": "Compelling meta description (120-155 chars)",
  "focus_keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4"],
  "og_title": "Social title for Open Graph",
  "og_description": "Social description for Open Graph",
  "schema_markup": {
    "@context": "https://schema.org",
    "@type": "WebSite or LocalBusiness or Organization or Service",
    "name": "...",
    "description": "..."
  },
  "recommendations": [
    "Actionable tip 1",
    "Actionable tip 2",
    "Actionable tip 3"
  ]
}`;

  const userPromptText = `
Analyze the following website data and produce optimal SEO suggestions:

Website Title: ${params.websiteTitle}
Original Business/Service Prompt: ${params.prompt || "N/A"}
Design Plan Summary: ${planSummary || "N/A"}
HTML Excerpt:
${htmlExcerpt}
`;

  try {
    const response = await ai.models.generateContent({
      model: model || "gemini-3.6-flash",
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPromptText}` }] },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "";
    const cleanedText = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanedText);

    return {
      seo_title: parsed.seo_title || params.websiteTitle || "Official Website",
      meta_description: parsed.meta_description || "Welcome to our website.",
      focus_keywords: Array.isArray(parsed.focus_keywords) ? parsed.focus_keywords : [],
      og_title: parsed.og_title || parsed.seo_title || params.websiteTitle,
      og_description: parsed.og_description || parsed.meta_description || "",
      schema_markup: parsed.schema_markup || {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: params.websiteTitle,
      },
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    };
  } catch (err: any) {
    console.error("AI SEO Suggestion Generation Error:", err);
    throw new Error(err.message || "Failed to generate AI SEO suggestions.");
  }
}
