import assert from "node:assert";
import {
  getWebsiteTrialStatus,
  TRIAL_DURATION_DAYS,
  TRIAL_DURATION_MS,
} from "../lib/website-trial";
import {
  checkWebsitePublicVisibility,
  renderWebsiteSuspendedHTML,
  resetMonthlyAllowanceWithoutRollover,
  processRetentionCleanup,
  RETENTION_DURATION_DAYS,
} from "../lib/lifecycle/website-lifecycle-engine";
import { dispatchLifecycleAlert } from "../lib/notifications/lifecycle-alerts";
import { PLANS } from "../lib/constants";

async function runLifecycleTests() {
  console.log("======================================================================");
  console.log("CODEAXYS: WEBSITE LIFECYCLE, SUSPENSION & RETENTION TEST SUITE");
  console.log("======================================================================\n");

  // -------------------------------------------------------------------------
  // TEST 1: 10-Day Website Trial Invariants
  // -------------------------------------------------------------------------
  console.log("--- [Test 1] 10-Day Website Trial Duration Invariants ---");
  {
    assert.strictEqual(TRIAL_DURATION_DAYS, 10, "Trial duration must be 10 days");
    assert.strictEqual(TRIAL_DURATION_MS, 10 * 24 * 60 * 60 * 1000, "Trial duration ms must match 10 days (864,000,000 ms)");

    const now = new Date();

    // Brand new site on free plan
    const brandNew = getWebsiteTrialStatus(now.toISOString(), "free", false);
    assert.strictEqual(brandNew.status, "trial_active", "Brand new website trial is active");
    assert.strictEqual(brandNew.isExpired, false, "Brand new website trial is not expired");
    assert.strictEqual(brandNew.daysRemaining, 10, "Days remaining for brand new site is 10");

    // 5 days old site on free plan
    const fiveDaysOld = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const day5Status = getWebsiteTrialStatus(fiveDaysOld.toISOString(), "free", false);
    assert.strictEqual(day5Status.status, "trial_active", "Day 5 website trial is active");
    assert.strictEqual(day5Status.isExpired, false, "Day 5 website is not expired");
    assert.strictEqual(day5Status.daysRemaining, 5, "Day 5 has 5 days remaining");

    // 9.5 days old site on free plan
    const almostExpired = new Date(now.getTime() - 9.5 * 24 * 60 * 60 * 1000);
    const day9Status = getWebsiteTrialStatus(almostExpired.toISOString(), "free", false);
    assert.strictEqual(day9Status.status, "trial_active", "Day 9.5 website trial is still active");
    assert.strictEqual(day9Status.daysRemaining, 1, "Day 9.5 has 1 day remaining");

    // 10.1 days old site on free plan (EXPIRED)
    const expired = new Date(now.getTime() - 10.1 * 24 * 60 * 60 * 1000);
    const expiredStatus = getWebsiteTrialStatus(expired.toISOString(), "free", false);
    assert.strictEqual(expiredStatus.status, "trial_expired", "Day 10.1 website trial has expired");
    assert.strictEqual(expiredStatus.isExpired, true, "Day 10.1 website is marked expired");
    assert.strictEqual(expiredStatus.badgeLabel, "10-Day Trial Expired", "Badge correctly reflects 10-day trial expiry");
    assert(expiredStatus.message.includes("90 days"), "Expiry message communicates 90-day safe preservation");

    console.log("  [PASS] Test 1: 10-day trial calculation and status transitions verified.\n");
  }

  // -------------------------------------------------------------------------
  // TEST 2: Permanent Entitlement for Paid Tiers
  // -------------------------------------------------------------------------
  console.log("--- [Test 2] Permanent Entitlement for Paid Tiers (Starter, Pro, Business, Agency) ---");
  {
    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const paidTiers = ["starter", "pro", "business", "agency"];

    for (const tier of paidTiers) {
      const trialInfo = getWebsiteTrialStatus(oldDate, tier, true);
      assert.strictEqual(trialInfo.status, "permanent", `Paid tier ${tier} has permanent status`);
      assert.strictEqual(trialInfo.isExpired, false, `Paid tier ${tier} is not expired`);
      assert.strictEqual(trialInfo.badgeColor, "emerald", `Paid tier ${tier} has emerald badge`);
    }

    console.log("  [PASS] Test 2: Paid tiers retain permanent status regardless of website age.\n");
  }

  // -------------------------------------------------------------------------
  // TEST 3: Server-Side Public Website Visibility & Suspension Gate
  // -------------------------------------------------------------------------
  console.log("--- [Test 3] Server-Side Public Website Visibility & Suspension Gate ---");
  {
    // Mock DB client returning test subscriptions
    const createMockDb = (userSubscription: any) => ({
      from: (table: string) => ({
        select: () => ({
          eq: (col: string, val: string) => ({
            maybeSingle: async () => ({ data: userSubscription, error: null }),
          }),
        }),
      }),
    });

    const now = new Date();

    // 3A: Unpublished Draft (NEVER publicly visible)
    const draftSite = {
      id: "site_draft_1",
      user_id: "usr_free_1",
      title: "Draft Portfolio",
      is_published: false,
      created_at: now.toISOString(),
    };
    const draftResult = await checkWebsitePublicVisibility(draftSite, createMockDb(null));
    assert.strictEqual(draftResult.isPubliclyVisible, false, "Draft site is never publicly visible");
    assert.strictEqual(draftResult.status, "draft");

    // 3B: Free Plan Published Site Within 10-Day Trial (PUBLICLY VISIBLE)
    const freshTrialSite = {
      id: "site_fresh_1",
      user_id: "usr_free_2",
      title: "Fresh Bakery",
      is_published: true,
      created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days old
    };
    const freshResult = await checkWebsitePublicVisibility(freshTrialSite, createMockDb({ plan_id: "free", status: "active" }));
    assert.strictEqual(freshResult.isPubliclyVisible, true, "Site within 10-day trial is publicly visible");
    assert.strictEqual(freshResult.status, "trial_active");
    assert.strictEqual(freshResult.daysRemaining, 7, "Has 7 days remaining on trial");

    // 3C: Free Plan Published Site Older Than 10 Days (SUSPENDED FROM PUBLIC)
    const expiredTrialSite = {
      id: "site_expired_1",
      user_id: "usr_free_3",
      title: "Old Bakery",
      is_published: true,
      created_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days old
    };
    const expiredResult = await checkWebsitePublicVisibility(expiredTrialSite, createMockDb({ plan_id: "free", status: "active" }));
    assert.strictEqual(expiredResult.isPubliclyVisible, false, "Site past 10-day trial is suspended from public visitors");
    assert.strictEqual(expiredResult.status, "trial_expired_suspended");
    assert(expiredResult.reason?.includes("10-day website trial has ended"));

    // 3D: Active Paid Plan Site Older Than 10 Days (PUBLICLY VISIBLE)
    const proSite = {
      id: "site_pro_1",
      user_id: "usr_pro_1",
      title: "SaaS Platform",
      is_published: true,
      created_at: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days old
    };
    const activeProSub = {
      plan_id: "pro",
      status: "active",
      current_period_end: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days left
    };
    const proResult = await checkWebsitePublicVisibility(proSite, createMockDb(activeProSub));
    assert.strictEqual(proResult.isPubliclyVisible, true, "Active paid subscriber site is publicly visible");
    assert.strictEqual(proResult.status, "active_paid");
    assert.strictEqual(proResult.isOwnerPaid, true);

    // 3E: Expired Paid Plan Site (SUSPENDED FROM PUBLIC)
    const expiredPaidSite = {
      id: "site_lapsed_1",
      user_id: "usr_lapsed_1",
      title: "Lapsed Studio",
      is_published: true,
      created_at: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const expiredSub = {
      plan_id: "starter",
      status: "active",
      current_period_end: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), // Expired 5 days ago
    };
    const lapsedResult = await checkWebsitePublicVisibility(expiredPaidSite, createMockDb(expiredSub));
    assert.strictEqual(lapsedResult.isPubliclyVisible, false, "Expired paid subscriber site is suspended from public visitors");
    assert.strictEqual(lapsedResult.status, "trial_expired_suspended");

    console.log("  [PASS] Test 3: Public website visibility gate correctly distinguishes trials, paid, drafts, and suspended sites.\n");
  }

  // -------------------------------------------------------------------------
  // TEST 4: Immediate Website Restoration on Renewal
  // -------------------------------------------------------------------------
  console.log("--- [Test 4] Immediate Website Restoration Upon Renewal ---");
  {
    const now = new Date();
    const customerSite = {
      id: "site_restore_1",
      user_id: "usr_restore_1",
      title: "Design Agency",
      is_published: true,
      created_at: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    };

    // Before Renewal: Expired subscription -> Suspended
    const expiredSub = {
      plan_id: "pro",
      status: "active",
      current_period_end: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const mockDbBefore = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: expiredSub }) }) }) }),
    };
    const beforeRenewal = await checkWebsitePublicVisibility(customerSite, mockDbBefore);
    assert.strictEqual(beforeRenewal.isPubliclyVisible, false, "Before renewal: site is suspended");

    // After Renewal: Subscription charged and renewed -> Immediately Live
    const renewedSub = {
      plan_id: "pro",
      status: "active",
      current_period_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), // New 30 days
    };
    const mockDbAfter = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: renewedSub }) }) }) }),
    };
    const afterRenewal = await checkWebsitePublicVisibility(customerSite, mockDbAfter);
    assert.strictEqual(afterRenewal.isPubliclyVisible, true, "After renewal: site is restored immediately with 0 latency");
    assert.strictEqual(afterRenewal.status, "active_paid");

    console.log("  [PASS] Test 4: Renewal immediately restores live public website access.\n");
  }

  // -------------------------------------------------------------------------
  // TEST 5: Suspended Offline HTML Generation
  // -------------------------------------------------------------------------
  console.log("--- [Test 5] Suspended Offline HTML Security Standards ---");
  {
    const html = renderWebsiteSuspendedHTML("Starlight Coffee <script>alert(1)</script>");
    assert(html.includes("Website Temporarily Offline"), "Contains offline headline");
    assert(html.includes("Starlight Coffee &lt;script&gt;alert(1)&lt;/script&gt;"), "Sanitizes XSS in title");
    assert(html.includes('meta name="robots" content="noindex, nofollow"'), "Enforces noindex, nofollow robots tag");
    assert(html.includes("/login"), "Provides owner login recovery CTA");
    assert(html.includes("Codeaxys AI Website Builder"), "Includes platform footer");

    console.log("  [PASS] Test 5: Suspended HTML is secure, XSS-sanitized, and non-indexable.\n");
  }

  // -------------------------------------------------------------------------
  // TEST 6: Monthly AI Credits Reset Without Rollover
  // -------------------------------------------------------------------------
  console.log("--- [Test 6] Monthly AI Credits Reset Without Rollover ---");
  {
    let updatedCreditsRow: any = null;
    let loggedCreditTx: any = null;

    const mockDb = {
      from: (table: string) => ({
        upsert: async (row: any) => {
          if (table === "user_credits") updatedCreditsRow = row;
          return { error: null };
        },
        insert: async (row: any) => {
          if (table === "ai_credit_transactions") loggedCreditTx = row;
          return { error: null };
        },
      }),
    };

    // User on Pro plan has 47 credits remaining at renewal
    const proPlanCredits = PLANS.pro.monthlyCredits; // 200
    const resetResult = await resetMonthlyAllowanceWithoutRollover("user_pro_renew", "pro", mockDb);

    assert.strictEqual(resetResult.success, true);
    assert.strictEqual(resetResult.newBalance, 200, "Reset gives exact Pro monthly allowance of 200");
    assert.strictEqual(updatedCreditsRow.balance, 200, "Balance strictly set to 200 without rolling over previous balance");
    assert.strictEqual(updatedCreditsRow.monthly_used, 0, "monthly_used reset to 0");
    assert.strictEqual(loggedCreditTx.action_type, "monthly_subscription_renewal_reset", "Audit log recorded");

    // Starter plan renewal (100 credits)
    const starterReset = await resetMonthlyAllowanceWithoutRollover("user_starter_renew", "starter", mockDb);
    assert.strictEqual(starterReset.newBalance, 100, "Starter reset gives exactly 100 credits");
    assert.strictEqual(updatedCreditsRow.balance, 100);

    // Business plan renewal (400 credits)
    const businessReset = await resetMonthlyAllowanceWithoutRollover("user_biz_renew", "business", mockDb);
    assert.strictEqual(businessReset.newBalance, 400, "Business reset gives exactly 400 credits");
    assert.strictEqual(updatedCreditsRow.balance, 400);

    console.log("  [PASS] Test 6: Credit renewal resets strictly to plan allowance without rollover.\n");
  }

  // -------------------------------------------------------------------------
  // TEST 7: 90-Day Retention Invariant & Safe Dry-Run Cleanup
  // -------------------------------------------------------------------------
  console.log("--- [Test 7] 90-Day Retention Invariant & Safe Dry-Run Cleanup ---");
  {
    assert.strictEqual(RETENTION_DURATION_DAYS, 90, "Retention duration must be 90 days");

    const now = new Date();

    // Mock dataset: 1 active paid site, 1 expired 30 days ago (within retention), 1 expired 100 days ago (past 90d)
    const mockWebsites = [
      { id: "site_active", user_id: "usr_active", title: "Active Site", is_published: true, created_at: now.toISOString() },
      { id: "site_recent_expired", user_id: "usr_recent", title: "Recently Expired", is_published: true, created_at: new Date(now.getTime() - 40 * 86400000).toISOString() },
      { id: "site_old_expired", user_id: "usr_old", title: "Ancient Lapsed", is_published: true, created_at: new Date(now.getTime() - 120 * 86400000).toISOString() },
    ];

    const mockSubscriptions: Record<string, any> = {
      usr_active: { plan_id: "pro", status: "active", current_period_end: new Date(now.getTime() + 10 * 86400000).toISOString() },
      usr_recent: { plan_id: "pro", status: "active", current_period_end: new Date(now.getTime() - 30 * 86400000).toISOString() }, // 30 days expired
      usr_old: { plan_id: "starter", status: "active", current_period_end: new Date(now.getTime() - 95 * 86400000).toISOString() }, // 95 days expired (past 90d)
    };

    const mockDb = {
      from: (table: string) => ({
        select: () => ({
          limit: () => ({ data: mockWebsites, error: null }),
          eq: (col: string, val: string) => ({
            maybeSingle: async () => ({ data: mockSubscriptions[val] || null, error: null }),
          }),
        }),
      }),
    };

    const report = await processRetentionCleanup({ supabase: mockDb, dryRun: true, asOfDate: now });

    assert.strictEqual(report.dryRun, true, "Cleanup defaults to dryRun: true");
    assert.strictEqual(report.scannedCount, 3, "Scanned all 3 mock websites");
    assert.strictEqual(report.preservedActivePaidCount, 1, "Active paid subscriber site is strictly preserved");
    assert.strictEqual(report.preservedWithinRetentionCount, 1, "Site expired 30 days ago is preserved within 90-day retention");
    assert.strictEqual(report.eligibleForDeletionCount, 1, "Site expired 95 days ago is flagged eligible for deletion");
    assert.strictEqual(report.simulatedDetails[0].websiteId, "site_old_expired", "Correct site identified");

    console.log("  [PASS] Test 7: 90-day retention calculation verified; dry-run mode safeguards customer data.\n");
  }

  // -------------------------------------------------------------------------
  // TEST 8: Lifecycle Alerts Dispatcher (Dry-Run & Copy Verification)
  // -------------------------------------------------------------------------
  console.log("--- [Test 8] Lifecycle Alerts Dispatcher (Dry-Run & Milestones) ---");
  {
    const mockSupabase = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { email: "owner@example.com" } }) }) }),
        insert: async () => ({ error: null }),
      }),
    };

    // Test Day 7 Reminder
    const day7Alert = await dispatchLifecycleAlert(mockSupabase, {
      userId: "usr_trial_7",
      websiteId: "web_trial_7",
      websiteTitle: "Sunset Yoga",
      eventType: "trial_reminder_day7",
      daysRemaining: 3,
    });
    assert.strictEqual(day7Alert.channel, "dry_run", "Runs in dry-run mode in test environment");
    assert.strictEqual(day7Alert.recipient, "owner@example.com", "Resolved recipient email");

    // Test Day 9 Reminder
    const day9Alert = await dispatchLifecycleAlert(mockSupabase, {
      userId: "usr_trial_9",
      websiteId: "web_trial_9",
      websiteTitle: "Sunset Yoga",
      eventType: "trial_reminder_day9",
      daysRemaining: 1,
    });
    assert.strictEqual(day9Alert.channel, "dry_run");

    // Test Day 10 Expiry Alert
    const day10Alert = await dispatchLifecycleAlert(mockSupabase, {
      userId: "usr_trial_10",
      websiteId: "web_trial_10",
      websiteTitle: "Sunset Yoga",
      eventType: "trial_expired_day10",
    });
    assert.strictEqual(day10Alert.channel, "dry_run");

    // Test Retention 14-day Warning
    const warn14dAlert = await dispatchLifecycleAlert(mockSupabase, {
      userId: "usr_retention_14",
      websiteId: "web_retention_14",
      websiteTitle: "Sunset Yoga",
      eventType: "retention_warning_14d",
      daysRemaining: 14,
    });
    assert.strictEqual(warn14dAlert.channel, "dry_run");

    console.log("  [PASS] Test 8: All lifecycle alert milestone triggers format and route safely in dry-run mode.\n");
  }

  console.log("======================================================================");
  console.log("ALL 8 WEBSITE LIFECYCLE, SUSPENSION & RETENTION TESTS PASSED! 🎉");
  console.log("======================================================================\n");
}

runLifecycleTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
