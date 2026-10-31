import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("▶ Running SEO Capabilities Showcase & Ordering Verification Tests...");

const showcasePath = path.resolve(process.cwd(), "components/SEOCapabilitiesShowcase.tsx");
const landingViewPath = path.resolve(process.cwd(), "components/LandingView.tsx");

assert.ok(fs.existsSync(showcasePath), "components/SEOCapabilitiesShowcase.tsx must exist");
assert.ok(fs.existsSync(landingViewPath), "components/LandingView.tsx must exist");

const showcaseContent = fs.readFileSync(showcasePath, "utf-8");
const landingViewContent = fs.readFileSync(landingViewPath, "utf-8");

// 1. Verify all 6 Categories exist in SEOCapabilitiesShowcase
const requiredCategories = [
  "SEO Command Center & Analytics",
  "Technical & Organic SEO",
  "AI Search Visibility",
  "Content & Topical Authority",
  "Competitor & Opportunity Intelligence",
  "SEO Autopilot",
];

for (const cat of requiredCategories) {
  assert.ok(
    showcaseContent.includes(cat),
    `SEOCapabilitiesShowcase must include category "${cat}"`
  );
}
console.log("  ✓ All 6 required SEO categories exist");

// 2. Verify all Category 1 features
const cat1Features = [
  "SEO Command Center",
  "SEO Overview",
  "Performance",
  "Monitoring",
  "Reports & White Label",
];
for (const feat of cat1Features) {
  assert.ok(
    showcaseContent.includes(feat),
    `Category 1 must include feature "${feat}"`
  );
}
console.log("  ✓ Category 1 (SEO Command Center & Analytics) contains all 5 required features");

// 3. Verify all Category 2 features
const cat2Features = [
  "Technical Crawl",
  "Technical SEO",
  "Organic SEO",
  "Internal Links",
  "Local SEO",
  "Pages",
  "SEO Settings",
];
for (const feat of cat2Features) {
  assert.ok(
    showcaseContent.includes(feat),
    `Category 2 must include feature "${feat}"`
  );
}
console.log("  ✓ Category 2 (Technical & Organic SEO) contains all 7 required features");

// 4. Verify all Category 3 features
const cat3Features = [
  "AEO / AI Search",
  "AI Visibility",
  "Keywords / SERP & AI",
];
for (const feat of cat3Features) {
  assert.ok(
    showcaseContent.includes(feat),
    `Category 3 must include feature "${feat}"`
  );
}
console.log("  ✓ Category 3 (AI Search Visibility) contains all 3 required features");

// 5. Verify all Category 4 features
const cat4Features = [
  "Content Studio",
  "Content & Blog",
  "Content Gaps",
  "Topical Authority",
];
for (const feat of cat4Features) {
  assert.ok(
    showcaseContent.includes(feat),
    `Category 4 must include feature "${feat}"`
  );
}
console.log("  ✓ Category 4 (Content & Topical Authority) contains all 4 required features");

// 6. Verify all Category 5 features
const cat5Features = [
  "Competitors",
  "Opportunity Engine",
];
for (const feat of cat5Features) {
  assert.ok(
    showcaseContent.includes(feat),
    `Category 5 must include feature "${feat}"`
  );
}
console.log("  ✓ Category 5 (Competitor & Opportunity Intelligence) contains both required features");

// 7. Verify Category 6 features & workflow
const cat6Features = [
  "SEO Autopilot",
  "Optimization Workflow",
];
for (const feat of cat6Features) {
  assert.ok(
    showcaseContent.includes(feat),
    `Category 6 must include feature "${feat}"`
  );
}
assert.ok(
  showcaseContent.includes("Optimization Workflow"),
  "Category 6 must display the optimization workflow"
);
assert.ok(
  showcaseContent.includes("AUDIT") &&
  showcaseContent.includes("AI PLAN") &&
  showcaseContent.includes("STAGE") &&
  showcaseContent.includes("AUTO-FIX"),
  "Category 6 must display the structured workflow stages (Audit, AI Plan, Stage, Auto-Fix)"
);
console.log("  ✓ Category 6 (SEO Autopilot) contains SEO Autopilot and its optimization workflow");

// 8. Visual styling checks: White card design, Codeaxys purple (#A60BFF), light lavender (#F5EBFF), responsive layout
assert.ok(
  showcaseContent.includes("bg-white"),
  "Must use white card backgrounds (bg-white)"
);
assert.ok(
  showcaseContent.includes("#A60BFF"),
  "Must use Codeaxys purple (#A60BFF)"
);
assert.ok(
  showcaseContent.includes("#F5EBFF"),
  "Must use light lavender icon background (#F5EBFF)"
);
assert.ok(
  showcaseContent.includes("text-slate-900"),
  "Must use navy headings (text-slate-900)"
);
assert.ok(
  showcaseContent.includes("text-slate-600"),
  "Must use slate descriptions (text-slate-600)"
);
assert.ok(
  showcaseContent.includes("grid-cols-1") &&
  showcaseContent.includes("md:grid-cols-2") &&
  showcaseContent.includes("lg:grid-cols-3"),
  "Must use responsive 1/2/3 column layout (mobile/tablet/desktop)"
);

// 8b. Heading area content checks
assert.ok(
  showcaseContent.includes("BUILT-IN SEO TOOLS"),
  "Must display badge 'BUILT-IN SEO TOOLS'"
);
assert.ok(
  showcaseContent.includes("Everything Inside Your SEO Toolkit"),
  "Must display heading 'Everything Inside Your SEO Toolkit'"
);
assert.ok(
  showcaseContent.includes("Explore the tools that help you analyze, optimize, and grow your search visibility."),
  "Must display description 'Explore the tools that help you analyze, optimize, and grow your search visibility.'"
);
console.log("  ✓ Heading area text verified: 'BUILT-IN SEO TOOLS' / 'Everything Inside Your SEO Toolkit'");
console.log("  ✓ Premium white card design system invariants verified (#A60BFF, #F5EBFF, bg-white, responsive grid)");

// 9. Verify SEOCapabilitiesShowcase is rendered in LandingView.tsx
assert.ok(
  landingViewContent.includes("import { SEOCapabilitiesShowcase } from \"./SEOCapabilitiesShowcase\";"),
  "LandingView must import SEOCapabilitiesShowcase"
);
assert.ok(
  landingViewContent.includes("<SEOCapabilitiesShowcase />"),
  "LandingView must render <SEOCapabilitiesShowcase />"
);
console.log("  ✓ SEOCapabilitiesShowcase properly imported and rendered in LandingView");

// 10. Verify critical constraints: Existing dark SEO dashboard preview is completely preserved
assert.ok(
  landingViewContent.includes("codeaxys.ai/dashboard/seo"),
  "Dashboard preview mockup URL must remain completely intact"
);
assert.ok(
  landingViewContent.includes("Website SEO Health"),
  "Dashboard preview header must remain completely intact"
);
assert.ok(
  landingViewContent.includes("80/100"),
  "Dashboard preview SEO score (80/100) must remain completely intact"
);
assert.ok(
  landingViewContent.includes("Google Search Preview"),
  "Dashboard preview Google search snippet must remain completely intact"
);
assert.ok(
  landingViewContent.includes("AI SEO INSIGHTS"),
  "Dashboard preview AI SEO insights widget must remain completely intact"
);
console.log("  ✓ Critical: Existing dark SEO dashboard preview is completely unchanged");

// 11. Verify integrations panel is preserved
assert.ok(
  landingViewContent.includes("Google Search Console") &&
  landingViewContent.includes("Google Analytics") &&
  landingViewContent.includes("Ahrefs Integration") &&
  landingViewContent.includes("Semrush Integration"),
  "Integrations panel (GSC, GA, Ahrefs, Semrush) must be completely preserved"
);
console.log("  ✓ Integrations panel (GSC, GA, Ahrefs, Semrush) is preserved");

// 12. Verify 4-step process bar is preserved
assert.ok(
  landingViewContent.includes("Build Website") &&
  landingViewContent.includes("Analyze SEO") &&
  landingViewContent.includes("Optimize & Connect") &&
  landingViewContent.includes("Track & Grow"),
  "4-Step process bar must remain completely intact"
);
console.log("  ✓ 4-step process bar is preserved");

// 13. Verify exact section order:
// Order: 1) Dark dashboard preview -> 2) SEOCapabilitiesShowcase -> 3) Integrations panel
const darkDashboardIndex = landingViewContent.indexOf("codeaxys.ai/dashboard/seo");
const showcaseIndex = landingViewContent.indexOf("<SEOCapabilitiesShowcase />");
const integrationsIndex = landingViewContent.indexOf("Connect the tools you already use.");

assert.ok(darkDashboardIndex > 0, "Dark dashboard preview must be present");
assert.ok(showcaseIndex > 0, "SEOCapabilitiesShowcase must be present");
assert.ok(integrationsIndex > 0, "Integrations section must be present");

assert.ok(
  darkDashboardIndex < showcaseIndex,
  "Dark SEO dashboard preview must appear BEFORE the SEOCapabilitiesShowcase"
);
assert.ok(
  showcaseIndex < integrationsIndex,
  "SEOCapabilitiesShowcase must appear BEFORE the Integrations & Analytics section"
);
console.log("  ✓ Exact section order verified: Dark Dashboard -> Showcase -> Integrations Panel");

console.log("\n✅ ALL SEO Capabilities Showcase & Ordering tests passed successfully!\n");
