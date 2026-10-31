import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

export const TEMPLATES = [
  "Accounting Firm",
  "Architecture",
  "Beauty Salon",
  "Creative Agency",
  "Digital Marketing agency",
  "Financial Services and bank",
  "Hotel",
  "IT Company",
  "Interior Design",
  "Jewellery",
  "NGO",
  "Restaurant",
  "Solar Company",
  "Spa and Wellness",
  "Travel-Tourism",
  "dancer",
  "fitness",
  "insurance",
  "photography",
  "yoga"
];

export const VIEWPORTS = [
  { name: "320px", width: 320, height: 640 },
  { name: "375px", width: 375, height: 667 },
  { name: "390px", width: 390, height: 844 },
  { name: "430px", width: 430, height: 932 },
  { name: "768px", width: 768, height: 1024 },
  { name: "1440px", width: 1440, height: 900 }
];

export async function auditTemplates(targetTemplates = TEMPLATES) {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const template of targetTemplates) {
    results[template] = {};
    const context = await browser.newContext();
    const page = await context.newPage();
    const url = `http://localhost:3000/api/templates-preview/${encodeURIComponent(template)}/index.html`;

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
        await page.waitForTimeout(200);

        const metrics = await page.evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
          const innerWidth = window.innerWidth;
          const overflowDiff = Math.max(0, Math.round(scrollWidth - innerWidth));
          const hasOverflow = overflowDiff > 1;

          let topOverflowSelectors = [];
          if (hasOverflow) {
            const allElements = document.querySelectorAll("*");
            for (const el of allElements) {
              const rect = el.getBoundingClientRect();
              if (rect.right > innerWidth + 1 || rect.width > innerWidth + 1) {
                const tag = el.tagName.toLowerCase();
                const cls = typeof el.className === "string" ? el.className.trim() : "";
                const id = el.id ? `#${el.id}` : "";
                const selector = `${tag}${id}${cls ? "." + cls.split(" ").filter(Boolean).slice(0, 2).join(".") : ""}`;
                topOverflowSelectors.push({
                  selector,
                  width: Math.round(rect.width),
                  right: Math.round(rect.right)
                });
                if (topOverflowSelectors.length >= 5) break;
              }
            }
          }

          // Check for images exceeding viewport
          const images = Array.from(document.querySelectorAll("img"));
          const overflowingImages = images.filter(img => img.getBoundingClientRect().width > innerWidth + 1).length;

          return {
            scrollWidth,
            innerWidth,
            overflowDiff,
            hasOverflow,
            topOverflowSelectors,
            overflowingImages,
            totalImages: images.length
          };
        });

        results[template][vp.name] = metrics;
      } catch (err) {
        results[template][vp.name] = { error: err.message };
      }
    }
    await context.close();
  }

  await browser.close();
  return results;
}

if (process.argv[1]?.endsWith("audit-templates-responsive.mjs")) {
  const target = process.argv[2] ? [process.argv[2]] : TEMPLATES;
  auditTemplates(target).then(results => {
    console.log("\n" + "=".repeat(96));
    console.log("TEMPLATE RESPONSIVENESS AUDIT RESULTS");
    console.log("=".repeat(96));
    console.log("Template                       | 320px      | 375px      | 390px      | 430px      | 768px      | 1440px");
    console.log("-".repeat(96));

    let totalPass = 0;
    let totalTests = 0;

    for (const [tmpl, vpData] of Object.entries(results)) {
      const cols = [`${tmpl.padEnd(30, " ")}`];
      for (const vp of VIEWPORTS) {
        totalTests++;
        const info = vpData[vp.name] || {};
        if (info.error) {
          cols.push("ERROR      ");
        } else if (info.hasOverflow) {
          cols.push(`+${info.overflowDiff}px FAIL `.padEnd(10, " "));
        } else {
          totalPass++;
          cols.push("PASS       ");
        }
      }
      console.log(cols.join(" | "));
    }

    console.log("-".repeat(96));
    console.log(`TOTAL SCORE: ${totalPass} / ${totalTests} viewports passing (${Math.round((totalPass/totalTests)*100)}%)\n`);
  }).catch(console.error);
}
