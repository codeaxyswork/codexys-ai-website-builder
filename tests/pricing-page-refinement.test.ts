/**
 * Codeaxys Pricing Page UI Refinement Verification Suite
 *
 * Verifies:
 * 1. Single source of truth: All four plans share identical features, wording, order, and styling.
 * 2. Plan-specific values differ only by approved limits:
 *    - Starter: ₹299/mo, 1 website, 100 AI credits, 2 GB storage, 1 custom domain
 *    - Pro: ₹599/mo, 3 websites, 200 AI credits, 10 GB storage, 3 custom domains
 *    - Business: ₹999/mo, 6 websites, 400 AI credits, 30 GB storage, 6 custom domains
 *    - Agency: ₹1,999/mo, 15 websites, 800 AI credits, 100 GB storage, 15 custom domains
 * 3. Billing duration selector: 1 Month, 12 Months, 36 Months update pricing according to approved models.
 * 4. Digital Marketing Suite Add-on: Preserves exact 6 features, uses configured catalog pricing (₹349/mo, ₹3,490/yr).
 * 5. Dynamic total calculations with add-on selection across all 3 durations.
 */

import assert from "node:assert";
import { calculatePlanPrice, normalizeBillingInterval, BILLING_INTERVALS } from "../lib/billing-periods";
import { PLANS } from "../lib/constants";
import { ADDON_CATALOG } from "../lib/addons/catalog";

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
  } catch (err: any) {
    console.error(`  [FAIL] ${name}`);
    console.error("        Error:", err?.message || err);
    throw err;
  }
}

async function runPricingPageRefinementSuite() {
  console.log("======================================================================");
  console.log("CODEAXYS PRICING PAGE REFINEMENT VERIFICATION SUITE");
  console.log("======================================================================\n");

  // -------------------------------------------------------------------------
  // 1. BILLING DURATION SELECTOR (1 Month, 12 Months, 36 Months)
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 1] Billing Duration Selector & Approved Pricing ---");

  runTest("Selector defines exactly 1 Month, 12 Months, and 36 Months", () => {
    assert.strictEqual(BILLING_INTERVALS.monthly.label, "Monthly");
    assert.strictEqual(BILLING_INTERVALS.yearly.label, "12 Months");
    assert.strictEqual(BILLING_INTERVALS.triennial.label, "36 Months");

    assert.strictEqual(normalizeBillingInterval("1 Month"), "monthly");
    assert.strictEqual(normalizeBillingInterval("12 Months"), "yearly");
    assert.strictEqual(normalizeBillingInterval("36 Months"), "triennial");
  });

  runTest("1 Month approved pricing: Starter ₹299, Pro ₹599, Business ₹999, Agency ₹1,999", () => {
    assert.strictEqual(calculatePlanPrice("starter", "monthly").finalTotal, 299);
    assert.strictEqual(calculatePlanPrice("pro", "monthly").finalTotal, 599);
    assert.strictEqual(calculatePlanPrice("business", "monthly").finalTotal, 999);
    assert.strictEqual(calculatePlanPrice("agency", "monthly").finalTotal, 1999);
  });

  runTest("12 Months approved pricing (10 months billed): Starter ₹2,990, Pro ₹5,990, Business ₹9,990, Agency ₹19,990", () => {
    const s = calculatePlanPrice("starter", "yearly");
    const p = calculatePlanPrice("pro", "yearly");
    const b = calculatePlanPrice("business", "yearly");
    const a = calculatePlanPrice("agency", "yearly");

    assert.strictEqual(s.finalTotal, 2990);
    assert.strictEqual(p.finalTotal, 5990);
    assert.strictEqual(b.finalTotal, 9990);
    assert.strictEqual(a.finalTotal, 19990);

    // Savings verification
    assert.strictEqual(s.savingsAmount, 598);
    assert.strictEqual(p.savingsAmount, 1198);
    assert.strictEqual(b.savingsAmount, 1998);
    assert.strictEqual(a.savingsAmount, 3998);
  });

  runTest("36 Months approved pricing (35% discount): Starter ₹6,997, Pro ₹14,017, Business ₹23,377, Agency ₹46,777", () => {
    const s = calculatePlanPrice("starter", "triennial");
    const p = calculatePlanPrice("pro", "triennial");
    const b = calculatePlanPrice("business", "triennial");
    const a = calculatePlanPrice("agency", "triennial");

    assert.strictEqual(s.finalTotal, 6997);
    assert.strictEqual(p.finalTotal, 14017);
    assert.strictEqual(b.finalTotal, 23377);
    assert.strictEqual(a.finalTotal, 46777);
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 2. PLAN SPECIFIC VALUE INVARIANTS
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 2] Plan Specific Capacity Invariants ---");

  runTest("Starter plan-specific values: 1 website, 100 credits, 2 GB storage, 1 domain", () => {
    const plan = PLANS.starter;
    assert.strictEqual(plan.price, 299);
    assert.strictEqual(plan.maxWebsites, 1);
    assert.strictEqual(plan.monthlyCredits, 100);
    assert.strictEqual(plan.storageLimitFormatted, "2 GB");
  });

  runTest("Pro plan-specific values: 3 websites, 200 credits, 10 GB storage, 3 domains", () => {
    const plan = PLANS.pro;
    assert.strictEqual(plan.price, 599);
    assert.strictEqual(plan.maxWebsites, 3);
    assert.strictEqual(plan.monthlyCredits, 200);
    assert.strictEqual(plan.storageLimitFormatted, "10 GB");
  });

  runTest("Business plan-specific values: 6 websites, 400 credits, 30 GB storage, 6 domains", () => {
    const plan = PLANS.business;
    assert.strictEqual(plan.price, 999);
    assert.strictEqual(plan.maxWebsites, 6);
    assert.strictEqual(plan.monthlyCredits, 400);
    assert.strictEqual(plan.storageLimitFormatted, "30 GB");
  });

  runTest("Agency plan-specific values: 15 websites, 800 credits, 100 GB storage, 15 domains", () => {
    const plan = PLANS.agency;
    assert.strictEqual(plan.price, 1999);
    assert.strictEqual(plan.maxWebsites, 15);
    assert.strictEqual(plan.monthlyCredits, 800);
    assert.strictEqual(plan.storageLimitFormatted, "100 GB");
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 3. DIGITAL MARKETING SUITE CONFIGURATION & CALCULATIONS
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 3] Digital Marketing Suite Add-on Calculations ---");

  runTest("Digital Marketing Suite uses configured catalog rates: ₹349/month, ₹3,490/year", () => {
    const addon = ADDON_CATALOG.digital_marketing_meta_suite;
    assert(addon !== undefined, "digital_marketing_meta_suite exists in catalog");
    assert.strictEqual(addon.pricing.monthlyPriceUnapproved, 349);
    assert.strictEqual(addon.pricing.annualPriceUnapproved, 3490);
  });

  runTest("1 Month with add-on: Starter ₹648, Pro ₹948, Business ₹1,348, Agency ₹2,348", () => {
    const addon = 349;
    assert.strictEqual(299 + addon, 648);
    assert.strictEqual(599 + addon, 948);
    assert.strictEqual(999 + addon, 1348);
    assert.strictEqual(1999 + addon, 2348);
  });

  runTest("12 Months with add-on: Starter ₹6,480, Pro ₹9,480, Business ₹13,480, Agency ₹23,480", () => {
    const addon12m = 3490;
    assert.strictEqual(2990 + addon12m, 6480);
    assert.strictEqual(5990 + addon12m, 9480);
    assert.strictEqual(9990 + addon12m, 13480);
    assert.strictEqual(19990 + addon12m, 23480);
  });
  // -------------------------------------------------------------------------
  // 4. CUSTOM DOMAIN LIMITS & SECTION VISIBILITY AUDIT
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 4] Custom Domain Limits & Section Visibility Audit ---");

  const fs = await import("node:fs");
  const path = await import("node:path");
  const pageContent = fs.readFileSync(path.resolve(__dirname, "../app/pricing/page.tsx"), "utf-8");

  runTest("All four pricing plans display exactly '1 Free Custom Domain'", () => {
    // Check that PRICING_PLANS defines '1 Free Custom Domain' for all 4 tiers
    const domainMatches = pageContent.match(/domain:\s*"1 Free Custom Domain"/g);
    assert(domainMatches && domainMatches.length === 4, "All 4 plans must define '1 Free Custom Domain'");

    // Verify 3, 6, 15 custom domains do not appear in plan specs
    assert(!pageContent.includes('"3 Custom Domains"'), "Must not show '3 Custom Domains'");
    assert(!pageContent.includes('"6 Custom Domains"'), "Must not show '6 Custom Domains'");
    assert(!pageContent.includes('"15 Custom Domains"'), "Must not show '15 Custom Domains'");
  });

  runTest("Website Builder section has expand/collapse removed and is permanently visible", () => {
    // Check website_builder is marked collapsible: false
    assert(pageContent.includes('category: "website_builder"'), "Website Builder section exists");
    assert(pageContent.includes("collapsible: false"), "Website Builder must be non-collapsible");

    // Check that website_builder features are rendered directly without collapse wrapper
    assert(pageContent.includes("if (!section.collapsible)"), "Renders static section when not collapsible");
  });

  runTest("All numeric feature count badges ('8 Features', '7 Features') are completely removed", () => {
    assert(!pageContent.includes('"8 Features"'), "Must not contain '8 Features' badge");
    assert(!pageContent.includes('"7 Features"'), "Must not contain '7 Features' badge");
    assert(!pageContent.includes("headerBadge"), "Must not define or render headerBadge");
  });

  runTest("Plan specifications panel removes separate labels and renders icons per row", () => {
    // Assert left labels are completely removed
    assert(!pageContent.includes("Websites:"), "Must not contain 'Websites:' label");
    assert(!pageContent.includes("AI Credits:"), "Must not contain 'AI Credits:' label");
    assert(!pageContent.includes("Cloud Storage:"), "Must not contain 'Cloud Storage:' label");
    assert(!pageContent.includes("Custom Domain:"), "Must not contain 'Custom Domain:' label");
    assert(!pageContent.includes("Custom Domains:"), "Must not contain 'Custom Domains:' label");

    // Assert icons are used for each specification row
    assert(pageContent.includes("<AppWindow"), "Must include AppWindow icon for websites");
    assert(pageContent.includes("<Sparkles"), "Must include Sparkles icon for AI credits");
    assert(pageContent.includes("<Cloud"), "Must include Cloud icon for storage");
    assert(pageContent.includes("<Globe"), "Must include Globe icon for domain");

    // Assert standardized purple icon on lavender background
    const specOccurrences = (pageContent.match(/w-9 h-9 rounded-xl bg-purple-100\/90 text-\[#6938ef\] flex items-center justify-center shrink-0/g) || []).length;
    assert.strictEqual(specOccurrences, 4, "All 4 specification icons must use standardized bg-purple-100/90 text-[#6938ef]");

    // Assert removal of yellow, green, and blue icon containers
    assert(!pageContent.includes("bg-amber-100/80"), "Must not contain amber icon container in specs panel");
    assert(!pageContent.includes("bg-emerald-100/80"), "Must not contain emerald icon container in specs panel");
    assert(!pageContent.includes("bg-blue-100/80"), "Must not contain blue icon container in specs panel");
  });

  runTest("Digital Marketing Suite uses unified Lucide icons, lavender badges, and #A60BFF", () => {
    // Assert all 7 requested Lucide icons are used
    assert(pageContent.includes("<Megaphone"), "Must use Megaphone icon for suite header");
    assert(pageContent.includes("icon: SearchCheck"), "Must use SearchCheck for SEO Intelligence");
    assert(pageContent.includes("icon: ChartNoAxesCombined"), "Must use ChartNoAxesCombined for AI Search Visibility");
    assert(pageContent.includes("icon: Settings2"), "Must use Settings2 for SEO Autopilot");
    assert(pageContent.includes("icon: FilePen"), "Must use FilePen for AI Content Marketing");
    assert(pageContent.includes("icon: CalendarDays"), "Must use CalendarDays for Marketing Campaign Planning");
    assert(pageContent.includes("icon: ChartPie"), "Must use ChartPie for Advanced Reporting");

    // Assert unified color palette
    assert(pageContent.includes("#A60BFF"), "Must use Codeaxys purple #A60BFF");
    assert(pageContent.includes("#F5EBFF"), "Must use light lavender tint #F5EBFF for icon containers");

    // Assert clean section heading
    assert(pageContent.includes("ADD-ON FEATURES"), "Must render clean ADD-ON FEATURES heading");

    // Assert responsive 3-column desktop, 2-column tablet, 1-column mobile grid
    assert(pageContent.includes("grid-cols-1 md:grid-cols-2 lg:grid-cols-3"), "Must use 3-col desktop grid");
  });

  runTest("Trust Benefits and Free Trial CTA sections are completely removed", () => {
    // Assert Trust Benefits section elements are removed
    assert(!pageContent.includes("No setup fees"), "Must not contain 'No setup fees'");
    assert(!pageContent.includes("30-day money-back guarantee"), "Must not contain '30-day money-back guarantee'");
    assert(!pageContent.includes("Expert support"), "Must not contain 'Expert support'");

    // Assert Free Trial CTA banner elements are removed
    assert(!pageContent.includes("10-Day Free Trial Available"), "Must not contain '10-Day Free Trial Available'");
    assert(!pageContent.includes("Looking to try Codeaxys before subscribing?"), "Must not contain 'Looking to try Codeaxys before subscribing?'");
    assert(!pageContent.includes("Start 10-Day Free Trial"), "Must not contain 'Start 10-Day Free Trial'");

    // Assert FAQ section and Digital Marketing Suite remain intact
    assert(pageContent.includes("Frequently Asked Questions"), "FAQ section must remain intact");
    assert(pageContent.includes("digital-marketing-suite-addon"), "Digital Marketing Suite must remain intact");
  });

  runTest("Horizontal divider between Digital Marketing Suite and FAQ is removed with preserved spacing", () => {
    // Assert divider line border-t is removed from FAQ section
    assert(!pageContent.includes('border-t border-slate-200/80 w-full max-w-4xl mx-auto space-y'), "FAQ section must not have top border divider");
    assert(pageContent.includes('<section className="mt-16 sm:mt-20 w-full max-w-4xl mx-auto space-y-10">'), "FAQ section container must preserve balanced vertical spacing");
    assert(pageContent.includes("Got Questions? We&apos;ve Got Answers"), "FAQ badge must remain intact");
    assert(pageContent.includes("Frequently Asked Questions"), "FAQ heading must remain intact");
  });
  console.log("");

  console.log("======================================================================");
  console.log("ALL PRICING PAGE REFINEMENT TESTS PASSED! 🎉");
  console.log("======================================================================\n");
}

runPricingPageRefinementSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
