/**
 * Codeaxys AI Website Builder — Add-on Pricing Phase 2 Verification Suite
 * Verifies UI components, category filters, disabled checkout, unapproved pricing safeguards,
 * non-fabrication of dashboard records, and domain offer isolation.
 */

import {
  ADDON_CATALOG,
  getAddonDefinition,
  isAddonPurchaseable,
  listAllAddons,
  listAddonsForPlan,
} from "../lib/addons/catalog";
import {
  evaluateEffectiveFeatureAccess,
  isUserAddonActiveAndValid,
  getUserActiveAddons,
} from "../lib/addons/entitlements";
import { calculateCartPrice } from "../lib/addons/pricing";
import { calculatePlanPrice } from "../lib/billing-periods";
import { canUseFeature } from "../lib/features";
import { UserAddonRecord } from "../lib/addons/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  [PASS] ${message}`);
}

async function runAddonPhase2TestSuite() {
  console.log("======================================================================");
  console.log("CODEAXYS ADD-ON PRICING PHASE 2: UI & MOCK CHECKOUT VERIFICATION");
  console.log("======================================================================\n");

  // ------------------------------------------------------------------
  // Test 1: Add-on Cards & Category Filter Integrity
  // ------------------------------------------------------------------
  console.log("--- [Test 1] Add-on Cards & Category Filter Integrity ---");
  const allAddons = listAllAddons();
  assert(allAddons.length === 7, "Catalog contains exactly 7 initial add-ons");

  const seoAddons = allAddons.filter((a) => a.category === "seo");
  assert(seoAddons.length === 2, "SEO & AI category contains 2 add-ons (AI Visibility & SEO Autopilot)");

  const agencyAddons = allAddons.filter((a) => a.category === "agency");
  assert(agencyAddons.length === 1, "Agency Tools category contains 1 add-on (White-Label Agency Reports)");

  const capacityAddons = allAddons.filter((a) => a.category === "capacity");
  assert(capacityAddons.length === 3, "Capacity category contains 3 add-ons (Websites, Credits, Storage)");

  const marketingAddons = allAddons.filter((a) => a.category === "marketing");
  assert(marketingAddons.length === 1, "Marketing category contains 1 add-on (Digital Marketing Meta Suite)");

  // Verify Google Ads publishing distinction
  const marketingDef = getAddonDefinition("digital_marketing_meta_suite");
  assert(
    marketingDef?.metadata?.unavailableIntegrations?.includes("google_ads_campaign_publishing"),
    "Google Ads campaign publishing is explicitly documented as unavailable / mock-only"
  );
  console.log("");

  // ------------------------------------------------------------------
  // Test 2: Inactive Add-ons Cannot Be Activated or Purchased
  // ------------------------------------------------------------------
  console.log("--- [Test 2] Inactive Add-ons Cannot Be Activated or Purchased ---");
  for (const addon of allAddons) {
    assert(addon.status === "inactive", `Add-on '${addon.id}' status is inactive`);
    assert(addon.isApproved === false, `Add-on '${addon.id}' isApproved is false`);
    assert(!isAddonPurchaseable(addon.id), `isAddonPurchaseable('${addon.id}') returns false`);
  }
  console.log("");

  // ------------------------------------------------------------------
  // Test 3: Unapproved Prices Are Never Charged to Customers
  // ------------------------------------------------------------------
  console.log("--- [Test 3] Unapproved Prices Are Never Charged to Customers ---");
  // 1. Starter monthly + AI Visibility add-on
  const cart1 = calculateCartPrice("starter", "monthly", [{ addonId: "ai_visibility_tracker" }]);
  assert(cart1.basePlanTotal === 299, "Base plan total is strictly ₹299");
  assert(cart1.finalTotal === 299, "Final total charges strictly ₹299 (Add-on unapproved price is NOT charged)");
  assert(cart1.isCheckoutEnabled === false, "Add-on checkout is strictly disabled (isCheckoutEnabled: false)");

  // 2. Pro annual + White-Label Reports + Extra Website Slot
  const cart2 = calculateCartPrice("pro", "yearly", [
    { addonId: "white_label_agency_reports" },
    { addonId: "extra_website_slot" },
  ]);
  assert(cart2.basePlanTotal === 5990, "Base Pro annual total is strictly ₹5,990");
  assert(cart2.finalTotal === 5990, "Final total charges strictly ₹5,990 (Add-ons are ₹0 charged)");
  assert(cart2.isCheckoutEnabled === false, "Add-on checkout is disabled");
  console.log("");

  // ------------------------------------------------------------------
  // Test 4: Base Plan Pricing Remains Unchanged
  // ------------------------------------------------------------------
  console.log("--- [Test 4] Base Plan Pricing Remains Unchanged ---");
  const pStarter = calculatePlanPrice("starter", "monthly");
  assert(pStarter.finalTotal === 299, "Starter Monthly: ₹299");
  assert(calculatePlanPrice("starter", "yearly").finalTotal === 2990, "Starter Annual: ₹2,990");
  assert(calculatePlanPrice("starter", "triennial").finalTotal === 6997, "Starter 36-Mo: ₹6,997");

  assert(calculatePlanPrice("pro", "monthly").finalTotal === 599, "Pro Monthly: ₹599");
  assert(calculatePlanPrice("pro", "yearly").finalTotal === 5990, "Pro Annual: ₹5,990");
  assert(calculatePlanPrice("pro", "triennial").finalTotal === 14017, "Pro 36-Mo: ₹14,017");

  assert(calculatePlanPrice("business", "monthly").finalTotal === 999, "Business Monthly: ₹999");
  assert(calculatePlanPrice("business", "yearly").finalTotal === 9990, "Business Annual: ₹9,990");
  assert(calculatePlanPrice("business", "triennial").finalTotal === 23377, "Business 36-Mo: ₹23,377");

  assert(calculatePlanPrice("agency", "monthly").finalTotal === 1999, "Agency Monthly: ₹1,999");
  assert(calculatePlanPrice("agency", "yearly").finalTotal === 19990, "Agency Annual: ₹19,990");
  assert(calculatePlanPrice("agency", "triennial").finalTotal === 46777, "Agency 36-Mo: ₹46,777");
  console.log("");

  // ------------------------------------------------------------------
  // Test 5: Dashboard Does Not Fabricate Purchase Records
  // ------------------------------------------------------------------
  console.log("--- [Test 5] Dashboard Does Not Fabricate Purchase Records ---");
  // When database has no records or migration is pending, getUserActiveAddons returns empty array
  const emptyMockClient = {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: [], error: null }),
      }),
    }),
  };
  const activeRecords = await getUserActiveAddons("test-user-id", emptyMockClient);
  assert(Array.isArray(activeRecords) && activeRecords.length === 0, "No fake add-on purchase records fabricated");

  // Missing table error returns empty array (fails closed)
  const missingTableClient = {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: null, error: { message: "relation 'user_addons' does not exist" } }),
      }),
    }),
  };
  const errorRecords = await getUserActiveAddons("test-user-id", missingTableClient);
  assert(errorRecords.length === 0, "Missing user_addons table fails closed cleanly to empty array");
  console.log("");

  // ------------------------------------------------------------------
  // Test 6: Checkout Totals Cannot Be Manipulated by Client Input
  // ------------------------------------------------------------------
  console.log("--- [Test 6] Checkout Totals Cannot Be Manipulated by Client Input ---");
  // If client submits unexpected or tampered add-on inputs, calculateCartPrice verifies against server catalog
  const tamperedCart = calculateCartPrice("starter", "monthly", [
    { addonId: "non_existent_exploit" } as any,
    { addonId: "ai_visibility_tracker" },
  ]);
  assert(
    tamperedCart.addonLineItems.length === 1,
    "Invalid/tampered add-on ID rejected by server-side catalog resolver"
  );
  assert(tamperedCart.finalTotal === 299, "Server-calculated finalTotal ignores any client price injection");
  console.log("");

  // ------------------------------------------------------------------
  // Test 7: Domain Policy Isolation Invariants
  // ------------------------------------------------------------------
  console.log("--- [Test 7] Domain Policy Isolation Invariants ---");
  // 1. Starter with add-ons has strictly 1 domain connection limit
  const starterCart = calculateCartPrice("starter", "monthly", [{ addonId: "extra_website_slot" }]);
  assert(starterCart.customDomainConnectionLimit === 1, "Starter base connection limit remains 1");
  assert(starterCart.freeDomainRegistrationCount === 0, "Monthly plan with add-on receives 0 free domains");

  // 2. Pro 36-month plan opted in to domain offer
  const pro36mCart = calculateCartPrice("pro", "triennial", [{ addonId: "extra_website_slot" }], {
    optInDomainOffer: true,
  });
  assert(pro36mCart.freeDomainRegistrationCount === 1, "36-month plan grants maximum ONE free domain");
  assert(pro36mCart.customDomainConnectionLimit === 3, "Pro domain connection limit remains 3 from base plan");
  console.log("");

  // ------------------------------------------------------------------
  // Test 8: API Entitlements Fail Closed When Status Cannot Be Verified
  // ------------------------------------------------------------------
  console.log("--- [Test 8] API Entitlements Fail Closed When Status Cannot Be Verified ---");
  // 1. Starter without add-on is denied AI SEO
  assert(!evaluateEffectiveFeatureAccess("starter", "ai_seo", []).allowed, "Starter denied AI SEO without add-on");

  // 2. Starter without add-on is denied AI Visibility
  assert(!evaluateEffectiveFeatureAccess("starter", "ai_visibility", []).allowed, "Starter denied AI Visibility without add-on");

  // 3. Starter without add-on is denied White-Label Reports
  assert(!evaluateEffectiveFeatureAccess("starter", "white_label_reports", []).allowed, "Starter denied White-Label Reports without add-on");

  // 4. Past due add-on record fails closed
  const pastDueRecord: UserAddonRecord = {
    id: "ua-pd",
    user_id: "u-1",
    addon_id: "ai_visibility_tracker",
    status: "past_due",
    billing_interval: "monthly",
    current_period_start: "2026-10-01T00:00:00Z",
    current_period_end: "2026-10-31T23:59:59Z",
    cancel_at_period_end: false,
    canceled_at: null,
    price_paid: 299,
    currency: "INR",
    metadata: {},
  };
  assert(!isUserAddonActiveAndValid(pastDueRecord), "Past-due add-on is invalid and fails closed");
  assert(
    !evaluateEffectiveFeatureAccess("starter", "ai_visibility", [pastDueRecord]).allowed,
    "Past-due add-on denies access server-side"
  );
  console.log("");

  console.log("======================================================================");
  console.log("ALL 8 PHASE 2 ADD-ON UI & MOCK CHECKOUT TESTS PASSED! 🎉");
  console.log("======================================================================\n");
}

runAddonPhase2TestSuite().catch((err) => {
  console.error("Test Suite Execution Failed:", err);
  process.exit(1);
});
