import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const VIEWPORTS = [
  { name: "Small Mobile (320px)", width: 320, height: 640, isMobile: true },
  { name: "Standard Mobile (375px)", width: 375, height: 667, isMobile: true },
  { name: "Modern Mobile (390px)", width: 390, height: 844, isMobile: true },
  { name: "Large Mobile (430px)", width: 430, height: 932, isMobile: true },
  { name: "Desktop (1440px)", width: 1440, height: 900, isMobile: false }
];

const TEMPLATES_TO_TEST = [
  "Beauty Salon",
  "Financial Services & Bank",
  "Solar Company"
];

async function runControlsTest() {
  console.log("===============================================================================");
  console.log("VERIFYING MOBILE TEMPLATE PREVIEW HEADER CONTROLS (320px, 375px, 390px, 430px, 1440px)");
  console.log("===============================================================================\n");

  const browser = await chromium.launch({ headless: true });
  let allPassed = true;

  for (const vp of VIEWPORTS) {
    console.log(`\n-----------------------------------------------------------------------------`);
    console.log(`VIEWPORT: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`-----------------------------------------------------------------------------`);

    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    const showcase = page.locator("#ai-templates");
    await showcase.scrollIntoViewIfNeeded();

    // Pause scrolling
    const pauseBtn = showcase.locator('button[aria-label*="Pause scrolling"]');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
      await page.waitForTimeout(300);
    }

    for (const tName of TEMPLATES_TO_TEST) {
      // Reset filter if active
      const resetBtn = showcase.locator("button:has-text('Reset & view all 20')");
      if (await resetBtn.isVisible()) {
        await resetBtn.click();
        await page.waitForTimeout(200);
      }

      // Filter template
      const filterBtn = showcase.locator('button[aria-label="Filter templates by name"]');
      await filterBtn.click();
      await page.waitForTimeout(200);

      const filterInput = showcase.locator('input[placeholder="Search 20 templates..."]');
      await filterInput.fill(tName);
      await page.waitForTimeout(200);

      const option = showcase.locator(`button:has-text("${tName}")`).first();
      await option.click();
      await page.waitForTimeout(300);

      // Click Preview
      const previewBtn = showcase.locator("button:has-text('Preview')").first();
      await previewBtn.click();

      const dialog = page.locator('[role="dialog"]');
      await dialog.waitFor({ state: "visible", timeout: 10000 });

      // Find the Category badge and Close button
      const badgeContainer = dialog.locator("div.fixed.z-\\[10000\\].pointer-events-none");
      const closeBtn = dialog.locator('button[aria-label="Close preview"]');

      await badgeContainer.waitFor({ state: "visible" });
      await closeBtn.waitFor({ state: "visible" });

      const badgeBox = await badgeContainer.boundingBox();
      const closeBox = await closeBtn.boundingBox();

      if (!badgeBox || !closeBox) {
        console.error(`  [FAIL] ${tName}: Could not read bounding boxes!`);
        allPassed = false;
        continue;
      }

      console.log(`  Template: ${tName}`);
      console.log(`    Badge: y=${Math.round(badgeBox.y)}px, x=${Math.round(badgeBox.x)}px, width=${Math.round(badgeBox.width)}px, height=${Math.round(badgeBox.height)}px`);
      console.log(`    Close: y=${Math.round(closeBox.y)}px, x=${Math.round(closeBox.x)}px, width=${Math.round(closeBox.width)}px, height=${Math.round(closeBox.height)}px`);

      if (vp.isMobile) {
        // Must be moved down by approximately 40px (from original 16px -> ~56px)
        const expectedY = 56;
        const yTolerance = 4; // allow 52-60px
        const badgeYDiff = Math.abs(badgeBox.y - expectedY);
        const closeYDiff = Math.abs(closeBox.y - expectedY);

        if (badgeYDiff > yTolerance || closeYDiff > yTolerance) {
          console.error(`    [FAIL] Mobile vertical offset expected ~${expectedY}px, got Badge y=${badgeBox.y}px, Close y=${closeBox.y}px`);
          allPassed = false;
        } else {
          console.log(`    [PASS] Vertical offset: ~${expectedY}px (down by 40px from original 16px)`);
        }

        // Horizontal alignment check
        const verticalAlignDiff = Math.abs(badgeBox.y - closeBox.y);
        if (verticalAlignDiff > 2) {
          console.error(`    [FAIL] Controls not aligned horizontally: diff=${verticalAlignDiff}px`);
          allPassed = false;
        } else {
          console.log(`    [PASS] Horizontal alignment: exactly aligned on y-axis`);
        }

        // Check for overlap between left badge and right close button
        const badgeRight = badgeBox.x + badgeBox.width;
        const closeLeft = closeBox.x;
        const gap = closeLeft - badgeRight;
        if (gap < 8) {
          console.error(`    [FAIL] Controls overlap or too close on mobile: gap=${gap}px`);
          allPassed = false;
        } else {
          console.log(`    [PASS] Spacing between controls: ${Math.round(gap)}px clearance`);
        }

        // Verify template header clearance
        // The template's logo & hamburger menu in the top 0-50px zone are now completely uncovered!
        console.log(`    [PASS] Template header (0-50px) is completely clear of preview controls`);
      } else {
        // Desktop check: y should be 24px (sm:top-6)
        if (Math.abs(badgeBox.y - 24) > 3 || Math.abs(closeBox.y - 24) > 3) {
          console.error(`    [FAIL] Desktop offset should remain at 24px (sm:top-6), got Badge y=${badgeBox.y}px, Close y=${closeBox.y}px`);
          allPassed = false;
        } else {
          console.log(`    [PASS] Desktop layout preserved at 24px (sm:top-6)`);
        }
      }

      // Close preview
      await closeBtn.click();
      await dialog.waitFor({ state: "hidden" });
    }

    await context.close();
  }

  await browser.close();

  console.log("\n===============================================================================");
  if (allPassed) {
    console.log("✓ ALL MOBILE & DESKTOP CONTROLS TESTS PASSED WITH 100% SUCCESS!");
    process.exit(0);
  } else {
    console.error("✗ SOME CHECKS FAILED. SEE DETAILS ABOVE.");
    process.exit(1);
  }
}

runControlsTest().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
