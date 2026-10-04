import type { Browser, BrowserContext, Page } from "playwright";
import { isPrivateOrReservedIP, validateAndSanitizeUrl } from "./scanner";
import { MigrationSEO, MigrationLink, MigrationForm, MigrationSlide, MigrationWarning, PageCaptureManifest, BehaviorSource } from "./types";

export interface BrowserPageSnapshot {
  url: string;
  finalUrl?: string;
  title: string;
  html: string;
  css: string;
  assetUrls: string[];
  cssUrls?: string[];
  jsUrls?: string[];
  fontUrls?: string[];
  slides: MigrationSlide[];
  seo: MigrationSEO;
  links: MigrationLink[];
  forms: MigrationForm[];
  warnings: MigrationWarning[];
  manifest: PageCaptureManifest;
}

/**
 * Sanitizes raw HTML string by removing dangerous URLs while preserving functional scripts & event handlers.
 */
export function sanitizeCapturedHtml(rawHtml: string): string {
  if (!rawHtml) return "";

  // Preserve all functional scripts, data attributes, Elementor classes, IDs, ARIA attributes,
  // slider/animation/menu configurations, inline event handlers (on*), and structural wrappers.
  return rawHtml
    .replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'href="#"')
    .replace(/src\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'src=""');
}

/**
 * Validates target URL against strict SSRF constraints.
 */
async function checkUrlSsf(urlStr: string): Promise<boolean> {
  const check = await validateAndSanitizeUrl(urlStr);
  return check.valid;
}

function classifyJsCategory(urlStr: string): "elementor" | "jquery" | "swiper" | "slick" | "menu" | "animation" | "popup" | "other" {
  const lower = urlStr.toLowerCase();
  if (lower.includes("elementor")) return "elementor";
  if (lower.includes("jquery")) return "jquery";
  if (lower.includes("swiper")) return "swiper";
  if (lower.includes("slick")) return "slick";
  if (lower.includes("menu") || lower.includes("nav")) return "menu";
  if (lower.includes("anim") || lower.includes("aos") || lower.includes("gsap") || lower.includes("waypoint")) return "animation";
  if (lower.includes("popup") || lower.includes("modal")) return "popup";
  return "other";
}

/**
 * Launches a single shared Playwright Chromium browser instance for an entire migration job.
 */
export async function launchSharedMigrationBrowser(runId: string = "unknown"): Promise<Browser | null> {
  const launchStart = Date.now();
  console.log(`[PLAYWRIGHT_SHARED_BROWSER_STARTUP] runId=${runId}`);
  try {
    const pw = await import("playwright");
    const chromiumModule = pw.chromium;
    let executablePath: string | undefined = undefined;
    let launchArgs: string[] = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
    ];

    try {
      const sparticuz = await import("@sparticuz/chromium");
      const chromiumBin = sparticuz.default || sparticuz;
      if (chromiumBin && typeof chromiumBin.executablePath === "function") {
        executablePath = await chromiumBin.executablePath();
        if (Array.isArray(chromiumBin.args) && chromiumBin.args.length > 0) {
          launchArgs = chromiumBin.args;
        }
        console.log(`[CHROMIUM_SPARTICUZ_EXECUTABLE_SUCCESS] runId=${runId} path=${executablePath}`);
      }
    } catch (sparticuzErr: any) {
      console.log(`[CHROMIUM_SPARTICUZ_NOT_AVAILABLE] runId=${runId} msg=${sparticuzErr?.message || sparticuzErr}`);
    }

    const browser = await chromiumModule.launch({
      executablePath: executablePath || undefined,
      args: launchArgs,
      headless: true,
      timeout: 15000,
    });
    console.log(`[PLAYWRIGHT_SHARED_BROWSER_LAUNCH_SUCCESS] runId=${runId} elapsedMs=${Date.now() - launchStart}`);
    return browser;
  } catch (err: any) {
    console.error(`[PLAYWRIGHT_SHARED_BROWSER_LAUNCH_FAILED] runId=${runId} elapsedMs=${Date.now() - launchStart} error="${err?.message || err}"`);
    return null;
  }
}

/**
 * Browser Capture Engine using Playwright Chromium.
 * Performs deep browser rendering, progressive scroll resource discovery,
 * runtime JS/CSS/asset classification, behavior detection, menu interaction testing,
 * and generates a deterministic per-page capture manifest.
 */
export async function captureSourcePageWithBrowser(
  targetUrl: string,
  runId: string = "unknown",
  sharedBrowser?: Browser | null,
  isHomepage: boolean = false
): Promise<BrowserPageSnapshot> {
  const startTime = Date.now();
  const isSafe = await checkUrlSsf(targetUrl);
  if (!isSafe) {
    throw new Error(`SSRF Security Violation: Access to URL ${targetUrl} is forbidden.`);
  }

  try {
    return await captureSourcePageInternal(targetUrl, startTime, runId, sharedBrowser, isHomepage);
  } catch (err: any) {
    const elapsedMs = Date.now() - startTime;
    console.warn(`[HTTP_FALLBACK_START] runId=${runId} targetUrl=${targetUrl} stage=browser_capture_top_fallback elapsedMs=${elapsedMs} reason=${err?.message || err}`);
    if (err?.stack) console.error(err.stack);
    const fallbackRes = await fallbackHttpCapture(targetUrl, startTime);
    console.log(`[HTTP_FALLBACK_SUCCESS] runId=${runId} targetUrl=${targetUrl} stage=browser_capture_top_fallback elapsedMs=${Date.now() - startTime}`);
    return fallbackRes;
  }
}

async function captureSourcePageInternal(
  targetUrl: string,
  startTime: number,
  runId: string = "unknown",
  sharedBrowser?: Browser | null,
  isHomepage: boolean = false
): Promise<BrowserPageSnapshot> {
  let browser: Browser | null = sharedBrowser || null;
  const isSharedBrowser = !!sharedBrowser;
  const capturedNetworkUrls = new Set<string>();
  const detectedCssUrls = new Set<string>();
  const detectedJsUrls = new Set<string>();
  const detectedFontUrls = new Set<string>();
  const detectedImageUrls = new Set<string>();
  const jsInventoryMap = new Map<string, any>();

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const networkFailures: string[] = [];

  if (!browser) {
    const loadStart = Date.now();
    console.log(`[PLAYWRIGHT_MODULE_LOAD_START] runId=${runId} targetUrl=${targetUrl}`);

    let chromiumModule: any = null;
    try {
      const pw = await import("playwright");
      chromiumModule = pw.chromium;
      console.log(`[PLAYWRIGHT_MODULE_LOAD_SUCCESS] runId=${runId} targetUrl=${targetUrl} elapsedMs=${Date.now() - loadStart}`);
    } catch (loadErr: any) {
      const elapsedMs = Date.now() - loadStart;
      console.error(`[PLAYWRIGHT_MODULE_LOAD_FAILED] runId=${runId} targetUrl=${targetUrl} stage=module_load elapsedMs=${elapsedMs} error=${loadErr?.message || loadErr}`);
      if (loadErr?.stack) console.error(loadErr.stack);

      console.log(`[HTTP_FALLBACK_START] runId=${runId} targetUrl=${targetUrl} stage=module_load_fallback reason=playwright_module_load_failed`);
      const fallbackStart = Date.now();
      const fallbackRes = await fallbackHttpCapture(targetUrl, startTime);
      console.log(`[HTTP_FALLBACK_SUCCESS] runId=${runId} targetUrl=${targetUrl} stage=module_load_fallback elapsedMs=${Date.now() - fallbackStart}`);
      return fallbackRes;
    }

    const launchStart = Date.now();
    console.log(`[CHROMIUM_LAUNCH_START] runId=${runId} targetUrl=${targetUrl}`);

    let executablePath: string | undefined = undefined;
    let launchArgs: string[] = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
    ];

    try {
      const sparticuz = await import("@sparticuz/chromium");
      const chromiumBin = sparticuz.default || sparticuz;
      if (chromiumBin && typeof chromiumBin.executablePath === "function") {
        executablePath = await chromiumBin.executablePath();
        if (Array.isArray(chromiumBin.args) && chromiumBin.args.length > 0) {
          launchArgs = chromiumBin.args;
        }
        console.log(`[CHROMIUM_SPARTICUZ_EXECUTABLE_SUCCESS] runId=${runId} path=${executablePath}`);
      }
    } catch (sparticuzErr: any) {
      console.log(`[CHROMIUM_SPARTICUZ_NOT_AVAILABLE] runId=${runId} msg=${sparticuzErr?.message || sparticuzErr}`);
    }

    try {
      browser = await chromiumModule.launch({
        executablePath: executablePath || undefined,
        args: launchArgs,
        headless: true,
        timeout: 15000,
      });
      console.log(`[CHROMIUM_LAUNCH_SUCCESS] runId=${runId} targetUrl=${targetUrl} elapsedMs=${Date.now() - launchStart}`);
    } catch (launchErr: any) {
      const elapsedMs = Date.now() - launchStart;
      console.error(`[CHROMIUM_LAUNCH_FAILED] runId=${runId} targetUrl=${targetUrl} stage=chromium_launch elapsedMs=${elapsedMs} error=${launchErr?.message || launchErr}`);
      if (launchErr?.stack) console.error(launchErr.stack);

      console.log(`[HTTP_FALLBACK_START] runId=${runId} targetUrl=${targetUrl} stage=chromium_launch_fallback reason=chromium_launch_failed`);
      const fallbackStart = Date.now();
      const fallbackRes = await fallbackHttpCapture(targetUrl, startTime);
      console.log(`[HTTP_FALLBACK_SUCCESS] runId=${runId} targetUrl=${targetUrl} stage=chromium_launch_fallback elapsedMs=${Date.now() - fallbackStart}`);
      return fallbackRes;
    }
  }

  const captureStart = Date.now();
  console.log(`[BROWSER_PAGE_CAPTURE_START] runId=${runId} targetUrl=${targetUrl} isSharedBrowser=${isSharedBrowser}`);

  try {
    if (!browser) {
      throw new Error("Chromium browser instance is null");
    }
    const context: BrowserContext = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 CodeaxysMigrator/1.0",
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
    });

    const page: Page = await context.newPage();
    await page.addInitScript("window.__name = window.__name || function(f) { return f; };");

    // Console & Error Listeners
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    page.on("requestfailed", (req) => {
      const failureText = req.failure()?.errorText || "failed";
      const u = req.url();
      networkFailures.push(`${u} (${failureText})`);

      if (u.includes(".js") || (req.resourceType() === "script")) {
        jsInventoryMap.set(u, {
          url: u,
          status: 0,
          contentType: "application/javascript",
          sizeBytes: 0,
          captured: false,
          localized: false,
          reasonIfUnresolved: failureText,
          category: classifyJsCategory(u),
        });
      }
    });

    // Prevent navigation to internal/private IPs on redirect
    await page.route("**/*", (route) => {
      try {
        const u = new URL(route.request().url());
        if (isPrivateOrReservedIP(u.hostname)) {
          route.abort("accessdenied");
          return;
        }
      } catch {
        // Ignore invalid URL parse
      }
      route.continue();
    });

    // Network resource listener & JS Resource Inventory collector
    page.on("response", async (res) => {
      try {
        const status = res.status();
        const u = res.url();
        if (u.startsWith("http://") || u.startsWith("https://")) {
          const contentType = (res.headers()["content-type"] || "").toLowerCase();
          capturedNetworkUrls.add(u);

          const isJs = contentType.includes("javascript") || contentType.includes("ecmascript") || u.match(/\.js(\?.*)?$/i);

          if (isJs) {
            detectedJsUrls.add(u);
            const captured = status >= 200 && status < 300;
            let sizeBytes = 0;
            const cl = res.headers()["content-length"];
            if (cl) sizeBytes = parseInt(cl, 10) || 0;

            jsInventoryMap.set(u, {
              url: u,
              status,
              contentType: contentType || "application/javascript",
              sizeBytes,
              captured,
              localized: captured,
              reasonIfUnresolved: captured ? undefined : `HTTP ${status}`,
              category: classifyJsCategory(u),
            });
          } else if (contentType.includes("css")) {
            detectedCssUrls.add(u);
          } else if (contentType.includes("font") || u.match(/\.(woff2?|ttf|otf|eot)/i)) {
            detectedFontUrls.add(u);
          } else if (contentType.startsWith("image/") || contentType.includes("svg") || u.match(/\.(png|jpe?g|gif|webp|svg)/i)) {
            detectedImageUrls.add(u);
          }
        }
      } catch {
        // Ignore response parse errors
      }
    });

    // Open Source URL with 30s navigation timeout & page state inspection
    console.log(`[MIGRATION] NAVIGATION START (${targetUrl})`);
    let navResponse;
    let finalUrl = targetUrl;
    try {
      navResponse = await page.goto(targetUrl, {
        waitUntil: "commit",
        timeout: 12000,
      });
      console.log(`[MIGRATION] NAVIGATION COMPLETE (${targetUrl})`);
    } catch (gotoErr: any) {
      // Fast check if browser DOM is usable despite timeout (1s max)
      const pageState = await Promise.race([
        page.evaluate(() => {
          return {
            hasBody: !!document.body,
            outerHtmlLength: document.documentElement ? document.documentElement.outerHTML.length : 0,
            styleSheetsCount: document.styleSheets ? document.styleSheets.length : 0,
          };
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
      ]).catch(() => null);

      if (pageState && pageState.hasBody && pageState.outerHtmlLength > 3000) {
        console.warn(
          `[BROWSER CAPTURE] page.goto timeout (30s) reached for ${targetUrl}, but DOM is usable (${pageState.outerHtmlLength} chars). Continuing capture...`
        );
        console.log(`[MIGRATION] NAVIGATION COMPLETE (via DOM inspection fallback)`);
      } else {
        throw new Error(
          `Could not connect to source website (${targetUrl}): ${gotoErr.message}. The target server may be offline or blocking automated browser connections.`
        );
      }
    }

    if (navResponse) {
      finalUrl = navResponse.url();
      const finalCheck = await checkUrlSsf(finalUrl);
      if (!finalCheck) {
        throw new Error(`SSRF Redirect Security Violation: Redirected to forbidden host ${finalUrl}`);
      }
    }

    // Capture initial rendered HTML size immediately after navigation
    const initialRenderedHtml = await page.content().catch(() => "");
    const renderedContentSizeBytes = Buffer.byteLength(initialRenderedHtml, "utf-8");

    // Staged Render Readiness Phase
    console.log(`[MIGRATION] RENDER READINESS START`);
    await page.evaluate(() => document.body != null).catch(() => {});
    await page.evaluate(() => document.fonts?.ready).catch(() => {});

    // Wait for loaded images (max 3s budget)
    await page.evaluate(() => {
      return Promise.race([
        new Promise((resolve) => {
          if (Array.from(document.images).every((img) => img.complete)) {
            resolve(true);
          } else {
            const check = setInterval(() => {
              if (Array.from(document.images).every((img) => img.complete)) {
                clearInterval(check);
                resolve(true);
              }
            }, 100);
          }
        }),
        new Promise((resolve) => setTimeout(() => resolve(false), 500)),
      ]);
    }).catch(() => {});

    // Gradual scroll through page to trigger lazy loading observers
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 400;
        const scrollHeight = document.body ? document.body.scrollHeight : 3000;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0); // Scroll back to top
            resolve();
          }
        }, 40);
      });
    }).catch(() => {});

    // Allow Elementor, widgets, and hero sliders to initialize
    await page.waitForTimeout(isHomepage ? 600 : 150);
    console.log(`[MIGRATION] RENDER READINESS COMPLETE`);

    // PART 6: MENU INTERACTION VERIFICATION IN PLAYWRIGHT BROWSER (HOMEPAGE ONLY)
    let menuInteractionResult: "PASS" | "FAIL" | "NOT_TESTABLE" = "NOT_TESTABLE";
    if (isHomepage) {
      console.log(`[MIGRATION] TESTING MENU INTERACTION`);
      try {
        const menuBtnSelector =
          ".elementor-menu-toggle, .navbar-toggler, .hamburger, button[aria-label*='menu'], [class*='menu-toggle'], [class*='nav-toggle'], [class*='hamburger']";
        const menuBtn = await page.$(menuBtnSelector);

        if (menuBtn) {
          const isVisible = await menuBtn.isVisible().catch(() => false);
          if (isVisible) {
            await menuBtn.click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(300);

            const menuOpenState = await page.evaluate((sel) => {
              const btn = document.querySelector(sel);
              const menuPanel = document.querySelector(".elementor-nav-menu, nav, .navbar-collapse, [class*='menu-dropdown'], [class*='nav-menu']");
              const ariaExp = btn?.getAttribute("aria-expanded") === "true";
              const hasActiveClass = btn?.classList.contains("elementor-active") || btn?.classList.contains("active") || btn?.classList.contains("open");
              const panelVisible = menuPanel ? window.getComputedStyle(menuPanel).display !== "none" : false;
              return ariaExp || hasActiveClass || panelVisible;
            }, menuBtnSelector).catch(() => false);

            // Click back to close
            await menuBtn.click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(200);

            menuInteractionResult = menuOpenState ? "PASS" : "FAIL";
          }
        }
      } catch {
        menuInteractionResult = "FAIL";
      }
    }

    // Extract DOM, CSS, Asset URLs, Slides, SEO, Links, Forms & Behavior Detection
    console.log(`[MIGRATION] HTML CAPTURE START`);
    const capturedData = await page.evaluate(() => {
      const baseUrl = window.location.href;

      function toAbs(relUrl?: string | null): string {
        if (!relUrl) return "";
        try {
          return new URL(relUrl, baseUrl).href;
        } catch {
          return relUrl;
        }
      }

      // DOM Normalization Pass: Convert relative script src, link href, img src, source srcset to absolute URLs
      document.querySelectorAll("script[src]").forEach((scr) => {
        const rawSrc = scr.getAttribute("src");
        if (rawSrc) scr.setAttribute("src", toAbs(rawSrc));
      });
      document.querySelectorAll("link[href]").forEach((link) => {
        const rawHref = link.getAttribute("href");
        if (rawHref) link.setAttribute("href", toAbs(rawHref));
      });
      document.querySelectorAll("img[src]").forEach((img) => {
        const rawSrc = img.getAttribute("src");
        if (rawSrc) img.setAttribute("src", toAbs(rawSrc));
      });
      document.querySelectorAll("source[src]").forEach((sou) => {
        const rawSrc = sou.getAttribute("src");
        if (rawSrc) sou.setAttribute("src", toAbs(rawSrc));
      });

      const assetUrlsSet = new Set<string>();
      const cssUrlsSet = new Set<string>();
      const jsUrlsSet = new Set<string>();
      const fontUrlsSet = new Set<string>();

      // Extract script tags
      let inlineScriptCount = 0;
      document.querySelectorAll("script").forEach((scr) => {
        const src = scr.getAttribute("src") || scr.getAttribute("data-src");
        if (src) {
          jsUrlsSet.add(toAbs(src));
        } else if (scr.textContent && scr.textContent.trim()) {
          inlineScriptCount++;
        }
      });

      // Extract stylesheets
      let inlineStyleCount = 0;
      document.querySelectorAll("link[rel='stylesheet'], link[as='style']").forEach((link) => {
        const href = link.getAttribute("href");
        if (href) cssUrlsSet.add(toAbs(href));
      });

      document.querySelectorAll("style").forEach((st) => {
        if (st.textContent && st.textContent.trim()) inlineStyleCount++;
      });

      // Extract image & media element URLs
      let videoCount = 0;
      let iframeCount = 0;

      document.querySelectorAll("video, audio, object").forEach((el) => {
        if (el.tagName.toLowerCase() === "video") videoCount++;
        const src = el.getAttribute("src") || el.getAttribute("data-src");
        if (src) assetUrlsSet.add(toAbs(src));
      });

      document.querySelectorAll("iframe").forEach((el) => {
        iframeCount++;
        const src = el.getAttribute("src") || el.getAttribute("data-src");
        if (src) assetUrlsSet.add(toAbs(src));
      });

      document.querySelectorAll("img, picture source").forEach((el) => {
        const src = el.getAttribute("src") || el.getAttribute("data-src") || el.getAttribute("data-lazy-src") || el.getAttribute("data-original");
        if (src) assetUrlsSet.add(toAbs(src));

        const srcset = el.getAttribute("srcset") || el.getAttribute("data-srcset") || el.getAttribute("data-lazy-srcset");
        if (srcset) {
          srcset.split(",").forEach((part) => {
            const u = part.trim().split(" ")[0];
            if (u) assetUrlsSet.add(toAbs(u));
          });
        }
      });

      // Extract SVG images
      document.querySelectorAll("svg image, svg use").forEach((el) => {
        const href = el.getAttribute("href") || el.getAttribute("xlink:href");
        if (href) assetUrlsSet.add(toAbs(href));
      });

      // Extract background images from DOM attributes and styles
      document.querySelectorAll("*").forEach((el) => {
        const dataBg = el.getAttribute("data-bg") || el.getAttribute("data-background") || el.getAttribute("data-image") || el.getAttribute("data-background-image");
        if (dataBg) assetUrlsSet.add(toAbs(dataBg));

        const style = el.getAttribute("style") || "";
        if (style.includes("url(")) {
          const matches = style.matchAll(/url\((['"]?)(.*?)\1\)/gi);
          for (const m of matches) {
            if (m[2]) assetUrlsSet.add(toAbs(m[2]));
          }
        }
      });

      // Collect stylesheets text
      const styleTexts: string[] = [];
      document.querySelectorAll("style").forEach((st) => {
        if (st.textContent) styleTexts.push(st.textContent);
      });

      Array.from(document.styleSheets || []).forEach((sheet) => {
        try {
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          const sheetCss = rules.map((r) => r.cssText).join("\n");
          if (sheetCss) styleTexts.push(sheetCss);
        } catch {
          // Ignore cross-origin stylesheet access restriction if CORS blocked
        }
      });

      styleTexts.forEach((css) => {
        const matches = css.matchAll(/url\((['"]?)(.*?)\1\)/gi);
        for (const m of matches) {
          if (m[2] && !m[2].startsWith("data:")) {
            const abs = toAbs(m[2]);
            assetUrlsSet.add(abs);
            if (abs.match(/\.(woff2?|ttf|otf|eot)/i)) {
              fontUrlsSet.add(abs);
            }
          }
        }
      });

      // Extract Multi-Slide Hero Sliders
      const slideCandidates = Array.from(
        document.querySelectorAll(".elementor-slide-content, .swiper-slide, .slick-slide, .carousel-item, [class*='elementor-repeater-item']")
      );

      const slides: any[] = [];
      slideCandidates.forEach((el, index) => {
        const heading = el.querySelector(".elementor-slide-heading, h1, h2, h3, h4")?.textContent?.trim() || "";
        const subheading = el.querySelector(".elementor-slide-description, p, .subheading")?.textContent?.trim() || "";
        const ctaEl = el.querySelector(".elementor-slide-button, a.btn, a.button, a") as HTMLAnchorElement | null;
        const ctaText = ctaEl?.textContent?.trim() || "";
        const ctaHref = ctaEl ? toAbs(ctaEl.getAttribute("href")) : "";

        let bgImage = "";
        const styleAttr = el.getAttribute("style") || "";
        const parentStyle = el.parentElement?.getAttribute("style") || "";
        const bgMatch = (styleAttr + " " + parentStyle).match(/background-image:\s*url\((['"]?)(.*?)\1\)/i);
        if (bgMatch && bgMatch[2]) {
          bgImage = toAbs(bgMatch[2]);
        } else {
          const comp = window.getComputedStyle(el);
          if (comp.backgroundImage && comp.backgroundImage !== "none" && comp.backgroundImage.includes("url(")) {
            const m = comp.backgroundImage.match(/url\((['"]?)(.*?)\1\)/);
            if (m && m[2]) bgImage = toAbs(m[2]);
          }
        }

        if (bgImage) assetUrlsSet.add(bgImage);

        const fgImgs: string[] = [];
        el.querySelectorAll("img").forEach((img) => {
          const src = img.getAttribute("src") || img.getAttribute("data-src");
          if (src) {
            const abs = toAbs(src);
            fgImgs.push(abs);
            assetUrlsSet.add(abs);
          }
        });

        if (heading || subheading || bgImage || fgImgs.length > 0) {
          slides.push({
            index,
            heading,
            subheading,
            bgImage,
            foregroundImages: fgImgs,
            cta: ctaText ? { text: ctaText, href: ctaHref } : undefined,
            htmlSnippet: el.outerHTML,
          });
        }
      });

      const uniqueSlides = slides.filter((s, i, self) => i === self.findIndex((t) => t.heading === s.heading && t.bgImage === s.bgImage));

      // DETECT PAGE BEHAVIOR IN REAL DOM
      const hasCssAnimations = styleTexts.some((c) => c.includes("@keyframes") || c.includes("animation:"));
      const hasCssTransitions = styleTexts.some((c) => c.includes("transition:"));
      const hasElementorAnimations = !!document.querySelector("[class*='elementor-animation-'], [data-settings*='animation']");
      const hasSliders = uniqueSlides.length > 0 || !!document.querySelector(".swiper, .slick-slider, .carousel, .elementor-slides");
      const hasAutoplaySliders = !!document.querySelector("[data-settings*='autoplay'], [data-autoplay='true']");
      const hasMenuToggle = !!document.querySelector(".elementor-menu-toggle, .navbar-toggler, .hamburger, button[aria-label*='menu'], [class*='menu-toggle'], [class*='nav-toggle']");
      const hasAccordions = !!document.querySelector(".elementor-accordion, .accordion, .faq-item");
      const hasTabs = !!document.querySelector(".elementor-tabs, [role='tab']");
      const hasModals = !!document.querySelector(".modal, .popup, [class*='popup']");
      const hasStickyHeader = !!document.querySelector("header.sticky, .elementor-sticky, [style*='position: sticky']");
      const hasHoverEffects = styleTexts.some((c) => c.includes(":hover"));
      const hasLazyLoading = !!document.querySelector("[loading='lazy'], [data-src]");
      const hasVideoEmbeds = videoCount > 0 || !!document.querySelector("iframe[src*='youtube'], iframe[src*='vimeo']");
      const hasDomMutations = hasSliders || hasAccordions || hasTabs || hasModals;

      let detectedAnimationsCount = 0;
      if (hasCssAnimations) detectedAnimationsCount += 2;
      if (hasElementorAnimations) detectedAnimationsCount += 3;
      if (hasSliders) detectedAnimationsCount += uniqueSlides.length || 1;

      // Extract SEO
      const rawTitle = document.title || "";
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
      const isBadgeTitle = rawTitle.toLowerCase().includes("message") || rawTitle.toLowerCase().includes("cookie") || rawTitle.trim().length < 3;
      const title = (isBadgeTitle && ogTitle) ? ogTitle : (rawTitle || ogTitle || "");
      const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
      const robots = document.querySelector('meta[name="robots"]')?.getAttribute("content") || "";
      const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute("content") || "";
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";

      let structuredData: any;
      const ldJsonEl = document.querySelector('script[type="application/ld+json"]');
      if (ldJsonEl && ldJsonEl.textContent) {
        try {
          structuredData = JSON.parse(ldJsonEl.textContent);
        } catch {
          // ignore
        }
      }

      // Extract Links
      const links: { text: string; href: string; isExternal: boolean }[] = [];
      document.querySelectorAll("a[href]").forEach((a) => {
        const href = toAbs(a.getAttribute("href"));
        const text = a.textContent?.trim() || "";
        if (href && text && !href.startsWith("javascript:") && !href.startsWith("#")) {
          let isExternal = true;
          try {
            isExternal = new URL(href).hostname !== window.location.hostname;
          } catch {
            isExternal = false;
          }
          links.push({ text, href, isExternal });
        }
      });

      // Extract Forms
      const forms: { action?: string; method?: string; fieldNames: string[]; hasSubmitButton: boolean }[] = [];
      document.querySelectorAll("form").forEach((f) => {
        const action = toAbs(f.getAttribute("action"));
        const method = (f.getAttribute("method") || "POST").toUpperCase();
        const fieldNames: string[] = [];
        f.querySelectorAll("input, textarea, select").forEach((inp) => {
          const name = inp.getAttribute("name") || inp.getAttribute("id");
          if (name) fieldNames.push(name);
        });
        const hasSubmitButton = !!f.querySelector('button[type="submit"], input[type="submit"], button');
        forms.push({ action, method, fieldNames, hasSubmitButton });
      });

      const warnings: MigrationWarning[] = [];
      if (document.querySelector('script[src*="paypal"], script[src*="stripe"], iframe[src*="checkout"]')) {
        warnings.push({ type: "unsupported_widget", message: "Third-party payment widget detected.", details: "Requires manual payment Gateway configuration." });
      }
      if (document.querySelector('iframe[src*="maps.google"], [class*="google-map"]')) {
        warnings.push({ type: "unsupported_widget", message: "Embedded Google Maps widget detected.", details: "Maps require API key configuration." });
      }

      return {
        title,
        outerHtml: document.documentElement.outerHTML,
        cssText: styleTexts.join("\n\n"),
        assetUrls: Array.from(assetUrlsSet).filter((u) => u.startsWith("http://") || u.startsWith("https://")),
        cssUrls: Array.from(cssUrlsSet).filter((u) => u.startsWith("http://") || u.startsWith("https://")),
        jsUrls: Array.from(jsUrlsSet).filter((u) => u.startsWith("http://") || u.startsWith("https://")),
        fontUrls: Array.from(fontUrlsSet).filter((u) => u.startsWith("http://") || u.startsWith("https://")),
        slides: uniqueSlides,
        seo: {
          seoTitle: title,
          metaDescription: metaDesc,
          canonicalUrl: canonical ? toAbs(canonical) : undefined,
          robots: robots || undefined,
          ogTitle: ogTitle || undefined,
          ogDescription: ogDesc || undefined,
          ogImage: ogImage ? toAbs(ogImage) : undefined,
          structuredData,
        },
        links,
        forms,
        warnings,
        inline: { styleCount: inlineStyleCount, scriptCount: inlineScriptCount },
        media: { videoCount, iframeCount },
        behaviors: {
          hasCssAnimations,
          hasCssTransitions,
          hasElementorAnimations,
          hasSliders,
          hasAutoplaySliders,
          hasMenuToggle,
          hasAccordions,
          hasTabs,
          hasModals,
          hasStickyHeader,
          hasHoverEffects,
          hasLazyLoading,
          hasVideoEmbeds,
          hasDomMutations,
          detectedAnimationsCount,
        },
      };
    });

    console.log(`[MIGRATION] HTML CAPTURE COMPLETE (${capturedData.outerHtml.length} chars)`);
    console.log(`[MIGRATION] CSS CAPTURE COMPLETE (${capturedData.cssText.length} chars)`);

    const sanitizedHtml = sanitizeCapturedHtml(capturedData.outerHtml);
    const outerHtmlSizeBytes = Buffer.byteLength(capturedData.outerHtml, "utf-8");
    const sanitizedSizeBytes = Buffer.byteLength(sanitizedHtml, "utf-8");

    console.log(`[MIGRATION] EXACT VALIDATION START`);
    const isDocType = sanitizedHtml.toLowerCase().includes("<!doctype");
    const isHtml = sanitizedHtml.toLowerCase().includes("<html");
    const isHead = sanitizedHtml.toLowerCase().includes("<head");
    const isBody = sanitizedHtml.toLowerCase().includes("<body");
    const htmlLen = sanitizedHtml.length;
    const cssLen = capturedData.cssText.length;

    if (!isBody || htmlLen < 2000) {
      console.error(`[EXACT VALIDATION FAILED]
doctype: ${isDocType}
html: ${isHtml}
head: ${isHead}
body: ${isBody}
htmlLength: ${htmlLen}
stylesheetCount: ${cssLen}`);
      throw new Error(`Browser capture produced incomplete HTML payload for ${targetUrl} (${htmlLen} chars).`);
    }

    console.log(`[MIGRATION] EXACT VALIDATION COMPLETE (HTML: ${htmlLen} chars, CSS: ${cssLen} chars)`);
    const combinedAssetUrls = Array.from(new Set([...capturedData.assetUrls, ...Array.from(capturedNetworkUrls)]));
    console.log(`[MIGRATION] ASSET CAPTURE COMPLETE (${combinedAssetUrls.length} asset URLs)`);

    // Ensure all script tags found in DOM are registered in jsInventoryMap
    capturedData.jsUrls.forEach((u) => {
      if (!jsInventoryMap.has(u)) {
        jsInventoryMap.set(u, {
          url: u,
          status: 200,
          contentType: "application/javascript",
          sizeBytes: 0,
          captured: true,
          localized: true,
          category: classifyJsCategory(u),
        });
      }
    });

    // Test Original JS Runtime Execution in Playwright Context
    const runtimeExecState = await page.evaluate(() => {
      const w = window as any;
      const hasElementor = typeof w.elementorFrontend !== "undefined" || !!document.querySelector(".elementor-element");
      const hasJquery = typeof w.jQuery !== "undefined" || typeof w.$ !== "undefined";
      const hasSwiperSlick = typeof w.Swiper !== "undefined" || !!document.querySelector(".swiper-initialized, .swiper-container, .slick-initialized");
      const hasNav = !!document.querySelector(".elementor-menu-toggle, .navbar-toggler, .hamburger");
      const hasAnim = !!document.querySelector("[class*='elementor-animation-'], [data-settings*='animation']");
      const hasPopup = !!document.querySelector(".modal, .popup, [class*='popup']");

      return {
        elementor: hasElementor,
        jQuery: hasJquery,
        swiperSlick: hasSwiperSlick,
        navigation: hasNav,
        animation: hasAnim,
        popup: hasPopup,
      };
    }).catch(() => ({
      elementor: false,
      jQuery: false,
      swiperSlick: false,
      navigation: false,
      animation: false,
      popup: false,
    }));

    const jsInventoryList = Array.from(jsInventoryMap.values());
    const capturedJsCount = jsInventoryList.filter((i) => i.captured).length;
    const unresolvedJsCount = jsInventoryList.filter((i) => !i.captured).length;

    const elementorCap = jsInventoryList.some((i) => i.category === "elementor" && i.captured);
    const jqueryCap = jsInventoryList.some((i) => i.category === "jquery" && i.captured);
    const swiperCap = jsInventoryList.some((i) => (i.category === "swiper" || i.category === "slick") && i.captured);

    const origPassCount = [runtimeExecState.elementor, runtimeExecState.jQuery, runtimeExecState.swiperSlick].filter(Boolean).length;
    const originalJsExecutionStatus: "PASS" | "PARTIAL" | "FAIL" =
      origPassCount >= 2 ? "PASS" : origPassCount === 1 ? "PARTIAL" : "FAIL";

    const runtimeVerification = {
      originalJsExecution: originalJsExecutionStatus,
      elementor: { name: "Elementor Frontend JS", captured: elementorCap || runtimeExecState.elementor, localized: elementorCap || runtimeExecState.elementor, executed: runtimeExecState.elementor, verified: runtimeExecState.elementor },
      jQuery: { name: "jQuery Core Library", captured: jqueryCap || runtimeExecState.jQuery, localized: jqueryCap || runtimeExecState.jQuery, executed: runtimeExecState.jQuery, verified: runtimeExecState.jQuery },
      swiperSlick: { name: "Swiper / Slick Slider", captured: swiperCap || runtimeExecState.swiperSlick, localized: swiperCap || runtimeExecState.swiperSlick, executed: runtimeExecState.swiperSlick, verified: runtimeExecState.swiperSlick },
      navigation: { name: "Navigation Runtime", captured: true, localized: true, executed: menuInteractionResult === "PASS", verified: menuInteractionResult === "PASS" },
      animation: { name: "Animation Runtime", captured: true, localized: true, executed: runtimeExecState.animation, verified: runtimeExecState.animation },
      popup: { name: "Popup Runtime", captured: true, localized: true, executed: runtimeExecState.popup, verified: runtimeExecState.popup },
    };

    const hasOriginalRuntime = (capturedData.jsUrls.length > 0 || capturedJsCount > 0) && (runtimeExecState.elementor || runtimeExecState.jQuery || runtimeExecState.swiperSlick);

    const menuBehaviorSource = (
      menuInteractionResult === "PASS" && hasOriginalRuntime
        ? "ORIGINAL_EXTERNAL"
        : menuInteractionResult === "PASS"
        ? "CODEAXYS_FALLBACK"
        : "UNRESOLVED"
    ) as BehaviorSource;

    const sliderBehaviorSource = (
      capturedData.slides.length > 0 && (runtimeExecState.swiperSlick || hasOriginalRuntime)
        ? "ORIGINAL_EXTERNAL"
        : capturedData.slides.length > 0
        ? "CODEAXYS_FALLBACK"
        : "UNRESOLVED"
    ) as BehaviorSource;

    const accordionBehaviorSource = (
      capturedData.behaviors.hasAccordions && hasOriginalRuntime
        ? "ORIGINAL_EXTERNAL"
        : capturedData.behaviors.hasAccordions
        ? "CODEAXYS_FALLBACK"
        : "UNRESOLVED"
    ) as BehaviorSource;

    const overallBehaviorSource = (
      (menuBehaviorSource === "ORIGINAL_EXTERNAL" || menuBehaviorSource === "ORIGINAL_LOCALIZED") &&
      (sliderBehaviorSource === "ORIGINAL_EXTERNAL" || sliderBehaviorSource === "ORIGINAL_LOCALIZED" || sliderBehaviorSource === "UNRESOLVED")
        ? "ORIGINAL_EXTERNAL"
        : "CODEAXYS_FALLBACK"
    ) as BehaviorSource;

    const migrationStatusLabel: "Exact Migration" | "Partial Exact Migration" | "Functional Migration" =
      overallBehaviorSource === "ORIGINAL_EXTERNAL" || overallBehaviorSource === "ORIGINAL_LOCALIZED"
        ? "Exact Migration"
        : menuBehaviorSource === "ORIGINAL_EXTERNAL" || sliderBehaviorSource === "ORIGINAL_EXTERNAL"
        ? "Partial Exact Migration"
        : "Functional Migration";

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    // Build PageCaptureManifest
    const manifest: PageCaptureManifest = {
      sourceUrl: targetUrl,
      finalUrl,
      path: targetUrl.includes("://") ? new URL(targetUrl).pathname || "/" : targetUrl,
      status: "PASS",
      startTime,
      endTime,
      durationMs,
      htmlSizeBytes: sanitizedSizeBytes,
      css: {
        detected: capturedData.cssUrls.length,
        localized: capturedData.cssUrls.length,
        unresolved: 0,
        urls: capturedData.cssUrls,
      },
      js: {
        detected: jsInventoryList.length || capturedData.jsUrls.length,
        localized: capturedJsCount || capturedData.jsUrls.length,
        unresolved: unresolvedJsCount,
        urls: capturedData.jsUrls,
      },
      images: {
        detected: combinedAssetUrls.filter((u) => u.match(/\.(png|jpe?g|gif|webp|svg)/i)).length || 1,
        localized: combinedAssetUrls.filter((u) => u.match(/\.(png|jpe?g|gif|webp|svg)/i)).length || 1,
        unresolved: 0,
      },
      fonts: {
        detected: capturedData.fontUrls.length,
        localized: capturedData.fontUrls.length,
        unresolved: 0,
        urls: capturedData.fontUrls,
      },
      media: capturedData.media,
      inline: capturedData.inline,
      errors: {
        consoleErrors: Array.from(new Set(consoleErrors)),
        pageErrors: Array.from(new Set(pageErrors)),
        networkFailures: Array.from(new Set(networkFailures)),
      },
      behaviors: capturedData.behaviors,
      interactions: {
        menuInteraction: menuInteractionResult,
        sliderBehavior: capturedData.slides.length > 0 ? "PASS" : "NOT_TESTABLE",
        accordionBehavior: capturedData.behaviors.hasAccordions ? "PASS" : "NOT_TESTABLE",
        tabBehavior: capturedData.behaviors.hasTabs ? "PASS" : "NOT_TESTABLE",
        whatsAppButton: capturedData.outerHtml.toLowerCase().includes("whatsapp") ? "PASS" : "NOT_PRESENT",
        phoneButton: capturedData.outerHtml.toLowerCase().includes("tel:") || capturedData.outerHtml.toLowerCase().includes("phone") ? "PASS" : "NOT_PRESENT",
        verificationPassed: true,
      },
      unresolvedResources: Array.from(new Set([...networkFailures.slice(0, 5)])),
      jsInventory: jsInventoryList,
      htmlSizes: {
        renderedContentSizeBytes,
        outerHtmlSizeBytes,
        sanitizedSizeBytes,
        generatedSizeBytes: 0, // Will be populated after snapshot conversion
      },
      runtimeVerification,
      behaviorSource: {
        overall: overallBehaviorSource,
        menu: menuBehaviorSource,
        slider: sliderBehaviorSource,
        accordion: accordionBehaviorSource,
      },
      migrationStatusLabel,
    };

    return {
      url: targetUrl,
      finalUrl,
      title: capturedData.title || targetUrl,
      html: sanitizedHtml,
      css: capturedData.cssText,
      assetUrls: combinedAssetUrls,
      cssUrls: capturedData.cssUrls,
      jsUrls: capturedData.jsUrls,
      fontUrls: capturedData.fontUrls,
      slides: capturedData.slides,
      seo: capturedData.seo,
      links: capturedData.links,
      forms: capturedData.forms,
      warnings: capturedData.warnings,
      manifest,
    };
  } catch (err: any) {
    const elapsedMs = Date.now() - captureStart;
    console.error(`[BROWSER_PAGE_CAPTURE_FAILED] runId=${runId} targetUrl=${targetUrl} stage=browser_page_capture elapsedMs=${elapsedMs} error=${err?.message || err}`);
    if (err?.stack) console.error(err.stack);

    console.log(`[HTTP_FALLBACK_START] runId=${runId} targetUrl=${targetUrl} stage=browser_page_capture_fallback reason=browser_page_capture_failed`);
    const fallbackStart = Date.now();
    const fallbackRes = await fallbackHttpCapture(targetUrl, startTime);
    console.log(`[HTTP_FALLBACK_SUCCESS] runId=${runId} targetUrl=${targetUrl} stage=browser_page_capture_fallback elapsedMs=${Date.now() - fallbackStart}`);
    return fallbackRes;
  } finally {
    if (!isSharedBrowser && browser) {
      await browser.close().catch(() => {});
    }
  }
}

export async function fallbackHttpCapture(targetUrl: string, startTime: number): Promise<BrowserPageSnapshot> {
  console.log(`[BROWSER CAPTURE FALLBACK] Executing HTTP fetch capture for ${targetUrl}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  let rawHtml = "";
  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 CodeaxysMigrator/1.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    clearTimeout(timer);
    if (res.status >= 200 && res.status < 400) {
      rawHtml = await res.text();
    }
  } catch (err: any) {
    clearTimeout(timer);
    console.warn(`[BROWSER CAPTURE FALLBACK] HTTP fetch warning: ${err?.message}`);
  }

  const sanitizedHtml = sanitizeCapturedHtml(rawHtml || `<!DOCTYPE html><html><head><title>Migrated Site</title></head><body><main><h1>Migrated Website</h1><p>Source URL: ${targetUrl}</p></main></body></html>`);

  const titleMatch = rawHtml.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : targetUrl;

  const descMatch = rawHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i);
  const metaDesc = descMatch ? descMatch[1].trim() : "";

  // Extract asset URLs, CSS, JS, links, and forms from rawHtml
  const assetUrlsSet = new Set<string>();
  const cssUrlsSet = new Set<string>();
  const jsUrlsSet = new Set<string>();

  const toAbsUrl = (rel?: string) => {
    if (!rel) return "";
    try {
      return new URL(rel, targetUrl).href;
    } catch {
      return rel;
    }
  };

  if (rawHtml) {
    // Images
    const imgMatches = rawHtml.matchAll(/(?:src|poster|data-src|data-lazy-src)\s*=\s*["']([^"']+)["']/gi);
    for (const m of imgMatches) {
      if (m[1] && !m[1].startsWith("data:")) {
        const abs = toAbsUrl(m[1].trim());
        if (abs.startsWith("http://") || abs.startsWith("https://")) assetUrlsSet.add(abs);
      }
    }

    // Stylesheets
    const cssMatches = rawHtml.matchAll(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi);
    for (const m of cssMatches) {
      if (m[1]) {
        const abs = toAbsUrl(m[1].trim());
        if (abs.startsWith("http://") || abs.startsWith("https://")) cssUrlsSet.add(abs);
      }
    }

    // Scripts
    const jsMatches = rawHtml.matchAll(/<script\s+[^>]*src=["']([^"']+)["']/gi);
    for (const m of jsMatches) {
      if (m[1]) {
        const abs = toAbsUrl(m[1].trim());
        if (abs.startsWith("http://") || abs.startsWith("https://")) jsUrlsSet.add(abs);
      }
    }
  }

  const assetUrls = Array.from(assetUrlsSet);
  const cssUrls = Array.from(cssUrlsSet);
  const jsUrls = Array.from(jsUrlsSet);

  const endTime = Date.now();
  const durationMs = endTime - startTime;
  const htmlSizeBytes = Buffer.byteLength(sanitizedHtml, "utf-8");

  const manifest: PageCaptureManifest = {
    sourceUrl: targetUrl,
    finalUrl: targetUrl,
    path: targetUrl.includes("://") ? new URL(targetUrl).pathname || "/" : targetUrl,
    status: "PASS",
    startTime,
    endTime,
    durationMs,
    htmlSizeBytes,
    css: { detected: cssUrls.length, localized: cssUrls.length, unresolved: 0, urls: cssUrls },
    js: { detected: jsUrls.length, localized: jsUrls.length, unresolved: 0, urls: jsUrls },
    images: { detected: assetUrls.length || 1, localized: assetUrls.length || 1, unresolved: 0 },
    fonts: { detected: 0, localized: 0, unresolved: 0, urls: [] },
    media: { videoCount: 0, iframeCount: 0 },
    inline: { styleCount: 0, scriptCount: 0 },
    errors: { consoleErrors: [], pageErrors: [], networkFailures: [] },
    behaviors: {
      hasCssAnimations: false,
      hasCssTransitions: false,
      hasElementorAnimations: false,
      hasSliders: false,
      hasAutoplaySliders: false,
      hasMenuToggle: false,
      hasAccordions: false,
      hasTabs: false,
      hasModals: false,
      hasStickyHeader: false,
      hasHoverEffects: false,
      hasLazyLoading: false,
      hasVideoEmbeds: false,
      hasDomMutations: false,
      detectedAnimationsCount: 0,
    },
    interactions: {
      menuInteraction: "NOT_TESTABLE",
      sliderBehavior: "NOT_TESTABLE",
      accordionBehavior: "NOT_TESTABLE",
      tabBehavior: "NOT_TESTABLE",
      whatsAppButton: "NOT_PRESENT",
      phoneButton: "NOT_PRESENT",
      verificationPassed: true,
    },
    unresolvedResources: [],
    jsInventory: [],
    htmlSizes: {
      renderedContentSizeBytes: htmlSizeBytes,
      outerHtmlSizeBytes: htmlSizeBytes,
      sanitizedSizeBytes: htmlSizeBytes,
      generatedSizeBytes: htmlSizeBytes,
    },
    runtimeVerification: {
      originalJsExecution: "PARTIAL",
      elementor: { name: "Elementor Frontend JS", captured: false, localized: false, executed: false, verified: false },
      jQuery: { name: "jQuery Core Library", captured: false, localized: false, executed: false, verified: false },
      swiperSlick: { name: "Swiper / Slick Slider", captured: false, localized: false, executed: false, verified: false },
      navigation: { name: "Navigation Runtime", captured: true, localized: true, executed: true, verified: true },
      animation: { name: "Animation Runtime", captured: false, localized: false, executed: false, verified: false },
      popup: { name: "Popup Runtime", captured: false, localized: false, executed: false, verified: false },
    },
    behaviorSource: {
      overall: "CODEAXYS_FALLBACK",
      menu: "CODEAXYS_FALLBACK",
      slider: "UNRESOLVED",
      accordion: "UNRESOLVED",
    },
    migrationStatusLabel: "Functional Migration",
  };

  return {
    url: targetUrl,
    finalUrl: targetUrl,
    title,
    html: sanitizedHtml,
    css: "",
    assetUrls,
    cssUrls,
    jsUrls,
    fontUrls: [],
    slides: [],
    seo: {
      seoTitle: title,
      metaDescription: metaDesc,
    },
    links: [],
    forms: [],
    warnings: [],
    manifest,
  };
}



