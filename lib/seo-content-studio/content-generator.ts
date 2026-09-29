import { GoogleGenAI } from '@google/genai';
import { getGeminiConfig } from '@/lib/gemini';
import { getUserUsage, deductCredits } from '@/lib/billing';
import { ContentBrief, ContentOutline } from './types';

export interface GeneratedArticleDraft {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  seo_title: string;
  meta_description: string;
  focus_keyword: string;
  creditsDeducted: number;
}

export async function generateContentStudioArticle(
  supabase: any,
  websiteId: string,
  userId: string,
  brief: ContentBrief,
  outline?: ContentOutline
): Promise<GeneratedArticleDraft> {
  // TEMPORARY UNLIMITED AI USAGE MODE: Credit balance check bypassed
  const CREDIT_COST = 5;

  // 2. Fetch Website Context
  const { data: website } = await supabase
    .from('websites')
    .select('id, title, prompt')
    .eq('id', websiteId)
    .eq('user_id', userId)
    .single();

  const brandName = website?.title || 'Our Business';
  const brandPrompt = website?.prompt || '';

  // 3. Construct System Prompt & Safety Guidelines
  const systemPrompt = `You are a Principal SEO Copywriter and Content Strategist for ${brandName}.
Your objective is to produce a high-value, highly engaging, search-engine and answer-engine optimized (AEO) blog article.

STRICT CONTENT ACCURACY & COMPLIANCE RULES:
1. NO FABRICATED CLAIMS: Do NOT make up fake statistics, customer reviews, awards, certifications, or false guarantees.
2. NO KEYWORD STUFFING: Include focus keywords naturally within headings and introductory paragraphs.
3. AEO ANSWER-FIRST STRUCTURE: Provide a clear 2-sentence direct answer immediately after the introduction or main H2.
4. READABILITY & FORMATTING: Use clean HTML (<p>, <h2>, <h3>, <ul>, <li>, <blockquote>, <div class="faq-item">).
5. RELEVANT INTERNAL LINKS: Include contextual internal links if provided in the brief.

OUTPUT FORMAT: Return ONLY a raw JSON object with NO markdown code fences.

JSON SCHEMA:
{
  "title": "Article Title",
  "slug": "url-slug",
  "excerpt": "Concise 2-sentence excerpt",
  "content": "<p>Article introduction...</p><h2>First H2</h2><p>Content...</p>",
  "category": "Industry Guides",
  "tags": ["SEO", "Guide"],
  "seo_title": "SEO Optimized Title (50-60 chars)",
  "meta_description": "Meta description snippet (130-155 chars)",
  "focus_keyword": "primary target keyword"
}`;

  const userPrompt = `
WEBSITE BRAND: ${brandName}
BUSINESS CONTEXT: ${brandPrompt}
TOPIC: "${brief.topic}"
PRIMARY KEYWORD: "${brief.primary_keyword}"
SECONDARY KEYWORDS: ${(brief.secondary_keywords || []).join(', ')}
SEARCH INTENT: ${brief.search_intent}
TARGET AUDIENCE: ${brief.target_audience}
TOPIC CLUSTER: ${brief.topic_cluster || 'General'}
DESIRED TONE: ${brief.desired_tone}

OUTLINE GUIDANCE:
${outline ? JSON.stringify(outline) : 'Generate a logical section structure with H2/H3 subheadings and an FAQ section.'}

INTERNAL LINK SUGGESTIONS:
${JSON.stringify(brief.internal_link_opportunities || [])}
  `;

  // 4. Invoke Gemini AI safely
  const { apiKey, model } = getGeminiConfig();
  const ai = new GoogleGenAI({ apiKey });

  const candidateModels = Array.from(new Set([model || 'gemini-3.6-flash', 'gemini-3.6-flash', 'gemini-3.5-flash']));
  let rawResponseText = '';
  let lastError: any = null;

  for (const targetModel of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        config: {
          responseMimeType: 'application/json',
        },
      });

      rawResponseText = response.text || '';
      if (rawResponseText.trim()) break;
    } catch (err: any) {
      console.warn(`Content Studio generation with ${targetModel} failed:`, err?.message || err);
      lastError = err;
    }
  }

  if (!rawResponseText.trim()) {
    throw new Error(lastError?.message || 'AI engine failed to generate content draft.');
  }

  const cleanedText = rawResponseText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleanedText);

  // 5. Deduct credits ONLY on successful generation
  await deductCredits(userId, CREDIT_COST, 'ai_content_studio_generation', websiteId);

  return {
    title: parsed.title || brief.topic,
    slug: parsed.slug || brief.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    excerpt: parsed.excerpt || '',
    content: parsed.content || `<p>${brief.topic}</p>`,
    category: parsed.category || 'General',
    tags: Array.isArray(parsed.tags) ? parsed.tags : ['Blog'],
    seo_title: parsed.seo_title || parsed.title || brief.topic,
    meta_description: parsed.meta_description || parsed.excerpt || '',
    focus_keyword: parsed.focus_keyword || brief.primary_keyword,
    creditsDeducted: CREDIT_COST,
  };
}
