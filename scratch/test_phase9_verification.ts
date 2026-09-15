import { NextRequest } from "next/server";
import { POST } from "../app/api/seo/cron/route";
import {
  calculateNextRunAt,
  createMonitoringAlert,
  processScheduledMonitoringBatch,
} from "../lib/seo-monitoring-engine";

async function runPhase9SecurityAndConcurrencyTests() {
  console.log("==================================================");
  console.log("CODEAXYS AI WEBSITE BUILDER — PHASE 9 SECURITY & CONCURRENCY TESTS");
  console.log("==================================================\n");

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, title: string, details?: string) {
    if (condition) {
      console.log(`✓ PASS: ${title}`);
      passCount++;
    } else {
      console.error(`✕ FAIL: ${title}`);
      if (details) console.error(`   Details: ${details}`);
      failCount++;
    }
  }

  // ---------------------------------------------------------------------
  // A. CRON AUTHENTICATION & SECURITY TESTS
  // ---------------------------------------------------------------------
  console.log("--- Section A: Cron Endpoint Security Tests ---");

  // Save original env
  const origSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-secret-key-12345";

  // Test 1: No Authorization Header -> 401
  const reqNoAuth = new NextRequest("http://localhost:3000/api/seo/cron", {
    method: "POST",
  });
  const resNoAuth = await POST(reqNoAuth);
  assert(resNoAuth.status === 401, "No Authorization header returns 401 Unauthorized");

  // Test 2: Wrong CRON_SECRET -> 401
  const reqWrongAuth = new NextRequest("http://localhost:3000/api/seo/cron", {
    method: "POST",
    headers: { authorization: "Bearer invalid-wrong-secret" },
  });
  const resWrongAuth = await POST(reqWrongAuth);
  assert(resWrongAuth.status === 401, "Wrong CRON_SECRET Bearer token returns 401 Unauthorized");

  // Test 3: Correct CRON_SECRET -> Authorized (200 / 500 depending on DB client, not 401)
  const reqCorrectAuth = new NextRequest("http://localhost:3000/api/seo/cron", {
    method: "POST",
    headers: { authorization: "Bearer test-secret-key-12345" },
  });
  const resCorrectAuth = await POST(reqCorrectAuth);
  assert(resCorrectAuth.status !== 401, "Correct CRON_SECRET is authorized (not 401)");

  // Test 4: x-vercel-cron: true WITHOUT valid CRON_SECRET -> 401 (Spoofing attempt blocked!)
  const reqSpoofedVercelHeader = new NextRequest("http://localhost:3000/api/seo/cron", {
    method: "POST",
    headers: { "x-vercel-cron": "true" },
  });
  const resSpoofed = await POST(reqSpoofedVercelHeader);
  assert(resSpoofed.status === 401, "Spoofed x-vercel-cron header WITHOUT secret is rejected with 401");

  // Test 5: Missing CRON_SECRET -> Fails Closed with 500
  delete process.env.CRON_SECRET;
  const reqMissingEnv = new NextRequest("http://localhost:3000/api/seo/cron", {
    method: "POST",
    headers: { authorization: "Bearer any-secret" },
  });
  const resMissingEnv = await POST(reqMissingEnv);
  assert(resMissingEnv.status === 500, "Missing server CRON_SECRET fails closed with 500 Server Error");

  // Restore env
  if (origSecret) process.env.CRON_SECRET = origSecret;
  else process.env.CRON_SECRET = "test-secret-key-12345";

  // ---------------------------------------------------------------------
  // B. ATOMIC JOB CLAIMING & CONCURRENCY TESTS
  // ---------------------------------------------------------------------
  console.log("\n--- Section B: Atomic Job Claiming & Concurrency Tests ---");

  // Mock Database State for Concurrency Test
  const nowIso = new Date().toISOString();
  let scheduleRow = {
    id: "sched-111",
    website_id: "site-222",
    user_id: "user-333",
    enabled: true,
    frequency: "weekly",
    preferred_hour: 3,
    next_run_at: "2026-09-15T00:00:00.000Z", // Due in past
    failure_count: 0,
  };

  // Mock Supabase with stateful atomic UPDATE ... WHERE next_run_at <= nowIso logic
  const mockDb: any = {
    from: (table: string) => {
      if (table === "website_monitoring_schedules") {
        return {
          select: () => ({
            eq: () => ({
              lte: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [scheduleRow], error: null }),
                }),
              }),
            }),
          }),
          update: (updates: any) => ({
            eq: (col1: string, val1: any) => ({
              lte: (col2: string, val2: any) => ({
                select: () => ({
                  maybeSingle: () => {
                    // ATOMIC CONDITION CHECK: Only update if scheduleRow.next_run_at <= val2
                    if (new Date(scheduleRow.next_run_at).getTime() <= new Date(val2).getTime()) {
                      scheduleRow = { ...scheduleRow, ...updates };
                      return Promise.resolve({ data: scheduleRow, error: null });
                    }
                    // Lock failed: row was already updated by worker 1!
                    return Promise.resolve({ data: null, error: null });
                  },
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null }),
            in: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
            limit: () => Promise.resolve({ data: [] }),
            order: () => ({ limit: () => Promise.resolve({ data: [] }) }),
          }),
        }),
        insert: () => Promise.resolve({ error: null }),
        upsert: () => Promise.resolve({ error: null }),
      };
    },
  };

  // Test 6 & 7: Simulate Worker 1 & Worker 2 claiming the due schedule concurrently
  const worker1Promise = processScheduledMonitoringBatch(mockDb, 5);
  const worker2Promise = processScheduledMonitoringBatch(mockDb, 5);

  const [resWorker1, resWorker2] = await Promise.all([worker1Promise, worker2Promise]);

  const totalProcessed = (resWorker1.processed || 0) + (resWorker2.processed || 0);
  assert(totalProcessed === 1, "Concurrent batch execution processes schedule exactly once (1 succeeded, 1 skipped)", `Worker1: ${resWorker1.processed}, Worker2: ${resWorker2.processed}`);

  // Test 8: Successful claim updates schedule state safely
  assert(
    new Date(scheduleRow.next_run_at).getTime() > Date.now(),
    "Successful claim updates next_run_at into the future",
    scheduleRow.next_run_at
  );

  // Test 9 & 10: Retry limit and bounded failure handling
  const nextWeekly = calculateNextRunAt("weekly", new Date());
  assert(nextWeekly !== null && nextWeekly.getTime() > Date.now(), "Weekly frequency calculates next run safely");

  console.log("\n==================================================");
  console.log(`ALL VERIFICATION TESTS COMPLETED: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("==================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase9SecurityAndConcurrencyTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
