import * as cheerio from "cheerio";
import { redisGet, redisSet } from "./redis";

export interface ManifestOptions {
  baseUrl?: string;
}

export async function generateAIWebsiteManifest(
  supabase: any,
  websiteId: string,
  options: ManifestOptions = {}
): Promise<string | null> {
  // 1. Check Redis Cache
  const cacheKey = `seo:llms:${websiteId}`;
  try {
    const cached = await redisGet<string>(cacheKey);
    if (cached) {
      return cached;
    }
  } catch (err) {
    // Graceful Redis fallback
  }

  // 2. Fetch Website Baseline
  const { data: website } = await supabase
    .from("websites")
    .select("id, title, published_slug, prompt, custom_domain, is_published, updated_at")
    .eq("id", websiteId)
    .single();

  if (!website || !website.is_published) {
    return null;
  }

  // 3. Fetch Data Sources in Parallel
  const [seoRes, localRes, aeoRes, pagesRes, blogsRes] = await Promise.all([
    supabase.from("website_seo").select("seo_title, meta_description, focus_keywords, canonical_url, schema_markup").eq("website_id", websiteId).maybeSingle(),
    supabase.from("website_local_seo").select("business_name, business_type, city, state, country, phone, address, analysis_result").eq("website_id", websiteId).maybeSingle(),
    supabase.from("website_aeo_analysis").select("questions_discovered, topic_clusters, content_gaps").eq("website_id", websiteId).maybeSingle(),
    supabase.from("website_pages").select("path, html_content").eq("website_id", websiteId),
    supabase.from("blog_posts").select("title, slug").eq("website_id", websiteId).eq("status", "published").limit(10),
  ]);

  const seoRow = seoRes.data || {};
  const localRow = localRes.data || {};
  const aeoRow = aeoRes.data || {};
  const pageList = pagesRes.data || [];
  const publishedBlogs = blogsRes.data || [];

  const indexPage = pageList.find((p: any) => p.path === "index.html") || pageList[0];
  const indexHtml = indexPage?.html_content || "";
  const $ = cheerio.load(indexHtml);

  const baseUrl = options.baseUrl || (website.custom_domain ? `https://${website.custom_domain}` : `/site/${website.published_slug}`);

  // Business Identity Priority: 1. local_seo, 2. website_seo, 3. website title/prompt
  const businessName = (localRow.business_name || website.title || "").trim();
  const businessType = (localRow.business_type || "").trim();
  const description = (seoRow.meta_description || website.prompt || $("meta[name='description']").attr("content") || "").trim();

  const city = (localRow.city || "").trim();
  const state = (localRow.state || "").trim();
  const country = (localRow.country || "").trim();
  const locationStr = [city, state, country].filter(Boolean).join(", ");
  const address = (localRow.address || "").trim();
  const phone = (localRow.phone || "").trim();

  // Extract Email & Contact info from body text if missing
  const bodyText = $("body").text();
  const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : "";

  // Extract Services / Focus Keywords
  const focusKeywords = seoRow.focus_keywords ? seoRow.focus_keywords.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
  const serviceHeadings: string[] = [];
  $("h2, h3").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 3 && text.length < 60 && !text.toLowerCase().includes("faq") && !text.toLowerCase().includes("contact") && !text.toLowerCase().includes("about")) {
      serviceHeadings.push(text);
    }
  });

  const servicesList = Array.from(new Set([...focusKeywords, ...serviceHeadings])).slice(0, 8);

  // Extract Public Pages
  const publicPages: Array<{ title: string; url: string }> = [];
  pageList.forEach((p: any) => {
    // Exclude draft, private, or internal paths
    if (!p.path || p.path.startsWith("admin") || p.path.startsWith("dashboard") || p.path.startsWith("api") || p.path.startsWith("auth")) {
      return;
    }

    let pageTitle = p.path === "index.html" ? "Home" : p.path.replace(".html", "").replace(/[-_]/g, " ");
    pageTitle = pageTitle.charAt(0).toUpperCase() + pageTitle.slice(1);
    const pageUrl = p.path === "index.html" ? `${baseUrl}/` : `${baseUrl}/${p.path}`;
    publicPages.push({ title: pageTitle, url: pageUrl });
  });

  publishedBlogs.forEach((b: any) => {
    publicPages.push({ title: b.title, url: `${baseUrl}/blog/${b.slug}` });
  });

  // Extract FAQ Content
  const faqItems: Array<{ question: string; answer: string }> = [];
  const rawQuestions = (aeoRow.questions_discovered as any[]) || [];
  rawQuestions.forEach((qObj: any) => {
    if (qObj.question && qObj.hasDirectAnswer) {
      faqItems.push({ question: qObj.question, answer: qObj.answer || "Direct factual answer provided on primary service page." });
    }
  });

  if (faqItems.length === 0) {
    // Fallback extract FAQ from HTML details/faq items
    $(".faq-item, details, .faq, [class*='faq']").each((_, el) => {
      const q = $(el).find("h3, h4, summary, strong").first().text().trim();
      const a = $(el).find("p").first().text().trim();
      if (q && a) {
        faqItems.push({ question: q, answer: a });
      }
    });
  }

  // Canonical URL
  const canonicalUrl = seoRow.canonical_url || `${baseUrl}/`;

  // Assemble Manifest Output
  const lines: string[] = [];

  if (businessName) {
    lines.push(`# ${businessName}`);
    lines.push("");
  }

  if (description) {
    lines.push(`> ${description}`);
    lines.push("");
  }

  // About Section
  const aboutLines: string[] = [];
  if (businessType) aboutLines.push(`Business Type: ${businessType}`);
  if (locationStr) aboutLines.push(`Location: ${locationStr}`);
  if (servicesList.length > 0) aboutLines.push(`Primary Services: ${servicesList.slice(0, 4).join(", ")}`);

  if (aboutLines.length > 0) {
    lines.push("## About");
    aboutLines.forEach((l) => lines.push(l));
    lines.push("");
  }

  // Services Section
  if (servicesList.length > 0) {
    lines.push("## Services");
    servicesList.forEach((s) => lines.push(`- ${s}`));
    lines.push("");
  }

  // Important Pages Section
  if (publicPages.length > 0) {
    lines.push("## Important Pages");
    publicPages.slice(0, 10).forEach((p) => lines.push(`- ${p.title}: ${p.url}`));
    lines.push("");
  }

  // FAQ Section
  if (faqItems.length > 0) {
    lines.push("## Frequently Asked Questions");
    lines.push("");
    faqItems.slice(0, 5).forEach((item) => {
      lines.push(`### ${item.question}`);
      lines.push(item.answer);
      lines.push("");
    });
  }

  // Contact Section
  const contactLines: string[] = [];
  if (phone) contactLines.push(`Phone: ${phone}`);
  if (email) contactLines.push(`Email: ${email}`);
  if (address) contactLines.push(`Address: ${address}`);

  if (contactLines.length > 0) {
    lines.push("## Contact");
    contactLines.forEach((c) => lines.push(c));
    lines.push("");
  }

  // Website Section
  lines.push("## Website");
  lines.push(`Canonical: ${canonicalUrl}`);
  lines.push(`Primary domain: ${baseUrl}`);
  lines.push("");

  const manifestText = lines.join("\n").trim();

  // Cache in Redis (TTL 3600s)
  try {
    await redisSet(cacheKey, manifestText, 3600);
  } catch (err) {
    // Graceful Redis error handling
  }

  return manifestText;
}
