/**
 * Platform Overview Features Section Verification Suite
 *
 * Verifies that the new Features section:
 * 1. Is placed immediately after the Hero section and before "How It Works".
 * 2. Renders the exact headline, description, and 6 feature cards.
 * 3. Follows the asymmetric 2-column x 3-row grid design with purple #A60BFF and lavender accents.
 * 4. Preserves all other homepage sections, hero functionality, and pricing intact.
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
  } catch (err: any) {
    console.error(`  [FAIL] ${name}`);
    console.error(`        Error: ${err.message}`);
    throw err;
  }
}

async function runPlatformOverviewFeaturesSuite() {
  console.log("\n======================================================================");
  console.log("CODEAXYS PLATFORM OVERVIEW FEATURES VERIFICATION SUITE");
  console.log("======================================================================\n");

  const landingPath = path.resolve(__dirname, "../components/LandingView.tsx");
  const landingContent = fs.readFileSync(landingPath, "utf-8");

  const featuresComponentPath = path.resolve(__dirname, "../components/PlatformOverviewFeatures.tsx");
  const featuresContent = fs.readFileSync(featuresComponentPath, "utf-8");

  // -------------------------------------------------------------------------
  // 1. PLACEMENT & ORDERING
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 1] Placement & DOM Hierarchy ---");

  runTest("PlatformOverviewFeatures is placed immediately after Hero and before How It Works", () => {
    const heroEndIdx = landingContent.indexOf('id="hero-generator"');
    const featuresComponentIdx = landingContent.indexOf("<PlatformOverviewFeatures />");
    const howItWorksIdx = landingContent.indexOf('id="how-it-works"');

    assert(heroEndIdx !== -1, "Hero section must exist");
    assert(featuresComponentIdx !== -1, "PlatformOverviewFeatures must be rendered in LandingView");
    assert(howItWorksIdx !== -1, "How It Works section must exist");

    assert(
      featuresComponentIdx > heroEndIdx,
      "PlatformOverviewFeatures must come after Hero section"
    );
    assert(
      featuresComponentIdx < howItWorksIdx,
      "PlatformOverviewFeatures must come before How It Works section"
    );
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 2. HEADLINE & DESCRIPTION
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 2] Headline & Description Content ---");

  runTest("Exact approved headline is rendered", () => {
    assert(
      featuresContent.includes("One Platform.") &&
      featuresContent.includes("Everything to Build, Manage &amp; Grow."),
      "Headline must match 'One Platform. Everything to Build, Manage & Grow.'"
    );
  });

  runTest("Exact approved description is rendered", () => {
    const expectedDesc =
      "Build websites, migrate and redesign existing sites, improve search visibility, and manage social media from one powerful platform.";
    assert(featuresContent.includes(expectedDesc), "Description must match exactly");
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 3. ALL SIX FEATURE CARDS
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 3] Six Feature Cards Content & Icons ---");

  const expectedCards = [
    {
      title: "AI Website Generation",
      description: "Create professional, responsive websites using AI.",
      icon: "Sparkles",
    },
    {
      title: "Website Migration",
      description: "Migrate existing website content and media.",
      icon: "ArrowRightLeft",
    },
    {
      title: "Migration + Redesign",
      description: "Migrate and transform existing websites with modern, responsive designs.",
      icon: "Palette",
    },
    {
      title: "SEO Intelligence",
      description: "Discover SEO issues, keyword opportunities, competitor gaps, and AI search visibility insights.",
      icon: "SearchCheck",
    },
    {
      title: "Social Media Management",
      description: "Create content, plan campaigns, schedule posts, and analyze performance.",
      icon: "CalendarDays",
    },
    {
      title: "SEO Autopilot",
      description: "Discover SEO opportunities, review prioritized recommendations, and manage proposed optimization fixes.",
      icon: "Settings2",
    },
  ];

  for (const card of expectedCards) {
    runTest(`Feature card '${card.title}' has correct title, description, and icon`, () => {
      assert(featuresContent.includes(card.title), `Must contain title '${card.title}'`);
      assert(featuresContent.includes(card.description), `Must contain description for '${card.title}'`);
      assert(featuresContent.includes(card.icon), `Must use Lucide icon '${card.icon}'`);
    });
  }
  console.log("");

  // -------------------------------------------------------------------------
  // 4. DESIGN SYSTEM & RESPONSIVE LAYOUT
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 4] Design System Tokens & Responsive Grid ---");

  runTest("Uses asymmetric layout with sticky left column and 2-col right grid", () => {
    assert(featuresContent.includes("lg:col-span-5"), "Left column spans 5 columns on desktop");
    assert(featuresContent.includes("lg:col-span-7"), "Right column spans 7 columns on desktop");
    assert(featuresContent.includes("lg:sticky"), "Left column is sticky on desktop");
    assert(featuresContent.includes("grid grid-cols-1 sm:grid-cols-2 gap-5"), "Cards use 2-col tablet/desktop grid and 1-col mobile");
  });

  runTest("Uses Codeaxys purple #A60BFF and lavender #F5EBFF icon containers", () => {
    assert(featuresContent.includes("#A60BFF"), "Must use primary purple #A60BFF");
    assert(featuresContent.includes("#F5EBFF"), "Must use lavender #F5EBFF icon backgrounds");
    assert(featuresContent.includes("bg-white"), "Cards must have white surfaces");
  });

  runTest("Semantic headings and accessibility hierarchy preserved", () => {
    assert(featuresContent.includes("<section"), "Must use semantic <section>");
    assert(featuresContent.includes("<h2"), "Must use <h2> for section headline");
    assert(featuresContent.includes("<h3"), "Must use <h3> for feature card titles");
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 5. UNTOUCHED PRESERVATION OF HERO & EXISTING HOMEPAGE SECTIONS
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 5] Preservation of Hero & Unrelated Sections ---");

  runTest("Hero section prompt editor, voice controls, and chips remain intact", () => {
    assert(landingContent.includes('id="hero-generator"'), "Hero generator ID intact");
    assert(landingContent.includes("Turn your ideas into powerful, responsive websites with AI."), "Hero subtitle intact");
    assert(landingContent.includes("<HeroAIBackground />"), "Hero AI canvas intact");
    assert(landingContent.includes("sampleChips.map"), "Prompt sample chips intact");
  });

  runTest("Pricing section and FAQ section remain intact", () => {
    assert(landingContent.includes('id="pricing"'), "Pricing section ID intact");
    assert(landingContent.includes("<HomepagePricingSection />"), "HomepagePricingSection component intact");
    assert(landingContent.includes('id="faq"'), "FAQ section ID intact");
  });
  console.log("");

  console.log("======================================================================");
  console.log("ALL PLATFORM OVERVIEW FEATURES TESTS PASSED! 🎉");
  console.log("======================================================================\n");
}

runPlatformOverviewFeaturesSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
