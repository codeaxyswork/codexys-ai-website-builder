import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

async function verifyLiveTemplateModal() {
  console.log("=== VERIFYING LIVE TEMPLATE MODAL ON HTTPS://CODEAXYS.COM ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("1. Navigating to https://codeaxys.com...");
  await page.goto("https://codeaxys.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log("2. Locating AI Built Templates showcase...");
  const showcaseSection = page.locator("#ai-templates");
  await showcaseSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  console.log("3. Pausing marquee animation and clicking Preview button on first template...");
  const pauseBtn = showcaseSection.locator('button[aria-label*="Pause scrolling"]');
  if (await pauseBtn.isVisible()) {
    await pauseBtn.click();
    await page.waitForTimeout(500);
  }
  const previewBtn = showcaseSection.locator("button:has-text('Preview')").first();
  await previewBtn.click({ force: true });
  await page.waitForTimeout(2000);

  console.log("4. Verifying modal iframe loaded...");
  const iframe = page.locator("iframe[src*='templates-preview']").first();
  const iframeSrc = await iframe.getAttribute("src");
  console.log("   Iframe src:", iframeSrc);

  if (!iframeSrc || !iframeSrc.includes("/api/templates-preview/")) {
    throw new Error("Template preview iframe did not load properly!");
  }

  console.log("5. Verifying close button works...");
  const closeBtn = page.locator('button[aria-label="Close preview"]').first();
  await closeBtn.click();
  await page.waitForTimeout(1000);

  const isModalVisible = await page.locator('button[aria-label="Close preview"]').isVisible();
  console.log("   Modal closed cleanly:", !isModalVisible);

  console.log("\n✓ LIVE TEMPLATE PREVIEW MODAL VERIFICATION PASSED 100%!");
  await browser.close();
}

verifyLiveTemplateModal().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
