import { getWebsiteTrialStatus } from "../lib/website-trial";

async function runConversationalAndTrialTests() {
  console.log("==================================================");
  console.log("TESTING 3-DAY WEBSITE PREVIEW TRIAL & CONVERSATIONAL DISCOVERY");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${testName} - ${detail || "Assertion failed"}`);
      failed++;
    }
  }

  // TEST 1: Recent Website (< 72 Hours Old)
  const now = new Date();
  const recentCreatedAt = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(); // 1 day old
  const trial1 = getWebsiteTrialStatus(recentCreatedAt, "free", false);

  assert(
    trial1.status === "trial_active" && !trial1.isExpired,
    "Test 1: 1-day old site has trial_active status",
    `Got ${trial1.status}`
  );
  assert(
    trial1.daysRemaining === 2 || trial1.daysRemaining === 3,
    "Test 1: Correct days remaining calculated",
    `Got ${trial1.daysRemaining}`
  );

  // TEST 2: Expired Preview Trial (> 72 Hours Old)
  const oldCreatedAt = new Date(now.getTime() - 96 * 60 * 60 * 1000).toISOString(); // 4 days old
  const trial2 = getWebsiteTrialStatus(oldCreatedAt, "free", false);

  assert(
    trial2.status === "trial_expired" && trial2.isExpired,
    "Test 2: 4-day old free draft site is marked as trial_expired",
    `Got ${trial2.status}`
  );
  assert(
    trial2.badgeLabel === "3-Day Preview Trial Expired",
    "Test 2: Correct badge label for expired trial",
    `Got ${trial2.badgeLabel}`
  );
  assert(
    trial2.message.includes("remain safely saved"),
    "Test 2: Data preservation message confirmed (Zero data deletion)",
    `Got ${trial2.message}`
  );

  // TEST 3: Published Website on Free Plan
  const trial3 = getWebsiteTrialStatus(oldCreatedAt, "free", true);
  assert(
    trial3.status === "permanent" && !trial3.isExpired,
    "Test 3: Published site has permanent status regardless of age",
    `Got ${trial3.status}`
  );

  // TEST 4: Pro Plan Subscription
  const trial4 = getWebsiteTrialStatus(oldCreatedAt, "pro", false);
  assert(
    trial4.status === "permanent" && !trial4.isExpired,
    "Test 4: Pro plan user has permanent status",
    `Got ${trial4.status}`
  );

  console.log("==================================================");
  console.log(`SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
}

runConversationalAndTrialTests().catch((e) => {
  console.error("Trial Test Script Failure:", e);
  process.exit(1);
});
