import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  PLAN_PERMISSIONS,
  canUseFeature,
  isAdvancedSeoPlan,
  isAgencyPlan,
} from "../lib/features";
import { PLANS } from "../lib/constants";
import {
  resolveSubscriptionPlan,
  isSubscriptionActiveAndValid,
  getUserUsage,
  checkAdvancedSeoEntitlement,
  DEFAULT_FREE_PLAN,
} from "../lib/billing";

/**
 * ============================================================================
 * CODEAXYS PHASE 1: PRICING, PERMISSIONS & SEO ENTITLEMENT REGRESSION SUITE
 * ============================================================================
 * Scenarios:
 * 1. Plan permissions catalog (Starter & Business explicit configuration)
 * 2. Feature gating: Basic SEO universal, AI SEO Pro+, Integrations Agency-only
 * 3. PLANS static catalog: Starter 1 custom domain and SEO tiering representation
 * 4. Subscription resolution: Starter active vs expired custom domain permissions
 * 5. Advanced SEO server-side check (checkAdvancedSeoEntitlement) across all 5 tiers
 * 6. Business plan (₹999) entitlement validation (ai_seo, schema, analytics)
 * 7. Expired paid subscription fail-closed security enforcement
 * 8. Pricing page copy invariants (No false custom domain or SEO claims)
 * ============================================================================
 */

function createMockSupabaseWithSub(sub: any) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: "test-user-123", email: "test@codeaxys.com" } },
        error: null,
      }),
    },
    from: (table: string) => {
      let currentQuery: any = { table };
      const chain = {
        select: (fields?: string, options?: any) => chain,
        eq: (col: string, val: any) => chain,
        neq: (col: string, val: any) => chain,
        gte: (col: string, val: any) => chain,
        order: (col: string, opts?: any) => chain,
        limit: (n: number) => chain,
        maybeSingle: async () => {
          if (table === "subscriptions") {
            return { data: sub, error: null };
          }
          if (table === "user_credits") {
            return { data: { balance: 100, monthly_used: 0, lifetime_used: 0 }, error: null };
          }
          return { data: null, error: null };
        },
        single: async () => {
          if (table === "subscriptions") {
            return { data: sub, error: null };
          }
          if (table === "user_credits") {
            return { data: { balance: 100, monthly_used: 0, lifetime_used: 0 }, error: null };
          }
          return { data: null, error: null };
        },
        count: 0,
      };
      return chain;
    },
    rpc: async () => ({ data: true, error: null }),
  };
}

async function runTests() {
  console.log("======================================================================");
  console.log("CODEAXYS STEP 7: PHASE 1 FIXES & ENTITLEMENT VERIFICATION");
  console.log("======================================================================\n");

  let passed = 0;
  let total = 0;

  function runCase(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            console.log(`  [PASS] Test ${total}: ${name}`);
            passed++;
          })
          .catch((err) => {
            console.error(`  [FAIL] Test ${total}: ${name}`);
            console.error("        Error:", err?.message || err);
            throw err;
          });
      } else {
        console.log(`  [PASS] Test ${total}: ${name}`);
        passed++;
      }
    } catch (err: any) {
      console.error(`  [FAIL] Test ${total}: ${name}`);
      console.error("        Error:", err?.message || err);
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: PLAN_PERMISSIONS has explicit entries for all 5 tiers
  // -------------------------------------------------------------------------
  runCase("PLAN_PERMISSIONS defines all 5 plans explicitly", () => {
    const definedPlans = Object.keys(PLAN_PERMISSIONS);
    assert(definedPlans.includes("free"), "free plan must be defined");
    assert(definedPlans.includes("starter"), "starter plan must be defined");
    assert(definedPlans.includes("pro"), "pro plan must be defined");
    assert(definedPlans.includes("business"), "business plan must be defined");
    assert(definedPlans.includes("agency"), "agency plan must be defined");
  });

  // -------------------------------------------------------------------------
  // TEST 2: Basic SEO is universally granted to ALL plans
  // -------------------------------------------------------------------------
  runCase("Basic SEO is included in Free, Starter, Pro, Business, and Agency", () => {
    const tiers = ["free", "starter", "pro", "business", "agency"];
    for (const tier of tiers) {
      assert.strictEqual(
        canUseFeature(tier, "basic_seo"),
        true,
        `Tier '${tier}' must include basic_seo`
      );
    }
  });

  // -------------------------------------------------------------------------
  // TEST 3: Business plan (₹999) receives promised features
  // -------------------------------------------------------------------------
  runCase("Business plan receives ai_seo, advanced_schema, analytics, but not advanced_integrations", () => {
    assert.strictEqual(canUseFeature("business", "basic_seo"), true, "Business has basic_seo");
    assert.strictEqual(canUseFeature("business", "ai_seo"), true, "Business has ai_seo");
    assert.strictEqual(canUseFeature("business", "advanced_schema"), true, "Business has advanced_schema");
    assert.strictEqual(canUseFeature("business", "analytics"), true, "Business has analytics");
    assert.strictEqual(
      canUseFeature("business", "advanced_integrations"),
      false,
      "Business does NOT have advanced_integrations (Agency-only)"
    );
    assert.strictEqual(isAdvancedSeoPlan("business"), true, "Business is recognized as Advanced SEO plan");
    assert.strictEqual(isAgencyPlan("business"), false, "Business is not an Agency plan");
  });

  // -------------------------------------------------------------------------
  // TEST 4: Advanced Integrations remain strictly Agency-only
  // -------------------------------------------------------------------------
  runCase("Advanced integrations are strictly restricted to Agency plan", () => {
    assert.strictEqual(canUseFeature("free", "advanced_integrations"), false);
    assert.strictEqual(canUseFeature("starter", "advanced_integrations"), false);
    assert.strictEqual(canUseFeature("pro", "advanced_integrations"), false);
    assert.strictEqual(canUseFeature("business", "advanced_integrations"), false);
    assert.strictEqual(canUseFeature("agency", "advanced_integrations"), true);
  });

  // -------------------------------------------------------------------------
  // TEST 5: Starter plan permissions in lib/features.ts
  // -------------------------------------------------------------------------
  runCase("Starter plan has basic_seo only and is blocked from advanced SEO/schema/integrations", () => {
    assert.strictEqual(canUseFeature("starter", "basic_seo"), true);
    assert.strictEqual(canUseFeature("starter", "ai_seo"), false);
    assert.strictEqual(canUseFeature("starter", "advanced_schema"), false);
    assert.strictEqual(canUseFeature("starter", "analytics"), false);
    assert.strictEqual(canUseFeature("starter", "advanced_integrations"), false);
    assert.strictEqual(isAdvancedSeoPlan("starter"), false);
  });

  // -------------------------------------------------------------------------
  // TEST 6: Case insensitivity and whitespace handling in feature checks
  // -------------------------------------------------------------------------
  runCase("canUseFeature normalizes planId strings cleanly", () => {
    assert.strictEqual(canUseFeature("  BUSINESS  ", "ai_seo"), true);
    assert.strictEqual(canUseFeature("STARTER", "basic_seo"), true);
    assert.strictEqual(canUseFeature("Starter", "ai_seo"), false);
    assert.strictEqual(canUseFeature("PRO", "ai_seo"), true);
    assert.strictEqual(canUseFeature("AGENCY", "advanced_integrations"), true);
    assert.strictEqual(canUseFeature(null, "basic_seo"), true); // Fallback to free
    assert.strictEqual(canUseFeature(undefined, "ai_seo"), false);
  });

  // -------------------------------------------------------------------------
  // TEST 7: PLANS Catalog accurately specifies Starter 1 Custom Domain & Quotas
  // -------------------------------------------------------------------------
  runCase("PLANS catalog in lib/constants.ts accurately models Starter and higher tiers", () => {
    const starter = PLANS.starter;
    assert.strictEqual(starter.price, 299, "Starter price is ₹299");
    assert.strictEqual(starter.maxWebsites, 1, "Starter max websites is 1");
    assert.strictEqual(starter.monthlyCredits, 100, "Starter credits is 100");
    assert(
      starter.features.some((f) => f.includes("1 Custom Domain")),
      "Starter features must list 1 Custom Domain"
    );
    assert(
      starter.features.some((f) => f.includes("Basic SEO")),
      "Starter features must list Basic SEO"
    );

    const pro = PLANS.pro;
    assert.strictEqual(pro.price, 599, "Pro price is ₹599");
    assert.strictEqual(pro.maxWebsites, 3, "Pro max websites is 3");
    assert.strictEqual(pro.monthlyCredits, 200, "Pro credits is 200");

    const business = PLANS.business;
    assert.strictEqual(business.price, 999, "Business price is ₹999");
    assert.strictEqual(business.maxWebsites, 6, "Business max websites is 6");
    assert.strictEqual(business.monthlyCredits, 400, "Business credits is 400");

    const agency = PLANS.agency;
    assert.strictEqual(agency.price, 1999, "Agency price is ₹1,999");
    assert.strictEqual(agency.maxWebsites, 15, "Agency max websites is 15");
    assert.strictEqual(agency.monthlyCredits, 800, "Agency credits is 800");
  });

  // -------------------------------------------------------------------------
  // TEST 8: Subscription plan resolution grants Starter custom domain, blocks advanced SEO
  // -------------------------------------------------------------------------
  runCase("resolveSubscriptionPlan grants Starter custom domain but denies advanced SEO", () => {
    const starterResolved = resolveSubscriptionPlan("starter");
    assert.strictEqual(starterResolved.id, "starter");
    assert.strictEqual(starterResolved.allow_custom_domain, true, "Starter must allow custom domain");
    assert.strictEqual(starterResolved.allow_advanced_seo, false, "Starter must NOT allow advanced SEO");

    const proResolved = resolveSubscriptionPlan("pro");
    assert.strictEqual(proResolved.allow_custom_domain, true);
    assert.strictEqual(proResolved.allow_advanced_seo, true);

    const businessResolved = resolveSubscriptionPlan("business");
    assert.strictEqual(businessResolved.allow_custom_domain, true);
    assert.strictEqual(businessResolved.allow_advanced_seo, true);

    const agencyResolved = resolveSubscriptionPlan("agency");
    assert.strictEqual(agencyResolved.allow_custom_domain, true);
    assert.strictEqual(agencyResolved.allow_advanced_seo, true);

    const freeResolved = resolveSubscriptionPlan("free");
    assert.strictEqual(freeResolved.allow_custom_domain, false);
    assert.strictEqual(freeResolved.allow_advanced_seo, false);
  });

  // -------------------------------------------------------------------------
  // TEST 9: Active Starter subscription user gets custom domain, no advanced SEO
  // -------------------------------------------------------------------------
  await runCase("Active Starter subscription user is entitled to custom domain but not advanced SEO", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 25);

    const mockSub = {
      plan_id: "starter",
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: futureDate.toISOString(),
      cancel_at_period_end: false,
    };

    const mockClient = createMockSupabaseWithSub(mockSub);
    const usage = await getUserUsage("test-user-starter-active", mockClient);

    assert(usage !== null, "Usage must be resolved");
    assert.strictEqual(usage.plan.id, "starter");
    assert.strictEqual(usage.plan.allow_custom_domain, true, "Active Starter user must have allow_custom_domain: true");
    assert.strictEqual(usage.plan.allow_advanced_seo, false, "Active Starter user must have allow_advanced_seo: false");

    // Check checkAdvancedSeoEntitlement
    const seoCheck = await checkAdvancedSeoEntitlement("test-user-starter-active", mockClient);
    assert.strictEqual(seoCheck.entitled, false, "Starter user must fail advanced SEO entitlement check");
    assert(seoCheck.reason?.includes("Basic SEO only"), "Reason must mention Basic SEO only");
  });

  // -------------------------------------------------------------------------
  // TEST 10: Expired Starter subscription immediately revokes custom domain & fails closed
  // -------------------------------------------------------------------------
  await runCase("Expired Starter subscription fails closed to free plan with custom domain disabled", async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);

    const expiredSub = {
      plan_id: "starter",
      status: "active",
      current_period_start: new Date(Date.now() - 35 * 86400000).toISOString(),
      current_period_end: pastDate.toISOString(),
      cancel_at_period_end: false,
    };

    assert.strictEqual(
      isSubscriptionActiveAndValid(expiredSub),
      false,
      "Expired Starter subscription must be invalid"
    );

    const mockClient = createMockSupabaseWithSub(expiredSub);
    const usage = await getUserUsage("test-user-starter-expired", mockClient);

    assert(usage !== null, "Usage must be resolved");
    assert.strictEqual(usage.plan.id, "free", "Expired subscription must fail closed to free plan");
    assert.strictEqual(usage.plan.allow_custom_domain, false, "Expired Starter must revoke custom domain");
    assert.strictEqual(usage.plan.allow_advanced_seo, false, "Expired Starter must revoke advanced SEO");
  });

  // -------------------------------------------------------------------------
  // TEST 11: Active Pro and Business users pass checkAdvancedSeoEntitlement
  // -------------------------------------------------------------------------
  await runCase("Active Pro and Business subscribers pass checkAdvancedSeoEntitlement", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 20);

    // Test Pro
    const proSub = {
      plan_id: "pro",
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: futureDate.toISOString(),
    };
    const proClient = createMockSupabaseWithSub(proSub);
    const proCheck = await checkAdvancedSeoEntitlement("test-user-pro", proClient);
    assert.strictEqual(proCheck.entitled, true, "Pro user must pass checkAdvancedSeoEntitlement");

    // Test Business
    const bizSub = {
      plan_id: "business",
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: futureDate.toISOString(),
    };
    const bizClient = createMockSupabaseWithSub(bizSub);
    const bizCheck = await checkAdvancedSeoEntitlement("test-user-biz", bizClient);
    assert.strictEqual(bizCheck.entitled, true, "Business user must pass checkAdvancedSeoEntitlement");

    // Test Agency
    const agencySub = {
      plan_id: "agency",
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: futureDate.toISOString(),
    };
    const agencyClient = createMockSupabaseWithSub(agencySub);
    const agencyCheck = await checkAdvancedSeoEntitlement("test-user-agency", agencyClient);
    assert.strictEqual(agencyCheck.entitled, true, "Agency user must pass checkAdvancedSeoEntitlement");
  });

  // -------------------------------------------------------------------------
  // TEST 12: Pricing page copy invariants
  // -------------------------------------------------------------------------
  runCase("Pricing page does not contain false claims about universal custom domains or full SEO in all plans", () => {
    const pricingPath = path.resolve(__dirname, "../app/pricing/page.tsx");
    const content = fs.readFileSync(pricingPath, "utf-8");

    // Must NOT say Full SEO Intelligence Suite is Included in All Plans
    assert(
      !content.includes('Full SEO Intelligence Suite\n                        </h3>\n                        <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-emerald-500/40">\n                          Included in All Plans'),
      "Pricing page must NOT display Full SEO Intelligence Suite as Included in All Plans"
    );

    // Must NOT claim universal custom domain without qualification
    assert(
      !content.includes('question: "Can I connect my own domain?",\n    answer: "Yes. You can connect and publish your website using your own custom domain."'),
      "FAQ must qualify custom domain availability per tier"
    );

    // Must explicitly mention Starter 1 custom domain
    assert(
      content.includes("1 Custom Domain") || content.includes("1 custom domain"),
      "Pricing page must mention 1 custom domain for Starter"
    );

    // Must explicitly delineate Basic SEO vs Advanced SEO Suite
    assert(
      content.includes("Basic SEO") && content.includes("Advanced SEO"),
      "Pricing page must delineate Basic SEO vs Advanced SEO"
    );
  });

  console.log("\n======================================================================");
  console.log(`ALL ${passed}/${total} PHASE 1 ENTITLEMENT & PRICING TESTS PASSED!`);
  console.log("======================================================================\n");
}

runTests().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
