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

async function runLiveProductionAudit() {
  console.log("===============================================================================");
  console.log("AUDITING LIVE PRODUCTION AT https://codeaxys.com ACROSS ALL 20 TEMPLATES & 6 VIEWPORTS");
  console.log("===============================================================================\n");

  const browser = await chromium.launch({ headless: true });
  let totalPass = 0;
  let totalFail = 0;
  const failureDetails = [];

  for (const template of TEMPLATES) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const url = `https://codeaxys.com/api/templates-preview/${encodeURIComponent(template)}/index.html`;

    process.stdout.write(`Template: ${template.padEnd(28)} | `);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      try {
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        if (!response || response.status() !== 200) {
          throw new Error(`HTTP status ${response ? response.status() : "none"}`);
        }

        // Wait brief tick for CSS/fonts to apply
        await page.waitForTimeout(200);

        const metrics = await page.evaluate(() => {
          const doc = document.documentElement;
          const body = document.body;
          const scrollWidth = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
          const innerWidth = window.innerWidth;
          const overflowX = scrollWidth - innerWidth;

          // Check for images overflowing
          const images = Array.from(document.querySelectorAll("img"));
          const overflowingImages = images.filter(img => img.getBoundingClientRect().right > innerWidth + 2).length;

          // Check if hamburger or nav exists
          const nav = document.querySelector("nav, .nav, .navbar, header");
          const hasNav = !!nav;

          return { scrollWidth, innerWidth, overflowX, overflowingImages, hasNav };
        });

        // 1px threshold for fractional browser rendering
        if (metrics.overflowX <= 1) {
          totalPass++;
          process.stdout.write(`✓ ${vp.name} `);
        } else {
          totalFail++;
          process.stdout.write(`✗ ${vp.name} (+${metrics.overflowX}px) `);
          failureDetails.push({ template, viewport: vp.name, overflow: metrics.overflowX });
        }
      } catch (err) {
        totalFail++;
        process.stdout.write(`ERR ${vp.name} `);
        failureDetails.push({ template, viewport: vp.name, error: err.message });
      }
    }
    console.log();
    await context.close();
  }

  await browser.close();

  console.log("\n===============================================================================");
  console.log(`TOTAL RESULTS: ${totalPass} / ${totalPass + totalFail} PASS (${((totalPass / (totalPass + totalFail)) * 100).toFixed(1)}%)`);
  if (failureDetails.length > 0) {
    console.log("FAILURES DETECTED:", failureDetails);
    process.exit(1);
  } else {
    console.log("ALL 20 TEMPLATES PASS 100% ACROSS ALL 6 VIEWPORTS ON LIVE PRODUCTION!");
    process.exit(0);
  }
}

runLiveProductionAudit();
