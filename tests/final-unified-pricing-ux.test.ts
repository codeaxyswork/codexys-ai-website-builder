/**
 * Codeaxys AI Website Builder — Final Unified Pricing UX & Billing Selection Verification Suite
 *
 * Verifies:
 * 1. Billing Period Selector: Monthly, 12 Months, 36 Months with 12 Months default.
 * 2. Approved Base Prices preserved across all 4 plans and intervals.
 * 3. Price comparison math: Reference price (monthly × months), approved prepaid price,
 *    exact rupee savings, effective monthly rates, and struck-through only on 12m/36m.
 * 4. Upfront charge disclosure clearly distinguishes actual upfront total from monthly equivalents.
 * 5. Plan-tailored Premium Features Bundle: no double-charging for features already in base plan,
 *    unapproved pricing safeguards (₹0 billed, preview only), and Agency 100% native inclusion.
 * 6. Checkout transparency: itemized breakdown with base subscription, bundle preview,
 *    discounts/savings, separate one-time charges, total charged today, and renewal period.
 * 7. Domain offer isolation: 36-month offer strictly max 1 free domain, separate from connection limits.
 * 8. Feature transparency: categorized feature audit and mock-only feature protection.
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

async function runUnifiedPricingUXSuite() {
  console.log("======================================================================");
  console.log("CODEAXYS FINAL UNIFIED PRICING UX & BILLING SELECTION TEST SUITE");
  console.log("======================================================================\n");

  // -------------------------------------------------------------------------
  // 1. BILLING PERIOD SELECTOR & DEFAULT SELECTION
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 1] Billing Period Selector & Default 12 Months ---");

  runTest("Selector provides exactly Monthly, 12 Months, and 36 Months", () => {
    assert.strictEqual(BILLING_INTERVALS.monthly.label, "Monthly");
    assert.strictEqual(BILLING_INTERVALS.yearly.label, "12 Months");
    assert.strictEqual(BILLING_INTERVALS.triennial.label, "36 Months");

    assert.strictEqual(BILLING_INTERVALS.monthly.durationMonths, 1);
    assert.strictEqual(BILLING_INTERVALS.yearly.durationMonths, 12);
    assert.strictEqual(BILLING_INTERVALS.triennial.durationMonths, 36);
  });

  runTest("Interval normalization correctly resolves standard and alias inputs", () => {
    assert.strictEqual(normalizeBillingInterval("12 Months"), "yearly");
    assert.strictEqual(normalizeBillingInterval("12 months"), "yearly");
    assert.strictEqual(normalizeBillingInterval("12m"), "yearly");
    assert.strictEqual(normalizeBillingInterval("yearly"), "yearly");
    assert.strictEqual(normalizeBillingInterval("annual"), "yearly");

    assert.strictEqual(normalizeBillingInterval("36 Months"), "triennial");
    assert.strictEqual(normalizeBillingInterval("36 months"), "triennial");
    assert.strictEqual(normalizeBillingInterval("36m"), "triennial");
    assert.strictEqual(normalizeBillingInterval("triennial"), "triennial");

    assert.strictEqual(normalizeBillingInterval("Monthly"), "monthly");
    assert.strictEqual(normalizeBillingInterval("monthly"), "monthly");
    assert.strictEqual(normalizeBillingInterval(null), "monthly");
    assert.strictEqual(normalizeBillingInterval(""), "monthly");
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 2. PRESERVE APPROVED BASE PRICES
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 2] Preserve Approved Base Prices Matrix ---");

  runTest("Starter approved prices: ₹299 (Monthly), ₹2,990 (12M), ₹6,997 (36M)", () => {
    const m = calculatePlanPrice("starter", "monthly");
    const y = calculatePlanPrice("starter", "yearly");
    const t = calculatePlanPrice("starter", "triennial");

    assert.strictEqual(m.finalTotal, 299, "Starter monthly must be ₹299");
    assert.strictEqual(y.finalTotal, 2990, "Starter 12 Months must be ₹2,990");
    assert.strictEqual(t.finalTotal, 6997, "Starter 36 Months must be ₹6,997");
  });

  runTest("Pro approved prices: ₹599 (Monthly), ₹5,990 (12M), ₹14,017 (36M)", () => {
    const m = calculatePlanPrice("pro", "monthly");
    const y = calculatePlanPrice("pro", "yearly");
    const t = calculatePlanPrice("pro", "triennial");

    assert.strictEqual(m.finalTotal, 599, "Pro monthly must be ₹599");
    assert.strictEqual(y.finalTotal, 5990, "Pro 12 Months must be ₹5,990");
    assert.strictEqual(t.finalTotal, 14017, "Pro 36 Months must be ₹14,017");
  });

  runTest("Business approved prices: ₹999 (Monthly), ₹9,990 (12M), ₹23,377 (36M)", () => {
    const m = calculatePlanPrice("business", "monthly");
    const y = calculatePlanPrice("business", "yearly");
    const t = calculatePlanPrice("business", "triennial");

    assert.strictEqual(m.finalTotal, 999, "Business monthly must be ₹999");
    assert.strictEqual(y.finalTotal, 9990, "Business 12 Months must be ₹9,990");
    assert.strictEqual(t.finalTotal, 23377, "Business 36 Months must be ₹23,377");
  });

  runTest("Agency approved prices: ₹1,999 (Monthly), ₹19,990 (12M), ₹46,777 (36M)", () => {
    const m = calculatePlanPrice("agency", "monthly");
    const y = calculatePlanPrice("agency", "yearly");
    const t = calculatePlanPrice("agency", "triennial");

    assert.strictEqual(m.finalTotal, 1999, "Agency monthly must be ₹1,999");
    assert.strictEqual(y.finalTotal, 19990, "Agency 12 Months must be ₹19,990");
    assert.strictEqual(t.finalTotal, 46777, "Agency 36 Months must be ₹46,777");
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 3. PRICE COMPARISON, SAVINGS & REFERENCE PRICE MATH
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 3] Price Comparison, Savings & Reference Prices ---");

  runTest("12 Months reference price = monthly × 12 and savings = reference - prepaid", () => {
    const plans = ["starter", "pro", "business", "agency"] as const;
    const expectedMonthly = [299, 599, 999, 1999];
    const expectedPrepaid = [2990, 5990, 9990, 19990];
    const expectedSavings = [598, 1198, 1998, 3998];

    plans.forEach((planId, idx) => {
      const calc = calculatePlanPrice(planId, "yearly");
      const ref = expectedMonthly[idx] * 12;
      assert.strictEqual(calc.referencePrice, ref, `${planId} 12M reference price must be ${ref}`);
      assert.strictEqual(calc.grossTotal, ref, `${planId} 12M grossTotal must equal reference price`);
      assert.strictEqual(calc.finalTotal, expectedPrepaid[idx], `${planId} 12M prepaid must be ${expectedPrepaid[idx]}`);
      assert.strictEqual(calc.discountAmount, expectedSavings[idx], `${planId} 12M savings must be ${expectedSavings[idx]}`);
      assert.strictEqual(calc.savingsAmount, expectedSavings[idx], `${planId} 12M savingsAmount must equal discountAmount`);
    });
  });

  runTest("36 Months reference price = monthly × 36 and savings = reference - prepaid", () => {
    const plans = ["starter", "pro", "business", "agency"] as const;
    const expectedMonthly = [299, 599, 999, 1999];
    const expectedPrepaid = [6997, 14017, 23377, 46777];
    const expectedSavings = [3767, 7547, 12587, 25187];

    plans.forEach((planId, idx) => {
      const calc = calculatePlanPrice(planId, "triennial");
      const ref = expectedMonthly[idx] * 36;
      assert.strictEqual(calc.referencePrice, ref, `${planId} 36M reference price must be ${ref}`);
      assert.strictEqual(calc.grossTotal, ref, `${planId} 36M grossTotal must equal reference price`);
      assert.strictEqual(calc.finalTotal, expectedPrepaid[idx], `${planId} 36M prepaid must be ${expectedPrepaid[idx]}`);
      assert.strictEqual(calc.discountAmount, expectedSavings[idx], `${planId} 36M savings must be ${expectedSavings[idx]}`);
      assert.strictEqual(calc.savingsAmount, expectedSavings[idx], `${planId} 36M savingsAmount must equal discountAmount`);
    });
  });

  runTest("Monthly billing has zero discount, zero savings, and reference price equals monthly price", () => {
    const plans = ["starter", "pro", "business", "agency"] as const;
    const expectedMonthly = [299, 599, 999, 1999];

    plans.forEach((planId, idx) => {
      const calc = calculatePlanPrice(planId, "monthly");
      assert.strictEqual(calc.referencePrice, expectedMonthly[idx]);
      assert.strictEqual(calc.finalTotal, expectedMonthly[idx]);
      assert.strictEqual(calc.discountAmount, 0, `${planId} Monthly savings must be 0`);
      assert.strictEqual(calc.discountPercent, 0, `${planId} Monthly discount % must be 0`);
    });
  });

  runTest("Effective monthly rate correctly calculated without rounding discrepancies", () => {
    // 12 Months effective monthly rates
    assert.strictEqual(calculatePlanPrice("starter", "yearly").effectiveMonthlyPrice, 249.17);
    assert.strictEqual(calculatePlanPrice("pro", "yearly").effectiveMonthlyPrice, 499.17);
    assert.strictEqual(calculatePlanPrice("business", "yearly").effectiveMonthlyPrice, 832.50);
    assert.strictEqual(calculatePlanPrice("agency", "yearly").effectiveMonthlyPrice, 1665.83);

    // 36 Months effective monthly rates
    assert.strictEqual(calculatePlanPrice("starter", "triennial").effectiveMonthlyPrice, 194.36);
    assert.strictEqual(calculatePlanPrice("pro", "triennial").effectiveMonthlyPrice, 389.36);
    assert.strictEqual(calculatePlanPrice("business", "triennial").effectiveMonthlyPrice, 649.36);
    assert.strictEqual(calculatePlanPrice("agency", "triennial").effectiveMonthlyPrice, 1299.36);
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 4. UPFRONT PAYMENT DISCLOSURE TRANSPARENCY
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 4] Upfront Charge vs Monthly Equivalent Transparency ---");

  runTest("Upfront charge disclosure clearly states full term charge upfront", () => {
    const starter12 = calculatePlanPrice("starter", "yearly");
    assert.strictEqual(starter12.upfrontChargeNotice, "Billed upfront as ₹2,990 for 12 months");

    const pro36 = calculatePlanPrice("pro", "triennial");
    assert.strictEqual(pro36.upfrontChargeNotice, "Billed upfront as ₹14,017 for 36 months");

    const bizMonthly = calculatePlanPrice("business", "monthly");
    assert.strictEqual(bizMonthly.upfrontChargeNotice, "Billed monthly at ₹999");
  });

  runTest("Renewal descriptions clearly specify recurring interval and amount", () => {
    const pro12 = calculatePlanPrice("pro", "yearly");
    assert.strictEqual(pro12.renewalNotice, "Renews every 12 months at ₹5,990 unless canceled");

    const starter36 = calculatePlanPrice("starter", "triennial");
    assert.strictEqual(starter36.renewalNotice, "Renews every 36 months at ₹6,997 unless canceled");

    const agencyM = calculatePlanPrice("agency", "monthly");
    assert.strictEqual(agencyM.renewalNotice, "Renews every month at ₹1,999 unless canceled");
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 5. UNIFIED PREMIUM FEATURES BUNDLE & NO DOUBLE CHARGING
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 5] Plan-Tailored Premium Bundle & Zero Double-Charging ---");

  runTest("Starter bundle includes advanced features and excludes native Basic SEO", () => {
    const bundle = getPlanBundleDefinition("starter", "yearly");
    assert.strictEqual(bundle.planId, "starter");
    assert.strictEqual(bundle.alreadyFullyIncluded, false);
    assert.strictEqual(bundle.isApproved, false, "Bundle pricing must be unapproved (preview mode)");
    assert.strictEqual(bundle.priceAmount, 0, "Bundle must charge ₹0 today");

    const featureIds = bundle.featuresIncluded.map((f) => f.id);
    assert(featureIds.includes("ai_visibility_tracker"), "Starter bundle includes AI Visibility");
    assert(featureIds.includes("seo_autopilot_fix_agent"), "Starter bundle includes SEO Autopilot");
    assert(featureIds.includes("advanced_schema_engine"), "Starter bundle includes Schema Engine");
    assert(featureIds.includes("technical_crawl_diagnostics"), "Starter bundle includes Technical Crawl");
    assert(featureIds.includes("digital_marketing_meta_suite"), "Starter bundle includes Meta Ads");

    // Starter features excluded to prevent double-charging
    assert(!featureIds.includes("basic_seo"), "Basic SEO is not re-included in bundle");
  });

  runTest("Pro bundle excludes features Pro already has natively", () => {
    const bundle = getPlanBundleDefinition("pro", "yearly");
    assert.strictEqual(bundle.planId, "pro");
    assert.strictEqual(bundle.alreadyFullyIncluded, false);

    const featureIds = bundle.featuresIncluded.map((f) => f.id);
    // Bundle adds what Pro lacks: SEO Autopilot, White-Label Reports, Third-Party Integrations
    assert(featureIds.includes("seo_autopilot_fix_agent"), "Pro bundle adds SEO Autopilot");
    assert(featureIds.includes("white_label_agency_reports"), "Pro bundle adds White-Label Reports");
    assert(featureIds.includes("agency_third_party_integrations"), "Pro bundle adds Integrations");

    // Pro ALREADY has AI Visibility, AI SEO, Schema, Crawl, Competitor Tracking, Meta Ads:
    assert(!featureIds.includes("ai_visibility_tracker"), "AI Visibility is already in Pro; not in bundle");
    assert(!featureIds.includes("ai_seo_suggestions"), "AI SEO is already in Pro; not in bundle");
    assert(!featureIds.includes("advanced_schema_engine"), "Schema is already in Pro; not in bundle");
    assert(!featureIds.includes("technical_crawl_diagnostics"), "Crawl is already in Pro; not in bundle");
    assert(!featureIds.includes("competitor_tracking_studio"), "Competitor tracking is already in Pro; not in bundle");
  });

  runTest("Business bundle excludes Autopilot and AI Visibility already in Business", () => {
    const bundle = getPlanBundleDefinition("business", "yearly");
    assert.strictEqual(bundle.planId, "business");
    assert.strictEqual(bundle.alreadyFullyIncluded, false);

    const featureIds = bundle.featuresIncluded.map((f) => f.id);
    // Business lacks White-Label Reports and Agency Integrations:
    assert(featureIds.includes("white_label_agency_reports"), "Business bundle adds White-Label Reports");
    assert(featureIds.includes("agency_third_party_integrations"), "Business bundle adds Integrations");

    // Business ALREADY has Autopilot and Visibility:
    assert(!featureIds.includes("seo_autopilot_fix_agent"), "SEO Autopilot already in Business; not in bundle");
    assert(!featureIds.includes("ai_visibility_tracker"), "AI Visibility already in Business; not in bundle");
  });

  runTest("Agency plan natively includes all premium features (100% native, zero bundle charge)", () => {
    const bundle = getPlanBundleDefinition("agency", "yearly");
    assert.strictEqual(bundle.planId, "agency");
    assert.strictEqual(bundle.alreadyFullyIncluded, true, "Agency bundle must show 100% already included");
    assert.strictEqual(bundle.featuresIncluded.length, 0, "No duplicate features added to Agency bundle");
    assert(bundle.featuresAlreadyInBasePlan.length > 5, "Discloses all capabilities included in Agency");
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 6. CHECKOUT SUMMARY & SERVER-SIDE TOTAL ENFORCEMENT
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 6] Checkout Summary & Server-Side Total Enforcement ---");

  runTest("Checkout calculation does not charge unapproved bundle prices", () => {
    // Pro 12 Months with add-on bundle
    const cart = calculateCartPrice("pro", "yearly", [{ addonId: "white_label_agency_reports" }]);
    assert.strictEqual(cart.basePlanTotal, 5990, "Base plan total is strictly ₹5,990");
    assert.strictEqual(cart.finalTotal, 5990, "Final charged total is strictly ₹5,990 (bundle is ₹0)");
    assert.strictEqual(cart.isCheckoutEnabled, false, "Add-on bundle live purchasing remains disabled");
  });

  runTest("Checkout totals ignore any client-injected amounts or fake bundle prices", () => {
    const tampered = calculateCartPrice("starter", "triennial", [{ addonId: "exploit_addon" } as any]);
    assert.strictEqual(tampered.finalTotal, 6997, "Server calculates strictly approved ₹6,997");
    assert.strictEqual(tampered.basePlanCalculation.savingsAmount, 3767, "Savings strictly ₹3,767");
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 7. SINGLE DOMAIN OFFER ISOLATION
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 7] 36-Month Single Domain Offer Isolation ---");

  runTest("36-month prepaid plans grant maximum 1 free domain across ALL tiers", () => {
    const starter36 = calculatePlanPrice("starter", "triennial", { optInDomainOffer: true });
    const pro36 = calculatePlanPrice("pro", "triennial", { optInDomainOffer: true });
    const biz36 = calculatePlanPrice("business", "triennial", { optInDomainOffer: true });
    const agency36 = calculatePlanPrice("agency", "triennial", { optInDomainOffer: true });

    assert.strictEqual(starter36.freeDomainRegistrationCount, 1, "Starter receives max 1 domain");
    assert.strictEqual(pro36.freeDomainRegistrationCount, 1, "Pro receives max 1 domain (not 3)");
    assert.strictEqual(biz36.freeDomainRegistrationCount, 1, "Business receives max 1 domain (not 6)");
    assert.strictEqual(agency36.freeDomainRegistrationCount, 1, "Agency receives max 1 domain (not 15)");

    // Connection limits remain distinct
    assert.strictEqual(starter36.customDomainConnectionLimit, 1);
    assert.strictEqual(pro36.customDomainConnectionLimit, 3);
    assert.strictEqual(biz36.customDomainConnectionLimit, 6);
    assert.strictEqual(agency36.customDomainConnectionLimit, 15);
  });

  runTest("Monthly and 12-Month plans NEVER qualify for the free domain registration offer", () => {
    const starter12 = calculatePlanPrice("starter", "yearly", { optInDomainOffer: true });
    const agencyMonthly = calculatePlanPrice("agency", "monthly", { optInDomainOffer: true });

    assert.strictEqual(starter12.freeDomainRegistrationCount, 0, "12M plan gets 0 free domain registrations");
    assert.strictEqual(starter12.qualifiesForDomainOffer, false);
    assert.strictEqual(agencyMonthly.freeDomainRegistrationCount, 0, "Monthly gets 0 free domain registrations");
    assert.strictEqual(agencyMonthly.qualifiesForDomainOffer, false);
  });
  console.log("");

  // -------------------------------------------------------------------------
  // 8. FEATURE TRANSPARENCY & IMPLEMENTATION SAFETY
  // -------------------------------------------------------------------------
  console.log("--- [Test Group 8] Feature Transparency & Implementation Safety ---");

  runTest("View All Features catalog provides complete, categorized plain-language features", () => {
    const starterFeats = getCompletePlanFeatures("starter");
    const proFeats = getCompletePlanFeatures("pro");
    const bizFeats = getCompletePlanFeatures("business");
    const agencyFeats = getCompletePlanFeatures("agency");

    assert.strictEqual(starterFeats.websiteLimit, 1);
    assert.strictEqual(proFeats.websiteLimit, 3);
    assert.strictEqual(bizFeats.websiteLimit, 6);
    assert.strictEqual(agencyFeats.websiteLimit, 15);

    // Verify categories
    assert(starterFeats.categoryGroups.some((g) => g.category === "core_builder"));
    assert(starterFeats.categoryGroups.some((g) => g.category === "hosting_domains"));
    assert(starterFeats.categoryGroups.some((g) => g.category === "seo_intelligence"));
    assert(starterFeats.categoryGroups.some((g) => g.category === "capacity_credits"));
  });

  runTest("Mock-only or incomplete features are explicitly flagged and not claimed live", () => {
    const agencyFeats = getCompletePlanFeatures("agency");
    const agencyTools = agencyFeats.categoryGroups.find((g) => g.category === "agency_tools");
    const googleAds = agencyTools?.features.find((f) => f.name.includes("Google Ads"));

    assert(googleAds !== undefined, "Google Ads capability is accounted for");
    assert.strictEqual(googleAds?.availability, "unavailable", "Google Ads live publishing is unavailable");
    assert(googleAds?.badgeText?.includes("Mock-Only"), "Explicitly labeled Mock-Only");
  });

  runTest("Server-side entitlement evaluation fails closed for bundle features without verified records", () => {
    // Without active add-on or higher tier, starter is blocked
    const access = evaluateEffectiveFeatureAccess("starter", "white_label_reports", []);
    assert.strictEqual(access.allowed, false, "Fails closed without active verified entitlement");
  });
  console.log("");

  console.log("======================================================================");
  console.log("ALL FINAL UNIFIED PRICING UX & BILLING SELECTION TESTS PASSED! 🎉");
  console.log("======================================================================\n");
}

runUnifiedPricingUXSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
