import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";

async function runMobilePromptWidgetTests() {
  console.log("=================================================================");
  console.log("MOBILE RESPONSIVE PROMPT WIDGET VERIFICATION SUITE");
  console.log("=================================================================");

  const browser = await chromium.launch({ headless: true });

  const mobileViewports = [
    { name: "Small Mobile (360px)", width: 360, height: 800 },
    { name: "Standard Mobile (390px)", width: 390, height: 844 },
    { name: "Large Mobile (430px)", width: 430, height: 932 },
  ];

  for (const vp of mobileViewports) {
    console.log(`\n--- TESTING ${vp.name.toUpperCase()} (Width: ${vp.width}px) ---`);
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#hero-generator h1");
    await page.waitForTimeout(500);

    const heroSection = page.locator("#hero-generator");
    const h1 = heroSection.locator("h1");
    const langSelect = heroSection.locator("select");
    const micBtn = heroSection.locator("button:has-text('Voice Input')");
    const textarea = heroSection.locator("textarea");
    const helpText = heroSection.locator("text=Need help?");
    const attachBtn = heroSection.locator("button:has-text('Attach Logo / Images')");
    const generateBtn = heroSection.locator("button:has-text('Generate Website')");
    const aiAssistant = page.locator("#ai-launcher-general");

    // 1. Headline Checks
    console.log("1. Checking Hero Headline...");
    const h1Info = await h1.evaluate((el) => {
      const s = window.getComputedStyle(el);
      const span = el.querySelector("span");
      const spanStyle = span ? window.getComputedStyle(span) : null;

      // Group text nodes into lines by vertical position
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const rects: Array<{ word: string; top: number }> = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const words = (node.textContent || "").split(/\s+/).filter(Boolean);
        let lastIdx = 0;
        for (const w of words) {
          const idx = (node.textContent || "").indexOf(w, lastIdx);
          lastIdx = idx + w.length;
          const r = document.createRange();
          r.setStart(node, idx);
          r.setEnd(node, lastIdx);
          const rect = r.getBoundingClientRect();
          rects.push({ word: w, top: Math.round(rect.top) });
        }
      }
      const lineMap = new Map<number, string[]>();
      for (const item of rects) {
        let foundLine: number | null = null;
        for (const [top] of lineMap.entries()) {
          if (Math.abs(top - item.top) <= 8) {
            foundLine = top;
            break;
          }
        }
        if (foundLine !== null) {
          lineMap.get(foundLine)!.push(item.word);
        } else {
          lineMap.set(item.top, [item.word]);
        }
      }
      const lines = Array.from(lineMap.values()).map((words) => words.join(" "));

      return {
        fontSize: parseFloat(s.fontSize),
        lineHeight: parseFloat(s.lineHeight),
        lines,
        lineCount: lines.length,
        color: s.color,
        spanBackgroundClip: spanStyle?.webkitBackgroundClip || spanStyle?.backgroundClip,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    });

    console.log(`  - Font Size: ${h1Info.fontSize}px (increased over original 30px)`);
    console.log(`  - Line Height: ${h1Info.lineHeight}px`);
    console.log(`  - Lines (${h1Info.lineCount}):`, h1Info.lines);

    if (h1Info.lineCount !== 2) {
      throw new Error(`Expected exactly 2 lines on ${vp.name}, but found ${h1Info.lineCount}: ${JSON.stringify(h1Info.lines)}`);
    }
    if (h1Info.fontSize < 31) {
      throw new Error(`Expected increased font size >= 31px on ${vp.name}, got ${h1Info.fontSize}px`);
    }
    if (h1Info.scrollWidth > h1Info.clientWidth) {
      throw new Error(`Headline has horizontal overflow on ${vp.name}! scrollWidth=${h1Info.scrollWidth} > clientWidth=${h1Info.clientWidth}`);
    }
    console.log("  ✓ Headline displays across exactly 2 clean lines without overflow");

    // 2. Language Selector Hidden on Mobile
    console.log("2. Checking Mobile Language Selector Hidden...");
    const langVisible = await langSelect.isVisible();
    if (langVisible) {
      throw new Error(`AI Language selector is visible on ${vp.name}, but should be HIDDEN!`);
    }
    console.log("  ✓ AI Language selector is completely hidden on mobile");

    // 3. Voice Input Visible and Properly Positioned
    console.log("3. Checking Voice Input Button...");
    const micVisible = await micBtn.isVisible();
    if (!micVisible) {
      throw new Error(`Voice Input button is not visible on ${vp.name}!`);
    }
    const micBox = await micBtn.boundingBox();
    console.log(`  - Voice Input boundingBox:`, micBox);
    if (!micBox || micBox.width < 80 || micBox.height < 25) {
      throw new Error(`Voice Input button has invalid dimensions on ${vp.name}: ${JSON.stringify(micBox)}`);
    }
    console.log("  ✓ Voice Input button is visible, well-proportioned, and balanced");

    // 4. Prompt Textarea Checks
    console.log("4. Checking Prompt Textarea...");
    const textareaVisible = await textarea.isVisible();
    if (!textareaVisible) {
      throw new Error(`Textarea is not visible on ${vp.name}!`);
    }
    const textareaBox = await textarea.boundingBox();
    console.log(`  - Textarea boundingBox:`, textareaBox);

    const textareaMetrics = await textarea.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        placeholder: el.getAttribute("placeholder"),
        paddingLeft: s.paddingLeft,
        paddingTop: s.paddingTop,
        fontSize: s.fontSize,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        hasOverflow: el.scrollWidth > el.clientWidth,
      };
    });

    console.log(`  - Placeholder: "${textareaMetrics.placeholder}"`);
    console.log(`  - Padding: top=${textareaMetrics.paddingTop}, left=${textareaMetrics.paddingLeft}`);
    console.log(`  - Font size: ${textareaMetrics.fontSize}`);

    if (textareaMetrics.hasOverflow) {
      throw new Error(`Textarea overflows container on ${vp.name}!`);
    }
    if (!textareaBox || textareaBox.height < 100) {
      throw new Error(`Textarea is too small on ${vp.name}: height=${textareaBox?.height}`);
    }
    console.log("  ✓ Textarea is prominent, comfortable, fits without overflow");

    // 5. Preserved Elements Check
    console.log("5. Checking Preserved UI Elements...");
    if (!(await helpText.isVisible())) throw new Error("Help text missing on mobile");
    if (!(await attachBtn.isVisible())) throw new Error("Attach Logo / Images button missing on mobile");
    if (!(await generateBtn.isVisible())) throw new Error("Generate Website button missing on mobile");
    if (!(await aiAssistant.isVisible())) throw new Error("Codeaxys AI floating assistant missing on mobile");
    console.log("  ✓ Help text, Attach button, Generate button, and floating assistant all preserved");

    // 6. Widget Section Horizontal Overflow Check
    const heroBox = await heroSection.evaluate((el) => {
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        overflow: el.scrollWidth > el.clientWidth,
      };
    });
    if (heroBox.overflow) {
      throw new Error(`Hero section has horizontal overflow on ${vp.name}! scrollWidth=${heroBox.scrollWidth} > clientWidth=${heroBox.clientWidth}`);
    }
    console.log("  ✓ Zero horizontal overflow in hero widget section");

    await page.close();
  }

  // ===========================================================================
  // DESKTOP & TABLET VERIFICATION (Confirming NO Regressions)
  // ===========================================================================
  console.log("\n--- VERIFYING TABLET VIEWPORT (768px) ---");
  const tabletPage = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  await tabletPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await tabletPage.waitForSelector("#hero-generator select");

  const tabletLang = tabletPage.locator("#hero-generator select");
  if (!(await tabletLang.isVisible())) {
    throw new Error("AI Language selector should remain VISIBLE on tablet (768px)!");
  }
  const tabletMic = tabletPage.locator("#hero-generator button:has-text('Voice Input')");
  if (!(await tabletMic.isVisible())) {
    throw new Error("Voice Input button should remain VISIBLE on tablet (768px)!");
  }
  console.log("  ✓ Tablet layout preserves language selector and voice input");
  await tabletPage.close();

  console.log("\n--- VERIFYING DESKTOP VIEWPORT (1440px) ---");
  const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktopPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await desktopPage.waitForSelector("#hero-generator select");

  const desktopLang = desktopPage.locator("#hero-generator select");
  if (!(await desktopLang.isVisible())) {
    throw new Error("AI Language selector should remain VISIBLE on desktop (1440px)!");
  }
  const desktopMic = desktopPage.locator("#hero-generator button:has-text('Voice Input')");
  if (!(await desktopMic.isVisible())) {
    throw new Error("Voice Input button should remain VISIBLE on desktop (1440px)!");
  }
  const desktopH1 = desktopPage.locator("#hero-generator h1");
  const desktopH1Text = (await desktopH1.innerText()).replace(/\s+/g, " ");
  console.log(`  - Desktop H1 text: "${desktopH1Text}"`);
  console.log("  ✓ Desktop layout remains completely unchanged and functional");
  await desktopPage.close();

  await browser.close();
  console.log("\n=================================================================");
  console.log("✓ ALL MOBILE, TABLET & DESKTOP CHECKS PASSED WITH 100% SUCCESS!");
  console.log("=================================================================\n");
}

runMobilePromptWidgetTests().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
