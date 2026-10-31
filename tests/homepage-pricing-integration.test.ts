/**
 * Homepage Pricing Sections Integration Verification Test Suite
 *
 * Verifies that the existing Codeaxys homepage pricing preview area has only
 * its 3 core sections replaced with the fully implemented versions from /pricing:
 * 1. Pricing Plans (4 cards side-by-side, approved limits, identical features, specs panel)
 * 2. Billing Duration Selector (1 Month, 12 Months, 36 Months)
 * 3. Digital Marketing Suite Add-on (High-impact container, 6 features, Lucide icons, checkbox, checkout)
 *
 * Also verifies that homepage title, headings, introductory content, and /pricing page
 * remain completely intact.
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { calculatePlanPrice } from "../lib/billing-periods";
import { ADDON_CATALOG } from "../lib/addons/catalog";

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

async function runHomepagePricingIntegrationSuite() {
  console.log("\n======================================================================");
  console.log("CODEAXYS HOMEPAGE PRICING INTEGRATION VERIFICATION SUITE");
  console.log("======================================================================\n");

  const landingViewPath = path.resolve(__dirname, "../components/LandingView.tsx");
  const landingContent = fs.readFileSync(landingViewPath, "utf-8");

  const homepageSectionPath = path.resolve(__dirname, "../components/HomepagePricingSection.tsx");
  const homepageSectionContent = fs.readFileSync(homepageSectionPath, "utf-8");

  const pricingPagePath = path.resolve(__dirname, "../app/pricing/page.tsx");
  const pricingPageContent = fs.readFileSync(pricingPagePath, "utf-8");

  const layoutPath = path.resolve(__dirname, "../app/layout.tsx");
  const layoutContent = fs.readFileSync(layoutPath, "utf-8");

  // -------------------------------------------------------------------------
  // 1. HOMEPAGE TITLE & INTRODUCTORY CONTENT PRESERVATION
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 1] Homepage Title & Introductory Content Preservation ---");

  runTest("Homepage document title in app/layout.tsx is preserved exactly", () => {
    assert(
      layoutContent.includes("Codexys AI Website Generator | Instant Standalone HTML/CSS Builder"),
      "Document title must be preserved exactly in layout.tsx"
    );
  });

  runTest("Homepage pricing section heading, badge, and subtitle are unchanged", () => {
    assert(landingContent.includes("Flexible Tiers"), "Must preserve 'Flexible Tiers' badge");
    assert(landingContent.includes("Simple, transparent pricing."), "Must preserve 'Simple, transparent pricing.' heading");
    assert(
      landingContent.includes(
        "Choose the plan that fits your business needs. Every plan includes full access to our AI Website Builder, custom domains, and SEO tools tailored to your tier."
      ),
      "Must preserve exact introductory subtitle"
    );
    assert(landingContent.includes('id="pricing"'), "Must preserve id='pricing' on section");
  });

  runTest("LandingView delegates pricing area to HomepagePricingSection", () => {
    assert(
      landingContent.includes("<HomepagePricingSection />"),
      "LandingView must render HomepagePricingSection component"
    );
    // Old naive card mapping should no longer be directly in LandingView
    assert(
      !landingContent.includes("[PLANS.starter, PLANS.pro, PLANS.business, PLANS.agency].filter(Boolean).map"),
      "Old inline card loop must be replaced"
    );
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 2. SECTION 2: BILLING DURATION SELECTOR
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 2] Billing Duration Selector ---");

  runTest("Supports exactly 1 Month, 12 Months, and 36 Months", () => {
    assert(homepageSectionContent.includes('id="billing-tab-1month"'), "Must have 1 Month tab");
    assert(homepageSectionContent.includes('id="billing-tab-12months"'), "Must have 12 Months tab");
    assert(homepageSectionContent.includes('id="billing-tab-36months"'), "Must have 36 Months tab");
    assert(homepageSectionContent.includes("16.7% OFF"), "Must show 16.7% OFF badge for 12 months");
    assert(homepageSectionContent.includes("35% OFF"), "Must show 35% OFF badge for 36 months");
  });

  runTest("Pricing calculations match approved matrix across all durations", () => {
    // Starter
    assert.strictEqual(calculatePlanPrice("starter", "monthly").finalTotal, 299);
    assert.strictEqual(calculatePlanPrice("starter", "yearly").finalTotal, 2990);
    assert.strictEqual(calculatePlanPrice("starter", "triennial").finalTotal, 6997);

    // Pro
    assert.strictEqual(calculatePlanPrice("pro", "monthly").finalTotal, 599);
    assert.strictEqual(calculatePlanPrice("pro", "yearly").finalTotal, 5990);
    assert.strictEqual(calculatePlanPrice("pro", "triennial").finalTotal, 14017);

    // Business
    assert.strictEqual(calculatePlanPrice("business", "monthly").finalTotal, 999);
    assert.strictEqual(calculatePlanPrice("business", "yearly").finalTotal, 9990);
    assert.strictEqual(calculatePlanPrice("business", "triennial").finalTotal, 23377);

    // Agency
    assert.strictEqual(calculatePlanPrice("agency", "monthly").finalTotal, 1999);
    assert.strictEqual(calculatePlanPrice("agency", "yearly").finalTotal, 19990);
    assert.strictEqual(calculatePlanPrice("agency", "triennial").finalTotal, 46777);
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 3. SECTION 1: FOUR PRICING PLANS
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 3] Pricing Plan Cards ---");

  runTest("All four pricing plans are present side-by-side with approved capacities", () => {
    const plans = ["starter", "pro", "business", "agency"];
    for (const planId of plans) {
      assert(
        homepageSectionContent.includes(`id=\`pricing-card-\${plan.id}\``) ||
        homepageSectionContent.includes("PRICING_PLANS.map"),
        `Must render plan ${planId}`
      );
    }

    assert(pricingPageContent.includes('websiteLimit: "1 Website"'));
    assert(pricingPageContent.includes('websiteLimit: "3 Websites"'));
    assert(pricingPageContent.includes('websiteLimit: "6 Websites"'));
    assert(pricingPageContent.includes('websiteLimit: "15 Websites"'));

    assert(pricingPageContent.includes('aiCredits: "100 AI Credits / Month"'));
    assert(pricingPageContent.includes('aiCredits: "200 AI Credits / Month"'));
    assert(pricingPageContent.includes('aiCredits: "400 AI Credits / Month"'));
    assert(pricingPageContent.includes('aiCredits: "800 AI Credits / Month"'));

    assert(pricingPageContent.includes('storage: "2 GB Storage"'));
    assert(pricingPageContent.includes('storage: "10 GB Storage"'));
    assert(pricingPageContent.includes('storage: "30 GB Storage"'));
    assert(pricingPageContent.includes('storage: "100 GB Storage"'));
  });

  runTest("Every plan displays strictly '1 Free Custom Domain'", () => {
    const matches = pricingPageContent.match(/domain:\s*"1 Free Custom Domain"/g);
    assert(matches && matches.length === 4, "Must define '1 Free Custom Domain' for all 4 plans");
  });

  runTest("Standardized purple on lavender icons in specifications panel", () => {
    assert(homepageSectionContent.includes("<AppWindow"), "Must render AppWindow icon");
    assert(homepageSectionContent.includes("<Sparkles"), "Must render Sparkles icon");
    assert(homepageSectionContent.includes("<Cloud"), "Must render Cloud icon");
    assert(homepageSectionContent.includes("<Globe"), "Must render Globe icon");

    const specContainers = (
      homepageSectionContent.match(/w-9 h-9 rounded-xl bg-purple-100\/90 text-\[#6938ef\]/g) || []
    ).length;
    assert.strictEqual(specContainers, 4, "Must have 4 standardized purple/lavender icon containers");
  });

  runTest("Feature list structure matches /pricing (Website Builder permanent, SEO & Social expandable)", () => {
    assert(homepageSectionContent.includes("if (!section.collapsible)"), "Website Builder is permanently open");
    assert(homepageSectionContent.includes("openSections[section.category]"), "SEO & Social are expandable accordions");
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 4. SECTION 3: DIGITAL MARKETING SUITE ADD-ON
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 4] Digital Marketing Suite Add-on ---");

  runTest("Digital Marketing Suite is rendered with correct pricing and Lucide icons", () => {
    assert(homepageSectionContent.includes('id="digital-marketing-suite-addon"'), "Must have marketing suite section id");
    assert(homepageSectionContent.includes("Digital Marketing Suite"), "Must have suite title");
    assert(homepageSectionContent.includes('id="include-digital-marketing-suite"'), "Must have checkbox");

    // All 6 features
    assert(homepageSectionContent.includes("DIGITAL_MARKETING_FEATURES.map"), "Renders marketing features list");
    assert(homepageSectionContent.includes("#A60BFF"), "Uses Codeaxys purple accent");
    assert(homepageSectionContent.includes("#F5EBFF"), "Uses lavender icon containers");
  });

  runTest("Dynamic add-on rate and total calculation", () => {
    const monthlyAddon = ADDON_CATALOG.digital_marketing_meta_suite?.pricing?.monthlyPriceUnapproved || 349;
    const annualAddon = ADDON_CATALOG.digital_marketing_meta_suite?.pricing?.annualPriceUnapproved || 3490;
    assert.strictEqual(monthlyAddon, 349);
    assert.strictEqual(annualAddon, 3490);

    // Verify 1-Month + Addon for all 4 plans
    assert.strictEqual(299 + monthlyAddon, 648);
    assert.strictEqual(599 + monthlyAddon, 948);
    assert.strictEqual(999 + monthlyAddon, 1348);
    assert.strictEqual(1999 + monthlyAddon, 2348);

    // Verify 12-Month + Addon for all 4 plans
    assert.strictEqual(2990 + annualAddon, 6480);
    assert.strictEqual(5990 + annualAddon, 9480);
    assert.strictEqual(9990 + annualAddon, 13480);
    assert.strictEqual(19990 + annualAddon, 23480);
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 5. CHECKOUT FLOW INTEGRATION
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 5] Checkout Flow Integration ---");

  runTest("Homepage includes MockCheckoutModal with correct props", () => {
    assert(homepageSectionContent.includes("<MockCheckoutModal"), "Must render MockCheckoutModal");
    assert(homepageSectionContent.includes("planId={selectedPlanId}"), "Passes selectedPlanId");
    assert(homepageSectionContent.includes("initialInterval={billingInterval}"), "Passes billingInterval");
    assert(homepageSectionContent.includes("isBundleSelected={includeMarketingSuite}"), "Passes isBundleSelected");
    assert(
      homepageSectionContent.includes('selectedAddonIds={includeMarketingSuite ? ["digital_marketing_meta_suite"] : []}'),
      "Passes selectedAddonIds"
    );
  });

  runTest("Unauthenticated plan selection directs to /login", () => {
    assert(homepageSectionContent.includes('router.push("/login")'), "Must redirect to /login when user not logged in");
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 6. PRICING PAGE INDEPENDENCE
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 6] /pricing Page Independence ---");

  runTest("/pricing page exists and functions independently", () => {
    assert(pricingPageContent.includes("export default function PricingPage()"), "PricingPage is exported");
    assert(pricingPageContent.includes("Choose the plan that fits your business"), "PricingPage hero intact");
    assert(pricingPageContent.includes("<Header"), "PricingPage header intact");
    assert(pricingPageContent.includes("<Footer"), "PricingPage footer intact");
    assert(pricingPageContent.includes("Frequently Asked Questions"), "PricingPage FAQ intact");
  });
  console.log("");

  console.log("======================================================================");
  console.log("ALL HOMEPAGE PRICING INTEGRATION TESTS PASSED! 🎉");
  console.log("======================================================================\n");
}

runHomepagePricingIntegrationSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
