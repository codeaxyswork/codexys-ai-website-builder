import { SourcePage, GlobalStyles, MigrationMode, MigrationSelections, MigrationSlide } from "./types";

/**
 * Clean & sanitize raw text/HTML snippet.
 */
function sanitizeText(str?: string): string {
  if (!str) return "";
  return str
    .replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'href="#"')
    .replace(/src\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'src=""')
    .trim();
}

/**
 * Converts a captured browser snapshot or HTML snippet into a Codeaxys Exact Snapshot Page.
 */
export function convertPageToExactSnapshot(
  snapshot: {
    html: string;
    css?: string;
    slides?: MigrationSlide[];
    title?: string;
  },
  migrationId: string = "snapshot"
): {
  htmlContent: string;
  cssContent: string;
  jsContent: string;
} {
  const scopeClass = `codeaxys-migration-snapshot-${migrationId.replace(/[^a-z0-9_-]/gi, "-")}`;
  const rawCss = snapshot.css || "";

  let scopedCss = rawCss
    .replace(/body\s*\{/gi, `.${scopeClass} {`)
    .replace(/html\s*\{/gi, `.${scopeClass} {`);

  const jsContent = `// Codeaxys Secondary Guard Controller
document.addEventListener("DOMContentLoaded", function () {
  if (!window.__codeaxys_fallback_bound) {
    window.__codeaxys_fallback_bound = true;
    const menuToggles = document.querySelectorAll(".elementor-menu-toggle, .navbar-toggler, .hamburger, button[aria-label*='menu'], [class*='menu-toggle'], [class*='nav-toggle'], [class*='hamburger']");
    menuToggles.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        if (btn.getAttribute("aria-expanded") === "true") return;
        const navPanel = document.querySelector(".elementor-nav-menu, nav, .navbar-collapse, [class*='menu-dropdown'], [class*='nav-menu']");
        if (navPanel && window.getComputedStyle(navPanel).display === "none") {
          navPanel.style.display = "block";
          btn.setAttribute("aria-expanded", "true");
        }
      });
    });
  }
});`;

  let htmlContent = snapshot.html || "";
  if (!htmlContent.toLowerCase().includes("<!doctype") && !htmlContent.toLowerCase().includes("<html")) {
    const cleanTitle = snapshot.title ? snapshot.title.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "Codeaxys Exact Snapshot";
    htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanTitle}</title>
  <style>
    .${scopeClass} {
      width: 100%;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    ${scopedCss}
  </style>
</head>
<body class="bg-white text-slate-900 font-sans antialiased min-h-screen">
  <div class="${scopeClass}" id="codeaxys-migration-snapshot">
    ${htmlContent}
  </div>
  <script>${jsContent}</script>
</body>
</html>`;
  } else {
    const styleTag = `<style>\n${scopedCss}\n</style>`;
    const scriptTag = `<script>\n${jsContent}\n</script>`;
    if (htmlContent.includes("</head>")) {
      htmlContent = htmlContent.replace("</head>", `${styleTag}\n</head>`);
    } else {
      htmlContent = styleTag + htmlContent;
    }
    if (htmlContent.includes("</body>")) {
      htmlContent = htmlContent.replace("</body>", `${scriptTag}\n</body>`);
    } else {
      htmlContent = htmlContent + scriptTag;
    }
  }

  return { htmlContent, cssContent: scopedCss, jsContent };
}

/**
 * Convert extracted SourcePage into a high-fidelity Codeaxys Native Page.
 * Implements strict mode-specific behavior:
 * - 'exact': HYBRID NATIVE-FIRST + FIDELITY-PRESERVING FALLBACK (Header/logo, hero background, hero sliders, full section hierarchy, section background images, floating WhatsApp/Phone actions, exact text & imagery).
 * - 'redesign': Keeps source content, modernizes visual design system & section containers.
 * - 'rebuild': Semantic reconstruction into high-converting Codeaxys layout using source truth.
 */
export function convertPageToCodeaxysNative(
  page: SourcePage,
  globalStyles: GlobalStyles,
  mode: MigrationMode,
  selections: MigrationSelections
): {
  htmlContent: string;
  cssContent: string;
  jsContent: string;
} {
  const primaryColor = selections.design.colors ? globalStyles.colors.primary || "#059669" : "#059669";
  const textColor = selections.design.colors ? globalStyles.colors.text || "#0f172a" : "#0f172a";
  const bg = selections.design.colors ? globalStyles.colors.background || "#ffffff" : "#ffffff";

  let bodySectionsHtml = "";

  // 1. Header & Brand Navigation
  const siteName = sanitizeText(page.siteName || page.title.split("-")[0]?.trim() || "Website");
  const logoSrc = page.logoUrl ? sanitizeText(page.logoUrl) : "";

  const headerSec = page.sections.find((s) => s.type === "header");
  const headerActionBtns = (headerSec?.buttons || []).map((b) => ({
    text: sanitizeText(b.text),
    href: sanitizeText(b.href),
  }));

  const navHtml = page.links && page.links.length > 0
    ? page.links.slice(0, 8).map((l) => `<a href="${sanitizeText(l.href)}" class="px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-emerald-700 transition-colors">${sanitizeText(l.text)}</a>`).join("\n")
    : `<a href="/" class="px-3.5 py-2 text-sm font-semibold text-emerald-700">Home</a>`;

  const headerCtaBtn = headerActionBtns[0]
    ? `<a href="${headerActionBtns[0].href}" class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-sm">${headerActionBtns[0].text}</a>`
    : "";

  if (mode === "exact") {
    bodySectionsHtml += `
<header class="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
  <div class="flex items-center gap-3">
    ${logoSrc ? `<img src="${logoSrc}" alt="${siteName}" class="h-10 w-auto object-contain" />` : `<span class="font-extrabold text-slate-900 text-xl tracking-tight">${siteName}</span>`}
  </div>
  <nav class="hidden md:flex items-center gap-2">
    ${navHtml}
  </nav>
  ${headerCtaBtn ? `<div>${headerCtaBtn}</div>` : ""}
</header>`;
  } else if (mode === "redesign") {
    bodySectionsHtml += `
<header class="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between shadow-2xs">
  <div class="flex items-center gap-3">
    ${logoSrc ? `<img src="${logoSrc}" alt="${siteName}" class="h-9 w-auto object-contain" />` : `<div class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white font-extrabold text-base shadow-sm">${siteName.substring(0, 1)}</div>`}
    <span class="font-extrabold text-slate-900 text-lg tracking-tight">${siteName}</span>
  </div>
  <nav class="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
    ${navHtml}
  </nav>
  ${headerCtaBtn ? `<div>${headerCtaBtn}</div>` : ""}
</header>`;
  } else {
    // rebuild mode
    bodySectionsHtml += `
<header class="sticky top-0 z-50 bg-slate-900 text-white border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-xl">
  <div class="flex items-center gap-3">
    <span class="font-black text-white text-xl tracking-tight">${siteName}</span>
  </div>
  <nav class="hidden md:flex items-center gap-3">
    ${navHtml}
  </nav>
</header>`;
  }

  // 2. Process Page Sections (Preserving Original Document Order)
  page.sections.forEach((sec) => {
    if (sec.type === "header" || sec.type === "footer") return;

    const heading = sanitizeText(sec.heading);
    const subheading = sanitizeText(sec.subheading);
    const paragraphs = sec.paragraphs.map(sanitizeText).filter(Boolean);
    const images = sec.images;
    const buttons = sec.buttons;
    const bgImg = sec.bgImage ? sanitizeText(sec.bgImage) : "";
    const isImported = sec.classification === "imported";

    if (mode === "exact") {
      // HIGH-FIDELITY EXACT MODE (Native-First + Fidelity-Preserving Fallback)
      if (isImported || sec.type === "hero") {
        const mainHeading = heading || sanitizeText(page.title);
        const bodyText = subheading || paragraphs[0] || "";
        const heroBg = bgImg || (page.heroBgImage ? sanitizeText(page.heroBgImage) : "");
        const heroImg = images[0]?.src ? sanitizeText(images[0].src) : "";

        let slidesHtml = "";
        if (sec.slides && sec.slides.length > 0) {
          const slidesCount = sec.slides.length;
          slidesHtml = `
<div class="relative w-full overflow-hidden rounded-3xl border border-slate-700 shadow-2xl bg-slate-900 group" id="hero-slider-container">
  <div class="flex transition-transform duration-500 ease-out w-full" id="hero-slider-track">
    ${sec.slides
      .map((s) => {
        const slideBg = s.bgImage ? sanitizeText(s.bgImage) : heroBg;
        return `
    <div class="w-full shrink-0 min-h-[440px] sm:min-h-[520px] p-8 sm:p-16 ${slideBg ? 'bg-cover bg-center text-white relative flex flex-col justify-center' : 'bg-slate-900 text-white flex flex-col justify-center'}" ${slideBg ? `style="background-image: linear-gradient(to right, rgba(15, 23, 42, 0.85) 0%, rgba(15, 23, 42, 0.45) 60%, rgba(15, 23, 42, 0.15) 100%), url('${slideBg}');"` : ""}>
      <div class="max-w-3xl space-y-4">
        ${s.heading ? `<h1 class="text-3xl sm:text-5xl font-black leading-tight tracking-tight drop-shadow-md text-white">${sanitizeText(s.heading)}</h1>` : ""}
        ${s.subheading ? `<p class="text-lg sm:text-xl text-emerald-300 leading-relaxed font-bold tracking-wide drop-shadow-xs max-w-2xl">${sanitizeText(s.subheading)}</p>` : ""}
        ${s.cta && s.cta.text ? `<div class="pt-4 flex flex-wrap gap-3"><a href="${sanitizeText(s.cta.href)}" class="px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm inline-block shadow-lg shadow-emerald-600/30 transition-transform active:scale-95 uppercase tracking-wider">${sanitizeText(s.cta.text)}</a></div>` : ""}
      </div>
    </div>`;
      })
      .join("\n")}
  </div>
  ${
    slidesCount > 1
      ? `
  <!-- Navigation Arrows -->
  <button onclick="prevHeroSlide()" class="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-slate-900/90 border border-white/20 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs hover:scale-110 z-10" aria-label="Previous Slide">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
  </button>
  <button onclick="nextHeroSlide()" class="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-slate-900/90 border border-white/20 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs hover:scale-110 z-10" aria-label="Next Slide">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
  </button>
  <!-- Pagination Dots -->
  <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
    ${sec.slides
      .map(
        (_, sIdx) => `
      <button onclick="goToHeroSlide(${sIdx})" class="hero-dot w-3 h-3 rounded-full transition-all ${sIdx === 0 ? 'bg-emerald-500 w-8' : 'bg-white/50 hover:bg-white'}" data-slide="${sIdx}" aria-label="Slide ${sIdx + 1}"></button>`
      )
      .join("\n")}
  </div>`
      : ""
  }
</div>`;
        }

        const ctaBtn = buttons[0]
          ? `<a href="${sanitizeText(buttons[0].href)}" class="px-7 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95 inline-block">${sanitizeText(buttons[0].text)}</a>`
          : "";

        bodySectionsHtml += `
<section class="relative py-12 px-4 sm:px-6 max-w-6xl mx-auto my-4">
  ${slidesHtml ? `<div class="w-full">${slidesHtml}</div>` : `
  <div class="flex flex-col lg:flex-row items-center gap-12 p-8 sm:p-14 bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl" ${heroBg ? `style="background-image: linear-gradient(to right, rgba(15, 23, 42, 0.85) 0%, rgba(15, 23, 42, 0.45) 60%, rgba(15, 23, 42, 0.15) 100%), url('${heroBg}');"` : ""}>
    <div class="flex-1 space-y-6 text-center lg:text-left">
      <h1 class="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight drop-shadow-lg">${mainHeading}</h1>
      ${bodyText ? `<p class="text-lg sm:text-xl text-slate-200 leading-relaxed max-w-2xl font-medium drop-shadow-xs">${bodyText}</p>` : ""}
      ${ctaBtn ? `<div class="pt-4">${ctaBtn}</div>` : ""}
    </div>
    ${heroImg && !heroBg ? `<div class="flex-1 w-full max-w-lg"><img src="${heroImg}" alt="${mainHeading}" class="w-full h-auto rounded-2xl border border-slate-200 shadow-xl object-cover" /></div>` : ""}
  </div>`}
</section>`;
      } else {
        switch (sec.type) {
          case "features":
          case "content": {
            const paras = paragraphs.map((p) => `<p class="text-slate-700 text-base leading-relaxed my-2">${p}</p>`).join("\n");
            const secImgs = images.map((img) => `<img src="${sanitizeText(img.src)}" alt="${sanitizeText(img.alt || heading)}" class="rounded-xl border border-slate-200 max-h-96 object-cover my-4 shadow-xs" />`).join("\n");
            const btns = buttons.map((b) => `<a href="${sanitizeText(b.href)}" class="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-block my-2">${sanitizeText(b.text)}</a>`).join(" ");

            bodySectionsHtml += `
<section class="py-14 px-6 max-w-5xl mx-auto space-y-4 ${bgImg ? "bg-cover bg-center p-8 rounded-2xl border my-4" : ""}" ${bgImg ? `style="background-image: url('${bgImg}');"` : ""}>
  ${heading ? `<h2 class="text-2xl sm:text-3xl font-bold text-slate-900 border-b border-slate-200 pb-3 tracking-tight">${heading}</h2>` : ""}
  ${subheading ? `<h3 class="text-lg font-semibold text-slate-800 mt-2">${subheading}</h3>` : ""}
  <div class="space-y-3 pt-2">${paras}</div>
  ${secImgs ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">${secImgs}</div>` : ""}
  ${btns ? `<div class="pt-3">${btns}</div>` : ""}
</section>`;
            break;
          }

          case "faq": {
            const faqItems = paragraphs.map((p) => `
<div class="p-4 rounded-xl bg-slate-50 border border-slate-200/80 my-2">
  <p class="text-slate-900 font-bold text-base leading-relaxed">${p}</p>
</div>`).join("\n");

            bodySectionsHtml += `
<section class="py-14 px-6 max-w-4xl mx-auto space-y-4">
  ${heading ? `<h2 class="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">${heading}</h2>` : ""}
  <div class="space-y-3">${faqItems}</div>
</section>`;
            break;
          }

          case "gallery": {
            const galleryImgs = images.map((img) => `
<div class="overflow-hidden rounded-xl border border-slate-200 shadow-xs">
  <img src="${sanitizeText(img.src)}" alt="${sanitizeText(img.alt || heading)}" class="w-full h-52 object-cover" />
</div>`).join("\n");

            bodySectionsHtml += `
<section class="py-14 px-6 max-w-6xl mx-auto space-y-6">
  ${heading ? `<h2 class="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">${heading}</h2>` : ""}
  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">${galleryImgs}</div>
</section>`;
            break;
          }

          default: {
            const paras = paragraphs.map((p) => `<p class="text-slate-700 leading-relaxed text-base my-2">${p}</p>`).join("\n");
            bodySectionsHtml += `
<section class="py-10 px-6 max-w-4xl mx-auto space-y-3">
  ${heading ? `<h2 class="text-xl font-bold text-slate-900">${heading}</h2>` : ""}
  ${paras}
</section>`;
            break;
          }
        }
      }
    } else if (mode === "redesign") {
      const mainHeading = heading || sanitizeText(page.title);
      const bodyText = subheading || paragraphs[0] || "";
      const heroImg = images[0]?.src ? sanitizeText(images[0].src) : "";

      bodySectionsHtml += `
<section class="relative py-24 px-6 max-w-6xl mx-auto my-6 bg-gradient-to-b from-emerald-50/70 via-white to-white rounded-3xl border border-emerald-100/80 shadow-md flex flex-col lg:flex-row items-center gap-12">
  <div class="flex-1 space-y-6 text-center lg:text-left">
    <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold uppercase tracking-wider">
      Modernized Content
    </span>
    <h1 class="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">${mainHeading}</h1>
    ${bodyText ? `<p class="text-lg text-slate-600 leading-relaxed max-w-2xl">${bodyText}</p>` : ""}
  </div>
  ${heroImg ? `<div class="flex-1 w-full max-w-lg"><img src="${heroImg}" alt="${mainHeading}" class="w-full h-auto rounded-3xl shadow-2xl border border-slate-200/80 object-cover" /></div>` : ""}
</section>`;
    } else {
      const mainHeading = heading || sanitizeText(page.title);
      const bodyText = subheading || paragraphs[0] || "";

      bodySectionsHtml += `
<section class="relative py-28 px-6 max-w-6xl mx-auto text-center space-y-8 bg-slate-900 text-white rounded-3xl my-8 shadow-2xl overflow-hidden">
  <div class="max-w-3xl mx-auto space-y-6">
    <h1 class="text-4xl sm:text-6xl font-black tracking-tight leading-tight">${mainHeading}</h1>
    ${bodyText ? `<p class="text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">${bodyText}</p>` : ""}
  </div>
</section>`;
    }
  });

  // 3. Floating Action Widgets
  let floatingWidgetsHtml = "";
  if (page.floatingActions && page.floatingActions.length > 0) {
    const wa = page.floatingActions.find((a) => a.type === "whatsapp");
    const phone = page.floatingActions.find((a) => a.type === "phone");

    floatingWidgetsHtml = `
<div class="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
  ${wa ? `<a href="${sanitizeText(wa.url)}" target="_blank" rel="noopener noreferrer" class="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-2xl flex items-center justify-center font-bold text-2xl transition-transform hover:scale-110 active:scale-95" title="WhatsApp Chat">WA</a>` : ""}
  ${phone ? `<a href="${sanitizeText(phone.url)}" class="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xl flex items-center justify-center font-bold text-xl transition-transform hover:scale-110 active:scale-95" title="Call Us">Tel</a>` : ""}
</div>`;
  }

  // 4. Footer
  const footerSec = page.sections.find((s) => s.type === "footer");
  const footerText = sanitizeText(footerSec?.paragraphs[0] || `&copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.`);

  bodySectionsHtml += `
<footer class="bg-slate-900 text-slate-400 py-12 px-6 mt-16 border-t border-slate-800">
  <div class="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs">
    <p class="text-slate-500">${footerText}</p>
    <div class="flex items-center gap-6">
      <a href="/" class="hover:text-white transition-colors">Home</a>
      <a href="/privacy" class="hover:text-white transition-colors">Privacy</a>
      <a href="/terms" class="hover:text-white transition-colors">Terms</a>
    </div>
  </div>
</footer>
${floatingWidgetsHtml}`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sanitizeText(page.seo.seoTitle || page.title)}</title>
  <meta name="description" content="${sanitizeText(page.seo.metaDescription || "")}">
  <link rel="canonical" href="${sanitizeText(page.seo.canonicalUrl || "")}">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="styles.css" rel="stylesheet">
</head>
<body class="bg-white text-slate-900 font-sans antialiased min-h-screen">
  ${bodySectionsHtml}
  <script src="script.js"></script>
</body>
</html>`;

  const cssContent = `/* Codeaxys Native Styles (${mode} mode) */
:root {
  --primary-color: ${primaryColor};
  --text-color: ${textColor};
  --bg-color: ${bg};
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--bg-color);
  color: var(--text-color);
}
`;

  const jsContent = `// Codeaxys Interactive Script (${mode} mode)
document.addEventListener("DOMContentLoaded", function () {
  let currentSlide = 0;
  const track = document.getElementById("hero-slider-track");
  const dots = document.querySelectorAll(".hero-dot");
  const totalSlides = dots.length;

  if (track && totalSlides > 1) {
    window.goToHeroSlide = function(index) {
      currentSlide = (index + totalSlides) % totalSlides;
      track.style.transform = "translateX(-" + (currentSlide * 100) + "%)";
      dots.forEach((dot, idx) => {
        if (idx === currentSlide) {
          dot.className = "hero-dot w-8 h-3 rounded-full bg-emerald-500 transition-all cursor-pointer";
        } else {
          dot.className = "hero-dot w-3 h-3 rounded-full bg-white/50 hover:bg-white transition-all cursor-pointer";
        }
      });
    };

    window.nextHeroSlide = function() {
      window.goToHeroSlide(currentSlide + 1);
    };

    window.prevHeroSlide = function() {
      window.goToHeroSlide(currentSlide - 1);
    };

    setInterval(function() {
      if (typeof window.nextHeroSlide === "function") {
        window.nextHeroSlide();
      }
    }, 5000);
  }
});
`;

  return { htmlContent, cssContent, jsContent };
}
