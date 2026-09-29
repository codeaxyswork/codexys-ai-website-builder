import { SourcePage, GlobalStyles, MigrationSelections, MigrationSection, MigrationImage, MigrationSEO, MigrationLink, MigrationForm, MigrationSlide } from "./types";
import { getGeminiConfig } from "@/lib/gemini";
import { GoogleGenAI } from "@google/genai";
import * as cheerio from "cheerio";
import crypto from "crypto";

let globalValidationCounter = 0;
let globalNativeInvocationCounter = 0;

export const REDESIGN_SYSTEM_INSTRUCTION = `You are redesigning an existing website.

Your task is to create a completely new visual and UI/UX experience for the existing website while preserving the website's original content and business meaning.

The supplied source website is the source of truth.

CONCEPTUAL RULE: CHANGE DESIGN, NOT CONTENT.

ALLOWED TO CHANGE (VISUAL PRESENTATION ONLY):
- Layout structure, grid alignment, visual container hierarchy
- Typography, font families, font sizes, text styles
- Color scheme, gradients, background styling, themes
- Container spacing, padding, margins, modern UI cards
- Button styles, section composition, component aesthetics
- Header visual design, hero section visual presentation, footer visual design
- Responsive layout, modern UI card wrappers, visual hierarchy

NOT ALLOWED TO CHANGE (CONTENT IS LOCKED DATA):
- Headings (H1, H2, H3 text MUST remain preserved and unchanged)
- Paragraph text and body content
- Business name, service names, and factual claims
- Contact details (phone numbers, email addresses, physical addresses)
- URLs and navigation destination links
- Images (unless user explicitly requests image replacement)

ABSOLUTELY FORBIDDEN:
- Do NOT add newsletter subscription blocks ("Subscribe to our newsletter", "Don't Miss Our Weekly Post", etc.) unless explicitly present in source
- Do NOT add blog posts or articles not present in source data
- Do NOT add testimonials, statistics, or metrics not present in source data
- Do NOT add generic marketing copy or fake CTAs
- Do NOT invent services, products, or business information

Think of this as redesigning the visual interface of an existing website, NOT generating a new website from scratch.`;

export const DEFAULT_REDESIGN_PROMPT =
  "Redesign this website with a modern, premium and professional visual style while preserving all existing content, images, business information, links and functionality.";

/**
 * Clean & sanitize text strings safely for HTML output.
 */
function sanitizeText(str?: string): string {
  if (!str) return "";
  return str
    .replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'href="#"')
    .replace(/src\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'src=""')
    .trim();
}

/**
 * Builds a rich SourcePage object from a full Playwright BrowserPageSnapshot.
 */
export function buildSourcePageFromBrowserSnapshot(
  snapshot: {
    url: string;
    title: string;
    html: string;
    assetUrls?: string[];
    slides?: MigrationSlide[];
    seo?: MigrationSEO;
    links?: MigrationLink[];
    forms?: MigrationForm[];
  },
  path: string = "index.html"
): SourcePage {
  const $ = cheerio.load(snapshot.html || "");

  const headings: { level: number; text: string }[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const level = parseInt(tag.replace("h", ""), 10) || 2;
    const text = $(el).text().replace(/\s+/g, " ").trim();
    const lower = text.toLowerCase();
    if (
      text &&
      text.length > 2 &&
      !lower.includes("new message") &&
      !lower.includes("cookie") &&
      !headings.some((h) => h.text === text)
    ) {
      headings.push({ level, text });
    }
  });

  const paragraphs: string[] = [];
  $("p, li, .elementor-text-editor, article p, section p, main p, div.text").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text && text.length > 15 && !paragraphs.includes(text) && !headings.some((h) => h.text === text)) {
      paragraphs.push(text);
    }
  });

  const images: MigrationImage[] = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src") || "";
    const alt = $(el).attr("alt") || snapshot.title || "Website Image";
    if (src && (src.startsWith("http://") || src.startsWith("https://"))) {
      if (!images.some((i) => i.src === src)) {
        images.push({ src, alt, role: "content" });
      }
    }
  });

  if (snapshot.assetUrls) {
    snapshot.assetUrls.forEach((u) => {
      if (u && (u.endsWith(".png") || u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".webp") || u.endsWith(".svg"))) {
        if (!images.some((i) => i.src === u)) {
          images.push({ src: u, alt: snapshot.title, role: "content" });
        }
      }
    });
  }

  const sections: MigrationSection[] = [];
  const $sectionEls = $("section, header, footer, main, article, .elementor-section, .container, [class*='section']");

  if ($sectionEls.length > 0) {
    $sectionEls.each((idx, el) => {
      const $sec = $(el);
      const secHead = $sec.find("h1, h2, h3, h4").first().text().replace(/\s+/g, " ").trim();
      const secParas: string[] = [];
      $sec.find("p, li").each((_, p) => {
        const pt = $(p).text().replace(/\s+/g, " ").trim();
        if (pt && pt.length > 15 && !secParas.includes(pt)) secParas.push(pt);
      });

      const secImgs: MigrationImage[] = [];
      $sec.find("img").each((_, img) => {
        const s = $(img).attr("src") || $(img).attr("data-src") || "";
        const a = $(img).attr("alt") || secHead || snapshot.title;
        if (s && (s.startsWith("http://") || s.startsWith("https://"))) {
          secImgs.push({ src: s, alt: a, role: "content" });
        }
      });

      const secBtns: { text: string; href: string }[] = [];
      $sec.find("a.btn, a.button, button, a[href]").each((_, b) => {
        const t = $(b).text().replace(/\s+/g, " ").trim();
        const h = $(b).attr("href") || "#";
        if (t && t.length < 35 && h && !h.startsWith("javascript:")) {
          secBtns.push({ text: t, href: h });
        }
      });

      let type: any = idx === 0 ? "hero" : "content";
      if (el.tagName.toLowerCase() === "header") type = "header";
      if (el.tagName.toLowerCase() === "footer") type = "footer";

      if (secHead || secParas.length > 0 || secImgs.length > 0) {
        sections.push({
          type,
          heading: secHead,
          paragraphs: secParas,
          buttons: secBtns,
          images: secImgs,
          slides: idx === 0 ? snapshot.slides : undefined,
          htmlSnippet: $.html(el) || "",
        });
      }
    });
  }

  if (sections.length === 0) {
    sections.push({
      type: "hero",
      heading: headings[0]?.text || snapshot.title,
      paragraphs: paragraphs.slice(0, 5),
      buttons: (snapshot.links || []).slice(0, 3).map((l) => ({ text: l.text, href: l.href })),
      images: images.slice(0, 5),
      slides: snapshot.slides,
      htmlSnippet: snapshot.html || "",
    });
  }

  const logoImg = images.find((i) => i.src.toLowerCase().includes("logo") || i.alt.toLowerCase().includes("logo"))?.src || images[0]?.src || "";
  const heroBg = snapshot.slides?.[0]?.bgImage || images[0]?.src || "";

  return {
    url: snapshot.url,
    path,
    slug: path.replace(/[^a-z0-9]/gi, "-").toLowerCase(),
    title: snapshot.title,
    siteName: snapshot.title.split("-")[0]?.split("|")[0]?.trim() || "Website",
    logoUrl: logoImg,
    heroBgImage: heroBg,
    headings,
    paragraphs,
    images,
    links: snapshot.links || [],
    forms: snapshot.forms || [],
    sections,
    seo: snapshot.seo || { seoTitle: snapshot.title },
  };
}

/**
 * Extracts normalized, structured source content from a SourcePage.
 */
export function extractStructuredSourcePage(page: SourcePage) {
  const headings = page.headings || [];
  const paragraphs = page.paragraphs || [];
  const images = page.images || [];
  const links = page.links || [];
  const forms = page.forms || [];
  const sections = page.sections || [];

  const contactInfo: { phones: string[]; emails: string[]; addresses: string[] } = {
    phones: [],
    emails: [],
    addresses: [],
  };

  // Find contact info from paragraphs and links
  const allTexts = [...paragraphs, ...headings.map((h) => h.text)];
  allTexts.forEach((txt) => {
    if (!txt) return;
    const phoneMatch = txt.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g);
    if (phoneMatch) {
      phoneMatch.forEach((p) => {
        if (p.replace(/\D/g, "").length >= 7 && !contactInfo.phones.includes(p)) {
          contactInfo.phones.push(p);
        }
      });
    }

    const emailMatch = txt.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (emailMatch) {
      emailMatch.forEach((e) => {
        if (!contactInfo.emails.includes(e)) contactInfo.emails.push(e);
      });
    }
  });

  return {
    title: page.title,
    path: page.path,
    url: page.url,
    siteName: page.siteName || page.title.split("-")[0]?.trim() || "Website",
    logoUrl: page.logoUrl,
    heroBgImage: page.heroBgImage,
    headings,
    paragraphs,
    images: images.map((img) => ({
      src: img.src,
      alt: img.alt || page.title,
      role: img.role || "content",
    })),
    links: links.map((l) => ({
      text: l.text,
      href: l.href,
    })),
    forms,
    sections: sections.map((sec) => ({
      type: sec.type,
      heading: sec.heading,
      subheading: sec.subheading,
      paragraphs: sec.paragraphs,
      buttons: sec.buttons,
      images: sec.images,
      bgImage: sec.bgImage,
      slides: sec.slides,
    })),
    contactInfo,
  };
}

/**
 * Validates redesigned HTML against locked source data to detect content drift.
 */
export function validateContentIntegrity(
  sourcePage: SourcePage,
  redesignedHtml: string,
  runId: string = "unknown_run",
  sourceLabel: string = "unlabeled"
): {
  isValid: boolean;
  warnings: string[];
  driftedElements: string[];
} {
  globalValidationCounter++;
  const valCount = globalValidationCounter;
  const candidateHtmlLength = redesignedHtml.length;
  const candidateHash = crypto.createHash("sha256").update(redesignedHtml).digest("hex");

  const upperCandidate = redesignedHtml.toUpperCase();
  const sourceHeroFound = (sourcePage.headings || []).some((h) => h.text.toUpperCase().includes("POWERING ECOMMERCE"));
  const candidateHeroFound = upperCandidate.includes("POWERING ECOMMERCE");
  const genericWeeklyPostFound = upperCandidate.includes("DON'T MISS OUR WEEKLY POST");
  const genericNewsletterFound = upperCandidate.includes("SUBSCRIBE TO OUR NEWSLETTER");

  console.log(`\n[REDESIGN_VALIDATION_START] runId: ${runId} | valInvocation: ${valCount} | label: ${sourceLabel} | candidateLength: ${candidateHtmlLength} | candidateSha256: ${candidateHash}`);
  console.log(`  - sourceHeroFound: ${sourceHeroFound ? "YES" : "NO"}`);
  console.log(`  - candidateHeroFound: ${candidateHeroFound ? "YES" : "NO"}`);
  console.log(`  - genericWeeklyPostFound: ${genericWeeklyPostFound ? "YES" : "NO"}`);
  console.log(`  - genericNewsletterFound: ${genericNewsletterFound ? "YES" : "NO"}`);

  const warnings: string[] = [];
  const driftedElements: string[] = [];
  const lowerHtml = redesignedHtml.toLowerCase();
  const lowerCleanHtml = lowerHtml.replace(/[^a-z0-9\s]/gi, "");

  // 1. Check Headings preservation (robust against punctuation and HTML entity formatting)
  const primaryHeading = sourcePage.headings.find(
    (h) => h.text && h.text.trim().length > 5 && !h.text.toLowerCase().includes("new message") && !h.text.toLowerCase().includes("cookie")
  )?.text || sourcePage.title;
  if (primaryHeading && primaryHeading.length > 5) {
    const cleanHeadingKey = primaryHeading
      .replace(/[^a-z0-9\s]/gi, "")
      .trim()
      .substring(0, 20)
      .toLowerCase();
    if (cleanHeadingKey && !lowerCleanHtml.includes(cleanHeadingKey)) {
      warnings.push(`Primary heading "${primaryHeading}" was missing or altered in redesign.`);
      driftedElements.push(`Heading: ${primaryHeading}`);
    }
  }

  // 2. Check Key Business / Contact Info Preservation
  const structured = extractStructuredSourcePage(sourcePage);
  structured.contactInfo.emails.forEach((email) => {
    if (!lowerHtml.includes(email.toLowerCase())) {
      warnings.push(`Contact email "${email}" was missing from redesign.`);
      driftedElements.push(`Email: ${email}`);
    }
  });

  // 3. Check for forbidden generic boilerplate content
  const genericBoilerplate = [
    "don't miss our weekly post",
    "subscribe to our newsletter",
    "lorem ipsum dolor sit amet",
    "generic saas template",
  ];

  genericBoilerplate.forEach((phrase) => {
    const sourceHasPhrase = (sourcePage.paragraphs || []).some((p) => p.toLowerCase().includes(phrase));
    if (!sourceHasPhrase && lowerHtml.includes(phrase)) {
      warnings.push(`Unrelated generic content phrase "${phrase}" was introduced in redesign.`);
      driftedElements.push(`Invented phrase: ${phrase}`);
    }
  });

  const isValid = warnings.length === 0;

  const postHash = crypto.createHash("sha256").update(redesignedHtml).digest("hex");
  console.log(`[REDESIGN_VALIDATION_RESULT] runId: ${runId} | valInvocation: ${valCount} | label: ${sourceLabel} | isValid: ${isValid ? "YES" : "NO"} | postSha256: ${postHash} | hashMatch: ${candidateHash === postHash}`);
  console.log(`  - Warnings: [${warnings.join("; ")}]`);
  console.log(`  - DriftedElements: [${driftedElements.join("; ")}]\n`);

  return {
    isValid,
    warnings,
    driftedElements,
  };
}

/**
 * Deterministic Native Redesign Generator: Rebuilds layout, typography, visual containers & hierarchy
 * using 100% locked source content, headings, paragraphs, images, links, forms, and contact info.
 */
export function convertPageToCodeaxysNativeRedesign(
  page: SourcePage,
  globalStyles: GlobalStyles,
  selections: MigrationSelections,
  userPrompt: string = DEFAULT_REDESIGN_PROMPT,
  runId: string = "unknown_run"
): {
  htmlContent: string;
  cssContent: string;
  jsContent: string;
} {
  globalNativeInvocationCounter++;
  const nativeCount = globalNativeInvocationCounter;
  console.log(`\n[REDESIGN_NATIVE_START] runId: ${runId} | path: ${page.path} | invocation: ${nativeCount} | inputHeadingCount: ${page.headings.length} | inputParagraphCount: ${page.paragraphs.length}`);
  const structured = extractStructuredSourcePage(page);
  const siteName = sanitizeText(structured.siteName);
  const logoSrc = structured.logoUrl ? sanitizeText(structured.logoUrl) : "";

  // Determine theme direction from user prompt
  const isDarkTheme = /dark|black|luxury|night|cyber/i.test(userPrompt);
  const isGlassTheme = /glass|blur|modern|futuristic/i.test(userPrompt);

  const bgClass = isDarkTheme ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";
  const cardBgClass = isDarkTheme
    ? "bg-slate-900/80 border-slate-800 text-slate-100 shadow-xl"
    : "bg-white border-slate-200/90 text-slate-900 shadow-md";
  const accentColor = globalStyles?.colors?.primary || (isDarkTheme ? "#818cf8" : "#4f46e5");
  const heroBadgeText = isGlassTheme ? "Redesigned Visual Experience" : "Source-Preserved Redesign";

  let bodyHtml = "";

  // 1. Redesigned Navigation Header
  const navLinksHtml = structured.links.length > 0
    ? structured.links
        .slice(0, 8)
        .map(
          (l) =>
            `<a href="${sanitizeText(l.href)}" class="px-4 py-2 text-xs font-bold transition-all rounded-xl ${
              isDarkTheme ? "text-slate-300 hover:text-white hover:bg-slate-800/80" : "text-slate-700 hover:text-indigo-600 hover:bg-slate-100"
            }">${sanitizeText(l.text)}</a>`
        )
        .join("\n")
    : `<a href="/" class="px-4 py-2 text-xs font-bold text-indigo-500">Home</a>`;

  bodyHtml += `
<header class="sticky top-0 z-50 ${
    isDarkTheme ? "bg-slate-950/80 border-slate-800/80" : "bg-white/80 border-slate-200/80"
  } backdrop-blur-xl border-b px-6 py-4 flex items-center justify-between transition-all">
  <div class="flex items-center gap-3">
    ${logoSrc ? `<img src="${logoSrc}" alt="${siteName}" class="h-9 w-auto object-contain" />` : `<div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-500/20">${siteName.substring(0, 1)}</div>`}
    <span class="font-extrabold text-lg tracking-tight ${isDarkTheme ? "text-white" : "text-slate-900"}">${siteName}</span>
  </div>
  <nav class="hidden md:flex items-center gap-1.5 p-1 rounded-2xl ${isDarkTheme ? "bg-slate-900/90 border border-slate-800" : "bg-slate-100/90 border border-slate-200"}">
    ${navLinksHtml}
  </nav>
</header>`;

  // 2. Redesigned Hero Section (Using Locked Source Headings & Content)
  const heroHeading = sanitizeText(
    structured.sections.find((s) => s.heading && s.heading.trim().length > 3)?.heading ||
    structured.headings.find((h) => h.text && h.text.trim().length > 3)?.text ||
    structured.title
  );
  const heroParagraph = sanitizeText(
    structured.sections.find((s) => s.paragraphs && s.paragraphs.length > 0)?.paragraphs[0] ||
    structured.paragraphs[0] ||
    ""
  );
  const heroImgSrc = structured.images[0]?.src ? sanitizeText(structured.images[0].src) : "";

  bodyHtml += `
<section class="relative py-20 px-6 max-w-7xl mx-auto my-6">
  <div class="p-8 sm:p-14 rounded-3xl ${cardBgClass} backdrop-blur-2xl border flex flex-col lg:flex-row items-center gap-12 relative overflow-hidden">
    <div class="flex-1 space-y-6 text-center lg:text-left z-10">
      <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full ${
        isDarkTheme ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300" : "bg-indigo-50 border-indigo-200 text-indigo-700"
      } border text-xs font-extrabold uppercase tracking-wider">
        <span>${heroBadgeText}</span>
      </div>
      <h1 class="text-4xl sm:text-6xl font-black tracking-tight leading-tight drop-shadow-sm">${heroHeading}</h1>
      ${heroParagraph ? `<p class="text-base sm:text-lg ${isDarkTheme ? "text-slate-300" : "text-slate-600"} leading-relaxed max-w-2xl">${heroParagraph}</p>` : ""}
      
      <div class="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
        ${structured.links
          .slice(0, 2)
          .map(
            (btn) =>
              `<a href="${sanitizeText(btn.href)}" class="px-7 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all shadow-lg shadow-indigo-600/30 active:scale-95">${sanitizeText(btn.text)}</a>`
          )
          .join("\n")}
      </div>
    </div>
    ${
      heroImgSrc
        ? `<div class="flex-1 w-full max-w-lg z-10">
      <div class="relative group">
        <div class="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur-xl opacity-30 group-hover:opacity-60 transition duration-500"></div>
        <img src="${heroImgSrc}" alt="${heroHeading}" class="relative w-full h-auto rounded-3xl border ${isDarkTheme ? "border-slate-800" : "border-slate-200"} shadow-2xl object-cover" />
      </div>
    </div>`
        : ""
    }
  </div>
</section>`;

  // 3. Redesigned Content Sections (Preserving all Source Sections, Paragraphs, Images)
  const remainingSections = structured.sections.filter((s) => s.type !== "header" && s.type !== "footer");

  if (remainingSections.length > 0) {
    remainingSections.forEach((sec, idx) => {
      const heading = sanitizeText(sec.heading);
      const subheading = sanitizeText(sec.subheading);
      const paras = sec.paragraphs.map(sanitizeText).filter(Boolean);
      const secImgs = sec.images.map((i) => sanitizeText(i.src)).filter(Boolean);

      if (!heading && paras.length === 0 && secImgs.length === 0) return;

      bodyHtml += `
<section class="py-12 px-6 max-w-7xl mx-auto space-y-6">
  <div class="p-8 sm:p-10 rounded-3xl ${cardBgClass} space-y-6 border">
    ${heading ? `<h2 class="text-2xl sm:text-3xl font-black tracking-tight border-b ${isDarkTheme ? "border-slate-800" : "border-slate-100"} pb-4">${heading}</h2>` : ""}
    ${subheading ? `<h3 class="text-base font-bold text-indigo-500 uppercase tracking-wide">${subheading}</h3>` : ""}
    
    ${
      paras.length > 0
        ? `<div class="space-y-4">
      ${paras.map((p) => `<p class="text-sm sm:text-base leading-relaxed ${isDarkTheme ? "text-slate-300" : "text-slate-700"}">${p}</p>`).join("\n")}
    </div>`
        : ""
    }

    ${
      secImgs.length > 0
        ? `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
      ${secImgs
        .map(
          (imgUrl) => `
        <div class="overflow-hidden rounded-2xl border ${isDarkTheme ? "border-slate-800" : "border-slate-200"} shadow-sm">
          <img src="${imgUrl}" alt="${heading || siteName}" class="w-full h-56 object-cover hover:scale-105 transition-transform duration-300" />
        </div>`
        )
        .join("\n")}
    </div>`
        : ""
    }
  </div>
</section>`;
    });
  } else {
    // Fallback: If sections were flat, render remaining paragraphs in modern grid cards
    const remainingParas = structured.paragraphs.slice(1);
    if (remainingParas.length > 0) {
      bodyHtml += `
<section class="py-12 px-6 max-w-7xl mx-auto space-y-6">
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    ${remainingParas
      .map(
        (p, pIdx) => `
      <div class="p-8 rounded-3xl ${cardBgClass} space-y-3 border">
        <div class="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-xs">${pIdx + 1}</div>
        <p class="text-sm sm:text-base leading-relaxed ${isDarkTheme ? "text-slate-300" : "text-slate-700"}">${sanitizeText(p)}</p>
      </div>`
      )
      .join("\n")}
  </div>
</section>`;
    }
  }

  // 4. Contact & Business Info Section (If present in source)
  if (structured.contactInfo.phones.length > 0 || structured.contactInfo.emails.length > 0) {
    bodyHtml += `
<section class="py-12 px-6 max-w-7xl mx-auto">
  <div class="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-indigo-900 to-slate-900 text-white shadow-2xl space-y-6 border border-indigo-800">
    <h2 class="text-2xl font-black tracking-tight">Contact & Business Information</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
      ${
        structured.contactInfo.phones.length > 0
          ? `<div><span class="text-xs font-bold text-indigo-300 uppercase block">Phone Numbers:</span><p class="font-mono text-base mt-1">${structured.contactInfo.phones.join(", ")}</p></div>`
          : ""
      }
      ${
        structured.contactInfo.emails.length > 0
          ? `<div><span class="text-xs font-bold text-indigo-300 uppercase block">Email Addresses:</span><p class="font-mono text-base mt-1">${structured.contactInfo.emails.join(", ")}</p></div>`
          : ""
      }
    </div>
  </div>
</section>`;
  }

  // 5. Redesigned Footer
  bodyHtml += `
<footer class="py-12 px-6 ${isDarkTheme ? "bg-slate-950 border-slate-900 text-slate-500" : "bg-slate-900 text-slate-400"} border-t mt-16">
  <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs">
    <p>&copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
    <div class="flex items-center gap-4">
      ${structured.links
        .slice(0, 5)
        .map((l) => `<a href="${sanitizeText(l.href)}" class="hover:text-white transition-colors">${sanitizeText(l.text)}</a>`)
        .join("\n")}
    </div>
  </div>
</footer>`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sanitizeText(page.seo?.seoTitle || page.title)}</title>
  <meta name="description" content="${sanitizeText(page.seo?.metaDescription || "")}">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="styles.css" rel="stylesheet">
</head>
<body class="${bgClass} font-sans antialiased min-h-screen">
  ${bodyHtml}
  <script src="script.js"></script>
</body>
</html>`;

  const cssContent = `/* Source-Preserved Redesigned Styles */
:root {
  --primary-accent: ${accentColor};
}
`;

  const jsContent = `// Codeaxys Redesign Interactive Script
document.addEventListener("DOMContentLoaded", function () {
  console.log("Redesigned Codeaxys Native Page Loaded.");
});
`;

  const upperNative = htmlContent.toUpperCase();
  const nativeHeroFound = upperNative.includes("POWERING ECOMMERCE GROWTH WITH BIGCOMMERCE EXPERTISE.");
  const nativeWeeklyPostFound = upperNative.includes("DON'T MISS OUR WEEKLY POST");
  const nativeNewsletterFound = upperNative.includes("SUBSCRIBE TO OUR NEWSLETTER");

  console.log(`[REDESIGN_NATIVE_RESULT] runId: ${runId} | invocation: ${nativeCount} | outputHtmlLength: ${htmlContent.length} | containsHeroHeading: ${nativeHeroFound ? "YES" : "NO"} | containsWeeklyPost: ${nativeWeeklyPostFound ? "YES" : "NO"} | containsNewsletter: ${nativeNewsletterFound ? "YES" : "NO"}\n`);

  return { htmlContent, cssContent, jsContent };
}

/**
 * Main AI Redesign Orchestrator:
 * Generates redesigned page using Gemini AI with locked source context.
 * Performs validation-aware AI retries (up to 3 redesign generation attempts)
 * with corrective prompt feedback if AI output fails content validation.
 */
export async function generateAIRedesignForPage(
  page: SourcePage,
  globalStyles: GlobalStyles,
  selections: MigrationSelections,
  userPrompt: string = DEFAULT_REDESIGN_PROMPT,
  supabase?: any,
  userId?: string,
  websiteId?: string,
  customRunId?: string
): Promise<{
  htmlContent: string;
  cssContent: string;
  jsContent: string;
  isAiGenerated: boolean;
}> {
  const runId = customRunId || `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const structured = extractStructuredSourcePage(page);
  const structuredJson = JSON.stringify(structured, null, 2);

  const { apiKey, model } = getGeminiConfig();
  const ai = new GoogleGenAI({ apiKey });

  const candidateModels = Array.from(new Set([model || "gemini-3.6-flash", "gemini-3.6-flash", "gemini-3.5-flash"]));

  const exactHeroHeadingStr = "POWERING ECOMMERCE GROWTH WITH BIGCOMMERCE EXPERTISE.";
  const structuredTextUpper = JSON.stringify(structured).toUpperCase();
  const hasExactHeroHeading = structuredTextUpper.includes(exactHeroHeadingStr);

  const maxRedesignAttempts = 3;
  const maxProviderRetries = 3;
  let lastProviderError: any = null;
  let lastValidationWarnings: string[] = [];
  let correctiveFeedback = "";

  for (let redesignAttempt = 1; redesignAttempt <= maxRedesignAttempts; redesignAttempt++) {
    // Build prompt for this redesign attempt
    let basePrompt = `${REDESIGN_SYSTEM_INSTRUCTION}

USER DESIGN DIRECTION INSTRUCTION: "${userPrompt}"

LOCKED SOURCE WEBSITE DATA:
${structuredJson}`;

    if (correctiveFeedback) {
      basePrompt += `

CRITICAL REGENERATION CORRECTION FOR ATTEMPT ${redesignAttempt}:
The previous redesign was rejected by content integrity validation because it altered source content or introduced generic boilerplate phrases.

REJECTION REASONS TO FIX:
${correctiveFeedback}

STRICT REQUIREMENTS FOR THIS REGENERATION:
- CONCEPTUAL RULE: CHANGE DESIGN, NOT CONTENT.
- Preserve all source headings, paragraphs, contact info, and business details exactly.
- Do NOT invent or add generic website template content (NO newsletter subscription blocks, NO "Don't Miss Our Weekly Post", NO fake CTAs, NO fake testimonials).
- Use ONLY source content for textual copy.
- You may redesign visual presentation, typography, colors, component styling, and cards only.`;
    }

    basePrompt += `

Output the redesigned page HTML, CSS, and JS using the exact markers:
===HTML_START===
<!DOCTYPE html>
...
===HTML_END===

===CSS_START===
/* Custom Redesigned CSS */
===CSS_END===

===JS_START===
// Custom Redesigned JS
===JS_END===
`;

    let responseText = "";
    let usedModel = "";

    // Provider retry loop (429 / 500 / 502 / 503 / network errors)
    for (const targetModel of candidateModels) {
      for (let providerAttempt = 1; providerAttempt <= maxProviderRetries; providerAttempt++) {
        try {
          console.log(`\n[AI_TRACE] REDESIGN REQUEST START (runId: ${runId}, RedesignAttempt: ${redesignAttempt}/${maxRedesignAttempts}, Model: ${targetModel}, ProviderAttempt: ${providerAttempt}/${maxProviderRetries})`);
          console.log(`  - Prompt Length: ${basePrompt.length} characters`);
          console.log(`  - Structured Source Length: ${structuredJson.length} characters`);
          console.log(`  - Exact Hero Heading Exists in Prompt: ${hasExactHeroHeading ? "YES ✓" : "NO ❌"}`);

          const response = await ai.models.generateContent({
            model: targetModel,
            contents: [basePrompt],
          });

          responseText = response.text || "";
          usedModel = targetModel;
          break; // Successfully received provider response
        } catch (err: any) {
          lastProviderError = err;
          const errMsg = err?.message || String(err);
          console.warn(`[AI_TRACE] Gemini model ${targetModel} provider attempt ${providerAttempt} error:`, errMsg);

          // Permanent non-retryable errors
          if (
            errMsg.includes("API key") ||
            errMsg.includes("INVALID_ARGUMENT") ||
            errMsg.includes("UNAUTHENTICATED") ||
            errMsg.includes("400") ||
            errMsg.includes("401") ||
            errMsg.includes("403")
          ) {
            console.warn(`[AI_TRACE] Permanent non-retryable error encountered: ${errMsg}`);
            throw new Error(`REDESIGN_AI_PROVIDER_FAILED: ${errMsg}`);
          }

          // Bounded exponential backoff for transient errors
          if (providerAttempt < maxProviderRetries) {
            const delayMs = Math.min(1000 * Math.pow(2, providerAttempt - 1), 4000);
            console.log(`[AI_TRACE] Transient provider error (429/503/network). Waiting ${delayMs}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
      }

      if (responseText) break; // Model succeeded, break candidate models loop
    }

    if (!responseText) {
      // All provider calls failed across models
      const providerErrorDetails = lastProviderError?.message ? lastProviderError.message.substring(0, 150) : "Provider rate limited or unavailable";
      throw new Error(`REDESIGN_AI_PROVIDER_FAILED: AI redesign could not be generated because the AI provider is temporarily unavailable (${providerErrorDetails}). Please retry.`);
    }

    // Extract HTML, CSS, JS
    const htmlMatch = responseText.match(/===HTML_START===([\s\S]*?)===HTML_END===/);
    const cssMatch = responseText.match(/===CSS_START===([\s\S]*?)===CSS_END===/);
    const jsMatch = responseText.match(/===JS_START===([\s\S]*?)===JS_END===/);

    const htmlContent = htmlMatch ? htmlMatch[1].trim() : "";
    const cssContent = cssMatch ? cssMatch[1].trim() : "/* Custom CSS */";
    const jsContent = jsMatch ? jsMatch[1].trim() : "// Custom JS";

    const candidateHash = crypto.createHash("sha256").update(htmlContent).digest("hex");
    const upperCandidate = htmlContent.toUpperCase();
    const heroFound = (page.headings || []).some((h) => h.text && upperCandidate.includes(h.text.toUpperCase().trim().substring(0, 20))) || upperCandidate.includes("POWERING ECOMMERCE");
    const genericWeeklyPostFound = upperCandidate.includes("DON'T MISS OUR WEEKLY POST");
    const genericNewsletterFound = upperCandidate.includes("SUBSCRIBE TO OUR NEWSLETTER");

    if (htmlContent.length < 200) {
      console.log(`[REDESIGN_AI_ATTEMPT] attemptNumber: ${redesignAttempt} | model: ${usedModel} | responseLength: ${htmlContent.length} | candidateHash: ${candidateHash} | heroFound: ${heroFound ? "true" : "false"} | genericWeeklyPostFound: ${genericWeeklyPostFound ? "true" : "false"} | genericNewsletterFound: ${genericNewsletterFound ? "true" : "false"} | isValid: false`);
      lastValidationWarnings = ["Candidate HTML response was incomplete or missing HTML tags."];
      correctiveFeedback = `- Previous output was incomplete or missing standard HTML structure.`;
      continue;
    }

    // Perform Content Integrity Audit
    const validation = validateContentIntegrity(page, htmlContent, runId, `AI_OUTPUT_${usedModel}_redesignAttempt${redesignAttempt}`);

    console.log(`[REDESIGN_AI_ATTEMPT] attemptNumber: ${redesignAttempt} | model: ${usedModel} | responseLength: ${htmlContent.length} | candidateHash: ${candidateHash} | heroFound: ${heroFound ? "true" : "false"} | genericWeeklyPostFound: ${genericWeeklyPostFound ? "true" : "false"} | genericNewsletterFound: ${genericNewsletterFound ? "true" : "false"} | isValid: ${validation.isValid ? "true" : "false"}`);

    if (validation.isValid) {
      console.log(`[REDESIGN ENGINE] Gemini AI Redesign succeeded on attempt ${redesignAttempt}/${maxRedesignAttempts} with model ${usedModel} for ${page.path}`);
      return { htmlContent, cssContent, jsContent, isAiGenerated: true };
    } else {
      console.warn(`[REDESIGN ENGINE] Redesign attempt ${redesignAttempt}/${maxRedesignAttempts} output rejected by content validation audit:`, validation.warnings);
      lastValidationWarnings = validation.warnings;
      correctiveFeedback = validation.warnings.map((w) => `- ${w}`).join("\n");
      // Discard invalid output (never save/persist) and proceed to next redesignAttempt...
    }
  }

  // All 3 redesign generation attempts failed validation audit
  const errorMsg = `REDESIGN_CONTENT_VALIDATION_FAILED: AI redesign could not produce a source-preserving result after ${maxRedesignAttempts} attempts (${lastValidationWarnings.join("; ")})`;
  console.log(`\n[REDESIGN_ERROR_CONSTRUCTION] runId: ${runId} | failureState: REDESIGN_CONTENT_VALIDATION_FAILED | finalErrorMessage: "${errorMsg}"\n`);
  throw new Error(errorMsg);
}
