import * as cheerio from "cheerio";
import { GeneratedFile, WebsitePlan } from "./types";
import { injectSEOIntoHTML } from "./seo-injector";
import { enqueueSEOJob, executeSEOAnalysis } from "./seo-job-processor";
import { runAEOAnalysis } from "./seo-aeo/engine";
import { runTopicalAuthorityAnalysis } from "./seo-aeo/topical-authority";
import { runGEOAnalysis } from "./seo-geo/engine";
import { runAIOAnalysisEngine } from "./seo-aio/engine";
import { getWebsitePublicUrl } from "./domain-resolver";

export interface ExtractedBusinessContext {
  businessName: string;
  businessType: string;
  description: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  services: string[];
  products: string[];
  primaryService: string;
}

/**
 * Extracts structured business information from the prompt, site plan, and generated HTML.
 * Strictly avoids fabricating unsupplied factual details like phone numbers or street addresses.
 */
export function extractBusinessContext(
  promptText: string,
  plan: WebsitePlan,
  htmlContent: string
): ExtractedBusinessContext {
  const cleanPrompt = (promptText || "").trim();

  // 1. Business Name
  let businessName = plan?.brandIdentity || "";
  if (!businessName || businessName === "My AI Website" || businessName.length < 3) {
    // Try Cheerio extraction from title or h1
    const $ = cheerio.load(htmlContent || "");
    const titleText = $("title").first().text().trim();
    const h1Text = $("h1").first().text().trim();
    businessName = titleText || h1Text || "Business Website";
  }

  // 2. Business Type / Industry
  const businessType = plan?.websiteType || "Business Services";

  // 3. Location / City Extraction (Only if explicitly mentioned in prompt with valid prepositions)
  let city: string | null = null;
  const locationMatch = cleanPrompt.match(
    /\b(?:in|at|near|located in|based in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/
  );
  if (locationMatch && locationMatch[1]) {
    const candidate = locationMatch[1].trim();
    // Exclude common non-city words and defensive check against detected business name
    const excluded = ["India", "USA", "UK", "Kerala", "California", "Mobile", "Desktop", "Web", "Online"];
    const isBusinessName = Boolean(businessName && candidate.toLowerCase() === businessName.toLowerCase());

    if (!excluded.includes(candidate) && !isBusinessName) {
      city = candidate;
    }
  }

  // 4. Contact Details (Only if explicitly provided in prompt)
  let phone: string | null = null;
  const phoneMatch = cleanPrompt.match(/(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
  if (phoneMatch && phoneMatch[0] && phoneMatch[0].length >= 7) {
    phone = phoneMatch[0].trim();
  }

  let email: string | null = null;
  const emailMatch = cleanPrompt.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch && emailMatch[0]) {
    email = emailMatch[0].trim();
  }

  // 5. Services & Products Extraction
  const services: string[] = [];
  if (plan?.sections && Array.isArray(plan.sections)) {
    plan.sections.forEach((sec) => {
      if (sec.name && sec.name.length < 40 && !sec.name.toLowerCase().includes("hero") && !sec.name.toLowerCase().includes("footer")) {
        services.push(sec.name);
      }
    });
  }

  const $ = cheerio.load(htmlContent || "");
  $("h2, h3").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 4 && text.length < 50 && !services.includes(text)) {
      services.push(text);
    }
  });

  const primaryService = services[0] || businessType;

  return {
    businessName,
    businessType,
    description: plan?.designDirection || `Official website for ${businessName}.`,
    city,
    phone,
    email,
    services: services.slice(0, 6),
    products: [],
    primaryService,
  };
}

/**
 * Generates valid JSON-LD schema objects based only on verified business context and visible HTML.
 */
export function generateBaselineJSONLD(
  context: ExtractedBusinessContext,
  canonicalUrl: string,
  htmlContent: string
): Record<string, any> {
  const schemas: any[] = [];

  // 1. WebSite Schema
  schemas.push({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": context.businessName,
    "url": canonicalUrl,
    "description": context.description,
  });

  // 2. Organization / LocalBusiness Schema
  const entitySchema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": context.city ? "LocalBusiness" : "Organization",
    "name": context.businessName,
    "url": canonicalUrl,
  };

  if (context.phone) entitySchema.telephone = context.phone;
  if (context.email) entitySchema.email = context.email;
  if (context.city) {
    entitySchema.address = {
      "@type": "PostalAddress",
      "addressLocality": context.city,
    };
  }

  schemas.push(entitySchema);

  // 3. FAQPage Schema (Only generated if visible FAQ content exists in HTML)
  const $ = cheerio.load(htmlContent || "");
  const faqItems: Array<{ question: string; answer: string }> = [];

  // Scan accordion or FAQ items
  $(".faq-item, details, .faq, [class*='faq']").each((_, el) => {
    const q = $(el).find("h3, h4, summary, .question, strong").first().text().trim();
    const a = $(el).find("p, .answer").first().text().trim();
    if (q.length > 5 && a.length > 5 && !faqItems.some((item) => item.question === q)) {
      faqItems.push({ question: q, answer: a });
    }
  });

  if (faqItems.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqItems.map((item) => ({
        "@type": "Question",
        "name": item.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": item.answer,
        },
      })),
    });
  }

  return schemas.length === 1 ? schemas[0] : { "@graph": schemas };
}

/**
 * Main auto-enhancer invoked after website generation to create and persist SEO/AEO foundation.
 * Failsafe: Any error inside this function is logged and swallowed so initial website generation never fails.
 */
export async function autoEnhanceGeneratedWebsiteSeo(
  supabase: any,
  userId: string,
  websiteId: string,
  promptText: string,
  plan: WebsitePlan,
  files: GeneratedFile[]
): Promise<void> {
  try {
    const indexFile = files.find((f) => f.path.endsWith("index.html"));
    const htmlContent = indexFile?.content || "";

    if (!htmlContent || htmlContent.trim() === "") return;

    // Fetch site slug
    const { data: website } = await supabase
      .from("websites")
      .select("slug, published_slug, custom_domain, is_published")
      .eq("id", websiteId)
      .single();

    const canonicalUrl = getWebsitePublicUrl(website);

    // 1. Extract Business Context
    const context = extractBusinessContext(promptText, plan, htmlContent);

    // 2. Generate SEO Metadata Foundation
    let rawTitle = `${context.businessName} | ${context.primaryService}`;
    if (context.city) rawTitle = `${context.businessName} - ${context.primaryService} in ${context.city}`;
    if (rawTitle.length > 60) rawTitle = rawTitle.substring(0, 57) + "...";

    let metaDesc = `Discover ${context.businessName}. We offer ${context.services.slice(0, 3).join(", ")}. Learn more and contact us today.`;
    if (metaDesc.length > 155) metaDesc = metaDesc.substring(0, 152) + "...";

    // Primary + Secondary Focus Keywords
    const primaryKw = context.city
      ? `${context.primaryService.toLowerCase()} in ${context.city.toLowerCase()}`
      : context.primaryService.toLowerCase();

    const focusKeywords = [
      primaryKw,
      context.businessName.toLowerCase(),
      ...context.services.map((s) => s.toLowerCase()),
    ].slice(0, 5);

    // First image in HTML for OG/Twitter
    const $ = cheerio.load(htmlContent);
    const ogImgUrl = $("img[src^='http']").first().attr("src") || undefined;

    // 3. Generate Baseline JSON-LD Schema
    const schemaMarkup = generateBaselineJSONLD(context, canonicalUrl, htmlContent);

    const seoSettingsPayload = {
      seo_title: rawTitle,
      meta_description: metaDesc,
      focus_keywords: focusKeywords,
      canonical_url: canonicalUrl,
      robots_index: true,
      robots_follow: true,
      og_title: rawTitle,
      og_description: metaDesc,
      og_image_url: ogImgUrl || null,
      twitter_card: "summary_large_image",
      twitter_title: rawTitle,
      twitter_description: metaDesc,
      twitter_image_url: ogImgUrl || null,
      schema_markup: schemaMarkup,
    };

    // 4. Inject metadata & schema into HTML content
    const enhancedHtml = injectSEOIntoHTML(htmlContent, seoSettingsPayload);

    // Update index.html page in website_pages
    await supabase
      .from("website_pages")
      .update({
        html_content: enhancedHtml,
        updated_at: new Date().toISOString(),
      })
      .eq("website_id", websiteId)
      .eq("path", "index.html");

    // Also update in-memory files array reference for caller if needed
    if (indexFile) {
      indexFile.content = enhancedHtml;
    }

    // 5. Persist website_seo
    await supabase.from("website_seo").upsert(
      {
        website_id: websiteId,
        user_id: userId,
        seo_title: rawTitle,
        meta_description: metaDesc,
        focus_keywords: focusKeywords.join(", "),
        canonical_url: canonicalUrl,
        robots_index: true,
        robots_follow: true,
        og_title: rawTitle,
        og_description: metaDesc,
        og_image_url: ogImgUrl || null,
        twitter_card: "summary_large_image",
        twitter_title: rawTitle,
        twitter_description: metaDesc,
        twitter_image_url: ogImgUrl || null,
        schema_markup: schemaMarkup,
        is_dirty: false,
        analysis_status: "completed",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "website_id" }
    );

    // 6. Persist website_local_seo
    await supabase.from("website_local_seo").upsert(
      {
        website_id: websiteId,
        user_id: userId,
        business_name: context.businessName,
        business_type: context.businessType,
        city: context.city,
        phone: context.phone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "website_id" }
    );

    // 7. Queue and execute background SEO & AEO Analysis asynchronously
    enqueueSEOJob(supabase, {
      websiteId,
      userId,
      triggerType: "initial_generation" as any,
      idempotencyKey: `auto_gen_${websiteId}`,
    })
      .then(() => executeSEOAnalysis(supabase, websiteId, userId, "initial_generation"))
      .then(() => runAEOAnalysis(supabase, websiteId, userId))
      .then(() => runTopicalAuthorityAnalysis(supabase, websiteId, userId))
      .then(() => runGEOAnalysis(supabase, websiteId, userId))
      .then(() => runAIOAnalysisEngine(supabase, websiteId, userId))
      .catch((err) => console.warn("Background SEO auto-enhancement analysis warning:", err?.message || err));
  } catch (err: any) {
    // Failsafe: Ensure initial website generation never crashes due to SEO enhancement
    console.error("autoEnhanceGeneratedWebsiteSeo Failsafe Caught Exception:", err?.message || err);
  }
}
