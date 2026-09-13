import { assemblePublishedWebsite } from "../lib/site-renderer";
import { analyzePage } from "../lib/seo-analyzer";

async function runLightweightSmokeTest() {
  console.log("==================================================");
  console.log("LIGHTWEIGHT SEO PRODUCTION SMOKE TEST");
  console.log("==================================================\n");

  let passed = 0;
  let total = 0;

  function assert(cond: boolean, name: string) {
    total++;
    if (cond) {
      passed++;
      console.log(`[PASS] Smoke Test ${total}: ${name}`);
    } else {
      console.error(`[FAIL] Smoke Test ${total}: ${name}`);
    }
  }

  // 1. Published Site Render (/site/[slug])
  try {
    const rendered = assemblePublishedWebsite({
      htmlContent: "<h1>Demo Site</h1><p>Welcome</p>",
      cssContent: "body { color: black; }",
      jsContent: "console.log('loaded');",
      seoSettings: { seo_title: "Demo Site SEO Title", meta_description: "Demo Description" },
      websiteTitle: "Demo Site",
    });
    assert(rendered.includes("<title>Demo Site SEO Title</title>"), "Rendered site HTML injection (/site/[slug])");
  } catch (e: any) {
    assert(false, `Rendered site HTML injection failed: ${e.message}`);
  }

  // 2. Deterministic Analysis Engine (0 credits consumed)
  try {
    const analysis = analyzePage({
      path: "index.html",
      htmlContent: "<h1>Demo Title</h1>",
    });
    assert(analysis.seo_score > 0, "Offline Cheerio Analysis Engine (0 credits)");
  } catch (e: any) {
    assert(false, `Cheerio Analysis Engine failed: ${e.message}`);
  }

  console.log("\n==================================================");
  console.log(`SMOKE TEST RESULTS: ${passed}/${total} PASSED`);
  console.log("==================================================");
}

runLightweightSmokeTest().catch(console.error);
