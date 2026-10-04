import * as cheerio from "cheerio";
import dns from "dns";
import { promisify } from "util";
import {
  SourceWebsiteScan,
  SourcePage,
  PlatformDetectionResult,
  MigrationWarning,
  UrlMapping,
  MigrationSEO,
  MigrationImage,
  MigrationForm,
  MigrationSection,
  MigrationSlide,
  MigrationFloatingAction,
  NavigationItem,
} from "./types";

const lookupAsync = promisify(dns.lookup);
const dnsCache = new Map<string, { address: string; timestamp: number }>();

async function getCachedDnsLookup(hostname: string): Promise<{ address: string }> {
  const lower = hostname.toLowerCase();
  const cached = dnsCache.get(lower);
  if (cached && Date.now() - cached.timestamp < 300000) {
    return { address: cached.address };
  }
  const resolved = await lookupAsync(lower);
  dnsCache.set(lower, { address: resolved.address, timestamp: Date.now() });
  return resolved;
}

// Crawl limits
const CRAWL_LIMITS = {
  MAX_PAGES: 25,
  MAX_DEPTH: 3,
  REQUEST_TIMEOUT_MS: 10000,
  MAX_RESPONSE_BYTES: 5 * 1024 * 1024, // 5MB
  MAX_REDIRECTS: 5,
};

/**
 * Validates if an IP address is a private, loopback, or cloud-metadata address (SSRF Protection).
 */
export function isPrivateOrReservedIP(ip: string): boolean {
  const cleanIp = ip.replace(/^::ffff:/i, "");
  const parts = cleanIp.split(".").map(Number);
  if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    const [a, b, c] = parts;
    if (a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0 || (a === 100 && b >= 64 && b <= 127)) {
      return true;
    }
    return false;
  }
  const lowerIp = cleanIp.toLowerCase();
  if (lowerIp === "::1" || lowerIp === "::" || lowerIp.startsWith("fe80:") || lowerIp.startsWith("fc00:") || lowerIp.startsWith("fd00:")) {
    return true;
  }
  return false;
}

/**
 * Canonical URL normalization helper to ensure trailing-slash and index.html variants
 * resolve to the exact same canonical string representation.
 */
export function normalizePageUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    let pathname = parsed.pathname.toLowerCase();
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    if (pathname === "/index.html" || pathname === "/index.htm" || pathname === "/index.php") {
      pathname = "/";
    }
    const origin = parsed.origin.toLowerCase();
    const cleanPath = pathname === "/" ? "" : pathname;
    return `${origin}${cleanPath}${parsed.search}`;
  } catch {
    return urlStr.trim().toLowerCase();
  }
}

/**
 * Validates URL format and performs DNS lookup to ensure host is not internal/private.
 */
export async function validateAndSanitizeUrl(inputUrl: string): Promise<{
  valid: boolean;
  normalizedUrl?: string;
  error?: string;
}> {
  try {
    let raw = inputUrl.trim();
    if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
      raw = `https://${raw}`;
    }

    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, error: "Only HTTP and HTTPS protocols are supported." };
    }

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".lan")) {
      return { valid: false, error: "Access to private or local networks is forbidden." };
    }

    if (isPrivateOrReservedIP(hostname)) {
      return { valid: false, error: "Access to private IP ranges is forbidden." };
    }

    try {
      const resolved = await getCachedDnsLookup(hostname);
      if (isPrivateOrReservedIP(resolved.address)) {
        return { valid: false, error: `Domain resolves to forbidden private IP (${resolved.address}).` };
      }
    } catch {
      return { valid: false, error: `Unable to resolve host: ${hostname}` };
    }

    const canonicalUrl = normalizePageUrl(raw);
    return {
      valid: true,
      normalizedUrl: canonicalUrl,
    };
  } catch {
    return { valid: false, error: "Malformed URL provided." };
  }
}

/**
 * Safe server-side fetch wrapper.
 */
async function safeFetchHtml(urlStr: string): Promise<{ html: string; finalUrl: string } | null> {
  const urlCheck = await validateAndSanitizeUrl(urlStr);
  if (!urlCheck.valid || !urlCheck.normalizedUrl) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CRAWL_LIMITS.REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(urlCheck.normalizedUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timer);
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html") && !contentType.toLowerCase().includes("xml")) {
      return null;
    }

    const finalUrlCheck = await validateAndSanitizeUrl(res.url);
    if (!finalUrlCheck.valid) return null;

    const reader = res.body?.getReader();
    if (!reader) {
      const html = await res.text();
      return { html, finalUrl: res.url };
    }

    let receivedBytes = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        receivedBytes += value.length;
        if (receivedBytes > CRAWL_LIMITS.MAX_RESPONSE_BYTES) {
          controller.abort();
          break;
        }
        chunks.push(value);
      }
    }

    const buffer = Buffer.concat(chunks);
    const html = buffer.toString("utf-8");
    return { html, finalUrl: res.url };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Helper to resolve relative asset URLs against base URL.
 */
function resolveUrl(relativeUrl: string | undefined, baseUrl: string): string {
  if (!relativeUrl) return "";
  let src = relativeUrl.trim();
  if (src.startsWith("data:")) return "";
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (src.startsWith("/")) return `${baseUrl}${src}`;
  return `${baseUrl}/${src}`;
}

/**
 * Extract background image URL from inline CSS style or data attribute.
 */
function extractBackgroundImageUrl(styleAttr: string | undefined, baseUrl: string): string {
  if (!styleAttr) return "";
  const match = styleAttr.match(/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/i);
  if (match && match[1]) {
    return resolveUrl(match[1], baseUrl);
  }
  return "";
}

/**
 * Detect platform signature.
 */
function detectPlatform(html: string, baseUrl: string): PlatformDetectionResult {
  const signals: string[] = [];
  const $ = cheerio.load(html);

  const generator = $('meta[name="generator"]').attr("content") || "";
  if (generator.toLowerCase().includes("wordpress")) signals.push("meta generator WordPress");
  if (html.includes("wp-content") || html.includes("wp-includes")) signals.push("wp-content/wp-includes URLs");
  if (html.includes("elementor")) signals.push("Elementor builder classes");
  if (generator.toLowerCase().includes("webflow") || html.includes("data-wf-page") || $('html').attr('data-wf-site')) signals.push("Webflow data attributes");
  if (html.includes("cdn.shopify.com") || html.includes("Shopify.theme")) signals.push("Shopify CDN");

  const isWP = signals.some((s) => s.includes("WordPress") || s.includes("wp-content"));
  const isElementor = signals.some((s) => s.includes("Elementor"));
  const isWebflow = signals.some((s) => s.includes("Webflow"));
  const isShopify = signals.some((s) => s.includes("Shopify"));

  if (isWP && isElementor) return { name: "WordPress", confidence: "high", signals: [...signals, "WordPress + Elementor"] };
  if (isWP) return { name: "WordPress", confidence: "high", signals };
  if (isWebflow) return { name: "Webflow", confidence: "high", signals };
  if (isShopify) return { name: "Shopify", confidence: "high", signals };
  if (signals.length > 0) return { name: "Custom website", confidence: "medium", signals };

  return { name: "Unknown", confidence: "low", signals: ["Standard HTML structure"] };
}

/**
 * Extract Page SEO metadata.
 */
function extractSEO($: cheerio.CheerioAPI, pageUrl: string): MigrationSEO {
  const seoTitle = $("title").first().text().trim() || $('meta[property="og:title"]').attr("content") || "";
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || $('meta[property="og:description"]').attr("content")?.trim() || "";
  const canonicalUrl = $('link[rel="canonical"]').attr("href")?.trim() || pageUrl;
  const robots = $('meta[name="robots"]').attr("content")?.trim() || "index, follow";
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const ogDescription = $('meta[property="og:description"]').attr("content")?.trim();
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim();

  let structuredData: any = null;
  try {
    const jsonLd = $('script[type="application/ld+json"]').first().html();
    if (jsonLd) structuredData = JSON.parse(jsonLd);
  } catch {
    // Ignore JSON-LD errors
  }

  return { seoTitle, metaDescription, canonicalUrl, robots, ogTitle, ogDescription, ogImage, structuredData };
}

/**
 * Extract Floating Actions (WhatsApp, Phone).
 */
function extractFloatingActions($: cheerio.CheerioAPI, baseUrl: string): MigrationFloatingAction[] {
  const actions: MigrationFloatingAction[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim();
    const isWa = href.includes("wa.me") || href.includes("api.whatsapp.com") || href.includes("whatsapp");
    const isTel = href.startsWith("tel:");

    if (isWa && !actions.some((a) => a.type === "whatsapp")) {
      actions.push({
        type: "whatsapp",
        label: text || "WhatsApp",
        url: href.startsWith("http") ? href : `https://${href.replace(/^\/\//, "")}`,
      });
    } else if (isTel && !actions.some((a) => a.type === "phone")) {
      actions.push({
        type: "phone",
        label: text || href.replace("tel:", ""),
        url: href,
      });
    }
  });

  return actions;
}

/**
 * Extract Header & Logo.
 */
function extractHeaderAndLogo($: cheerio.CheerioAPI, baseUrl: string, pageTitle: string): {
  siteName: string;
  logoUrl?: string;
  headerButtons: { text: string; href: string }[];
  navItems: NavigationItem[];
} {
  const $header = $("header, .header, .navbar, nav").first();
  let logoUrl = "";

  // 1. Logo search
  const $logoImg = $("img[src*='logo'], img[alt*='logo'], header img, .logo img").first();
  if ($logoImg.length > 0) {
    logoUrl = resolveUrl($logoImg.attr("src") || $logoImg.attr("data-src"), baseUrl);
  }

  // 2. Site Name search
  let siteName = $('meta[property="og:site_name"]').attr("content")?.trim() || "";
  if (!siteName && $header.length > 0) {
    siteName = $header.find(".logo-text, .brand, h1, h2, a.navbar-brand").first().text().trim();
  }
  if (!siteName) {
    siteName = pageTitle.split("-")[0]?.split("|")[0]?.trim() || "Website";
  }
  // Sanitize out generic labels
  if (siteName.toLowerCase().includes("navigation header")) {
    siteName = pageTitle.split("-")[0]?.split("|")[0]?.trim() || "Website";
  }

  // 3. Navigation & Header Action Buttons (e.g. 360° Virtual Tour, Book Appointment)
  const navItems: NavigationItem[] = [];
  const headerButtons: { text: string; href: string }[] = [];

  const $menuLinks = $header.length > 0 ? $header.find("a[href]") : $("nav a[href], .menu a[href]");
  $menuLinks.each((_, el) => {
    const text = $(el).text().trim();
    const href = resolveUrl($(el).attr("href"), baseUrl);
    const cls = $(el).attr("class") || "";

    if (text && href && text.length < 35 && !href.startsWith("javascript:")) {
      if (cls.toLowerCase().includes("btn") || text.toLowerCase().includes("tour") || text.toLowerCase().includes("book") || text.toLowerCase().includes("appointment")) {
        if (!headerButtons.some((b) => b.text === text)) {
          headerButtons.push({ text, href });
        }
      } else {
        if (!navItems.some((n) => n.url === href || n.label === text)) {
          navItems.push({ label: text, url: href });
        }
      }
    }
  });

  return { siteName, logoUrl, headerButtons: headerButtons.slice(0, 5), navItems: navItems.slice(0, 10) };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanCtaText(rawText: string, heading?: string, subheading?: string): string {
  if (!rawText) return "";
  let clean = rawText.replace(/[\r\n\t]+/g, " ").trim();

  if (heading && heading.length > 3) {
    clean = clean.replace(new RegExp(escapeRegExp(heading), "gi"), "").trim();
  }
  if (subheading && subheading.length > 3) {
    clean = clean.replace(new RegExp(escapeRegExp(subheading), "gi"), "").trim();
  }

  clean = clean.replace(/\s+/g, " ").trim();

  if (clean.length > 35) {
    const commonActions = ["book appointment", "contact us", "learn more", "read more", "explore", "view tour", "book now", "get started", "360° virtual tour", "call us"];
    const lower = clean.toLowerCase();
    const matched = commonActions.find((a) => lower.includes(a));
    if (matched) {
      return matched.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    const words = clean.split(" ");
    if (words.length <= 4) return words.join(" ");
    return "Book Appointment";
  }

  return clean || "Book Appointment";
}

function extractStrictSlideBgImage($s: cheerio.Cheerio<any>, baseUrl: string): string {
  let bg = extractBackgroundImageUrl($s.attr("style"), baseUrl);
  if (bg) return bg;

  bg = extractBackgroundImageUrl($s.attr("data-bg") || $s.attr("data-background") || $s.attr("data-src") || $s.attr("data-lazy-src"), baseUrl);
  if (bg) return bg;

  const $childBg = $s.find(".elementor-slide-bg, [style*='background'], [data-bg]").first();
  if ($childBg.length > 0) {
    bg = extractBackgroundImageUrl($childBg.attr("style"), baseUrl) || extractBackgroundImageUrl($childBg.attr("data-bg") || $childBg.attr("data-src"), baseUrl);
    if (bg) return bg;
  }

  const $img = $s.find("img").first();
  if ($img.length > 0) {
    const src = resolveUrl($img.attr("src") || $img.attr("data-src") || $img.attr("data-lazy-src"), baseUrl);
    if (src) return src;
  }

  return "";
}

/**
 * Deep Structural Page Decomposition for High-Fidelity Migration.
 */
function extractPageSections($: cheerio.CheerioAPI, baseUrl: string, pageTitle: string): {
  sections: MigrationSection[];
  heroBgImage?: string;
  slides: MigrationSlide[];
  allImages: MigrationImage[];
} {
  const sections: MigrationSection[] = [];
  const slides: MigrationSlide[] = [];
  const allImages: MigrationImage[] = [];
  let heroBgImage = "";

  // 1. Discover top-level root slide containers strictly without parent-child duplication
  let $candidateSlides = $(".swiper-slide, .slick-slide, .carousel-item, [class*='elementor-repeater-item'], rs-slide, .hero-slide");
  if ($candidateSlides.length === 0) {
    $candidateSlides = $(".slider > div, .carousel > div, #hero .slide, .hero .slide");
  }

  // Filter candidate nodes to ensure only root slide container nodes are processed
  const candidateArr = $candidateSlides.toArray();
  const rootSlideNodes: any[] = [];
  $candidateSlides.each((_, el) => {
    const $el = $(el);
    const isChild = $el.parents().filter((_, p) => candidateArr.includes(p)).length > 0;
    if (!isChild) {
      rootSlideNodes.push(el);
    }
  });

  rootSlideNodes.forEach((slideEl, sIdx) => {
    const $s = $(slideEl);
    const bgImg = extractStrictSlideBgImage($s, baseUrl);

    const $headingEl = $s.find("h1, h2, .elementor-slide-heading, [class*='title']").first();
    let hText = $headingEl.text().replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();

    const $subEl = $s.find(".elementor-slide-description, .slide-desc, .sub-title, p, h3").first();
    let subText = $subEl.text().replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();

    if (subText && hText && subText.toLowerCase() === hText.toLowerCase()) {
      subText = "";
    } else if (subText && hText && subText.toLowerCase().includes(hText.toLowerCase())) {
      subText = subText.replace(new RegExp(escapeRegExp(hText), "gi"), "").trim();
    }

    const ctaEl = $s.find("a.btn, a.button, a.elementor-button, a[href]").first();
    const rawCtaText = ctaEl.find(".elementor-button-text, .btn-text, span").first().text() || ctaEl.text();
    const ctaText = cleanCtaText(rawCtaText, hText, subText);
    const ctaHref = resolveUrl(ctaEl.attr("href"), baseUrl);

    const fgImages: string[] = [];
    $s.find("img").each((_, img) => {
      const src = resolveUrl($(img).attr("src") || $(img).attr("data-src"), baseUrl);
      if (src && src !== bgImg && !fgImages.includes(src)) {
        fgImages.push(src);
      }
    });

    if (hText || subText || bgImg) {
      if (!heroBgImage && bgImg) heroBgImage = bgImg;
      slides.push({
        index: sIdx,
        heading: hText,
        subheading: subText,
        bgImage: bgImg,
        foregroundImages: fgImages,
        cta: ctaText && ctaHref ? { text: ctaText, href: ctaHref } : undefined,
      });

      if (process.env.NODE_ENV !== "production") {
        console.log(`[Exact Migration Scan - Slide ${sIdx}] bg: "${bgImg}", heading: "${hText}", cta: "${ctaText}"`);
      }
    }
  });

  // If slider slides were detected, instantiate dedicated Hero Section at index 0
  if (slides.length > 0) {
    const firstSlide = slides[0];
    sections.push({
      type: "hero",
      classification: "imported",
      heading: firstSlide.heading || pageTitle,
      subheading: firstSlide.subheading || undefined,
      paragraphs: firstSlide.subheading ? [firstSlide.subheading] : [],
      buttons: slides.map((s) => s.cta).filter(Boolean) as { text: string; href: string }[],
      images: slides
        .map((s) => (s.bgImage ? { src: s.bgImage, alt: s.heading || "Hero Slide", role: "hero" as const } : null))
        .filter(Boolean) as MigrationImage[],
      bgImage: heroBgImage || firstSlide.bgImage || undefined,
      slides: slides,
      htmlSnippet: "",
    });
  }

  // 2. Discover structural sections across the entire page body
  const $body = $("body").first();

  // Find candidate section nodes (support Elementor, VC, Bootstrap, Semantic HTML5)
  let $sectionElements = $body.find("section, .elementor-section, .elementor-top-section, article, div[id*='section'], div[class*='section']");
  if ($sectionElements.length === 0) {
    $sectionElements = $body.find("main > div, #content > div, body > div.container, body > div.row");
  }
  if ($sectionElements.length === 0) {
    $sectionElements = $body.find("div").filter((_, el) => {
      return $(el).find("h1, h2, h3").length > 0;
    });
  }

  // Process distinct structural section blocks
  $sectionElements.each((idx, el) => {
    const $sec = $(el);

    // Skip nested sections inside already processed parent sections to prevent duplicates
    if ($sec.parents("section, .elementor-section").length > 0) return;

    // Skip section if it is the hero slider container already captured as dedicated hero section
    if (slides.length > 0 && ($sec.hasClass("slider") || $sec.find(".swiper-slide, .slick-slide, .elementor-slide-content, rs-slide").length > 0)) {
      return;
    }

    const bgImg = extractBackgroundImageUrl($sec.attr("style"), baseUrl) || extractBackgroundImageUrl($sec.find("[style*='background']").first().attr("style"), baseUrl);
    if (!heroBgImage && sections.length === 0 && idx === 0 && bgImg) {
      heroBgImage = bgImg;
    }

    const headings: string[] = [];
    $sec.find("h1, h2, h3, h4").each((_, h) => {
      const text = $(h).text().trim();
      if (text && text.length > 2 && !headings.includes(text)) {
        headings.push(text);
      }
    });

    const paragraphs: string[] = [];
    $sec.find("p, li").each((_, p) => {
      const text = $(p).text().trim();
      if (text && text.length > 10 && !paragraphs.includes(text)) {
        paragraphs.push(text);
      }
    });

    const buttons: { text: string; href: string }[] = [];
    $sec.find("a.btn, a.button, button, a[href]").each((_, a) => {
      const text = $(a).text().trim();
      const href = resolveUrl($(a).attr("href"), baseUrl);
      if (text && href && text.length > 1 && text.length < 40 && !href.startsWith("javascript:")) {
        buttons.push({ text, href });
      }
    });

    const secImages: MigrationImage[] = [];
    $sec.find("img").each((_, img) => {
      const src = resolveUrl($(img).attr("src") || $(img).attr("data-src"), baseUrl);
      const alt = $(img).attr("alt") || "";
      if (src && !secImages.some((i) => i.src === src)) {
        const item: MigrationImage = { src, alt, role: sections.length === 0 ? "hero" : "content" };
        secImages.push(item);
        if (!allImages.some((i) => i.src === src)) {
          allImages.push(item);
        }
      }
    });

    if (headings.length > 0 || paragraphs.length > 0 || secImages.length > 0 || bgImg) {
      let type: MigrationSection["type"] = "content";
      if (sections.length === 0 && idx === 0) {
        type = "hero";
      } else if (headings.some((h) => /feature|service|treatment|therapy|what we do|roots|philosophy/i.test(h))) {
        type = "features";
      } else if (headings.some((h) => /faq|question|frequently/i.test(h))) {
        type = "faq";
      } else if (secImages.length >= 3) {
        type = "gallery";
      } else if (headings.some((h) => /contact|reach|location|address/i.test(h))) {
        type = "contact";
      }

      const isComplexSlider = type === "hero" && slides.length > 0;
      const isComplexLayout = !!bgImg || $sec.hasClass("elementor-section") || $sec.hasClass("vc_row") || $sec.find(".swiper-container, .slick-slider, .carousel, .owl-carousel").length > 0;
      const classification: MigrationSection["classification"] = (isComplexSlider || isComplexLayout) ? "imported" : "native";

      sections.push({
        type,
        classification,
        heading: headings[0] || undefined,
        subheading: headings[1] || undefined,
        paragraphs,
        buttons: buttons.slice(0, 5),
        images: secImages,
        bgImage: bgImg || undefined,
        slides: type === "hero" && slides.length > 0 ? slides : undefined,
        htmlSnippet: $sec.html()?.substring(0, 3000) || "",
      });
    }
  });

  // Fallback section if structural section discovery yielded nothing
  if (sections.length === 0) {
    const allP: string[] = [];
    $("p").each((_, p) => {
      const text = $(p).text().trim();
      if (text && text.length > 10) allP.push(text);
    });

    sections.push({
      type: "hero",
      heading: pageTitle,
      paragraphs: allP,
      buttons: [],
      images: allImages,
      htmlSnippet: $("body").html()?.substring(0, 3000) || "",
    });
  }

  return { sections, heroBgImage, slides, allImages };
}

/**
 * Primary Bounded Crawler & Discovery Entrypoint.
 */
export async function scanSourceWebsite(inputUrl: string): Promise<SourceWebsiteScan> {
  const urlCheck = await validateAndSanitizeUrl(inputUrl);
  if (!urlCheck.valid || !urlCheck.normalizedUrl) {
    throw new Error(urlCheck.error || "Invalid URL for website migration scan.");
  }

  const startUrl = urlCheck.normalizedUrl;
  const parsedBase = new URL(startUrl);
  const baseUrl = parsedBase.origin;
  const domain = parsedBase.hostname;

  const visitedUrls = new Set<string>();
  const pages: SourcePage[] = [];
  const urlMappings: UrlMapping[] = [];
  const warnings: MigrationWarning[] = [];
  const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 1 }];

  let platform: PlatformDetectionResult = { name: "Unknown", confidence: "low", signals: [] };

  let mainNav: NavigationItem[] = [];
  let footerNav: NavigationItem[] = [];
  let siteName = "";
  let logoUrl = "";
  let discoveredImageCount = 0;
  let discoveredFormCount = 0;
  let blogCount = 0;

  while (queue.length > 0 && visitedUrls.size < CRAWL_LIMITS.MAX_PAGES) {
    const current = queue.shift()!;
    const normCurrentUrl = normalizePageUrl(current.url);
    if (visitedUrls.has(normCurrentUrl)) continue;
    visitedUrls.add(normCurrentUrl);

    const fetched = await safeFetchHtml(current.url);
    if (!fetched) continue;

    const $ = cheerio.load(fetched.html);
    const seo = extractSEO($, fetched.finalUrl);

    if (pages.length === 0) {
      // First Page (Homepage)
      platform = detectPlatform(fetched.html, baseUrl);

      const headerInfo = extractHeaderAndLogo($, baseUrl, seo.seoTitle || domain);
      siteName = headerInfo.siteName;
      logoUrl = headerInfo.logoUrl || "";
      mainNav = headerInfo.navItems;

      $("footer a").each((_, a) => {
        const txt = $(a).text().trim();
        const href = resolveUrl($(a).attr("href"), baseUrl);
        if (txt && href && !footerNav.some((f) => f.url === href)) {
          footerNav.push({ label: txt, url: href });
        }
      });

      if (fetched.html.includes("google-analytics.com") || fetched.html.includes("gtag")) {
        warnings.push({
          type: "unsupported_script",
          message: "Google Analytics snippet detected. Re-configure analytics in Codeaxys domain settings.",
        });
      }
    }

    const parsedPageUrl = new URL(fetched.finalUrl);
    let rawPath = parsedPageUrl.pathname;
    if (rawPath === "/" || rawPath === "") {
      rawPath = "index.html";
    } else {
      rawPath = rawPath.replace(/^\//, "").replace(/\/$/, "");
      if (!rawPath.endsWith(".html")) {
        rawPath += ".html";
      }
    }

    const slug = rawPath.replace(/\.html$/, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "home";

    const headings: { level: number; text: string }[] = [];
    $("h1, h2, h3, h4").each((_, h) => {
      const tag = (h as any).name || "h2";
      const level = parseInt(tag.replace("h", "")) || 2;
      const text = $(h).text().trim();
      if (text) headings.push({ level, text });
    });

    const paragraphs: string[] = [];
    $("p, li").each((_, p) => {
      const text = $(p).text().trim();
      if (text && text.length > 10 && !paragraphs.includes(text)) paragraphs.push(text);
    });

    const pageForms: MigrationForm[] = [];
    $("form").each((_, form) => {
      const action = $(form).attr("action");
      const method = $(form).attr("method") || "POST";
      const fieldNames: string[] = [];
      $(form).find("input, select, textarea").each((_, field) => {
        const name = $(field).attr("name") || $(field).attr("placeholder");
        if (name) fieldNames.push(name);
      });
      pageForms.push({ action, method, fieldNames, hasSubmitButton: $(form).find("button, input[type='submit']").length > 0 });
    });

    if (pageForms.length > 0) {
      discoveredFormCount += pageForms.length;
      warnings.push({
        type: "form_needs_setup",
        message: `Form with ${pageForms[0].fieldNames.length} fields detected on ${rawPath}. Configure Codeaxys form handler.`,
      });
    }

    const floatingActions = extractFloatingActions($, baseUrl);
    const { sections, heroBgImage, slides, allImages } = extractPageSections($, baseUrl, seo.seoTitle || slug);

    discoveredImageCount += allImages.length;

    const isBlog = rawPath.includes("blog") || rawPath.includes("post") || rawPath.includes("article");
    if (isBlog) blogCount++;

    pages.push({
      url: fetched.finalUrl,
      path: rawPath,
      slug,
      title: seo.seoTitle || headings[0]?.text || slug,
      siteName,
      logoUrl,
      heroBgImage,
      headings,
      paragraphs,
      images: allImages,
      links: [],
      forms: pageForms,
      sections,
      floatingActions,
      seo,
      isBlogPage: isBlog,
    });

    urlMappings.push({
      originalUrl: fetched.finalUrl,
      originalPath: parsedPageUrl.pathname,
      newSlug: slug === "home" || slug === "index" ? "/" : `/${slug}`,
      requiresRedirect: parsedPageUrl.pathname !== `/${slug}` && parsedPageUrl.pathname !== "/",
    });

    // Bounded crawler queue filling
    if (current.depth < CRAWL_LIMITS.MAX_DEPTH && queue.length + visitedUrls.size < CRAWL_LIMITS.MAX_PAGES) {
      $("a[href]").each((_, a) => {
        const href = $(a).attr("href");
        if (!href) return;
        try {
          const resolved = resolveUrl(href, baseUrl);
          const normResolved = normalizePageUrl(resolved);
          const parsedRes = new URL(normResolved);
          if (parsedRes.hostname === domain && !visitedUrls.has(normResolved) && !queue.some((q) => normalizePageUrl(q.url) === normResolved)) {
            queue.push({ url: normResolved, depth: current.depth + 1 });
          }
        } catch {
          // Ignore invalid hrefs
        }
      });
    }
  }

  if (pages.length === 0) {
    pages.push({
      url: startUrl,
      path: "index.html",
      slug: "home",
      title: siteName || domain,
      siteName,
      logoUrl,
      heroBgImage: "",
      headings: [],
      paragraphs: [],
      images: [],
      links: [],
      forms: [],
      sections: [],
      floatingActions: [],
      seo: { seoTitle: siteName || domain, metaDescription: "" },
      isBlogPage: false,
    });
    urlMappings.push({
      originalUrl: startUrl,
      originalPath: "/",
      newSlug: "/",
      requiresRedirect: false,
    });
  }

  return {
    targetUrl: startUrl,
    baseUrl,
    domain,
    siteName,
    logoUrl,
    platform,
    pages,
    navigation: {
      main: mainNav.slice(0, 10),
      footer: footerNav.slice(0, 10),
    },
    globalStyles: {
      colors: {
        primary: "#059669",
        secondary: "#10b981",
        background: "#ffffff",
        text: "#0f172a",
      },
      fonts: ["Inter", "sans-serif"],
      buttonStyle: "rounded-xl font-bold bg-emerald-600 text-white",
    },
    summary: {
      pagesCount: pages.length,
      imagesCount: discoveredImageCount,
      navMenusCount: mainNav.length > 0 ? 1 : 0,
      formsCount: discoveredFormCount,
      blogPagesCount: blogCount,
      seoRecordsCount: pages.length,
    },
    urlMappings,
    warnings,
  };
}
