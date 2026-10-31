import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TEMPLATES_TO_TEST = [
  { name: "Accounting Firm", folder: "Accounting Firm" },
  { name: "Hotel", folder: "Hotel" },
  { name: "Solar Company", folder: "Solar Company" }
];

async function measureTemplate(baseUrl, template, isWarm = false, sharedContext = null) {
  let context = sharedContext;
  let shouldCloseContext = false;

  if (!context) {
    const browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    shouldCloseContext = true;
  }

  const page = await context.newPage();

  const networkRequests = [];
  const consoleMessages = [];
  const failedRequests = [];

  page.on("console", msg => {
    if (msg.type() === "error") {
      consoleMessages.push(msg.text());
    }
  });

  page.on("requestfailed", req => {
    failedRequests.push({
      url: req.url(),
      failure: req.failure() ? req.failure().errorText : "unknown"
    });
  });

  page.on("request", req => {
    req._startTime = Date.now();
  });

  page.on("response", async res => {
    try {
      const req = res.request();
      const duration = req._startTime ? Date.now() - req._startTime : 0;
      let bodySize = 0;
      try {
        const buf = await res.body();
        bodySize = buf.length;
      } catch {
        // Can fail if redirected or aborted
      }

      networkRequests.push({
        url: res.url(),
        status: res.status(),
        contentType: res.headers()["content-type"] || "",
        cacheControl: res.headers()["cache-control"] || "",
        duration,
        size: bodySize,
        fromCache: res.fromServiceWorker() || false
      });
    } catch {
      // Ignore response read errors
    }
  });

  // Navigate to target
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1000);

  const showcase = page.locator("#ai-templates");
  await showcase.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // If marquee is moving, pause it so we can click reliably
  const pauseBtn = showcase.locator('button[aria-label*="Pause scrolling"]');
  if (await pauseBtn.isVisible()) {
    await pauseBtn.click();
    await page.waitForTimeout(300);
  }

  // Use the filter to select the exact template so its card is visible
  const filterBtn = showcase.locator('button[aria-label="Filter templates by name"]');
  await filterBtn.click();
  await page.waitForTimeout(300);

  const filterInput = showcase.locator('input[placeholder="Search 20 templates..."]');
  await filterInput.fill(template.name);
  await page.waitForTimeout(300);

  const option = showcase.locator(`button:has-text("${template.name}")`).first();
  await option.click();
  await page.waitForTimeout(500);

  // Now locate the Preview button
  const previewBtn = showcase.locator("button:has-text('Preview')").first();

  // Clear network logs recorded during initial homepage load so we isolate the preview action!
  networkRequests.length = 0;
  failedRequests.length = 0;

  const clickStartTime = Date.now();
  let overlayGoneTime = 0;

  // Click Preview
  await previewBtn.click();

  // Wait for dialog overlay
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: "visible", timeout: 10000 });
  const dialogVisibleTime = Date.now() - clickStartTime;

  // Locate the iframe
  const iframeLocator = page.locator("iframe[title*='Website Preview']");
  await iframeLocator.waitFor({ state: "attached", timeout: 10000 });

  // Monitor when the overlay disappears (isPreviewLoading === false)
  const loadingOverlay = page.locator("text=/Initializing live template demo and assets/");
  
  try {
    await loadingOverlay.waitFor({ state: "detached", timeout: 45000 });
    overlayGoneTime = Date.now() - clickStartTime;
  } catch {
    overlayGoneTime = -1; // timed out
  }

  const totalUserPerceivedTime = overlayGoneTime > 0 ? overlayGoneTime : (Date.now() - clickStartTime);

  // Analyze network requests
  const htmlDocRequest = networkRequests.find(r => r.url.includes("/api/templates-preview/") && r.url.endsWith("index.html"));
  const sortedByDuration = [...networkRequests].sort((a, b) => b.duration - a.duration);
  const sortedBySize = [...networkRequests].sort((a, b) => b.size - a.size);
  const totalDownloadedBytes = networkRequests.reduce((sum, r) => sum + r.size, 0);

  await page.close();
  if (shouldCloseContext) {
    const browser = context.browser();
    await context.close();
    if (browser) await browser.close();
  }

  return {
    template: template.name,
    isWarm,
    dialogVisibleTime,
    overlayGoneTime,
    totalUserPerceivedTime,
    totalDownloadedBytes,
    networkRequestsCount: networkRequests.length,
    htmlDoc: htmlDocRequest ? {
      url: htmlDocRequest.url,
      status: htmlDocRequest.status,
      duration: htmlDocRequest.duration,
      size: htmlDocRequest.size,
      cacheControl: htmlDocRequest.cacheControl
    } : null,
    slowestRequests: sortedByDuration.slice(0, 5).map(r => ({
      url: r.url,
      status: r.status,
      duration: `${r.duration}ms`,
      size: `${(r.size / 1024).toFixed(1)} KB`,
      contentType: r.contentType
    })),
    largestRequests: sortedBySize.slice(0, 5).map(r => ({
      url: r.url,
      size: `${(r.size / 1024).toFixed(1)} KB`,
      duration: `${r.duration}ms`,
      contentType: r.contentType
    })),
    failedRequests,
    consoleErrors: consoleMessages
  };
}

async function runDiagnostic() {
  console.log("===============================================================================");
  console.log("TEMPLATE PREVIEW LATENCY DIAGNOSIS (LIVE PROD & PREVIEW)");
  console.log("===============================================================================\n");

  const targets = [
    { name: "Live Production", url: "https://codeaxys.com" },
    { name: "Preview Deployment", url: "https://codexys-ai-website-builder-bb7crtyv6-codeaxys.vercel.app" }
  ];

  for (const target of targets) {
    console.log(`\n=============================================================================`);
    console.log(`>>> TARGET: ${target.name} (${target.url}) <<<`);
    console.log(`=============================================================================\n`);

    for (const template of TEMPLATES_TO_TEST) {
      console.log(`\n-----------------------------------------------------------------------------`);
      console.log(`[TESTING] Template: ${template.name} on ${target.name}`);
      console.log(`-----------------------------------------------------------------------------`);

      // Launch fresh browser context for COLD load
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

      console.log(`  -> Running COLD Load...`);
      const coldResult = await measureTemplate(target.url, template, false, context);
      console.log(`     User-Perceived Load Time (Click -> Overlay Gone): ${coldResult.totalUserPerceivedTime} ms`);
      console.log(`     Dialog Rendered: ${coldResult.dialogVisibleTime} ms`);
      console.log(`     Total Requests: ${coldResult.networkRequestsCount} | Total Transferred: ${(coldResult.totalDownloadedBytes / (1024 * 1024)).toFixed(2)} MB`);
      if (coldResult.htmlDoc) {
        console.log(`     HTML Document: ${coldResult.htmlDoc.duration} ms | Size: ${(coldResult.htmlDoc.size / 1024).toFixed(1)} KB | Status: ${coldResult.htmlDoc.status}`);
      }
      console.log(`     Top 5 Slowest Requests:`);
      for (const s of coldResult.slowestRequests) {
        console.log(`       - ${s.duration.padEnd(8)} | ${s.size.padEnd(10)} | ${s.status} | ${s.url}`);
      }
      console.log(`     Top 5 Largest Requests:`);
      for (const l of coldResult.largestRequests) {
        console.log(`       - ${l.size.padEnd(10)} | ${l.duration.padEnd(8)} | ${l.url}`);
      }
      if (coldResult.failedRequests.length > 0) {
        console.log(`     Failed Requests:`, coldResult.failedRequests);
      }

      console.log(`\n  -> Running WARM Load (Same browser context / cache populated)...`);
      const warmResult = await measureTemplate(target.url, template, true, context);
      console.log(`     User-Perceived Load Time (Click -> Overlay Gone): ${warmResult.totalUserPerceivedTime} ms`);
      console.log(`     Dialog Rendered: ${warmResult.dialogVisibleTime} ms`);
      console.log(`     Total Requests: ${warmResult.networkRequestsCount} | Total Transferred: ${(warmResult.totalDownloadedBytes / (1024 * 1024)).toFixed(2)} MB`);
      if (warmResult.htmlDoc) {
        console.log(`     HTML Document: ${warmResult.htmlDoc.duration} ms | Size: ${(warmResult.htmlDoc.size / 1024).toFixed(1)} KB | Status: ${warmResult.htmlDoc.status}`);
      }
      console.log(`     Top 3 Slowest Requests:`);
      for (const s of warmResult.slowestRequests.slice(0, 3)) {
        console.log(`       - ${s.duration.padEnd(8)} | ${s.size.padEnd(10)} | ${s.status} | ${s.url}`);
      }

      await context.close();
      await browser.close();
    }
  }
}

runDiagnostic().catch(err => {
  console.error("Diagnostic error:", err);
  process.exit(1);
});
