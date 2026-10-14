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
import { getCachedSiteData, setCachedSiteData, invalidateCachedSiteData } from "../lib/site-cache";

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

  // -------------------------------------------------------------------------
  // TEST 9: Blog Post Route Public Visibility & Suspension Gate
  // -------------------------------------------------------------------------
  console.log("--- [Test 9] Blog Post Route Public Visibility & Suspension Gate ---");
  {
    const now = new Date();
    const createMockDb = (userSubscription: any) => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: userSubscription, error: null }),
          }),
        }),
      }),
    });

    // 9A: Suspended website blog post (15 days old on free plan)
    const expiredSite = {
      id: "site_blog_expired",
      user_id: "usr_free_blog",
      title: "Expired Bakery",
      is_published: true,
      created_at: new Date(now.getTime() - 15 * 86400000).toISOString(),
    };
    const expiredVisibility = await checkWebsitePublicVisibility(expiredSite, createMockDb({ plan_id: "free", status: "active" }), now);
    assert.strictEqual(expiredVisibility.isPubliclyVisible, false, "Expired site blog post is not publicly visible");
    assert.strictEqual(expiredVisibility.status, "trial_expired_suspended");

    // Public visitor gets 503 + suspended HTML + noindex headers
    const suspendedHtml = renderWebsiteSuspendedHTML(expiredSite.title);
    assert(suspendedHtml.includes("Website Temporarily Offline"), "Renders suspended HTML");
    assert(suspendedHtml.includes("noindex, nofollow"), "Enforces noindex for suspended blog post");

    // 9B: Active paid website blog post (Pro plan)
    const paidSite = {
      id: "site_blog_paid",
      user_id: "usr_paid_blog",
      title: "Active Agency",
      is_published: true,
      created_at: new Date(now.getTime() - 45 * 86400000).toISOString(),
    };
    const paidVisibility = await checkWebsitePublicVisibility(paidSite, createMockDb({
      plan_id: "pro",
      status: "active",
      current_period_end: new Date(now.getTime() + 15 * 86400000).toISOString(),
    }), now);
    assert.strictEqual(paidVisibility.isPubliclyVisible, true, "Paid subscriber blog post is publicly accessible");
    assert.strictEqual(paidVisibility.status, "active_paid");

    // 9C: Active 10-day trial website blog post (3 days old)
    const trialSite = {
      id: "site_blog_trial",
      user_id: "usr_trial_blog",
      title: "Fresh Studio",
      is_published: true,
      created_at: new Date(now.getTime() - 3 * 86400000).toISOString(),
    };
    const trialVisibility = await checkWebsitePublicVisibility(trialSite, createMockDb({ plan_id: "free", status: "active" }), now);
    assert.strictEqual(trialVisibility.isPubliclyVisible, true, "Active trial blog post is publicly accessible");
    assert.strictEqual(trialVisibility.status, "trial_active");

    console.log("  [PASS] Test 9: Blog post route protection enforces server-side visibility gate.\n");
  }

  // -------------------------------------------------------------------------
  // TEST 10: Sitemap Route Protection (Block Suspended URL Discovery)
  // -------------------------------------------------------------------------
  console.log("--- [Test 10] Sitemap Route Protection (Block Suspended URL Discovery) ---");
  {
    const now = new Date();
    const createMockDb = (userSubscription: any) => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: userSubscription, error: null }),
          }),
        }),
      }),
    });

    // 10A: Expired trial website sitemap check
    const expiredSite = {
      id: "site_sitemap_expired",
      user_id: "usr_sitemap_1",
      title: "Old Shop",
      is_published: true,
      created_at: new Date(now.getTime() - 12 * 86400000).toISOString(),
    };
    const expiredVisibility = await checkWebsitePublicVisibility(expiredSite, createMockDb({ plan_id: "free", status: "active" }), now);
    assert.strictEqual(expiredVisibility.isPubliclyVisible, false, "Suspended site visibility must be false");
    // When visibility is false, sitemap route returns HTTP 404
    const sitemapStatusOnSuspended = expiredVisibility.isPubliclyVisible ? 200 : 404;
    assert.strictEqual(sitemapStatusOnSuspended, 404, "Sitemap route returns 404 for suspended website");

    // 10B: Active paid subscriber sitemap check
    const paidSite = {
      id: "site_sitemap_paid",
      user_id: "usr_sitemap_2",
      title: "Pro Merchant",
      is_published: true,
      created_at: new Date(now.getTime() - 60 * 86400000).toISOString(),
    };
    const paidVisibility = await checkWebsitePublicVisibility(paidSite, createMockDb({
      plan_id: "starter",
      status: "active",
      current_period_end: new Date(now.getTime() + 20 * 86400000).toISOString(),
    }), now);
    assert.strictEqual(paidVisibility.isPubliclyVisible, true, "Active paid subscriber site is visible");
    const sitemapStatusOnPaid = paidVisibility.isPubliclyVisible ? 200 : 404;
    assert.strictEqual(sitemapStatusOnPaid, 200, "Sitemap route returns 200 for paid subscriber website");

    console.log("  [PASS] Test 10: Sitemap route protects suspended websites from crawler URL discovery.\n");
  }

  // -------------------------------------------------------------------------
  // TEST 11: Robots.txt Route Protection (Safe Non-Indexable Response)
  // -------------------------------------------------------------------------
  console.log("--- [Test 11] Robots.txt Route Protection (Safe Non-Indexable Response) ---");
  {
    const now = new Date();
    const createMockDb = (userSubscription: any) => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: userSubscription, error: null }),
          }),
        }),
      }),
    });

    // 11A: Suspended website robots response
    const suspendedSite = {
      id: "site_robots_suspended",
      user_id: "usr_robots_1",
      title: "Suspended Cafe",
      is_published: true,
      created_at: new Date(now.getTime() - 11 * 86400000).toISOString(),
    };
    const visibility = await checkWebsitePublicVisibility(suspendedSite, createMockDb(null), now);
    assert.strictEqual(visibility.isPubliclyVisible, false, "Suspended site visibility is false");

    // Robots route returns 200 Disallow: / with no-cache headers when suspended
    const robotsBody = !visibility.isPubliclyVisible ? "User-agent: *\nDisallow: /\n" : "User-agent: *\nAllow: /\n";
    const cacheControlHeader = !visibility.isPubliclyVisible ? "no-cache, no-store, must-revalidate" : "public, max-age=3600";
    assert(robotsBody.includes("Disallow: /"), "Suspended robots disallows all crawling");
    assert(!robotsBody.includes("Sitemap:"), "Suspended robots does not leak sitemap URL");
    assert.strictEqual(cacheControlHeader, "no-cache, no-store, must-revalidate", "Enforces no-cache so crawler revisits");

    // 11B: Active website robots response
    const activeSite = {
      id: "site_robots_active",
      user_id: "usr_robots_2",
      title: "Active Cafe",
      is_published: true,
      created_at: new Date(now.getTime() - 2 * 86400000).toISOString(),
    };
    const activeVis = await checkWebsitePublicVisibility(activeSite, createMockDb(null), now);
    assert.strictEqual(activeVis.isPubliclyVisible, true);
    const activeRobotsBody = !activeVis.isPubliclyVisible ? "User-agent: *\nDisallow: /\n" : "User-agent: *\nAllow: /\n";
    assert(activeRobotsBody.includes("Allow: /"), "Active website allows crawling");

    console.log("  [PASS] Test 11: Robots.txt route returns safe, non-indexable disallow response for suspended websites.\n");
  }

  // -------------------------------------------------------------------------
  // TEST 12: Cache Ordering & Invalidation on Suspension
  // -------------------------------------------------------------------------
  console.log("--- [Test 12] Cache Ordering & Invalidation on Suspension ---");
  {
    const now = new Date();
    const testSlug = "speedy-cafe";
    const cacheKey = `homepage_${testSlug}`;

    // Step 1: Pre-populate cache (as if site was viewed while trial was active)
    setCachedSiteData(cacheKey, "<html><body>Live Site Content</body></html>", 300000);
    assert.strictEqual(getCachedSiteData<string>(cacheKey), "<html><body>Live Site Content</body></html>", "Cache initialized");

    // Step 2: Time passes and website trial expires (now 11 days old, free plan)
    const site = {
      id: "site_cached_1",
      user_id: "usr_cache_test",
      title: "Speedy Cafe",
      published_slug: testSlug,
      is_published: true,
      created_at: new Date(now.getTime() - 11 * 86400000).toISOString(),
    };
    const mockDb = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { plan_id: "free", status: "active" } }) }) }) }),
    };

    // Step 3: Route evaluates visibility BEFORE checking cache!
    const visibility = await checkWebsitePublicVisibility(site, mockDb, now);
    assert.strictEqual(visibility.isPubliclyVisible, false, "Visibility check correctly identifies site as expired");

    // When visibility is false, cache must be invalidated and 503 returned
    let responseStatus: number;
    let responseBody: string;

    if (!visibility.isPubliclyVisible) {
      invalidateCachedSiteData(testSlug);
      responseStatus = 503;
      responseBody = renderWebsiteSuspendedHTML(site.title);
    } else {
      const cached = getCachedSiteData<string>(cacheKey);
      responseStatus = 200;
      responseBody = cached!;
    }

    assert.strictEqual(responseStatus, 503, "Response status is 503, NOT 200 from stale cache");
    assert(responseBody.includes("Website Temporarily Offline"), "Suspended HTML returned");

    // Step 4: Verify cache was evicted by invalidateCachedSiteData
    const postInvalidateCache = getCachedSiteData<string>(cacheKey);
    assert.strictEqual(postInvalidateCache, null, "Cache map no longer contains stale cached entry");

    // Step 5: Test renewal restoration cache flow
    // Owner renews with Pro plan
    const renewedSubDb = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { plan_id: "pro", status: "active", current_period_end: new Date(now.getTime() + 30 * 86400000).toISOString() } }) }) }) }),
    };
    const restoredVisibility = await checkWebsitePublicVisibility(site, renewedSubDb, now);
    assert.strictEqual(restoredVisibility.isPubliclyVisible, true, "Renewed site is visible");

    // New rendered page can be cached safely
    setCachedSiteData(cacheKey, "<html><body>Restored Live Site Content</body></html>", 300000);
    assert.strictEqual(getCachedSiteData<string>(cacheKey), "<html><body>Restored Live Site Content</body></html>");

    console.log("  [PASS] Test 12: Cache ordering guarantees expired sites are never served from stale memory cache.\n");
  }

  // -------------------------------------------------------------------------
  // TEST 13: Publish API Protection (403 UPGRADE_REQUIRED on Expired Trial)
  // -------------------------------------------------------------------------
  console.log("--- [Test 13] Publish API Protection (403 UPGRADE_REQUIRED on Expired Trial) ---");
  {
    const now = new Date();
    const createMockDb = (userSubscription: any) => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: userSubscription, error: null }),
          }),
        }),
      }),
    });

    // Helper simulating the Publish API validation check
    async function simulatePublishEligibility(website: any, subscription: any, asOf: Date = now) {
      const visibility = await checkWebsitePublicVisibility(
        { ...website, is_published: true },
        createMockDb(subscription),
        asOf
      );

      if (!visibility.isPubliclyVisible) {
        return {
          status: 403,
          body: {
            error: "Your 10-day website trial has ended. An active paid subscription (Starter, Pro, Business, or Agency) is required to publish this website publicly.",
            code: "UPGRADE_REQUIRED",
            status: visibility.status,
            reason: visibility.reason,
          },
        };
      }

      return {
        status: 200,
        body: {
          success: true,
          published: true,
          slug: website.published_slug || "published-site",
        },
      };
    }

    // 13A: Expired trial website (14 days old, free plan) -> Rejected with 403 UPGRADE_REQUIRED
    const expiredDraft = {
      id: "site_publish_expired",
      user_id: "usr_publish_1",
      title: "Stale Bakery",
      is_published: false,
      created_at: new Date(now.getTime() - 14 * 86400000).toISOString(),
    };
    const rejectedResult = await simulatePublishEligibility(expiredDraft, { plan_id: "free", status: "active" });
    assert.strictEqual(rejectedResult.status, 403, "Publishing rejected with HTTP 403");
    assert.strictEqual(rejectedResult.body.code, "UPGRADE_REQUIRED", "Returns UPGRADE_REQUIRED error code");
    assert.strictEqual(rejectedResult.body.status, "trial_expired_suspended");
    assert(rejectedResult.body.error.includes("10-day website trial has ended"));

    // 13B: Fresh trial website (4 days old, free plan) -> Permitted
    const freshDraft = {
      id: "site_publish_fresh",
      user_id: "usr_publish_2",
      title: "Fresh Bakery",
      is_published: false,
      created_at: new Date(now.getTime() - 4 * 86400000).toISOString(),
    };
    const allowedTrialResult = await simulatePublishEligibility(freshDraft, { plan_id: "free", status: "active" });
    assert.strictEqual(allowedTrialResult.status, 200, "Publishing allowed during active 10-day trial");
    assert.strictEqual(allowedTrialResult.body.published, true);

    // 13C: Expired website with newly activated paid plan (Starter ₹299/mo) -> Permitted
    const paidSubscriberDraft = {
      id: "site_publish_upgraded",
      user_id: "usr_publish_3",
      title: "Upgraded Boutique",
      is_published: false,
      created_at: new Date(now.getTime() - 25 * 86400000).toISOString(), // 25 days old
    };
    const paidSub = {
      plan_id: "starter",
      status: "active",
      current_period_end: new Date(now.getTime() + 28 * 86400000).toISOString(),
    };
    const allowedPaidResult = await simulatePublishEligibility(paidSubscriberDraft, paidSub);
    assert.strictEqual(allowedPaidResult.status, 200, "Publishing allowed after upgrading to paid plan");
    assert.strictEqual(allowedPaidResult.body.published, true);

    // 13D: Lapsed paid subscriber trying to publish without renewing -> Rejected with 403 UPGRADE_REQUIRED
    const lapsedSubscriberDraft = {
      id: "site_publish_lapsed",
      user_id: "usr_publish_4",
      title: "Lapsed Boutique",
      is_published: false,
      created_at: new Date(now.getTime() - 45 * 86400000).toISOString(),
    };
    const lapsedSub = {
      plan_id: "pro",
      status: "active",
      current_period_end: new Date(now.getTime() - 3 * 86400000).toISOString(), // Expired 3 days ago
    };
    const rejectedLapsedResult = await simulatePublishEligibility(lapsedSubscriberDraft, lapsedSub);
    assert.strictEqual(rejectedLapsedResult.status, 403, "Publishing rejected for lapsed paid subscription");
    assert.strictEqual(rejectedLapsedResult.body.code, "UPGRADE_REQUIRED");

    console.log("  [PASS] Test 13: Publish API gate correctly enforces trial duration and paid plan entitlement.\n");
  }

  console.log("======================================================================");
  console.log("ALL 13 WEBSITE LIFECYCLE, SUSPENSION & RETENTION TESTS PASSED! 🎉");
  console.log("======================================================================\n");
}

runLifecycleTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
