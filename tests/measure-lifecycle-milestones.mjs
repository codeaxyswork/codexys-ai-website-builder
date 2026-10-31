import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TEMPLATES = [
  "Accounting Firm",
  "Hotel",
  "Solar Company"
];

async function measureLifecycle(templateName) {
  const browser = await chromium.launch({ headless: true });
  // Fresh context (Cold)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log(`\n=============================================================================`);
  console.log(`DETAILED LIFECYCLE BREAKDOWN: ${templateName}`);
  console.log(`=============================================================================`);

  await page.goto("https://codeaxys.com", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  const showcase = page.locator("#ai-templates");
  await showcase.scrollIntoViewIfNeeded();

  // Pause marquee
  const pauseBtn = showcase.locator('button[aria-label*="Pause scrolling"]');
  if (await pauseBtn.isVisible()) {
    await pauseBtn.click();
    await page.waitForTimeout(300);
  }

  // Filter template
  const filterBtn = showcase.locator('button[aria-label="Filter templates by name"]');
  await filterBtn.click();
  const filterInput = showcase.locator('input[placeholder="Search 20 templates..."]');
  await filterInput.fill(templateName);
  const option = showcase.locator(`button:has-text("${templateName}")`).first();
  await option.click();
  await page.waitForTimeout(500);

  const previewBtn = showcase.locator("button:has-text('Preview')").first();

  const clickTime = Date.now();
  await previewBtn.click();

  // Wait for dialog
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: "visible" });
  const dialogTime = Date.now() - clickTime;

  // Track iframe attachment
  const iframeLocator = page.locator("iframe[title*='Website Preview']");
  await iframeLocator.waitFor({ state: "attached" });
  const iframeAttachTime = Date.now() - clickTime;

  // Track overlay disappearance
  const loadingOverlay = page.locator("text=/Initializing live template demo and assets/");
  let overlayGoneTime = -1;
  try {
    await loadingOverlay.waitFor({ state: "detached", timeout: 45000 });
    overlayGoneTime = Date.now() - clickTime;
  } catch {
    overlayGoneTime = -1;
  }

  // Query performance timing inside the iframe
  const frame = page.frame({ url: /templates-preview/ });
  let perfData = null;
  if (frame) {
    try {
      perfData = await frame.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource");
        return {
          navigation: nav ? {
            startTime: nav.startTime,
            responseStart: nav.responseStart, // TTFB
            responseEnd: nav.responseEnd,     // HTML download complete
            domInteractive: nav.domInteractive,
            domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
            loadEventEnd: nav.loadEventEnd
          } : null,
          resources: resources.map(r => ({
            name: r.name,
            initiatorType: r.initiatorType,
            duration: r.duration,
            transferSize: r.transferSize,
            encodedBodySize: r.encodedBodySize
          }))
        };
      });
    } catch (e) {
      console.log("Could not extract frame perf data:", e.message);
    }
  }

  console.log(`1. Click-to-Dialog-Visible:                  ${dialogTime} ms`);
  console.log(`2. Click-to-Iframe-Attached:                 ${iframeAttachTime} ms`);

  if (perfData && perfData.navigation) {
    const nav = perfData.navigation;
    console.log(`3. HTML Navigation TTFB (responseStart):     ${Math.round(nav.responseStart)} ms`);
    console.log(`4. HTML Download Complete (responseEnd):     ${Math.round(nav.responseEnd)} ms`);
    console.log(`5. Iframe DOM Ready (domInteractive):        ${Math.round(nav.domInteractive)} ms`);
    console.log(`6. Iframe Styles/Scripts (domContentLoaded): ${Math.round(nav.domContentLoadedEventEnd)} ms`);
    console.log(`7. Iframe All Assets Complete (loadEventEnd):${Math.round(nav.loadEventEnd)} ms`);
  }

  console.log(`8. User-Perceived Total (Overlay Hidden):    ${overlayGoneTime} ms`);

  if (perfData && perfData.resources) {
    const slow = perfData.resources.sort((a, b) => b.duration - a.duration).slice(0, 5);
    console.log(`\nTop Slowest Subresources inside Iframe:`);
    for (const r of slow) {
      console.log(`  - ${Math.round(r.duration).toString().padEnd(6)} ms | ${(r.transferSize / 1024).toFixed(1).padEnd(8)} KB | ${r.initiatorType.padEnd(6)} | ${r.name}`);
    }
  }

  await context.close();
  await browser.close();
}

async function run() {
  for (const t of TEMPLATES) {
    await measureLifecycle(t);
  }
}

run();
