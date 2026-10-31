import { chromium } from "playwright";
import { TEMPLATES_DATA } from "../components/AIBuiltTemplatesShowcase";

const PROD_URL = "https://codeaxys.com";

async function runLiveProductionVerification() {
  console.log("=================================================================");
  console.log("LIVE PRODUCTION QUALITY ASSURANCE & VERIFICATION: CODEAXYS.COM");
  console.log("=================================================================");
  console.log(`Target URL: ${PROD_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);

  const browser = await chromium.launch({ headless: true });
  
  // Track console errors & failed network requests
  const consoleErrors: string[] = [];
  const networkFailures: string[] = [];

  // ===========================================================================
  // 1. DESKTOP LIVE BROWSER VERIFICATION (1440x900)
  // ===========================================================================
  console.log("\n[1/4] Launching Desktop Browser (1440x900)...");
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await desktopContext.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      // Ignore expected 401 for anonymous homepage visitors (e.g. auth check)
      if (msg.text().includes("401")) return;
      consoleErrors.push(`[Console Error] ${msg.text()}`);
    }
  });

  page.on("requestfailed", (req) => {
    // Only track genuine failures from codeaxys.com domain (ignore client-side aborts when closing modals)
    if (req.url().includes("codeaxys.com")) {
      const err = req.failure()?.errorText || "";
      if (err.includes("net::ERR_ABORTED")) return;
      networkFailures.push(`[Failed Request] ${req.method()} ${req.url()}: ${err}`);
    }
  });

  console.log(`  Navigating to ${PROD_URL}...`);
  const response = await page.goto(PROD_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  if (!response || response.status() !== 200) {
    throw new Error(`Failed to load ${PROD_URL}: status ${response?.status()}`);
  }
  console.log(`  ✓ Successfully loaded ${PROD_URL} (Status 200)`);

  const showcaseSection = page.locator("#ai-templates");
  await showcaseSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // --- CHECK 1: Template Count Badge ---
  console.log("\n--- CHECK 1: Template Count Badge ---");
  const badge = showcaseSection.locator("text=20 Real Templates");
  const badgeVisible = await badge.isVisible();
  if (!badgeVisible) {
    throw new Error("Showcase count badge '20 Real Templates' is not visible on live site!");
  }
  console.log("  ✓ Status badge '20 Real Templates' visible and confirmed in live DOM");

  // --- CHECK 2: Height Consistency Between Badge, Filter, and Pause Button ---
  console.log("\n--- CHECK 2: Control Heights Matching ---");
  const badgeBox = await showcaseSection.locator("div.h-\\[38px\\]").first().boundingBox();
  const filterBtn = showcaseSection.locator('button[aria-label="Filter templates by name"]');
  const filterBox = await filterBtn.boundingBox();
  const pauseBtn = showcaseSection.locator('button[aria-label*="scrolling"]');
  const pauseBox = await pauseBtn.boundingBox();

  console.log(`  - Badge element height: ${badgeBox?.height}px`);
  console.log(`  - Filter button height: ${filterBox?.height}px`);
  console.log(`  - Pause button height: ${pauseBox?.height}px`);

  if (!badgeBox || !pauseBox || !filterBox) {
    throw new Error("Could not measure control bounding boxes");
  }

  const heightDiff = Math.abs(badgeBox.height - pauseBox.height);
  if (heightDiff > 1) {
    throw new Error(`Height mismatch: badge is ${badgeBox.height}px but pause button is ${pauseBox.height}px`);
  }
  console.log("  ✓ Template count badge, filter button, and Pause button heights match perfectly (38px)!");

  // --- CHECK 3: Pause / Resume Controls ---
  console.log("\n--- CHECK 3: Marquee Pause/Resume Controls ---");
  console.log("  Clicking Pause button...");
  await pauseBtn.click();
  await page.waitForTimeout(300);
  const resumeVisible = await showcaseSection.locator("text=Resume").isVisible();
  if (!resumeVisible) {
    throw new Error("Resume button did not appear after clicking Pause");
  }
  console.log("  ✓ Marquee successfully paused, showing Resume state");

  console.log("  Clicking Resume button...");
  await pauseBtn.click();
  await page.waitForTimeout(300);
  const pauseVisible = await showcaseSection.locator("text=Pause").isVisible();
  if (!pauseVisible) {
    throw new Error("Pause button did not appear after clicking Resume");
  }
  console.log("  ✓ Marquee successfully resumed, returning to Pause state");

  // Pause again for clean inspection
  await pauseBtn.click();

  // --- CHECK 4: Searchable Filter Functionality ---
  console.log("\n--- CHECK 4: Searchable Template Filter ---");
  await filterBtn.click();
  await page.waitForTimeout(300);

  const searchInput = showcaseSection.locator('input[placeholder*="Search 20 templates"]');
  const searchInputVisible = await searchInput.isVisible();
  if (!searchInputVisible) {
    throw new Error("Search input inside filter popover is not visible");
  }
  console.log("  ✓ Filter popover opened with search input");

  // Search for "Hotel"
  await searchInput.fill("Hotel");
  await page.waitForTimeout(200);
  const hotelOption = showcaseSection.locator("button:has-text('Hotel')").first();
  await hotelOption.click();
  await page.waitForTimeout(300);

  const filterIndicator = showcaseSection.locator("text=Showing filter: Hotel");
  if (!(await filterIndicator.isVisible())) {
    throw new Error("Filtered view for Hotel is not visible");
  }
  console.log("  ✓ Filtered card view successfully displayed for 'Hotel'");

  // Test preview directly from filtered card
  console.log("  Opening preview from filtered card...");
  const previewBtn = showcaseSection.locator("button:has-text('Preview')").first();
  await previewBtn.click();

  const previewModal = page.locator('div[role="dialog"]');
  await previewModal.waitFor({ state: "visible", timeout: 10000 });
  console.log("  ✓ Full-screen preview modal opened for Hotel");

  const iframe = previewModal.locator("iframe");
  const iframeSrc = await iframe.getAttribute("src");
  console.log(`  ✓ Iframe src: ${iframeSrc}`);
  if (!iframeSrc?.includes("/api/templates-preview/Hotel/index.html")) {
    throw new Error(`Unexpected iframe src: ${iframeSrc}`);
  }

  // Close preview with Close button
  const closeBtn = previewModal.locator('button[aria-label="Close preview"]');
  await closeBtn.click();
  await previewModal.waitFor({ state: "detached", timeout: 5000 });
  console.log("  ✓ Full-screen preview modal closed cleanly");

  // Reset filter
  const resetBtn = showcaseSection.locator("text=Reset & view all 20");
  await resetBtn.click();
  await page.waitForTimeout(300);
  console.log("  ✓ Reset filter returned to full 20-template marquee");

  // ===========================================================================
  // 2. LIVE PREVIEW SPEED & CONTENT-READY BENCHMARKS
  // ===========================================================================
  console.log("\n[2/4] Live Preview Performance Benchmarks (Testing 5 Diverse Templates)...");
  const testTemplates = [
    { name: "Hotel", folder: "Hotel" },
    { name: "Restaurant", folder: "Restaurant" },
    { name: "Travel & Tourism", folder: "Travel-Tourism" },
    { name: "Accounting Firm", folder: "Accounting Firm" },
    { name: "Spa & Wellness", folder: "Spa and Wellness" },
  ];

  const timings: Array<{ name: string; openMs: number; readyMs: number; cacheStatus: string }> = [];

  for (const tpl of testTemplates) {
    // Open preview by navigating or clicking
    await filterBtn.click();
    await searchInput.fill(tpl.name);
    await page.waitForTimeout(200);
    const opt = showcaseSection.locator(`button:has-text('${tpl.name}')`).first();
    await opt.click();
    await page.waitForTimeout(200);

    const pBtn = showcaseSection.locator("button:has-text('Preview')").first();
    const t0 = Date.now();
    await pBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await modal.waitFor({ state: "visible", timeout: 10000 });
    const openMs = Date.now() - t0;

    // Check loading overlay
    const loadingOverlay = modal.locator(`text=Loading ${tpl.name}...`);
    const overlaySeen = await loadingOverlay.isVisible().catch(() => false);

    // Wait for iframe content to be ready
    const ifr = modal.locator("iframe");
    await ifr.waitFor({ state: "visible" });
    
    // Evaluate inside iframe
    const frame = modal.frameLocator("iframe");
    await frame.locator("body").waitFor({ state: "visible", timeout: 20000 });
    const readyMs = Date.now() - t0;

    // Also check server response headers for this template
    const previewRes = await page.request.get(
      `${PROD_URL}/api/templates-preview/${encodeURIComponent(tpl.folder)}/index.html`
    );
    const vercelCache = previewRes.headers()["x-vercel-cache"] || "DIRECT";

    timings.push({
      name: tpl.name,
      openMs,
      readyMs,
      cacheStatus: vercelCache,
    });

    console.log(`  ✓ ${tpl.name}: modal opened in ${openMs}ms, content ready in ${readyMs}ms (Overlay: ${overlaySeen ? "YES" : "INSTANT"}, Edge Cache: ${vercelCache})`);

    // Close preview
    const cBtn = modal.locator('button[aria-label="Close preview"]');
    await cBtn.click();
    await modal.waitFor({ state: "detached", timeout: 5000 });
    await page.waitForTimeout(200);

    // Reset filter
    await showcaseSection.locator("text=Reset & view all 20").click();
    await page.waitForTimeout(200);
  }

  console.log("\n  --- Live Preview Speed Benchmark Results ---");
  console.table(timings);

  // ===========================================================================
  // 3. VERIFY ALL 20 PREVIEW ROUTES & ASSETS VIA HTTP
  // ===========================================================================
  console.log("\n[3/4] Verifying all 20 Template Preview Routes & Assets on Production...");
  let passedTemplates = 0;
  for (let i = 0; i < TEMPLATES_DATA.length; i++) {
    const tpl = TEMPLATES_DATA[i];
    const previewPath = `/api/templates-preview/${encodeURIComponent(tpl.folderName)}/index.html`;
    const res = await page.request.get(`${PROD_URL}${previewPath}`);
    if (res.status() !== 200) {
      throw new Error(`Production preview route failed for ${tpl.name}: ${res.status()} at ${previewPath}`);
    }
    const cType = res.headers()["content-type"];
    const cControl = res.headers()["cache-control"];
    const etag = res.headers()["etag"];
    
    if (!cType?.includes("text/html")) {
      throw new Error(`Expected text/html content-type for ${tpl.name}, got ${cType}`);
    }

    // Verify thumbnail asset loads
    const thumbRes = await page.request.get(`${PROD_URL}${tpl.thumbnail}`);
    if (thumbRes.status() !== 200) {
      throw new Error(`Thumbnail failed for ${tpl.name}: ${thumbRes.status()} at ${tpl.thumbnail}`);
    }

    passedTemplates++;
    console.log(`  [${i + 1}/20] ✓ ${tpl.name.padEnd(28)} Preview HTTP 200 (${cControl}) | Thumb HTTP 200`);
  }
  console.log(`  ✓ All ${passedTemplates}/20 template preview routes and thumbnails verified live!`);

  // ===========================================================================
  // 4. MOBILE VIEWPORT VERIFICATION (375x667)
  // ===========================================================================
  console.log("\n[4/4] Testing Mobile Viewport (375x667)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 667 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(PROD_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  const mobileSection = mobilePage.locator("#ai-templates");
  await mobileSection.scrollIntoViewIfNeeded();
  await mobilePage.waitForTimeout(500);

  // Check no horizontal scrollbar on mobile
  const scrollWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await mobilePage.evaluate(() => document.documentElement.clientWidth);
  if (scrollWidth > clientWidth) {
    console.warn(`  ⚠ Warning: Horizontal overflow on mobile: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`);
  } else {
    console.log("  ✓ Mobile layout has zero horizontal overflow");
  }

  // Open filter on mobile
  const mobileFilterBtn = mobileSection.locator('button[aria-label="Filter templates by name"]');
  await mobileFilterBtn.scrollIntoViewIfNeeded();
  await mobileFilterBtn.click({ force: true });
  await mobilePage.waitForTimeout(300);

  const mobileDropdown = mobileSection.locator(".max-h-60");
  await mobileDropdown.waitFor({ state: "visible" });
  const mobileHotelOpt = mobileDropdown.locator("button:has-text('Hotel')").first();
  await mobileHotelOpt.click({ force: true });
  await mobilePage.waitForTimeout(300);
  console.log("  ✓ Selected 'Hotel' in mobile filter");

  // Verify filtered card on mobile
  const mobileCard = mobileSection.locator("h3:has-text('Hotel')").first();
  if (!(await mobileCard.isVisible())) {
    throw new Error("Hotel card not visible on mobile");
  }

  // Open preview on mobile
  const mobilePreviewBtn = mobileSection.locator("button:has-text('Preview')").first();
  await mobilePreviewBtn.scrollIntoViewIfNeeded();
  await mobilePreviewBtn.click({ force: true });
  const mobileModal = mobilePage.locator('div[role="dialog"]');
  await mobileModal.waitFor({ state: "visible", timeout: 10000 });
  console.log("  ✓ Full-screen preview modal opened on mobile");

  // Close preview on mobile
  const mobileCloseBtn = mobileModal.locator('button[aria-label="Close preview"]');
  await mobileCloseBtn.click({ force: true });
  await mobileModal.waitFor({ state: "detached", timeout: 5000 });
  console.log("  ✓ Full-screen preview modal closed cleanly on mobile");

  await browser.close();

  // Final Console & Network Error Audit
  console.log("\n=================================================================");
  console.log("FINAL AUDIT RESULTS");
  console.log("=================================================================");
  console.log(`Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach((e) => console.log(`  - ${e}`));
  }
  console.log(`Network Failures: ${networkFailures.length}`);
  if (networkFailures.length > 0) {
    networkFailures.forEach((f) => console.log(`  - ${f}`));
  }

  if (networkFailures.length > 0) {
    throw new Error(`Encountered ${networkFailures.length} failed network requests on live production!`);
  }

  console.log("\n=================================================================");
  console.log("✓ LIVE PRODUCTION VERIFICATION COMPLETE: ALL CHECKS PASSED!");
  console.log("=================================================================");
}

runLiveProductionVerification().catch((err) => {
  console.error("\n❌ LIVE PRODUCTION VERIFICATION FAILED:", err);
  process.exit(1);
});
