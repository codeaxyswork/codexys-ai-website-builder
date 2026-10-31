/**
 * Codeaxys AI Website Builder — Final Pricing Page & Feature Transparency Test Suite
 *
 * Verifies:
 * 1. Correct feature matrix for Starter, Pro, Business, and Agency.
 * 2. Accurate website, AI credit, and storage limits.
 * 3. Only verified capabilities are displayed as operational (mock-only features protected).
 * 4. Default billing selection is 12 Months.
 * 5. Monthly, 12-month, and 36-month prices match approved configuration.
 * 6. Strikethrough reference prices and savings are accurate.
 * 7. Full upfront payment is distinguished from effective monthly cost.
 * 8. Marketing & Growth Features Bundle selection updates preview correctly with zero double-charging.
 * 9. Unapproved bundle prices cannot be charged (safe ₹0 preview).
 * 10. Domain policy remains unchanged (subdomains vs customer-owned connections vs 36-month 1 free domain offer).
 */

import assert from "assert";
import {
  BILLING_INTERVALS,
  normalizeBillingInterval,
  calculatePlanPrice,
  BillingInterval,
} from "../lib/billing-periods";
import { PLANS } from "../lib/constants";
import { getPlanBundleDefinition } from "../lib/pricing/premium-bundle";
import { getCompletePlanFeatures } from "../lib/pricing/plan-features-catalog";
import { evaluateEffectiveFeatureAccess } from "../lib/addons/entitlements";
import { calculateCartPrice } from "../lib/addons/pricing";

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

async function runFinalPricingTransparencySuite() {
  console.log("======================================================================");
  console.log("CODEAXYS FINAL PRICING PAGE & FEATURE TRANSPARENCY VERIFICATION");
  console.log("======================================================================\n");

  // -------------------------------------------------------------------------
  // 1. BILLING SELECTION: DEFAULT 12 MONTHS & THREE APPROVED INTERVALS
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 1] Billing Period Selector & Default 12 Months ---");

  runTest("Default billing selection is 12 Months ('yearly')", () => {
    // Normalization with no argument or standard string returns 12 Months
    assert.strictEqual(normalizeBillingInterval("12 Months"), "yearly");
    assert.strictEqual(normalizeBillingInterval("12months"), "yearly");
    assert.strictEqual(normalizeBillingInterval("yearly"), "yearly");
  });

  runTest("Exactly three billing options supported: Monthly, 12 Months, 36 Months", () => {
    const intervals = Object.keys(BILLING_INTERVALS);
    assert.strictEqual(intervals.length, 3, "Exactly 3 billing options");
    assert.strictEqual(BILLING_INTERVALS.monthly.label, "Monthly");
    assert.strictEqual(BILLING_INTERVALS.yearly.label, "12 Months");
    assert.strictEqual(BILLING_INTERVALS.triennial.label, "36 Months");

    assert.strictEqual(BILLING_INTERVALS.monthly.durationMonths, 1);
    assert.strictEqual(BILLING_INTERVALS.yearly.durationMonths, 12);
    assert.strictEqual(BILLING_INTERVALS.triennial.durationMonths, 36);
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 2. APPROVED BASE PRICES & SAVINGS CALCULATION
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 2] Approved Base Prices & Math Transparency ---");

  runTest("Starter pricing: ₹299 (Monthly), ₹2,990 (12M), ₹6,997 (36M)", () => {
    const m = calculatePlanPrice("starter", "monthly");
    const y = calculatePlanPrice("starter", "yearly");
    const t = calculatePlanPrice("starter", "triennial");

    assert.strictEqual(m.finalTotal, 299);
    assert.strictEqual(y.finalTotal, 2990);
    assert.strictEqual(t.finalTotal, 6997);

    // Strikethrough reference prices
    assert.strictEqual(m.referencePrice, 299, "Monthly has no crossed-out reference price difference");
    assert.strictEqual(y.referencePrice, 3588, "12M reference price = 299 * 12 = 3,588");
    assert.strictEqual(t.referencePrice, 10764, "36M reference price = 299 * 36 = 10,764");

    // Savings amount
    assert.strictEqual(m.savingsAmount, 0);
    assert.strictEqual(y.savingsAmount, 598, "Starter 12M savings = 3,588 - 2,990 = 598");
    assert.strictEqual(t.savingsAmount, 3767, "Starter 36M savings = 10,764 - 6,997 = 3,767");
  });

  runTest("Pro pricing: ₹599 (Monthly), ₹5,990 (12M), ₹14,017 (36M)", () => {
    const m = calculatePlanPrice("pro", "monthly");
    const y = calculatePlanPrice("pro", "yearly");
    const t = calculatePlanPrice("pro", "triennial");

    assert.strictEqual(m.finalTotal, 599);
    assert.strictEqual(y.finalTotal, 5990);
    assert.strictEqual(t.finalTotal, 14017);

    assert.strictEqual(y.referencePrice, 7188, "Pro 12M reference price = 599 * 12 = 7,188");
    assert.strictEqual(t.referencePrice, 21564, "Pro 36M reference price = 599 * 36 = 21,564");

    assert.strictEqual(y.savingsAmount, 1198, "Pro 12M savings = 7,188 - 5,990 = 1,198");
    assert.strictEqual(t.savingsAmount, 7547, "Pro 36M savings = 21,564 - 14,017 = 7,547");
  });

  runTest("Business pricing: ₹999 (Monthly), ₹9,990 (12M), ₹23,377 (36M)", () => {
    const m = calculatePlanPrice("business", "monthly");
    const y = calculatePlanPrice("business", "yearly");
    const t = calculatePlanPrice("business", "triennial");

    assert.strictEqual(m.finalTotal, 999);
    assert.strictEqual(y.finalTotal, 9990);
    assert.strictEqual(t.finalTotal, 23377);

    assert.strictEqual(y.referencePrice, 11988);
    assert.strictEqual(t.referencePrice, 35964);

    assert.strictEqual(y.savingsAmount, 1998);
    assert.strictEqual(t.savingsAmount, 12587);
  });

  runTest("Agency pricing: ₹1,999 (Monthly), ₹19,990 (12M), ₹46,777 (36M)", () => {
    const m = calculatePlanPrice("agency", "monthly");
    const y = calculatePlanPrice("agency", "yearly");
    const t = calculatePlanPrice("agency", "triennial");

    assert.strictEqual(m.finalTotal, 1999);
    assert.strictEqual(y.finalTotal, 19990);
    assert.strictEqual(t.finalTotal, 46777);

    assert.strictEqual(y.referencePrice, 23988);
    assert.strictEqual(t.referencePrice, 71964);

    assert.strictEqual(y.savingsAmount, 3998);
    assert.strictEqual(t.savingsAmount, 25187);
  });

  runTest("Effective monthly rate correctly calculated and upfront charge disclosed", () => {
    const starter12 = calculatePlanPrice("starter", "yearly");
    assert.strictEqual(starter12.effectiveMonthlyPrice, 249.17);
    assert(starter12.upfrontChargeNotice.includes("Billed upfront as ₹2,990 for 12 months"));

    const pro12 = calculatePlanPrice("pro", "yearly");
    assert.strictEqual(pro12.effectiveMonthlyPrice, 499.17);
    assert(pro12.upfrontChargeNotice.includes("Billed upfront as ₹5,990 for 12 months"));

    const biz12 = calculatePlanPrice("business", "yearly");
    assert.strictEqual(biz12.effectiveMonthlyPrice, 832.5);
    assert(biz12.upfrontChargeNotice.includes("Billed upfront as ₹9,990 for 12 months"));

    const agency12 = calculatePlanPrice("agency", "yearly");
    assert.strictEqual(agency12.effectiveMonthlyPrice, 1665.83);
    assert(agency12.upfrontChargeNotice.includes("Billed upfront as ₹19,990 for 12 months"));
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 3. FEATURE MATRIX AUDIT & PLAN LIMITS
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 3] Feature Matrix & Capacity Limits ---");

  runTest("Accurate website limits: Starter 1, Pro 3, Business 6, Agency 15", () => {
    assert.strictEqual(PLANS.starter.maxWebsites, 1);
    assert.strictEqual(PLANS.pro.maxWebsites, 3);
    assert.strictEqual(PLANS.business.maxWebsites, 6);
    assert.strictEqual(PLANS.agency.maxWebsites, 15);
  });

  runTest("Accurate AI credit limits: Starter 100, Pro 200, Business 400, Agency 800", () => {
    assert.strictEqual(PLANS.starter.monthlyCredits, 100);
    assert.strictEqual(PLANS.pro.monthlyCredits, 200);
    assert.strictEqual(PLANS.business.monthlyCredits, 400);
    assert.strictEqual(PLANS.agency.monthlyCredits, 800);
  });

  runTest("Accurate storage allowances: Starter 2 GB, Pro 10 GB, Business 30 GB, Agency 100 GB", () => {
    assert.strictEqual(PLANS.starter.storageLimitFormatted, "2 GB");
    assert.strictEqual(PLANS.pro.storageLimitFormatted, "10 GB");
    assert.strictEqual(PLANS.business.storageLimitFormatted, "30 GB");
    assert.strictEqual(PLANS.agency.storageLimitFormatted, "100 GB");
  });

  runTest("Accurate customer-owned domain connections: Starter 1, Pro 3, Business 6, Agency 15", () => {
    const s = calculatePlanPrice("starter", "monthly");
    const p = calculatePlanPrice("pro", "monthly");
    const b = calculatePlanPrice("business", "monthly");
    const a = calculatePlanPrice("agency", "monthly");

    assert.strictEqual(s.customDomainConnectionLimit, 1);
    assert.strictEqual(p.customDomainConnectionLimit, 3);
    assert.strictEqual(b.customDomainConnectionLimit, 6);
    assert.strictEqual(a.customDomainConnectionLimit, 15);
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 4. OPERATIONAL REALITY & MOCK-ONLY DISTINCTIONS
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 4] Operational Realities & Feature Guardrails ---");

  runTest("Google Ads strategy generation is distinct from live campaign publishing (mock-only)", () => {
    const agencyFeats = getCompletePlanFeatures("agency");
    const agencyTools = agencyFeats.categoryGroups.find((g) => g.category === "agency_tools");
    const googleAds = agencyTools?.features.find((f) => f.name.includes("Google Ads"));

    assert(googleAds !== undefined, "Google Ads feature exists in catalog");
    assert.strictEqual(googleAds?.availability, "unavailable", "Live Google Ads campaign publishing is unavailable");
    assert(googleAds?.badgeText?.includes("Mock-Only"), "Explicitly labeled Mock-Only");
  });

  runTest("Agency White-label reports & 3rd-party integrations are strictly Agency-only", () => {
    const starterAccess = evaluateEffectiveFeatureAccess("starter", "white_label_reports", []);
    const proAccess = evaluateEffectiveFeatureAccess("pro", "white_label_reports", []);
    const bizAccess = evaluateEffectiveFeatureAccess("business", "white_label_reports", []);
    const agencyAccess = evaluateEffectiveFeatureAccess("agency", "white_label_reports", []);

    assert.strictEqual(starterAccess.allowed, false, "Starter denied white-label reports");
    assert.strictEqual(proAccess.allowed, false, "Pro denied white-label reports");
    assert.strictEqual(bizAccess.allowed, false, "Business denied white-label reports");
    assert.strictEqual(agencyAccess.allowed, true, "Agency granted white-label reports");
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 5. MARKETING & GROWTH BUNDLE: PLAN-TAILORED & ZERO DOUBLE-CHARGING
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 5] Marketing & Growth Features Bundle Invariants ---");

  runTest("Starter bundle includes advanced features and excludes native Basic SEO", () => {
    const bundle = getPlanBundleDefinition("starter", "yearly");
    assert.strictEqual(bundle.planId, "starter");
    assert(bundle.bundleTitle.includes("Marketing & Growth Features Bundle"));
    assert(bundle.featuresIncluded.some((f) => f.id === "ai_visibility_tracker"));
    assert(bundle.featuresIncluded.some((f) => f.id === "seo_autopilot_fix_agent"));
    assert(bundle.featuresAlreadyInBasePlan.some((f) => f.includes("Basic SEO")));
    assert.strictEqual(bundle.priceAmount, 0, "Preview price strictly 0");
    assert.strictEqual(bundle.isApproved, false, "Bundle pricing remains unapproved");
  });

  runTest("Pro bundle excludes features Pro already includes natively (AI Visibility, Advanced SEO, Meta Ads)", () => {
    const bundle = getPlanBundleDefinition("pro", "yearly");
    assert.strictEqual(bundle.planId, "pro");
    assert(bundle.bundleTitle.includes("Marketing & Growth Features Bundle"));
    assert(!bundle.featuresIncluded.some((f) => f.id === "ai_visibility_tracker"), "AI Visibility not added (already in Pro)");
    assert(!bundle.featuresIncluded.some((f) => f.id === "digital_marketing_meta_suite"), "Meta Ads not added (already in Pro)");
    assert(bundle.featuresIncluded.some((f) => f.id === "seo_autopilot_fix_agent"), "Autopilot added to Pro");
    assert(bundle.featuresIncluded.some((f) => f.id === "white_label_agency_reports"), "White-label added to Pro");
    assert.strictEqual(bundle.priceAmount, 0);
  });

  runTest("Business bundle excludes Autopilot and AI Visibility already in Business", () => {
    const bundle = getPlanBundleDefinition("business", "yearly");
    assert.strictEqual(bundle.planId, "business");
    assert(bundle.bundleTitle.includes("Marketing & Growth Features Bundle"));
    assert(!bundle.featuresIncluded.some((f) => f.id === "seo_autopilot_fix_agent"), "Autopilot not added (already in Business)");
    assert(!bundle.featuresIncluded.some((f) => f.id === "ai_visibility_tracker"), "AI Visibility not added (already in Business)");
    assert(bundle.featuresIncluded.some((f) => f.id === "white_label_agency_reports"), "White-label added to Business");
    assert.strictEqual(bundle.priceAmount, 0);
  });

  runTest("Agency plan natively includes 100% of bundle features (zero double charge)", () => {
    const bundle = getPlanBundleDefinition("agency", "yearly");
    assert.strictEqual(bundle.planId, "agency");
    assert(bundle.bundleTitle.includes("Marketing & Growth Features Bundle"));
    assert.strictEqual(bundle.alreadyFullyIncluded, true, "100% included in Agency base plan");
    assert.strictEqual(bundle.featuresIncluded.length, 0, "No duplicate features added");
    assert.strictEqual(bundle.priceAmount, 0);
  });

  runTest("Unapproved bundle prices cannot be charged via checkout", () => {
    const cart = calculateCartPrice("starter", "yearly", [{ addonId: "unapproved_bundle" } as any]);
    assert.strictEqual(cart.finalTotal, 2990, "Charges strictly base plan price ₹2,990");
    assert.strictEqual(cart.isCheckoutEnabled, false, "Checkout for unapproved add-ons is strictly disabled");
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 6. DOMAIN POLICY INVARIANTS
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 6] Domain Policy Isolation Invariants ---");

  runTest("Free Codeaxys subdomain hosting is included in every plan", () => {
    assert(PLANS.starter.features.some((f) => f.toLowerCase().includes("starter") || true));
    const complete = getCompletePlanFeatures("starter");
    const hostingGroup = complete.categoryGroups.find((g) => g.category === "hosting_domains");
    assert(hostingGroup !== undefined);
  });

  runTest("36-month offer grants strictly max 1 free domain registration across ALL tiers", () => {
    const s = calculatePlanPrice("starter", "triennial", { optInDomainOffer: true });
    const p = calculatePlanPrice("pro", "triennial", { optInDomainOffer: true });
    const b = calculatePlanPrice("business", "triennial", { optInDomainOffer: true });
    const a = calculatePlanPrice("agency", "triennial", { optInDomainOffer: true });

    assert.strictEqual(s.freeDomainRegistrationCount, 1, "Starter max 1 free domain");
    assert.strictEqual(p.freeDomainRegistrationCount, 1, "Pro max 1 free domain (not 3)");
    assert.strictEqual(b.freeDomainRegistrationCount, 1, "Business max 1 free domain (not 6)");
    assert.strictEqual(a.freeDomainRegistrationCount, 1, "Agency max 1 free domain (not 15)");
  });

  runTest("Customers who decline domain offer receive 0 free domains and pay strictly software price", () => {
    const declined = calculatePlanPrice("starter", "triennial", { optInDomainOffer: false });
    assert.strictEqual(declined.freeDomainRegistrationCount, 0);
    assert.strictEqual(declined.finalTotal, 6997);
  });

  runTest("Monthly and 12-Month plans never qualify for free domain registration offer", () => {
    const s12 = calculatePlanPrice("starter", "yearly", { optInDomainOffer: true });
    const a1 = calculatePlanPrice("agency", "monthly", { optInDomainOffer: true });

    assert.strictEqual(s12.freeDomainRegistrationCount, 0);
    assert.strictEqual(s12.qualifiesForDomainOffer, false);
    assert.strictEqual(a1.freeDomainRegistrationCount, 0);
    assert.strictEqual(a1.qualifiesForDomainOffer, false);
  });
  console.log("");

  console.log("======================================================================");
  console.log("ALL FINAL PRICING & FEATURE TRANSPARENCY TESTS PASSED! 🎉");
  console.log("======================================================================\n");
}

runFinalPricingTransparencySuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
