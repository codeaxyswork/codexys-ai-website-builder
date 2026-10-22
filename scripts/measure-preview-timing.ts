import { chromium } from "playwright";
import { TEMPLATES_DATA } from "../components/AIBuiltTemplatesShowcase";

async function measureBaseline() {
  console.log("=== BENCHMARKING PREVIEW LOADING TIMES (BEFORE) ===");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  const section = page.locator("#ai-templates");
  await section.scrollIntoViewIfNeeded();

  // Pause marquee
  const pauseBtn = section.locator('button[aria-label="Pause scrolling"]');
  if (await pauseBtn.isVisible()) {
    await pauseBtn.click();
  }

  const sampleTemplates = [
    { name: "Hotel", folder: "Hotel" },
    { name: "Restaurant", folder: "Restaurant" },
    { name: "Travel & Tourism", folder: "Travel-Tourism" },
    { name: "Accounting Firm", folder: "Accounting Firm" },
    { name: "Spa and Wellness", folder: "Spa and Wellness" },
  ];

  const results: Array<{
    name: string;
    modalVisibleMs: number;
    contentReadyMs: number;
  }> = [];

  for (const t of sampleTemplates) {
    const previewBtn = section.locator(`button:has-text("Preview")`).filter({
      has: page.locator(`xpath=ancestor::div[contains(@class, "group") and .//h3[normalize-space()="${t.name}"]]`),
    }).first();

    const dialog = page.locator('[role="dialog"]');

    const clickStart = Date.now();
    await previewBtn.dispatchEvent("click");

    await dialog.waitFor({ state: "visible" });
    const modalVisibleTime = Date.now() - clickStart;

    // Wait for iframe to load its document and content
    const frame = page.frameLocator('[role="dialog"] iframe');
    await frame.locator("body").waitFor({ state: "attached" });
    // Wait for the iframe DOM to be completely interactive
    await page.evaluate(() => {
      const iframe = document.querySelector('[role="dialog"] iframe') as HTMLIFrameElement;
      if (!iframe) return Promise.resolve();
      if (iframe.contentDocument && iframe.contentDocument.readyState === "complete") {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        iframe.addEventListener("load", () => resolve(), { once: true });
      });
    });

    const contentReadyTime = Date.now() - clickStart;

    results.push({
      name: t.name,
      modalVisibleMs: modalVisibleTime,
      contentReadyMs: contentReadyTime,
    });

    console.log(`  Template: ${t.name}`);
    console.log(`    - Click to visible modal: ${modalVisibleTime} ms`);
    console.log(`    - Click to content ready: ${contentReadyTime} ms`);

    // Close modal
    const closeBtn = dialog.locator('button[aria-label="Close preview"]');
    await closeBtn.click();
    await dialog.waitFor({ state: "hidden" });
    await page.waitForTimeout(500);
  }

  await browser.close();

  console.log("\n=== SUMMARY BEFORE OPTIMIZATION ===");
  console.table(results);
}

measureBaseline().catch(console.error);
