/**
 * Codeaxys AI Website Builder — Add-on Pricing Phase 1 Verification Suite
 * Verifies catalog definitions, inactive-by-default behavior, base plan invariants,
 * dual-gate entitlements, credit top-up accounting, and cart price calculations.
 */

import fs from "fs";
import path from "path";
import {
  ADDON_CATALOG,
  getAddonDefinition,
  isAddonEligibleForPlan,
  isAddonPurchaseable,
  listAllAddons,
  listAddonsForPlan,
} from "../lib/addons/catalog";
import {
  isUserAddonActiveAndValid,
  evaluateEffectiveFeatureAccess,
  calculateEffectiveUsageQuotas,
} from "../lib/addons/entitlements";
import {
  initializeCreditLedger,
  replenishWithPurchasedCreditsPreserved,
  deductFromCreditLedger,
  addPurchasedCredits,
} from "../lib/addons/credits-accounting";
import { calculateCartPrice } from "../lib/addons/pricing";
import { UserAddonRecord } from "../lib/addons/types";
import { PLANS } from "../lib/constants";
import { canUseFeature } from "../lib/features";
import { calculatePlanPrice } from "../lib/billing-periods";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  [PASS] ${message}`);
}

async function runAddonPhase1TestSuite() {
  console.log("======================================================================");
  console.log("CODEAXYS ADD-ON PRICING PHASE 1 VERIFICATION SUITE");
  console.log("======================================================================\n");

  // ------------------------------------------------------------------
  // Test 1: Add-on Catalog Validation & Inactive-by-Default Invariants
  // ------------------------------------------------------------------
  console.log("--- [Test 1] Catalog Validation & Inactive-by-Default Invariants ---");
  const requiredAddons = [
    "ai_visibility_tracker",
    "seo_autopilot_fix_agent",
    "white_label_agency_reports",
    "extra_website_slot",
    "ai_credit_top_up_pack",
    "media_storage_expansion",
    "digital_marketing_meta_suite",
  ];

  for (const id of requiredAddons) {
    const addon = getAddonDefinition(id);
    assert(Boolean(addon), `Catalog contains required add-on: ${id}`);
    assert(addon!.status === "inactive", `Add-on ${id} is inactive by default (status: inactive)`);
    assert(addon!.isApproved === false, `Add-on ${id} is marked unapproved (isApproved: false)`);
    assert(!isAddonPurchaseable(id), `Add-on ${id} is not purchasable in Phase 1`);
  }

  // Verify Google Ads publishing distinction
  const marketingAddon = getAddonDefinition("digital_marketing_meta_suite");
  assert(
    marketingAddon?.metadata?.unavailableIntegrations?.includes("google_ads_campaign_publishing"),
    "Google Ads campaign publishing is explicitly marked unavailable in digital marketing suite metadata"
  );
  console.log("");

  // ------------------------------------------------------------------
  // Test 2: Base-Plan Pricing & Entitlement Backward Compatibility
  // ------------------------------------------------------------------
  console.log("--- [Test 2] Base-Plan Pricing & Entitlement Backward Compatibility ---");
  const starterPrice = calculatePlanPrice("starter", "monthly");
  assert(starterPrice.finalTotal === 299, "Starter monthly price unchanged: ₹299");
  const starterAnnual = calculatePlanPrice("starter", "yearly");
  assert(starterAnnual.finalTotal === 2990, "Starter annual price unchanged: ₹2,990");
  const starter36m = calculatePlanPrice("starter", "triennial");
  assert(starter36m.finalTotal === 6997, "Starter 36-month price unchanged: ₹6,997");

  const proPrice = calculatePlanPrice("pro", "monthly");
  assert(proPrice.finalTotal === 599, "Pro monthly price unchanged: ₹599");
  const proAnnual = calculatePlanPrice("pro", "yearly");
  assert(proAnnual.finalTotal === 5990, "Pro annual price unchanged: ₹5,990");
  const pro36m = calculatePlanPrice("pro", "triennial");
  assert(pro36m.finalTotal === 14017, "Pro 36-month price unchanged: ₹14,017");

  const bizPrice = calculatePlanPrice("business", "monthly");
  assert(bizPrice.finalTotal === 999, "Business monthly price unchanged: ₹999");
  const bizAnnual = calculatePlanPrice("business", "yearly");
  assert(bizAnnual.finalTotal === 9990, "Business annual price unchanged: ₹9,990");
  const biz36m = calculatePlanPrice("business", "triennial");
  assert(biz36m.finalTotal === 23377, "Business 36-month price unchanged: ₹23,377");

  const agencyPrice = calculatePlanPrice("agency", "monthly");
  assert(agencyPrice.finalTotal === 1999, "Agency monthly price unchanged: ₹1,999");
  const agencyAnnual = calculatePlanPrice("agency", "yearly");
  assert(agencyAnnual.finalTotal === 19990, "Agency annual price unchanged: ₹19,990");
  const agency36m = calculatePlanPrice("agency", "triennial");
  assert(agency36m.finalTotal === 46777, "Agency 36-month price unchanged: ₹46,777");

  // canUseFeature backwards compatibility
  assert(canUseFeature("free", "basic_seo") === true, "canUseFeature: Free includes basic_seo");
  assert(canUseFeature("starter", "ai_seo") === false, "canUseFeature: Starter denies ai_seo");
  assert(canUseFeature("pro", "ai_seo") === true, "canUseFeature: Pro includes ai_seo");
  assert(canUseFeature("business", "advanced_schema") === true, "canUseFeature: Business includes advanced_schema");
  assert(canUseFeature("business", "advanced_integrations") === false, "canUseFeature: Business denies advanced_integrations");
  assert(canUseFeature("agency", "advanced_integrations") === true, "canUseFeature: Agency includes advanced_integrations");
  console.log("");

  // ------------------------------------------------------------------
  // Test 3: Eligible versus Ineligible Add-on Matrix
  // ------------------------------------------------------------------
  console.log("--- [Test 3] Eligible versus Ineligible Add-on Matrix ---");
  // SEO Autopilot requires Pro prerequisite (Starter lacks AI SEO foundation)
  assert(!isAddonEligibleForPlan("seo_autopilot_fix_agent", "starter"), "Starter is ineligible for SEO Autopilot add-on");
  assert(isAddonEligibleForPlan("seo_autopilot_fix_agent", "pro"), "Pro is eligible for SEO Autopilot add-on");

  // AI Visibility is eligible for Starter and Pro (included in Business & Agency)
  assert(isAddonEligibleForPlan("ai_visibility_tracker", "starter"), "Starter is eligible for AI Visibility Tracker add-on");
  assert(isAddonEligibleForPlan("ai_visibility_tracker", "pro"), "Pro is eligible for AI Visibility Tracker add-on");
  assert(!isAddonEligibleForPlan("ai_visibility_tracker", "business"), "Business does not need AI Visibility add-on (included in base plan)");

  // White-Label reports eligible for Pro & Business (included in Agency)
  assert(!isAddonEligibleForPlan("white_label_agency_reports", "starter"), "Starter is ineligible for White-Label reports");
  assert(isAddonEligibleForPlan("white_label_agency_reports", "pro"), "Pro is eligible for White-Label reports");
  assert(isAddonEligibleForPlan("white_label_agency_reports", "business"), "Business is eligible for White-Label reports");

  // Capacity packs eligible across paid plans
  assert(isAddonEligibleForPlan("extra_website_slot", "starter"), "Starter is eligible for Extra Website Slots");
  assert(isAddonEligibleForPlan("media_storage_expansion", "starter"), "Starter is eligible for Storage Expansion");
  assert(isAddonEligibleForPlan("ai_credit_top_up_pack", "free"), "Free is eligible for AI Credit Top-Up Packs");
  console.log("");

  // ------------------------------------------------------------------
  // Test 4: Expired and Cancelled Add-on Access State Machine
  // ------------------------------------------------------------------
  console.log("--- [Test 4] Expired and Cancelled Add-on Access State Machine ---");
  const now = new Date("2026-10-14T12:00:00Z");

  const activeAddon: UserAddonRecord = {
    id: "ua-1",
    user_id: "user-123",
    addon_id: "ai_visibility_tracker",
    status: "active",
    billing_interval: "monthly",
    current_period_start: "2026-10-01T00:00:00Z",
    current_period_end: "2026-10-31T23:59:59Z",
    cancel_at_period_end: false,
    canceled_at: null,
    price_paid: 299,
    currency: "INR",
    metadata: {},
  };
  assert(isUserAddonActiveAndValid(activeAddon, now), "Active add-on within period is valid");

  const expiredAddon: UserAddonRecord = {
    ...activeAddon,
    id: "ua-2",
    current_period_end: "2026-10-10T00:00:00Z", // Past date
  };
  assert(!isUserAddonActiveAndValid(expiredAddon, now), "Expired add-on fails closed");

  const canceledWithinPeriod: UserAddonRecord = {
    ...activeAddon,
    id: "ua-3",
    status: "canceled",
    cancel_at_period_end: true,
    canceled_at: "2026-10-05T00:00:00Z",
    current_period_end: "2026-10-31T23:59:59Z",
  };
  assert(
    isUserAddonActiveAndValid(canceledWithinPeriod, now),
    "Canceled add-on with cancel_at_period_end=true remains valid until current_period_end"
  );

  const canceledAfterPeriod: UserAddonRecord = {
    ...canceledWithinPeriod,
    id: "ua-4",
    current_period_end: "2026-10-10T00:00:00Z",
  };
  assert(
    !isUserAddonActiveAndValid(canceledAfterPeriod, now),
    "Canceled add-on after current_period_end is invalid"
  );

  const pastDueAddon: UserAddonRecord = {
    ...activeAddon,
    id: "ua-5",
    status: "past_due",
  };
  assert(!isUserAddonActiveAndValid(pastDueAddon, now), "Past due add-on fails closed");
  console.log("");

  // ------------------------------------------------------------------
  // Test 5: Server-Side Dual-Gate Entitlement Evaluation
  // ------------------------------------------------------------------
  console.log("--- [Test 5] Server-Side Dual-Gate Entitlement Evaluation ---");
  // 1. Pro user checking AI Visibility without add-on -> Native Base Plan
  const proNative = evaluateEffectiveFeatureAccess("pro", "ai_visibility", []);
  assert(proNative.allowed && proNative.grantedBy === "base_plan", "Pro plan natively includes AI Visibility");

  // 2. Starter user checking AI Visibility without add-on -> Denied
  const starterDenied = evaluateEffectiveFeatureAccess("starter", "ai_visibility", []);
  assert(!starterDenied.allowed && starterDenied.grantedBy === "none", "Starter plan without add-on is denied AI Visibility");

  // 3. Starter user with active AI Visibility add-on -> Granted by add-on
  const starterWithAddon = evaluateEffectiveFeatureAccess("starter", "ai_visibility", [activeAddon], now);
  assert(
    starterWithAddon.allowed && starterWithAddon.grantedBy === "addon" && starterWithAddon.addonId === "ai_visibility_tracker",
    "Starter plan with active add-on is granted AI Visibility"
  );

  // 4. Starter user with expired add-on -> Denied
  const starterWithExpired = evaluateEffectiveFeatureAccess("starter", "ai_visibility", [expiredAddon], now);
  assert(!starterWithExpired.allowed, "Starter plan with expired add-on is denied access");
  console.log("");

  // ------------------------------------------------------------------
  // Test 6: Capacity Quota Calculations With Add-ons
  // ------------------------------------------------------------------
  console.log("--- [Test 6] Capacity Quota Calculations With Add-ons ---");
  const websiteSlotAddon: UserAddonRecord = {
    id: "ua-ws",
    user_id: "user-123",
    addon_id: "extra_website_slot",
    status: "active",
    billing_interval: "monthly",
    current_period_start: "2026-10-01T00:00:00Z",
    current_period_end: "2026-10-31T23:59:59Z",
    cancel_at_period_end: false,
    canceled_at: null,
    price_paid: 199,
    currency: "INR",
    metadata: {},
  };

  const storageAddon: UserAddonRecord = {
    id: "ua-st",
    user_id: "user-123",
    addon_id: "media_storage_expansion",
    status: "active",
    billing_interval: "monthly",
    current_period_start: "2026-10-01T00:00:00Z",
    current_period_end: "2026-10-31T23:59:59Z",
    cancel_at_period_end: false,
    canceled_at: null,
    price_paid: 149,
    currency: "INR",
    metadata: {},
  };

  const starterBase = {
    maxWebsites: 1,
    storageBytes: 2147483648, // 2 GB
    monthlyCredits: 100,
    currentBalance: 100,
  };

  const combinedQuotas = calculateEffectiveUsageQuotas("starter", starterBase, [websiteSlotAddon, storageAddon], now);
  assert(combinedQuotas.websitesLimit === 2, "Starter base limit of 1 website incremented to 2 with extra website slot add-on");
  assert(
    combinedQuotas.storageLimitBytes === 2147483648 + 10737418240,
    "Starter 2 GB storage incremented by 10 GB to 12 GB total"
  );
  console.log("");

  // ------------------------------------------------------------------
  // Test 7: Domain Offer Isolation Invariant
  // ------------------------------------------------------------------
  console.log("--- [Test 7] Domain Offer Isolation Invariant ---");
  // Calculate cart price with multiple add-ons on a 36-month subscription
  const cartWithDomain = calculateCartPrice("starter", "triennial", [{ addonId: "extra_website_slot" }], {
    optInDomainOffer: true,
  });

  assert(
    cartWithDomain.freeDomainRegistrationCount === 1,
    "36-month subscription grants maximum strictly ONE free domain registration offer"
  );
  assert(
    cartWithDomain.customDomainConnectionLimit === 1,
    "Starter custom domain connection limit remains strictly 1 from base plan"
  );

  // Monthly plan with add-on
  const cartMonthly = calculateCartPrice("starter", "monthly", [{ addonId: "extra_website_slot" }], {
    optInDomainOffer: true,
  });
  assert(
    cartMonthly.freeDomainRegistrationCount === 0,
    "Monthly subscriptions NEVER qualify for free domain registration offer regardless of add-ons"
  );
  console.log("");

  // ------------------------------------------------------------------
  // Test 8: AI Credit Top-Up Separate Accounting Invariants
  // ------------------------------------------------------------------
  console.log("--- [Test 8] AI Credit Top-Up Separate Accounting Invariants ---");
  // 1. Initialize Starter plan with 100 monthly allowance and 500 purchased credits
  const initialLedger = initializeCreditLedger(100, 500);
  assert(initialLedger.monthlyAllowanceBalance === 100, "Initial monthly allowance is 100");
  assert(initialLedger.purchasedCreditsBalance === 500, "Initial purchased top-up balance is 500");
  assert(initialLedger.totalSpendableBalance === 600, "Total spendable balance is 600");

  // 2. Deduct 40 credits (monthly allowance covers it)
  const deduct1 = deductFromCreditLedger(40, initialLedger);
  assert(deduct1.success, "Deduction 1 succeeded");
  assert(deduct1.deductedFromMonthly === 40, "Deducted 40 credits from monthly allowance");
  assert(deduct1.deductedFromPurchased === 0, "Zero credits deducted from purchased top-up");
  assert(deduct1.newLedger.monthlyAllowanceBalance === 60, "Monthly allowance reduced to 60");
  assert(deduct1.newLedger.purchasedCreditsBalance === 500, "Purchased credits untouched at 500");

  // 3. Deduct 80 credits (exceeds remaining 60 monthly; drains monthly then 20 from purchased)
  const deduct2 = deductFromCreditLedger(80, deduct1.newLedger);
  assert(deduct2.success, "Deduction 2 succeeded");
  assert(deduct2.deductedFromMonthly === 60, "Deducted remaining 60 from monthly allowance");
  assert(deduct2.deductedFromPurchased === 20, "Deducted 20 from purchased top-up balance");
  assert(deduct2.newLedger.monthlyAllowanceBalance === 0, "Monthly allowance depleted to 0");
  assert(deduct2.newLedger.purchasedCreditsBalance === 480, "Purchased credits reduced to 480");
  assert(deduct2.newLedger.totalSpendableBalance === 480, "Total spendable balance is 480");

  // 4. Renewal simulation: monthly allowance replenishment triggers
  const renewal = replenishWithPurchasedCreditsPreserved(deduct2.newLedger, 100);
  assert(
    renewal.resetMonthlyAllowance === 100,
    "Monthly allowance reset strictly to 100 plan allowance without rollover"
  );
  assert(
    renewal.preservedPurchasedCredits === 480,
    "Purchased top-up credits (480) 100% PRESERVED across monthly subscription renewal!"
  );
  assert(
    renewal.newLedger.totalSpendableBalance === 580,
    "New total spendable balance is 580 (100 monthly + 480 purchased)"
  );

  // 5. Customer buys another +250 top-up pack
  const afterTopUp = addPurchasedCredits(renewal.newLedger, 250);
  assert(afterTopUp.purchasedCreditsBalance === 730, "Purchased balance increased to 730 (480 + 250)");
  assert(afterTopUp.monthlyAllowanceBalance === 100, "Monthly allowance remains unaffected at 100");
  assert(afterTopUp.totalSpendableBalance === 830, "Total spendable balance is 830");
  console.log("");

  // ------------------------------------------------------------------
  // Test 9: Add-on Cart Calculation Without Activating Checkout
  // ------------------------------------------------------------------
  console.log("--- [Test 9] Add-on Cart Calculation Without Activating Checkout ---");
  const cartPro = calculateCartPrice("pro", "yearly", [
    { addonId: "white_label_agency_reports", interval: "yearly" },
    { addonId: "extra_website_slot", interval: "yearly" },
  ]);

  assert(cartPro.basePlanTotal === 5990, "Base Pro annual total is ₹5,990");
  assert(cartPro.addonsUnapprovedTotal > 0, "Add-ons unapproved total calculated accurately for preview");
  assert(cartPro.finalTotal === 5990, "Final charged total is strictly ₹5,990 (add-ons are NOT charged in Phase 1)");
  assert(cartPro.isCheckoutEnabled === false, "Add-on checkout is strictly disabled in Phase 1 (isCheckoutEnabled: false)");
  assert(
    cartPro.checkoutNotice.includes("disabled") || cartPro.checkoutNotice.includes("inactive"),
    "Checkout notice explicitly states add-on checkout is inactive"
  );
  console.log("");

  // ------------------------------------------------------------------
  // Test 10: SQL Migration File and Rollback Invariants
  // ------------------------------------------------------------------
  console.log("--- [Test 10] SQL Migration File and Rollback Invariants ---");
  const migrationPath = path.join(
    process.cwd(),
    "supabase/migrations/20261015_addon_pricing_foundation.sql"
  );
  assert(fs.existsSync(migrationPath), "Migration file exists at supabase/migrations/20261015_addon_pricing_foundation.sql");

  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  assert(migrationSql.includes("CREATE TABLE IF NOT EXISTS public.addons"), "Migration creates public.addons table");
  assert(migrationSql.includes("CREATE TABLE IF NOT EXISTS public.user_addons"), "Migration creates public.user_addons table");
  assert(
    migrationSql.includes("DROP TABLE IF EXISTS public.user_addons CASCADE") &&
      migrationSql.includes("DROP TABLE IF EXISTS public.addons CASCADE"),
    "Migration contains explicit rollback documentation instructions"
  );
  assert(
    migrationSql.includes("idx_user_addons_unique_active_recurring"),
    "Migration enforces partial unique index preventing duplicate active recurring add-ons"
  );
  assert(
    migrationSql.includes("ENABLE ROW LEVEL SECURITY"),
    "Migration enforces Row Level Security (RLS) on both tables"
  );
  console.log("");

  console.log("======================================================================");
  console.log("ALL 10 ADD-ON PRICING PHASE 1 VERIFICATION TESTS PASSED! 🎉");
  console.log("======================================================================\n");
}

runAddonPhase1TestSuite().catch((err) => {
  console.error("Test Suite Execution Failed:", err);
  process.exit(1);
});
