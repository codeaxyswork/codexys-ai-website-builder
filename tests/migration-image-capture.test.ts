import assert from "node:assert";
import {
  isSupportedAssetUrl,
  extractAssetMappingsFromHtml,
  rewriteAssetUrlInContent,
} from "@/lib/migration/asset-importer";
import {
  normalizeImageUrl,
  buildSourcePageFromBrowserSnapshot,
  extractStructuredSourcePage,
} from "@/lib/migration/redesign-engine";

async function runMigrationImageCaptureTests() {
  console.log("=".repeat(80));
  console.log("CODEAXYS MIGRATION IMAGE CAPTURE REGRESSION TEST SUITE");
  console.log("=".repeat(80));

  const baseUrl = "https://source-example.com/subpage/";

  // --------------------------------------------------------------------------
  // Test 1: Query parameter stripping for image extension detection
  // --------------------------------------------------------------------------
  console.log("\n--- Test 1: Query Parameter Stripping & Extension Recognition ---");
  {
    const urlWithParams = "https://cdn.example.com/images/hero.jpg?w=1200&format=webp&q=80";
    assert.strictEqual(
      isSupportedAssetUrl(urlWithParams),
      true,
      "Expected URL with query parameters to be recognized as supported image"
    );

    const pngWithParams = "https://cdn.example.com/assets/logo.png?v=2.4.1";
    assert.strictEqual(
      isSupportedAssetUrl(pngWithParams),
      true,
      "Expected PNG with version query param to be recognized"
    );

    const nonAssetUrl = "https://cdn.example.com/api/analytics?track=1";
    assert.strictEqual(
      isSupportedAssetUrl(nonAssetUrl),
      false,
      "Expected analytics endpoint to be rejected"
    );

    console.log("✅ Passed: Query parameters stripped before extension evaluation.");
  }

  // --------------------------------------------------------------------------
  // Test 2: Targeted Tracking Pixel Regex (Not Overly Broad)
  // --------------------------------------------------------------------------
  console.log("\n--- Test 2: Targeted Pixel Filter & Legitimate Pixel Preservation ---");
  {
    // Legitimate assets that include the word "pixel"
    const legitimate1 = "https://source-example.com/assets/pixel-art-hero.png";
    const legitimate2 = "https://source-example.com/wp-content/uploads/pixel_city.jpg";
    const legitimate3 = "https://source-example.com/icons/pixelated-logo.svg";

    assert.strictEqual(
      isSupportedAssetUrl(legitimate1),
      true,
      "Legitimate asset 'pixel-art-hero.png' must NOT be excluded"
    );
    assert.strictEqual(
      isSupportedAssetUrl(legitimate2),
      true,
      "Legitimate asset 'pixel_city.jpg' must NOT be excluded"
    );
    assert.strictEqual(
      isSupportedAssetUrl(legitimate3),
      true,
      "Legitimate asset 'pixelated-logo.svg' must NOT be excluded"
    );

    // Actual tracking pixels that MUST be excluded
    const tracking1 = "https://connect.facebook.net/en_US/fbevents.js/facebook-pixel.gif";
    const tracking2 = "https://analytics.tiktok.com/api/v2/pixel.gif";
    const tracking3 = "https://source-example.com/tr/?id=123";
    const tracking4 = "https://source-example.com/assets/visitor-pixel.png";
    const tracking5 = "https://source-example.com/tracking-pixel.png";

    assert.strictEqual(
      isSupportedAssetUrl(tracking1),
      false,
      "Facebook pixel must be excluded"
    );
    assert.strictEqual(
      isSupportedAssetUrl(tracking2),
      false,
      "TikTok pixel.gif must be excluded"
    );
    assert.strictEqual(
      isSupportedAssetUrl(tracking3),
      false,
      "/tr/ tracking route must be excluded"
    );
    assert.strictEqual(
      isSupportedAssetUrl(tracking4),
      false,
      "visitor-pixel must be excluded"
    );
    assert.strictEqual(
      isSupportedAssetUrl(tracking5),
      false,
      "tracking-pixel must be excluded"
    );

    console.log("✅ Passed: Targeted pixel regex excludes tracking while preserving legitimate 'pixel' assets.");
  }

  // --------------------------------------------------------------------------
  // Test 3: Data URL Blank Placeholders vs Valid Data Assets
  // --------------------------------------------------------------------------
  console.log("\n--- Test 3: Lazy-Load Blank Placeholders Demoted ---");
  {
    const transparent1x1 = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const svgBlank = "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201%201'%3E%3C/svg%3E";

    assert.strictEqual(
      isSupportedAssetUrl(transparent1x1),
      false,
      "Transparent 1x1 GIF placeholder must not be imported"
    );
    assert.strictEqual(
      isSupportedAssetUrl(svgBlank),
      false,
      "Empty SVG placeholder must not be imported"
    );

    console.log("✅ Passed: Dummy lazy-load placeholders rejected from asset import.");
  }

  // --------------------------------------------------------------------------
  // Test 4: Relative Image Normalization in redesign-engine
  // --------------------------------------------------------------------------
  console.log("\n--- Test 4: Image URL Normalization in redesign-engine ---");
  {
    assert.strictEqual(
      normalizeImageUrl("/images/hero.jpg", baseUrl),
      "https://source-example.com/images/hero.jpg",
      "Root-relative URL must resolve to origin root"
    );

    assert.strictEqual(
      normalizeImageUrl("banner.webp", baseUrl),
      "https://source-example.com/subpage/banner.webp",
      "Relative path must resolve against current subpage path"
    );

    assert.strictEqual(
      normalizeImageUrl("//cdn.provider.com/logo.png", baseUrl),
      "https://cdn.provider.com/logo.png",
      "Protocol-relative URL must resolve with https:"
    );

    assert.strictEqual(
      normalizeImageUrl("https://existing.com/pic.jpg?w=800", baseUrl),
      "https://existing.com/pic.jpg?w=800",
      "Absolute URL must remain unchanged"
    );

    assert.strictEqual(
      normalizeImageUrl("data:image/png;base64,abc", baseUrl),
      "data:image/png;base64,abc",
      "Data URL must be preserved as-is"
    );

    console.log("✅ Passed: normalizeImageUrl correctly handles all relative and protocol variations.");
  }

  // --------------------------------------------------------------------------
  // Test 5: Raw-to-Absolute Asset Mapping Discovery in HTML
  // --------------------------------------------------------------------------
  console.log("\n--- Test 5: extractAssetMappingsFromHtml Discovery ---");
  {
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <link rel="icon" href="/favicon.ico">
      </head>
      <body>
        <header>
          <img src="/img/logo.svg" alt="Brand Logo">
        </header>
        <main>
          <img src="assets/hero.jpg" data-src="/hires/hero.jpg" alt="Hero">
          <div style="background-image: url('../bg.webp')">Hero Background</div>
          <img srcset="/img-400.jpg 400w, /img-800.jpg 800w" src="/img-800.jpg">
        </main>
      </body>
      </html>
    `;

    const mappings = extractAssetMappingsFromHtml(sampleHtml, baseUrl);
    const rawUrls = mappings.map((m) => m.rawUrl);

    assert.ok(rawUrls.includes("/img/logo.svg"), "Discovered root-relative /img/logo.svg");
    assert.ok(rawUrls.includes("assets/hero.jpg"), "Discovered relative assets/hero.jpg");
    assert.ok(rawUrls.includes("/hires/hero.jpg"), "Discovered data-src /hires/hero.jpg");
    assert.ok(rawUrls.includes("../bg.webp"), "Discovered relative inline style ../bg.webp");
    assert.ok(rawUrls.includes("/img-400.jpg"), "Discovered srcset candidate /img-400.jpg");
    assert.ok(rawUrls.includes("/img-800.jpg"), "Discovered srcset candidate /img-800.jpg");
    assert.ok(rawUrls.includes("/favicon.ico"), "Discovered favicon /favicon.ico");

    // Check that absoluteUrls are correctly resolved
    const logoMapping = mappings.find((m) => m.rawUrl === "/img/logo.svg");
    assert.strictEqual(
      logoMapping?.absoluteUrl,
      "https://source-example.com/img/logo.svg",
      "Logo absolute URL must be correctly resolved"
    );

    const relativeBgMapping = mappings.find((m) => m.rawUrl === "../bg.webp");
    assert.strictEqual(
      relativeBgMapping?.absoluteUrl,
      "https://source-example.com/bg.webp",
      "Inline style ../bg.webp must resolve relative to subpage base"
    );

    console.log("✅ Passed: extractAssetMappingsFromHtml captures relative src, srcset, data-src, and inline styles.");
  }

  // --------------------------------------------------------------------------
  // Test 6: Boundary-Safe Contextual URL Rewriting
  // --------------------------------------------------------------------------
  console.log("\n--- Test 6: Contextual URL Rewriting (Prevents False Substring Replacement) ---");
  {
    const inputHtml = `
      <img src="/logo.png" alt="Main">
      <img src="/super/logo.png" alt="Super Logo">
      <div style="background-image: url('/logo.png')"></div>
      <img srcset="/logo.png 1x, /logo.png?2x 2x">
    `;

    const targetRaw = "/logo.png";
    const replacementPublic = "https://mock.supabase.co/storage/v1/object/public/website-assets/u1/w1/logo.png";

    const rewritten = rewriteAssetUrlInContent(inputHtml, targetRaw, replacementPublic);

    // /logo.png should be replaced
    assert.ok(
      rewritten.includes(`src="${replacementPublic}"`),
      "Quoted src attribute must be rewritten"
    );
    assert.ok(
      rewritten.includes(`url('${replacementPublic}')`),
      "CSS url() must be rewritten"
    );
    assert.ok(
      rewritten.includes(`${replacementPublic} 1x`),
      "srcset descriptor element must be rewritten"
    );

    // /super/logo.png should NOT be corrupted to /super/https://mock...
    assert.ok(
      rewritten.includes('src="/super/logo.png"'),
      "Subpath '/super/logo.png' must NOT be corrupted by '/logo.png' replacement"
    );

    console.log("✅ Passed: rewriteAssetUrlInContent safely rewrites exact targets without corrupting substrings.");
  }

  // --------------------------------------------------------------------------
  // Test 7: Header Logo Detection and Hero Image Separation
  // --------------------------------------------------------------------------
  console.log("\n--- Test 7: Header Logo Identification vs Hero Card Image Separation ---");
  {
    const snapshotWithHeader = {
      url: "https://source-example.com/",
      html: `
        <!DOCTYPE html>
        <html>
        <body>
          <header class="site-header">
            <a href="/"><img src="/brand-mark.png" alt="Company Name"></a>
          </header>
          <section class="hero-section">
            <h1>Welcome to Our Platform</h1>
            <img src="/hero-banner.jpg" alt="Platform Banner">
          </section>
          <section class="gallery">
            <img src="/gallery1.jpg" alt="Gallery 1">
          </section>
        </body>
        </html>
      `,
      title: "Test Brand",
      description: "Test Description",
    };

    const sourcePage = buildSourcePageFromBrowserSnapshot(snapshotWithHeader);
    const structured = extractStructuredSourcePage(sourcePage);

    // 1. Header logo must be identified from header tag even if filename lacks 'logo'
    assert.strictEqual(
      sourcePage.logoUrl,
      "https://source-example.com/brand-mark.png",
      "Expected brand-mark.png in <header> to be recognized as logoUrl"
    );
    assert.strictEqual(
      structured.logoUrl,
      "https://source-example.com/brand-mark.png",
      "Structured output must preserve logoUrl"
    );

    // 2. Logo must NOT be reused as the hero image when a real content image exists
    const heroImage = sourcePage.heroBgImage;
    assert.notStrictEqual(
      heroImage,
      "https://source-example.com/brand-mark.png",
      "Logo must NOT be reused as hero image"
    );
    assert.strictEqual(
      heroImage,
      "https://source-example.com/hero-banner.jpg",
      "Real content image in hero section must be chosen as hero image"
    );

    console.log("✅ Passed: Header logo recognized and prevented from polluting hero cards.");
  }

  // --------------------------------------------------------------------------
  // Test 8: Responsive srcset Candidate Extraction & Normalization
  // --------------------------------------------------------------------------
  console.log("\n--- Test 8: Responsive srcset Candidates ---");
  {
    const htmlWithSrcset = `
      <img src="/fallback.jpg" srcset="/mobile.jpg 480w, /tablet.jpg 768w, /desktop.jpg 1200w">
    `;

    const mappings = extractAssetMappingsFromHtml(htmlWithSrcset, "https://source-example.com/");
    const absoluteCandidates = mappings.map((m) => m.absoluteUrl);

    assert.ok(absoluteCandidates.includes("https://source-example.com/mobile.jpg"));
    assert.ok(absoluteCandidates.includes("https://source-example.com/tablet.jpg"));
    assert.ok(absoluteCandidates.includes("https://source-example.com/desktop.jpg"));
    assert.ok(absoluteCandidates.includes("https://source-example.com/fallback.jpg"));

    console.log("✅ Passed: All responsive srcset candidates extracted and resolved.");
  }

  console.log("\n" + "=".repeat(80));
  console.log("ALL MIGRATION IMAGE CAPTURE TESTS PASSED! 📸✨");
  console.log("=".repeat(80));
}

runMigrationImageCaptureTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
