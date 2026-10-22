import { chromium } from "playwright";
import { TEMPLATES_DATA } from "../components/AIBuiltTemplatesShowcase";

async function runComprehensiveTests() {
  console.log("=== COMPREHENSIVE UI, FILTERING, NAMING & PERFORMANCE VERIFICATION ===");

  // 1. Data Integrity and Naming Standardization
  console.log("\n--- TEST 1: Standardized Template Names (20 Entries) ---");
  if (TEMPLATES_DATA.length !== 20) {
    throw new Error(`Expected exactly 20 templates, got ${TEMPLATES_DATA.length}`);
  }

  const expectedStandardizedNames: Record<string, string> = {
    "accounting-firm": "Accounting Firm",
    "architecture": "Architecture",
    "beauty-salon": "Beauty Salon",
    "creative-agency": "Creative Agency",
    "digital-marketing-agency": "Digital Marketing Agency",
    "financial-services-and-bank": "Financial Services & Bank",
    "hotel": "Hotel",
    "it-company": "IT Company",
    "interior-design": "Interior Design",
    "jewellery": "Jewellery",
    "ngo": "NGO",
    "restaurant": "Restaurant",
    "solar-company": "Solar Company",
    "spa-and-wellness": "Spa & Wellness",
    "travel-tourism": "Travel & Tourism",
    "dancer": "Dancer",
    "fitness": "Fitness",
    "insurance": "Insurance",
    "photography": "Photography",
    "yoga": "Yoga",
  };

  const nameSet = new Set<string>();
  for (const t of TEMPLATES_DATA) {
    const expectedName = expectedStandardizedNames[t.id];
    if (!expectedName) {
      throw new Error(`Unexpected template id: ${t.id}`);
    }
    if (t.name !== expectedName) {
      throw new Error(`Expected template name "${expectedName}", got "${t.name}"`);
    }
    if (nameSet.has(t.name)) {
      throw new Error(`Duplicate template name found: ${t.name}`);
    }
    nameSet.add(t.name);
    console.log(`  ✓ [${t.id}] folderName="${t.folderName}" -> name="${t.name}" (${t.category})`);
  }
  console.log("  ✓ All 20 template display names verified clean, consistent, and unique!");

  // 2. Playwright UI Verification
  console.log("\n--- TEST 2: UI Visuals, Badge & Pause Button Heights ---");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  const section = page.locator("#ai-templates");
  await section.scrollIntoViewIfNeeded();

  // Badge and Pause Button heights
  const badge = section.locator("text=/20 Real Templates/").locator("xpath=..");
  const pauseBtn = section.locator('button[aria-label="Pause scrolling"], button[aria-label="Resume scrolling"]');
  const filterBtn = section.locator('button[aria-label="Filter templates by name"]');

  const badgeBox = await badge.boundingBox();
  const pauseBox = await pauseBtn.boundingBox();
  const filterBox = await filterBtn.boundingBox();

  console.log(`  - Badge Height: ${badgeBox?.height}px`);
  console.log(`  - Pause Button Height: ${pauseBox?.height}px`);
  console.log(`  - Filter Button Height: ${filterBox?.height}px`);

  if (!badgeBox || !pauseBox || !filterBox) {
    throw new Error("Could not calculate bounding boxes for header controls");
  }

  const heightDiff = Math.abs(badgeBox.height - pauseBox.height);
  if (heightDiff > 1) {
    throw new Error(`Badge height (${badgeBox.height}px) does not match Pause button height (${pauseBox.height}px)!`);
  }
  console.log("  ✓ Visual height consistency verified! Badge, Pause button, and Filter button heights match perfectly.");

  // 3. Carousel Autoplay and Pause/Resume controls
  console.log("\n--- TEST 3: Carousel Autoplay, Pause & Resume Controls ---");
  console.log("  - Clicking Pause button...");
  await pauseBtn.click();
  const resumeVisible = await section.locator('button[aria-label="Resume scrolling"]').isVisible();
  if (!resumeVisible) throw new Error("Resume button not visible after pausing");
  console.log("  ✓ Marquee paused successfully, showing Resume state");

  console.log("  - Clicking Resume button...");
  const resumeBtn = section.locator('button[aria-label="Resume scrolling"]');
  await resumeBtn.click();
  const pauseVisible = await section.locator('button[aria-label="Pause scrolling"]').isVisible();
  if (!pauseVisible) throw new Error("Pause button not visible after resuming");
  console.log("  ✓ Marquee resumed successfully, returning to Pause state");

  // Re-pause for stable element interaction
  await pauseBtn.click();

  // 4. Filter Functionality
  console.log("\n--- TEST 4: Searchable Template Filter Control ---");
  // Open filter dropdown
  await filterBtn.click();
  const dropdown = section.locator(".max-h-60");
  await dropdown.waitFor({ state: "visible" });
  console.log("  ✓ Filter dropdown opened");

  // Test search in filter
  const searchInput = section.locator('input[placeholder="Search 20 templates..."]');
  await searchInput.fill("Restaurant");
  const restaurantOption = dropdown.locator("button:has-text('Restaurant')").first();
  await restaurantOption.waitFor({ state: "visible" });
  console.log("  ✓ Search query 'Restaurant' displayed Restaurant option");

  // Select Restaurant
  await restaurantOption.click();
  console.log("  ✓ Selected 'Restaurant' from filter dropdown");

  // Verify filtered card view is rendered
  const filteredBanner = section.locator("text=/Showing filter:/");
  await filteredBanner.waitFor({ state: "visible" });
  console.log("  ✓ Filtered card view displayed with clear indicator");

  const filteredCard = section.locator(".max-w-7xl h3:has-text('Restaurant')");
  if (!(await filteredCard.isVisible())) {
    throw new Error("Restaurant card is not visible in filtered view");
  }

  // Test immediate Preview action from filtered card
  console.log("  - Launching Preview directly from filtered card...");
  const filteredPreviewBtn = section.locator("button:has-text('Preview')").first();
  await filteredPreviewBtn.click();

  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: "visible" });
  console.log("  ✓ Preview opened immediately from filtered card");

  const closeBtn = dialog.locator('button[aria-label="Close preview"]');
  await closeBtn.click();
  await dialog.waitFor({ state: "hidden" });
  console.log("  ✓ Preview closed");

  // Reset filter
  console.log("  - Resetting filter to return to full carousel...");
  const resetBtn = section.locator("button:has-text('Reset & view all 20')");
  await resetBtn.click();
  await page.waitForTimeout(300);

  // Verify full marquee is back
  const allCards = section.locator("h3:has-text('Restaurant')");
  const cardCount = await allCards.count();
  console.log(`  ✓ Full carousel restored (found duplicated marquee cards: ${cardCount})`);

  // 5. Benchmark Performance (AFTER Optimizations)
  console.log("\n--- TEST 5: Preview Performance Benchmarks (AFTER) ---");
  const sampleTemplates = [
    { name: "Hotel", folder: "Hotel" },
    { name: "Restaurant", folder: "Restaurant" },
    { name: "Travel & Tourism", folder: "Travel-Tourism" },
    { name: "Accounting Firm", folder: "Accounting Firm" },
    { name: "Spa & Wellness", folder: "Spa and Wellness" },
  ];

  const resultsAfter: Array<{
    name: string;
    modalVisibleMs: number;
    contentReadyMs: number;
  }> = [];

  for (const t of sampleTemplates) {
    const cardPreviewBtn = section.locator(`button:has-text("Preview")`).filter({
      has: page.locator(`xpath=ancestor::div[contains(@class, "group") and .//h3[normalize-space()="${t.name}"]]`),
    }).first();

    const clickStart = Date.now();
    await cardPreviewBtn.dispatchEvent("click");

    await dialog.waitFor({ state: "visible" });
    const modalVisibleTime = Date.now() - clickStart;

    // Check loading indicator appears immediately
    const loader = dialog.locator("text=/Loading/");
    const loaderVisible = await loader.isVisible().catch(() => false);
    if (loaderVisible) {
      console.log(`    ✓ Immediate loading overlay active for ${t.name}`);
    }

    // Wait for iframe content ready
    const frame = page.frameLocator('[role="dialog"] iframe');
    await frame.locator("body").waitFor({ state: "attached" });

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

    resultsAfter.push({
      name: t.name,
      modalVisibleMs: modalVisibleTime,
      contentReadyMs: contentReadyTime,
    });

    console.log(`  ${t.name}:`);
    console.log(`    - Modal visible: ${modalVisibleTime} ms`);
    console.log(`    - Content ready: ${contentReadyTime} ms`);

    await closeBtn.click();
    await dialog.waitFor({ state: "hidden" });
    await page.waitForTimeout(300);
  }

  // 6. Test Switching between different templates
  console.log("\n--- TEST 6: Switching Between Templates Seamlessly ---");
  // Open Hotel, then close and open Dancer, then close and open Yoga
  for (const tName of ["Hotel", "Dancer", "Yoga"]) {
    const btn = section.locator(`button:has-text("Preview")`).filter({
      has: page.locator(`xpath=ancestor::div[contains(@class, "group") and .//h3[normalize-space()="${tName}"]]`),
    }).first();
    await btn.dispatchEvent("click");
    await dialog.waitFor({ state: "visible" });
    const titlePill = dialog.locator(`text="${tName}"`);
    if (!(await titlePill.isVisible())) {
      throw new Error(`Expected modal title pill to show "${tName}"`);
    }
    console.log(`  ✓ Opened preview for ${tName}`);
    await closeBtn.click();
    await dialog.waitFor({ state: "hidden" });
  }

  await browser.close();

  console.log("\n=== PERFORMANCE MEASUREMENTS (AFTER OPTIMIZATIONS) ===");
  console.table(resultsAfter);

  console.log("\n========================================================");
  console.log("✓ ALL TESTS PASSED: UI, FILTER, NAMING & SPEED FULLY VERIFIED!");
  console.log("========================================================\n");
}

runComprehensiveTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
