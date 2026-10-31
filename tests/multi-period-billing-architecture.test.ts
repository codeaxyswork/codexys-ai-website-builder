import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  calculatePlanPrice,
  calculatePeriodEndDate,
  normalizeBillingInterval,
  isCreditReplenishmentDue,
  BILLING_INTERVALS,
  APPROVED_DOMAIN_OFFER_POLICY,
} from "../lib/billing-periods";
import { isSubscriptionActiveAndValid, getUserUsage } from "../lib/billing";
import { checkWebsitePublicVisibility, resetMonthlyAllowanceWithoutRollover } from "../lib/lifecycle/website-lifecycle-engine";
import { PLANS } from "../lib/constants";

/**
 * ============================================================================
 * CODEAXYS PHASE 2: MULTI-PERIOD BILLING ARCHITECTURE TEST SUITE
 * ============================================================================
 * Scenarios:
 * 1. Approved pricing calculations across all 4 plans × 3 billing periods (12 matrices)
 * 2. Effective monthly prices, gross totals, and savings verification
 * 3. Exact term date boundary calculations (30 days, 12 months, 36 months)
 * 4. Active paid subscription validation across multi-year timeline
 * 5. Expired multi-period subscription fail-closed enforcement
 * 6. Website public visibility and suspension gates for multi-period subscriptions
 * 7. Initial credit allocation invariant (never grant all future months upfront)
 * 8. 30-day periodic credit replenishment triggers and boundary checks
 * 9. Strict no-rollover policy on periodic credit replenishment
 * 10. Backward compatibility with legacy subscriptions without interval fields
 * 11. Database migration file syntax and schema validation
 * ============================================================================
 */

async function runTests() {
  console.log("======================================================================");
  console.log("CODEAXYS STEP 8: PHASE 2 MULTI-PERIOD BILLING VERIFICATION SUITE");
  console.log("======================================================================\n");

  let total = 0;
  let passed = 0;

  function runCase(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            passed++;
            console.log(`  [PASS] Test ${total}: ${name}`);
          })
          .catch((err) => {
            console.error(`  [FAIL] Test ${total}: ${name}`);
            console.error("        Error:", err?.message || err);
            throw err;
          });
      }
      passed++;
      console.log(`  [PASS] Test ${total}: ${name}`);
    } catch (err: any) {
      console.error(`  [FAIL] Test ${total}: ${name}`);
      console.error("        Error:", err?.message || err);
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: Starter Plan Pricing Matrix (Monthly, Annual, 36 Months)
  // -------------------------------------------------------------------------
  runCase("Starter plan pricing matches approved values: ₹299, ₹2,990, ₹6,997", () => {
    const monthly = calculatePlanPrice("starter", "monthly");
    assert.strictEqual(monthly.finalTotal, 299, "Starter monthly must be ₹299");
    assert.strictEqual(monthly.durationMonths, 1, "Starter monthly duration must be 1 month");
    assert.strictEqual(monthly.discountPercent, 0, "Starter monthly discount must be 0%");

    const annual = calculatePlanPrice("starter", "yearly");
    assert.strictEqual(annual.finalTotal, 2990, "Starter annual must be ₹2,990 (10 months billed)");
    assert.strictEqual(annual.durationMonths, 12, "Starter annual duration must be 12 months");
    assert.strictEqual(annual.discountAmount, 598, "Starter annual savings must be ₹598");

    const triennial = calculatePlanPrice("starter", "triennial");
    assert.strictEqual(triennial.finalTotal, 6997, "Starter 36-month must be ₹6,997 (35% off)");
    assert.strictEqual(triennial.durationMonths, 36, "Starter 36-month duration must be 36 months");
    assert.strictEqual(triennial.discountPercent, 35.0, "Starter 36-month discount must be 35%");
    assert.strictEqual(triennial.discountAmount, 3767, "Starter 36-month savings must be ₹3,767");
  });

  // -------------------------------------------------------------------------
  // TEST 2: Pro Plan Pricing Matrix (Monthly, Annual, 36 Months)
  // -------------------------------------------------------------------------
  runCase("Pro plan pricing matches approved values: ₹599, ₹5,990, ₹14,017", () => {
    const monthly = calculatePlanPrice("pro", "monthly");
    assert.strictEqual(monthly.finalTotal, 599, "Pro monthly must be ₹599");

    const annual = calculatePlanPrice("pro", "yearly");
    assert.strictEqual(annual.finalTotal, 5990, "Pro annual must be ₹5,990 (10 months billed)");
    assert.strictEqual(annual.discountAmount, 1198, "Pro annual savings must be ₹1,198");

    const triennial = calculatePlanPrice("pro", "triennial");
    assert.strictEqual(triennial.finalTotal, 14017, "Pro 36-month must be ₹14,017 (35% off)");
    assert.strictEqual(triennial.discountAmount, 7547, "Pro 36-month savings must be ₹7,547");
  });

  // -------------------------------------------------------------------------
  // TEST 3: Business Plan Pricing Matrix (Monthly, Annual, 36 Months)
  // -------------------------------------------------------------------------
  runCase("Business plan pricing matches approved values: ₹999, ₹9,990, ₹23,377", () => {
    const monthly = calculatePlanPrice("business", "monthly");
    assert.strictEqual(monthly.finalTotal, 999, "Business monthly must be ₹999");

    const annual = calculatePlanPrice("business", "yearly");
    assert.strictEqual(annual.finalTotal, 9990, "Business annual must be ₹9,990 (10 months billed)");
    assert.strictEqual(annual.discountAmount, 1998, "Business annual savings must be ₹1,998");

    const triennial = calculatePlanPrice("business", "triennial");
    assert.strictEqual(triennial.finalTotal, 23377, "Business 36-month must be ₹23,377 (35% off)");
    assert.strictEqual(triennial.discountAmount, 12587, "Business 36-month savings must be ₹12,587");
  });

  // -------------------------------------------------------------------------
  // TEST 4: Agency Plan Pricing Matrix (Monthly, Annual, 36 Months)
  // -------------------------------------------------------------------------
  runCase("Agency plan pricing matches approved values: ₹1,999, ₹19,990, ₹46,777", () => {
    const monthly = calculatePlanPrice("agency", "monthly");
    assert.strictEqual(monthly.finalTotal, 1999, "Agency monthly must be ₹1,999");

    const annual = calculatePlanPrice("agency", "yearly");
    assert.strictEqual(annual.finalTotal, 19990, "Agency annual must be ₹19,990 (10 months billed)");
    assert.strictEqual(annual.discountAmount, 3998, "Agency annual savings must be ₹3,998");

    const triennial = calculatePlanPrice("agency", "triennial");
    assert.strictEqual(triennial.finalTotal, 46777, "Agency 36-month must be ₹46,777 (35% off)");
    assert.strictEqual(triennial.discountAmount, 25187, "Agency 36-month savings must be ₹25,187");
  });

  // -------------------------------------------------------------------------
  // TEST 5: Effective Monthly Rate Calculations
  // -------------------------------------------------------------------------
  runCase("Effective monthly rates accurately reflect term savings", () => {
    const sYearly = calculatePlanPrice("starter", "yearly");
    assert.strictEqual(sYearly.effectiveMonthlyPrice, 249.17, "Starter annual effective rate is ₹249.17/mo");

    const sTriennial = calculatePlanPrice("starter", "triennial");
    assert.strictEqual(sTriennial.effectiveMonthlyPrice, 194.36, "Starter 36-mo effective rate is ₹194.36/mo");

    const pTriennial = calculatePlanPrice("pro", "triennial");
    assert.strictEqual(pTriennial.effectiveMonthlyPrice, 389.36, "Pro 36-mo effective rate is ₹389.36/mo");

    const bTriennial = calculatePlanPrice("business", "triennial");
    assert.strictEqual(bTriennial.effectiveMonthlyPrice, 649.36, "Business 36-mo effective rate is ₹649.36/mo");

    const aTriennial = calculatePlanPrice("agency", "triennial");
    assert.strictEqual(aTriennial.effectiveMonthlyPrice, 1299.36, "Agency 36-mo effective rate is ₹1,299.36/mo");
  });

  // -------------------------------------------------------------------------
  // TEST 6: Date Boundaries & Duration Calculation
  // -------------------------------------------------------------------------
  runCase("calculatePeriodEndDate correctly computes future boundaries", () => {
    const start = new Date("2026-01-01T00:00:00Z");

    const monthlyEnd = calculatePeriodEndDate(start, "monthly");
    const monthlyDays = (monthlyEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    assert.strictEqual(monthlyDays, 30, "Monthly period end must be 30 days");

    const yearlyEnd = calculatePeriodEndDate(start, "yearly");
    assert.strictEqual(yearlyEnd.toISOString(), "2027-01-01T00:00:00.000Z", "Yearly period end is +1 calendar year");

    const triennialEnd = calculatePeriodEndDate(start, "triennial");
    assert.strictEqual(triennialEnd.toISOString(), "2029-01-01T00:00:00.000Z", "Triennial period end is +3 calendar years");
  });

  // -------------------------------------------------------------------------
  // TEST 7: Multi-Year Active Subscription Validation (isSubscriptionActiveAndValid)
  // -------------------------------------------------------------------------
  runCase("Annual and 36-month subscriptions maintain active entitlement throughout term", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const triennialEnd = calculatePeriodEndDate(start, "triennial"); // 2029-01-01

    const sub36 = {
      plan_id: "pro",
      status: "active",
      billing_interval: "triennial",
      duration_months: 36,
      current_period_start: start.toISOString(),
      current_period_end: triennialEnd.toISOString(),
    };

    // Month 6 (2026-07-01) -> ACTIVE
    assert.strictEqual(isSubscriptionActiveAndValid(sub36, new Date("2026-07-01T00:00:00Z")), true);

    // Month 24 (2028-01-01) -> ACTIVE
    assert.strictEqual(isSubscriptionActiveAndValid(sub36, new Date("2028-01-01T00:00:00Z")), true);

    // Month 35 (2028-12-01) -> ACTIVE
    assert.strictEqual(isSubscriptionActiveAndValid(sub36, new Date("2028-12-01T00:00:00Z")), true);

    // Month 37 (2029-01-02) -> EXPIRED (Fails closed)
    assert.strictEqual(isSubscriptionActiveAndValid(sub36, new Date("2029-01-02T00:00:00Z")), false);
  });

  // -------------------------------------------------------------------------
  // TEST 8: Website Public Visibility Throughout 36-Month Term
  // -------------------------------------------------------------------------
  await runCase("Website visibility remains publicly live during 36-month term and suspends upon expiry", async () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const triennialEnd = calculatePeriodEndDate(start, "triennial");

    const mockSub = {
      plan_id: "starter",
      status: "active",
      billing_interval: "triennial",
      duration_months: 36,
      current_period_start: start.toISOString(),
      current_period_end: triennialEnd.toISOString(),
    };

    const mockDb = {
      from: (tbl: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: mockSub, error: null }),
          }),
        }),
      }),
    };

    const website = {
      id: "site-36mo",
      user_id: "user-36mo",
      is_published: true,
      created_at: start.toISOString(),
    };

    // Day 500 (in middle of 36 months) -> Publicly visible
    const checkMidTerm = await checkWebsitePublicVisibility(
      website,
      mockDb,
      new Date("2027-06-01T00:00:00Z")
    );
    assert.strictEqual(checkMidTerm.isPubliclyVisible, true, "Site must be live mid-term of 36 months");
    assert.strictEqual(checkMidTerm.status, "active_paid");

    // Month 37 (after expiry) -> Suspended from public
    const checkExpired = await checkWebsitePublicVisibility(
      website,
      mockDb,
      new Date("2029-01-05T00:00:00Z")
    );
    assert.strictEqual(checkExpired.isPubliclyVisible, false, "Site must suspend after 36 months expires");
    assert.strictEqual(checkExpired.status, "trial_expired_suspended");
  });

  // -------------------------------------------------------------------------
  // TEST 9: Invariant: Never Grant All Future Months' Credits Upfront
  // -------------------------------------------------------------------------
  runCase("Multi-period plans initialize credits strictly to single-month allowance", () => {
    // Starter 36-month: allowance is 100 credits, NOT 3,600
    const sCalc = calculatePlanPrice("starter", "triennial");
    assert.strictEqual(sCalc.monthlyCredits, 100, "Starter 36-month allowance is strictly 100 credits/mo");

    // Pro Annual: allowance is 200 credits, NOT 2,400
    const pCalc = calculatePlanPrice("pro", "yearly");
    assert.strictEqual(pCalc.monthlyCredits, 200, "Pro annual allowance is strictly 200 credits/mo");

    // Business 36-month: allowance is 400 credits, NOT 14,400
    const bCalc = calculatePlanPrice("business", "triennial");
    assert.strictEqual(bCalc.monthlyCredits, 400, "Business 36-month allowance is strictly 400 credits/mo");

    // Agency 36-month: allowance is 800 credits, NOT 28,800
    const aCalc = calculatePlanPrice("agency", "triennial");
    assert.strictEqual(aCalc.monthlyCredits, 800, "Agency 36-month allowance is strictly 800 credits/mo");
  });

  // -------------------------------------------------------------------------
  // TEST 10: 30-Day Periodic Credit Replenishment Triggers (isCreditReplenishmentDue)
  // -------------------------------------------------------------------------
  runCase("isCreditReplenishmentDue triggers every 30 days and ignores fresh or expired subscriptions", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2027-01-01T00:00:00Z"); // 1 year active

    const sub = {
      status: "active",
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
      last_credit_refreshed_at: start.toISOString(),
    };

    // Day 5: Not due
    assert.strictEqual(isCreditReplenishmentDue(sub, new Date("2026-01-06T00:00:00Z")), false);

    // Day 29: Not due
    assert.strictEqual(isCreditReplenishmentDue(sub, new Date("2026-01-30T00:00:00Z")), false);

    // Day 30: DUE!
    assert.strictEqual(isCreditReplenishmentDue(sub, new Date("2026-01-31T00:00:00Z")), true);

    // Day 45: DUE!
    assert.strictEqual(isCreditReplenishmentDue(sub, new Date("2026-02-15T00:00:00Z")), true);

    // Expired subscription (2027-02-01): NOT due (must not replenish credits on expired term)
    assert.strictEqual(isCreditReplenishmentDue(sub, new Date("2027-02-01T00:00:00Z")), false);
  });

  // -------------------------------------------------------------------------
  // TEST 11: Strict No-Rollover Policy on Replenishment
  // -------------------------------------------------------------------------
  await runCase("Credit replenishment overwrites existing balance to plan allowance without rollover", async () => {
    let savedBalance = -1;

    const mockDb = {
      from: (tbl: string) => ({
        upsert: async (payload: any) => {
          if (tbl === "user_credits") {
            savedBalance = payload.balance;
          }
          return { error: null };
        },
        insert: async () => ({ error: null }),
        update: () => ({ eq: async () => ({ error: null }) }),
      }),
    };

    // Replenish user on Starter plan (allowance: 100) who currently had 45 credits unused
    const res = await resetMonthlyAllowanceWithoutRollover("user-test", "starter", mockDb);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.newBalance, 100, "Replenished balance must reset strictly to 100");
    assert.strictEqual(savedBalance, 100, "No rollover: 45 leftover credits were not added to 100");
  });

  // -------------------------------------------------------------------------
  // TEST 12: Backward Compatibility with Legacy Monthly Subscriptions
  // -------------------------------------------------------------------------
  runCase("Legacy subscriptions without billing_interval default safely to monthly", () => {
    const legacySub = {
      plan_id: "pro",
      status: "active",
      current_period_end: new Date(Date.now() + 15 * 86400 * 1000).toISOString(),
    };

    assert.strictEqual(isSubscriptionActiveAndValid(legacySub), true, "Legacy monthly subscription is active");
    assert.strictEqual(normalizeBillingInterval(undefined), "monthly", "Undefined interval normalizes to monthly");
    assert.strictEqual(normalizeBillingInterval("annual"), "yearly", "annual normalizes to yearly");
    assert.strictEqual(normalizeBillingInterval("36_months"), "triennial", "36_months normalizes to triennial");
  });

  // -------------------------------------------------------------------------
  // TEST 13: Database Migration File Invariants
  // -------------------------------------------------------------------------
  runCase("Migration 20261014_multi_period_billing_architecture.sql exists and enforces constraints", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../supabase/migrations/20261014_multi_period_billing_architecture.sql"
    );
    assert(fs.existsSync(migrationPath), "Migration file must exist");

    const sql = fs.readFileSync(migrationPath, "utf-8");
    assert(sql.includes("billing_interval"), "Migration must add billing_interval column");
    assert(sql.includes("duration_months"), "Migration must add duration_months column");
    assert(sql.includes("discount_percent"), "Migration must add discount_percent column");
    assert(sql.includes("last_credit_refreshed_at"), "Migration must add last_credit_refreshed_at column");
    assert(sql.includes("CHECK (duration_months IN (1, 12, 36))"), "Migration must enforce 1, 12, 36 duration check");
  });

  // -------------------------------------------------------------------------
  // TEST 14: Approved 36-Month Domain Offer: Max 1 Free Domain Across ALL Plans
  // -------------------------------------------------------------------------
  runCase("Every paid plan receives a maximum of ONE free domain under qualifying 36-month offer", () => {
    const plans = ["starter", "pro", "business", "agency"] as const;

    for (const planId of plans) {
      const calc = calculatePlanPrice(planId, "triennial", { optInDomainOffer: true });

      assert.strictEqual(
        calc.qualifiesForDomainOffer,
        true,
        `${planId} 36-month subscription must qualify for domain offer`
      );
      assert.strictEqual(
        calc.freeDomainRegistrationCount,
        1,
        `${planId} 36-month subscription must receive strictly 1 free domain registration (not more)`
      );
      assert.strictEqual(
        calc.domainOfferDetails.maxFreeDomains,
        1,
        `${planId} maxFreeDomains policy must be 1`
      );
      assert.strictEqual(
        calc.domainOfferDetails.freeYears,
        1,
        "First-year registration must be free"
      );
    }

    // Explicitly verify Agency (15 websites) does NOT receive 15 free domains
    const agencyCalc = calculatePlanPrice("agency", "triennial", { optInDomainOffer: true });
    assert.strictEqual(agencyCalc.maxWebsites, 15, "Agency has 15 website slots");
    assert.strictEqual(
      agencyCalc.freeDomainRegistrationCount,
      1,
      "Agency must receive MAXIMUM 1 free domain registration under the 36-month offer, NOT 15"
    );

    // Explicitly verify Business (6 websites) does NOT receive 6 free domains
    const bizCalc = calculatePlanPrice("business", "triennial", { optInDomainOffer: true });
    assert.strictEqual(bizCalc.maxWebsites, 6, "Business has 6 website slots");
    assert.strictEqual(
      bizCalc.freeDomainRegistrationCount,
      1,
      "Business must receive MAXIMUM 1 free domain registration under the 36-month offer, NOT 6"
    );

    // Explicitly verify Pro (3 websites) does NOT receive 3 free domains
    const proCalc = calculatePlanPrice("pro", "triennial", { optInDomainOffer: true });
    assert.strictEqual(proCalc.maxWebsites, 3, "Pro has 3 website slots");
    assert.strictEqual(
      proCalc.freeDomainRegistrationCount,
      1,
      "Pro must receive MAXIMUM 1 free domain registration under the 36-month offer, NOT 3"
    );
  });

  // -------------------------------------------------------------------------
  // TEST 15: Customers Who Decline Domain Offer Pay Strictly Software Amount
  // -------------------------------------------------------------------------
  runCase("Customers who decline domain offer receive 0 free domains and pay strictly software subscription amount", () => {
    const expectations = [
      { planId: "starter", expectedTotal: 6997 },
      { planId: "pro", expectedTotal: 14017 },
      { planId: "business", expectedTotal: 23377 },
      { planId: "agency", expectedTotal: 46777 },
    ];

    for (const { planId, expectedTotal } of expectations) {
      // Explicitly declining domain offer
      const declinedCalc = calculatePlanPrice(planId, "triennial", { optInDomainOffer: false });
      assert.strictEqual(
        declinedCalc.freeDomainRegistrationCount,
        0,
        `${planId} subscriber who declines domain offer receives 0 free domains`
      );
      assert.strictEqual(
        declinedCalc.finalTotal,
        expectedTotal,
        `${planId} subscriber who declines domain offer pays strictly software total ₹${expectedTotal}`
      );

      // Defaulting without opt-in option provided
      const defaultCalc = calculatePlanPrice(planId, "triennial");
      assert.strictEqual(
        defaultCalc.freeDomainRegistrationCount,
        0,
        `${planId} default calculation grants 0 free domains unless explicitly opted in`
      );
      assert.strictEqual(
        defaultCalc.finalTotal,
        expectedTotal,
        `${planId} default calculation total matches software total ₹${expectedTotal}`
      );
    }
  });

  // -------------------------------------------------------------------------
  // TEST 16: Monthly and Annual Plans Do Not Qualify for Domain Offer
  // -------------------------------------------------------------------------
  runCase("Monthly and Annual plans do not qualify for free domain registration offer", () => {
    const plans = ["starter", "pro", "business", "agency"] as const;

    for (const planId of plans) {
      // Attempting to opt-in on monthly
      const monthlyCalc = calculatePlanPrice(planId, "monthly", { optInDomainOffer: true });
      assert.strictEqual(monthlyCalc.qualifiesForDomainOffer, false, `${planId} monthly cannot qualify for domain offer`);
      assert.strictEqual(monthlyCalc.freeDomainRegistrationCount, 0, `${planId} monthly receives 0 free domains`);

      // Attempting to opt-in on annual
      const yearlyCalc = calculatePlanPrice(planId, "yearly", { optInDomainOffer: true });
      assert.strictEqual(yearlyCalc.qualifiesForDomainOffer, false, `${planId} yearly cannot qualify for domain offer`);
      assert.strictEqual(yearlyCalc.freeDomainRegistrationCount, 0, `${planId} yearly receives 0 free domains`);
    }
  });

  // -------------------------------------------------------------------------
  // TEST 17: Separation of Website Connections vs Domain Registrations
  // -------------------------------------------------------------------------
  runCase("Customer-owned domain connection allowance remains strictly separate from domain registration offer", () => {
    const starter = calculatePlanPrice("starter", "monthly");
    assert.strictEqual(starter.customDomainConnectionLimit, 1, "Starter allows 1 custom domain connection");

    const pro = calculatePlanPrice("pro", "monthly");
    assert.strictEqual(pro.customDomainConnectionLimit, 3, "Pro allows 3 custom domain connections");

    const business = calculatePlanPrice("business", "monthly");
    assert.strictEqual(business.customDomainConnectionLimit, 6, "Business allows 6 custom domain connections");

    const agency = calculatePlanPrice("agency", "monthly");
    assert.strictEqual(agency.customDomainConnectionLimit, 15, "Agency allows 15 custom domain connections");

    const free = calculatePlanPrice("free", "monthly");
    assert.strictEqual(free.customDomainConnectionLimit, 0, "Free plan has 0 custom domain connections (subdomains only)");
  });

  // -------------------------------------------------------------------------
  // TEST 18: Pricing Page & Checkout Modal Copy Verification
  // -------------------------------------------------------------------------
  runCase("Pricing page copy cleanly separates subdomain hosting, domain connections, and 36-mo domain offer", () => {
    const pricingPath = path.resolve(__dirname, "../app/pricing/page.tsx");
    const content = fs.readFileSync(pricingPath, "utf-8");

    // Must NOT claim Agency gets 15 free domains or Pro gets 3 free domains
    assert(!content.includes("15 Free Domains"), "Pricing page must not advertise 15 Free Domains");
    assert(!content.includes("6 Free Domains"), "Pricing page must not advertise 6 Free Domains");
    assert(!content.includes("3 Free Domains"), "Pricing page must not advertise 3 Free Domains");

    // Must verify the approved 1 Free Domain · First Year Free* label
    assert(
      content.includes("1 Free Domain · First Year Free*"),
      "Pricing page must display 1 Free Domain · First Year Free* on 36-month offer"
    );

    // Must not have Domain Connections row in pricing cards
    assert(
      !content.includes('<span className="font-semibold text-slate-600">Domain Connections</span>'),
      "Pricing page cards must not have Domain Connections rows"
    );

    // Must state that multiple websites do not grant multiple free domain registrations
    assert(
      content.includes("multiple websites do not grant multiple free domain registrations"),
      "Pricing page must state that multiple websites do not grant multiple free domain registrations"
    );

    // Must disclose that Years 2 and 3 renewal fees apply
    assert(
      content.includes("Standard registry renewal fees apply for Years 2 and 3"),
      "Pricing page must disclose Year 2 and Year 3 renewal fees"
    );
  });

  console.log("\n======================================================================");
  console.log(`ALL ${passed}/${total} PHASE 2 MULTI-PERIOD BILLING TESTS PASSED!`);
  console.log("======================================================================\n");
}

runTests().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
