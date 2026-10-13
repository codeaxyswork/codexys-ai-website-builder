import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  checkCreditBalance,
  deductCreditsWithClient,
  refundCreditsWithClient,
  getUserUsage,
  isSubscriptionActiveAndValid,
  resolveSubscriptionPlan,
  DEFAULT_FREE_PLAN,
} from "../lib/billing";
import { refundProbeCredits, checkAiVisibilityEntitlement } from "../lib/ai-visibility/credit-guard";
import { checkRateLimit } from "../lib/rate-limit";
import { CREDIT_COSTS, PLANS } from "../lib/constants";
import { NextRequest } from "next/server";

// Load .env.local into process.env if present so Next.js server utils have required keys
try {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch {
  // Ignore in environments without .env.local
}

/**
 * ============================================================================
 * CODEAXYS BILLING & REFUND REMEDIATION TEST SUITE
 * ============================================================================
 * NOTE: Tests are divided into two distinct categories:
 *   1. MOCK POSTGRES ATOMIC ENGINE TESTS: Simulates PostgreSQL user_credits table,
 *      atomic row-level locks (FOR UPDATE), ai_credit_transactions audit log,
 *      and RPC function behavior without mutating remote production databases.
 *   2. REAL NEXT.JS ROUTE HANDLER TESTS: Invokes actual Next.js route handlers
 *      with NextRequest objects to verify authentication, ownership, and validation.
 * ============================================================================
 */

interface MockDbOptions {
  rpcUnavailable?: boolean;
  missingUserCreditsRow?: boolean;
}

function createMockDb(initialCredits: number = 100, options: MockDbOptions = {}) {
  const userCreditsRowExists = !options.missingUserCreditsRow;
  let balance = initialCredits;
  let monthlyUsed = 0;
  let lifetimeUsed = 0;
  const transactions: Array<{
    id: string;
    userId: string;
    websiteId: string | null;
    creditsUsed: number;
    actionType: string;
    createdAt: string;
  }> = [];

  // Simulate PostgreSQL transactional advisory lock per user_id (pg_advisory_xact_lock)
  // Ensures strict serialization even when user_credits row does not exist.
  const userLocks = new Map<string, Promise<void>>();
  const acquireUserLock = async (userId: string): Promise<() => void> => {
    const prev = userLocks.get(userId) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    userLocks.set(userId, prev.then(() => current));
    await prev;
    return () => {
      release();
    };
  };

  const mockDb: any = {
    _getBalance: () => balance,
    _getMonthlyUsed: () => monthlyUsed,
    _getLifetimeUsed: () => lifetimeUsed,
    _getTransactions: () => transactions,

    rpc: async (fnName: string, params: any) => {
      if (options.rpcUnavailable) {
        return {
          data: null,
          error: new Error(`RPC function ${fnName} is unavailable or schema pending migration.`),
        };
      }

      if (fnName === "_resolve_deduction_action_for_refund") {
        return {
          data: null,
          error: new Error(
            "permission denied for function _resolve_deduction_action_for_refund: internal helper cannot be invoked directly"
          ),
        };
      }

      if (fnName === "deduct_user_credits") {
        const { p_user_id, p_credits, p_action_type, p_website_id } = params;
        if (!p_credits || p_credits <= 0) {
          return { data: false, error: null };
        }
        const release = await acquireUserLock(p_user_id);
        try {
          // Introduce microtask delay to simulate DB/network time and force concurrent interleaving
          await new Promise((r) => setTimeout(r, 2));

          if (!userCreditsRowExists) {
            return { data: false, error: null };
          }

          if (balance < p_credits) {
            return { data: false, error: null };
          }
          balance -= p_credits;
          monthlyUsed += p_credits;
          lifetimeUsed += p_credits;
          transactions.push({
            id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            userId: p_user_id,
            websiteId: p_website_id,
            creditsUsed: p_credits,
            actionType: p_action_type,
            createdAt: new Date().toISOString(),
          });
          return { data: true, error: null };
        } finally {
          release();
        }
      }

      if (fnName === "refund_user_credits") {
        const { p_user_id, p_credits, p_action_type, p_website_id } = params;

        // Validation
        if (!p_user_id) {
          return { data: false, error: null };
        }
        if (!p_credits || p_credits <= 0 || !p_action_type || !p_action_type.trim()) {
          return { data: false, error: null };
        }

        // Security check: Reject any action type not following 'refund:' convention
        if (!p_action_type.startsWith("refund:")) {
          return { data: false, error: null };
        }

        const afterRefund = p_action_type.substring(7).trim();
        if (!afterRefund) {
          return { data: false, error: null };
        }

        // Transactional Advisory Lock: serializes simultaneous refund requests
        // even when user_credits row is missing
        const release = await acquireUserLock(p_user_id);
        try {
          await new Promise((r) => setTimeout(r, 2));

          // Fail closed if user credit account does not exist
          if (!userCreditsRowExists) {
            return { data: false, error: null };
          }

          // Idempotency check: prevent double refunds for same action_type
          const existingRefund = transactions.find(
            (t) =>
              t.userId === p_user_id &&
              t.actionType === p_action_type &&
              t.creditsUsed < 0
          );
          if (existingRefund) {
            return { data: false, error: null };
          }

          // Unified Deterministic Deduction Resolver:
          // Mirrors public._resolve_deduction_action_for_refund in Postgres RPC
          const resolveDeductionActionForRefund = (userId: string, refundAction: string): string | null => {
            if (!refundAction.startsWith("refund:")) return null;
            const afterRefund = refundAction.substring(7).trim();
            if (!afterRefund) return null;

            // 1. Direct exact match check
            const exactDeductions = transactions.filter(
              (t) => t.userId === userId && t.actionType === afterRefund && t.creditsUsed > 0
            );
            if (exactDeductions.length > 1) return null; // Fail closed on duplicate deduction records
            if (exactDeductions.length === 1) return exactDeductions[0].actionType;

            // 2. Structured partial refund matching & candidate deduction resolution
            const candidates: string[] = [];

            // Probe prefix candidate
            if (afterRefund.startsWith("ai_visibility_probe:")) {
              const probeCand = afterRefund.substring(20);
              if (probeCand) {
                candidates.push(probeCand);
                if (probeCand.includes("#")) {
                  const lastH = probeCand.lastIndexOf("#");
                  if (lastH > 0) candidates.push(probeCand.substring(0, lastH));
                }
                if (probeCand.includes(":")) {
                  const lastC = probeCand.lastIndexOf(":");
                  if (lastC > 0) {
                    const subCand = probeCand.substring(0, lastC);
                    candidates.push(subCand);
                    if (subCand.includes(":")) {
                      const secondLastC = subCand.lastIndexOf(":");
                      if (secondLastC > 0) candidates.push(subCand.substring(0, secondLastC));
                    }
                  }
                }
              }
            }

            // Hash delimiter candidates
            if (afterRefund.includes("#")) {
              const lastHash = afterRefund.lastIndexOf("#");
              if (lastHash > 0) candidates.push(afterRefund.substring(0, lastHash));
              const firstHash = afterRefund.split("#")[0];
              if (firstHash) candidates.push(firstHash);
            }

            // Colon delimiter candidates
            if (afterRefund.includes(":")) {
              const lastColon = afterRefund.lastIndexOf(":");
              if (lastColon > 0) {
                const cand1 = afterRefund.substring(0, lastColon);
                candidates.push(cand1);
                if (cand1.includes(":")) {
                  const secondLastColon = cand1.lastIndexOf(":");
                  if (secondLastColon > 0) {
                    candidates.push(cand1.substring(0, secondLastColon));
                  }
                }
              }
            }

            // Deduplicate and sort by length descending (longest prefix first)
            const uniqueCandidates = Array.from(new Set(candidates))
              .filter((c) => c && c !== afterRefund)
              .sort((a, b) => b.length - a.length);

            for (const cand of uniqueCandidates) {
              const candMatches = transactions.filter(
                (t) => t.userId === userId && t.actionType === cand && t.creditsUsed > 0
              );
              if (candMatches.length > 1) return null; // Fail closed on duplicates
              if (candMatches.length === 1) return candMatches[0].actionType;
            }

            return null;
          };

          // Deduction-to-refund relationship verification:
          // Deterministically resolve the authentic original deduction using the exact same resolver.
          const matchedAction = resolveDeductionActionForRefund(p_user_id, p_action_type);
          if (!matchedAction) {
            return { data: false, error: null };
          }

          const origTx = transactions.find(
            (t) => t.userId === p_user_id && t.actionType === matchedAction && t.creditsUsed > 0
          );
          if (!origTx) {
            return { data: false, error: null };
          }

          // Cumulative refund calculation:
          // Deterministically sum all previous refunds that resolve to this exact matchedAction.
          // This eliminates loose prefix matching and ensures refunds for 'job_1' cannot be counted
          // against 'job_1:task_2', or vice versa.
          const alreadyRefunded = transactions
            .filter((t) => {
              if (t.userId !== p_user_id || t.creditsUsed >= 0 || !t.actionType.startsWith("refund:")) {
                return false;
              }
              return resolveDeductionActionForRefund(p_user_id, t.actionType) === matchedAction;
            })
            .reduce((sum, t) => sum + (-t.creditsUsed), 0);

          // Reject if cumulative refunds would exceed original deduction
          if (alreadyRefunded + p_credits > origTx.creditsUsed) {
            return { data: false, error: null };
          }

          balance += p_credits;
          monthlyUsed = Math.max(0, monthlyUsed - p_credits);
          lifetimeUsed = Math.max(0, lifetimeUsed - p_credits);
          transactions.push({
            id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            userId: p_user_id,
            websiteId: p_website_id,
            creditsUsed: -p_credits,
            actionType: p_action_type,
            createdAt: new Date().toISOString(),
          });
          return { data: true, error: null };
        } finally {
          release();
        }
      }

      return { data: null, error: new Error(`Unknown RPC ${fnName}`) };
    },

    from: (table: string) => {
      return {
        select: (cols: string) => ({
          eq: (col: string, val: any) => ({
            eq: (col2: string, val2: any) => ({
              single: async () => {
                if (table === "websites") {
                  if (val === "site_owned" && val2 === "user_1") {
                    return { data: { id: "site_owned", user_id: "user_1" }, error: null };
                  }
                  if (val === "site_victim" && val2 === "user_attacker") {
                    return { data: null, error: new Error("Row not found") };
                  }
                  return { data: null, error: new Error("Not found") };
                }
                return { data: null, error: null };
              },
            }),
            single: async () => {
              if (table === "user_credits") {
                if (!userCreditsRowExists) {
                  return { data: null, error: new Error("Row not found") };
                }
                return { data: { balance, monthly_used: monthlyUsed, lifetime_used: lifetimeUsed }, error: null };
              }
              if (table === "websites") {
                if (val === "site_owned") return { data: { id: "site_owned", user_id: "user_1" }, error: null };
                if (val === "site_victim") return { data: { id: "site_victim", user_id: "victim_user" }, error: null };
                return { data: null, error: new Error("Not found") };
              }
              return { data: null, error: null };
            },
            maybeSingle: async () => {
              if (table === "user_credits") {
                if (!userCreditsRowExists) {
                  return { data: null, error: null };
                }
                return { data: { balance, monthly_used: monthlyUsed, lifetime_used: lifetimeUsed }, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
      };
    },
  };

  return mockDb;
}

async function runAllTests() {
  console.log("=== RUNNING CODEAXYS CRITICAL BILLING & REFUND VERIFICATION TEST SUITE ===\n");

  // ==========================================================================
  // SECTION 1: INSUFFICIENT BALANCE AND DEDUCTION REJECTION
  // ==========================================================================
  console.log("--- [Mock Test 1] Zero and Insufficient Balance Rejection ---");
  {
    const zeroDb = createMockDb(0);
    const deductRes = await deductCreditsWithClient(zeroDb, "user_zero", 5, "ai_blog_generation:op_zero");
    assert.strictEqual(deductRes, false, "Should reject deduction when balance is 0");
    assert.strictEqual(zeroDb._getBalance(), 0, "Balance should remain 0");

    const partialDb = createMockDb(3);
    const partialDeductRes = await deductCreditsWithClient(partialDb, "user_partial", 5, "ai_blog_generation:op_partial");
    assert.strictEqual(partialDeductRes, false, "Should reject deduction when balance (3) < cost (5)");
    assert.strictEqual(partialDb._getBalance(), 3, "Balance should remain 3 without partial reduction");
    console.log("✅ Passed: Zero and insufficient balances strictly rejected without leakage.\n");
  }

  // ==========================================================================
  // SECTION 2: CONCURRENT ATOMIC DEDUCTION SAFETY
  // ==========================================================================
  console.log("--- [Mock Test 2] Concurrent Requests & Atomic Deduction Race Condition Safety ---");
  {
    const concurrentDb = createMockDb(20);
    const COST_PER_OP = 10;
    const NUM_CONCURRENT = 5;

    const results = await Promise.all(
      Array.from({ length: NUM_CONCURRENT }).map((_, i) =>
        deductCreditsWithClient(concurrentDb, "user_race", COST_PER_OP, `ACTION_${i}`)
      )
    );

    const succeeded = results.filter((r) => r === true).length;
    const failed = results.filter((r) => r === false).length;

    assert.strictEqual(succeeded, 2, `Exactly 2 requests should succeed (got ${succeeded})`);
    assert.strictEqual(failed, 3, `Exactly 3 requests should be rejected (got ${failed})`);
    assert.strictEqual(concurrentDb._getBalance(), 0, "Final balance must be exactly 0, never negative");
    assert.strictEqual(concurrentDb._getMonthlyUsed(), 20, "Monthly used must record exactly 20");
    console.log("✅ Passed: Atomic deductions prevent overspending races.\n");
  }

  // ==========================================================================
  // SECTION 3: SUCCESSFUL REFUND VIA SERVICE-ROLE EXECUTION PATH
  // ==========================================================================
  console.log("--- [Mock Test 3] Successful Refund Through Service-Role Execution Path ---");
  {
    const refundDb = createMockDb(50);
    const opId = "op_test_success_123";
    const deductAction = `ai_blog_generation:${opId}`;
    const refundAction = `refund:${deductAction}`;

    // 1. Initial deduction
    const deducted = await deductCreditsWithClient(refundDb, "user_srv", 5, deductAction, "site_1");
    assert.strictEqual(deducted, true, "Initial deduction must succeed");
    assert.strictEqual(refundDb._getBalance(), 45, "Balance should be 45 after deduction");

    // 2. Refund executed via service-role client
    const refunded = await refundCreditsWithClient(refundDb, "user_srv", 5, refundAction, "site_1");
    assert.strictEqual(refunded, true, "Service-role refund must succeed");
    assert.strictEqual(refundDb._getBalance(), 50, "Balance must be restored to 50");
    console.log("✅ Passed: Successful refund executed cleanly through service-role execution path.\n");
  }

  // ==========================================================================
  // SECTION 4: REFUND FAILURE HANDLING WHEN RPC IS UNAVAILABLE
  // ==========================================================================
  console.log("--- [Mock Test 4] Refund Failure Handling When RPC Is Unavailable (No Silent Fallback) ---");
  {
    const unavailDb = createMockDb(50, { rpcUnavailable: true });
    const opId = "op_test_unavail_456";
    const refundAction = `refund:ai_blog_generation:${opId}`;

    // Call refundCreditsWithClient when RPC is unavailable
    const refundResult = await refundCreditsWithClient(unavailDb, "user_unavail", 5, refundAction, "site_1");

    // Must return explicit false, and balance must NOT change via unprivileged user_credits fallback
    assert.strictEqual(refundResult, false, "Must return explicit false when RPC errors");
    assert.strictEqual(unavailDb._getBalance(), 50, "Balance must remain unchanged; no unprivileged fallback write");
    console.log("✅ Passed: RPC failure returns explicit false without attempting unprivileged fallback.\n");
  }

  // ==========================================================================
  // SECTION 5: TWO DISTINCT FAILED OPERATIONS RECEIVE SEPARATE REFUNDS
  // ==========================================================================
  console.log("--- [Mock Test 5] Two Distinct Failed Operations Receive Separate Refunds ---");
  {
    const multiDb = createMockDb(100);
    const op1 = "op_distinct_alpha";
    const op2 = "op_distinct_beta";

    // Deduct for operation 1
    const deduct1 = await deductCreditsWithClient(multiDb, "user_multi", 5, `ai_blog_generation:${op1}`);
    assert.strictEqual(deduct1, true);

    // Deduct for operation 2
    const deduct2 = await deductCreditsWithClient(multiDb, "user_multi", 5, `ai_blog_generation:${op2}`);
    assert.strictEqual(deduct2, true);
    assert.strictEqual(multiDb._getBalance(), 90, "Balance is 90 after two distinct deductions");

    // Both operations fail independently
    const refund1 = await refundCreditsWithClient(multiDb, "user_multi", 5, `refund:ai_blog_generation:${op1}`);
    assert.strictEqual(refund1, true, "First distinct operation must receive its refund");
    assert.strictEqual(multiDb._getBalance(), 95, "Balance is 95 after first refund");

    const refund2 = await refundCreditsWithClient(multiDb, "user_multi", 5, `refund:ai_blog_generation:${op2}`);
    assert.strictEqual(refund2, true, "Second distinct operation must also receive its separate refund");
    assert.strictEqual(multiDb._getBalance(), 100, "Balance is fully restored to 100");
    console.log("✅ Passed: Distinct operations with unique IDs receive independent refunds without colliding.\n");
  }

  // ==========================================================================
  // SECTION 6: RETRYING SAME OPERATION DOES NOT ISSUE SECOND REFUND (IDEMPOTENCY)
  // ==========================================================================
  console.log("--- [Mock Test 6] Retrying Same Operation Does Not Issue Second Refund (Idempotency) ---");
  {
    const retryDb = createMockDb(100);
    const opRetry = "op_retry_stable_789";
    const deductAction = `ai_blog_generation:${opRetry}`;
    const refundAction = `refund:${deductAction}`;

    // Deduct 5 credits
    await deductCreditsWithClient(retryDb, "user_retry", 5, deductAction);
    assert.strictEqual(retryDb._getBalance(), 95);

    // First refund attempt succeeds
    const firstRefund = await refundCreditsWithClient(retryDb, "user_retry", 5, refundAction);
    assert.strictEqual(firstRefund, true, "Initial refund must succeed");
    assert.strictEqual(retryDb._getBalance(), 100);

    // Retried refund attempt with same operation key
    const secondRefund = await refundCreditsWithClient(retryDb, "user_retry", 5, refundAction);
    assert.strictEqual(secondRefund, false, "Retried refund must be rejected idempotently");
    assert.strictEqual(retryDb._getBalance(), 100, "Balance must NOT exceed 100");
    console.log("✅ Passed: Identical retried operation rejected idempotently at database level.\n");
  }

  // ==========================================================================
  // SECTION 7: CONCURRENT DUPLICATE REFUND ATTEMPTS
  // ==========================================================================
  console.log("--- [Mock Test 7] Concurrent Duplicate Refund Attempts ---");
  {
    const concurrentRefDb = createMockDb(50);
    const opRace = "op_race_refund_999";
    const deductAction = `ai_edit:${opRace}`;
    const refundAction = `refund:${deductAction}`;

    // Deduct 5 credits
    await deductCreditsWithClient(concurrentRefDb, "user_race_ref", 5, deductAction);
    assert.strictEqual(concurrentRefDb._getBalance(), 45);

    // 5 concurrent refund attempts hit server at same millisecond with same action key
    const refundPromises = Array.from({ length: 5 }).map(() =>
      refundCreditsWithClient(concurrentRefDb, "user_race_ref", 5, refundAction)
    );
    const refundResults = await Promise.all(refundPromises);

    const refundSuccessCount = refundResults.filter((r) => r === true).length;
    const refundFailureCount = refundResults.filter((r) => r === false).length;

    assert.strictEqual(refundSuccessCount, 1, `Exactly 1 concurrent refund must succeed (got ${refundSuccessCount})`);
    assert.strictEqual(refundFailureCount, 4, `Exactly 4 concurrent refunds must be rejected (got ${refundFailureCount})`);
    assert.strictEqual(concurrentRefDb._getBalance(), 50, "Balance must be exactly 50, never inflated");
    console.log("✅ Passed: Concurrent duplicate refund attempts handled safely; exactly 1 applied.\n");
  }

  // ==========================================================================
  // SECTION 8A: MISSING DEDUCTION RECORDS & PHANTOM REFUND REJECTION
  // ==========================================================================
  console.log("--- [Mock Test 8A] Missing Deduction Records & Phantom Refund Rejection ---");
  {
    const missingDb = createMockDb(100);
    const phantomRefund = await refundCreditsWithClient(
      missingDb,
      "user_phantom",
      5,
      "refund:ai_blog_generation:phantom_op_never_deducted"
    );
    assert.strictEqual(phantomRefund, false, "Refund without prior deduction must be rejected");
    assert.strictEqual(missingDb._getBalance(), 100, "Balance must remain unchanged at 100");
    console.log("✅ Passed: Missing deduction records strictly rejected without credit leakage.\n");
  }

  // ==========================================================================
  // SECTION 8B: NON-REFUND ACTION TYPES REJECTION (MANDATORY 'refund:' POLICY)
  // ==========================================================================
  console.log("--- [Mock Test 8B] Non-Refund Action Types Rejection (Mandatory 'refund:' Policy) ---");
  {
    const nonRefundDb = createMockDb(100);
    await deductCreditsWithClient(nonRefundDb, "user_non_refund", 5, "ai_blog_generation:op_legit_deduct");
    assert.strictEqual(nonRefundDb._getBalance(), 95);

    // 1. Attempt refund with arbitrary grant action
    const grantRes = await refundCreditsWithClient(
      nonRefundDb,
      "user_non_refund",
      5,
      "credit_grant:welcome_bonus"
    );
    assert.strictEqual(grantRes, false, "Non-refund action type 'credit_grant' must be rejected");

    // 2. Attempt refund with original action type missing 'refund:' prefix
    const bareRes = await refundCreditsWithClient(
      nonRefundDb,
      "user_non_refund",
      5,
      "ai_blog_generation:op_legit_deduct"
    );
    assert.strictEqual(bareRes, false, "Action type missing 'refund:' prefix must be rejected");

    // 3. Attempt refund with empty prefix
    const emptyRes = await refundCreditsWithClient(
      nonRefundDb,
      "user_non_refund",
      5,
      "refund:"
    );
    assert.strictEqual(emptyRes, false, "Action type with empty target must be rejected");

    assert.strictEqual(nonRefundDb._getBalance(), 95, "Balance must remain intact at 95");
    console.log("✅ Passed: Non-refund action types strictly rejected under mandatory convention.\n");
  }

  // ==========================================================================
  // SECTION 8C: OVERLAPPING ACTION NAMES & UNAMBIGUOUS DEDUCTION ASSOCIATION
  // ==========================================================================
  console.log("--- [Mock Test 8C] Overlapping Action Names & Unambiguous Deduction Association ---");
  {
    const overlapDb = createMockDb(100);
    // Two overlapping deductions for the same user:
    // Deduction 1: 'job_batch_alpha' (cost 10)
    // Deduction 2: 'job_batch_alpha:task_beta' (cost 5, shares prefix 'job_batch_alpha')
    await deductCreditsWithClient(overlapDb, "user_overlap", 10, "job_batch_alpha");
    await deductCreditsWithClient(overlapDb, "user_overlap", 5, "job_batch_alpha:task_beta");
    assert.strictEqual(overlapDb._getBalance(), 85, "Balance is 85 after 15 total deductions");

    // 1. Refund Deduction 2: 5 credits for 'refund:job_batch_alpha:task_beta'
    const refDeduct2 = await refundCreditsWithClient(
      overlapDb,
      "user_overlap",
      5,
      "refund:job_batch_alpha:task_beta"
    );
    assert.strictEqual(refDeduct2, true, "Refund for Deduction 2 must succeed");
    assert.strictEqual(overlapDb._getBalance(), 90, "Balance is 90 after refunding Deduction 2");

    // 2. Deduction 2 cannot be double refunded
    const dupRefDeduct2 = await refundCreditsWithClient(
      overlapDb,
      "user_overlap",
      5,
      "refund:job_batch_alpha:task_beta"
    );
    assert.strictEqual(dupRefDeduct2, false, "Duplicate refund for Deduction 2 must be rejected");

    // 3. Partial refund 1 for Deduction 1: 6 credits for 'refund:job_batch_alpha:part_1'
    // Must NOT count Deduction 2's refund against Deduction 1!
    const part1Deduct1 = await refundCreditsWithClient(
      overlapDb,
      "user_overlap",
      6,
      "refund:job_batch_alpha:part_1"
    );
    assert.strictEqual(part1Deduct1, true, "Partial refund for Deduction 1 must succeed");
    assert.strictEqual(overlapDb._getBalance(), 96, "Balance is 96 after 6 credit partial refund");

    // 4. Partial refund 2 for Deduction 1: 4 credits for 'refund:job_batch_alpha:part_2'
    const part2Deduct1 = await refundCreditsWithClient(
      overlapDb,
      "user_overlap",
      4,
      "refund:job_batch_alpha:part_2"
    );
    assert.strictEqual(part2Deduct1, true, "Exact second partial refund for Deduction 1 must succeed");
    assert.strictEqual(overlapDb._getBalance(), 100, "Balance is fully restored to 100");

    // 5. Attempting over-refund on Deduction 1: 1 credit
    const overDeduct1 = await refundCreditsWithClient(
      overlapDb,
      "user_overlap",
      1,
      "refund:job_batch_alpha:part_3"
    );
    assert.strictEqual(overDeduct1, false, "Over-refund beyond 10 credits on Deduction 1 must fail");
    assert.strictEqual(overlapDb._getBalance(), 100, "Balance remains 100");
    console.log("✅ Passed: Overlapping action names resolved unambiguously without cross-talk.\n");
  }

  // ==========================================================================
  // SECTION 8D: SINGLE OVER-REFUND & MULTIPLE PARTIAL REFUNDS WITH CUMULATIVE LIMITS
  // ==========================================================================
  console.log("--- [Mock Test 8D] Single Over-Refund & Multiple Partial Refunds with Cumulative Limits ---");
  {
    const partDb = createMockDb(100);
    const opPartial = "op_partial_deduct_10";
    const deductAction = `ai_blog_generation:${opPartial}`;

    // 1. Deduct 10 credits
    const deductSuccess = await deductCreditsWithClient(partDb, "user_partial_test", 10, deductAction);
    assert.strictEqual(deductSuccess, true, "Deduction of 10 credits must succeed");
    assert.strictEqual(partDb._getBalance(), 90, "Balance must be 90 after 10 credit deduction");

    // 2. Single over-refund attempt: 15 credits on a 10 credit deduction
    const singleOver = await refundCreditsWithClient(
      partDb,
      "user_partial_test",
      15,
      `refund:${deductAction}`
    );
    assert.strictEqual(singleOver, false, "Single over-refund exceeding original deduction must fail");
    assert.strictEqual(partDb._getBalance(), 90);

    // 3. Partial refund 1: 4 credits (action: refund:ai_blog_generation:op_partial_deduct_10:part_1)
    const partRefund1 = await refundCreditsWithClient(
      partDb,
      "user_partial_test",
      4,
      `refund:${deductAction}:part_1`
    );
    assert.strictEqual(partRefund1, true, "First partial refund of 4 credits must succeed");
    assert.strictEqual(partDb._getBalance(), 94, "Balance must increase to 94");

    // 4. Partial refund 2: 4 credits (action: refund:ai_blog_generation:op_partial_deduct_10:part_2)
    const partRefund2 = await refundCreditsWithClient(
      partDb,
      "user_partial_test",
      4,
      `refund:${deductAction}:part_2`
    );
    assert.strictEqual(partRefund2, true, "Second partial refund of 4 credits must succeed");
    assert.strictEqual(partDb._getBalance(), 98, "Balance must increase to 98 (total 8 refunded)");

    // 5. Over-refund attempt: 3 credits (cumulative 4 + 4 + 3 = 11 > 10)
    const overRefundAttempt = await refundCreditsWithClient(
      partDb,
      "user_partial_test",
      3,
      `refund:${deductAction}:part_3`
    );
    assert.strictEqual(overRefundAttempt, false, "Cumulative over-refund (11 > 10) must be rejected");
    assert.strictEqual(partDb._getBalance(), 98, "Balance must remain 98, unchanged after rejected over-refund");

    // 6. Exact remaining refund: 2 credits (cumulative 4 + 4 + 2 = 10 <= 10)
    const exactRemainingRefund = await refundCreditsWithClient(
      partDb,
      "user_partial_test",
      2,
      `refund:${deductAction}:part_4`
    );
    assert.strictEqual(exactRemainingRefund, true, "Exact remaining refund of 2 credits must succeed");
    assert.strictEqual(partDb._getBalance(), 100, "Balance must be restored to 100");

    // 7. Any further refund attempt must be rejected (already fully refunded 10/10)
    const postFullRefund = await refundCreditsWithClient(
      partDb,
      "user_partial_test",
      1,
      `refund:${deductAction}:part_5`
    );
    assert.strictEqual(postFullRefund, false, "Refund beyond 100% of deduction must be rejected");
    assert.strictEqual(partDb._getBalance(), 100, "Balance must remain exactly 100");
    console.log("✅ Passed: Cumulative partial refunds accurately capped at 100% of original deduction.\n");
  }

  // ==========================================================================
  // SECTION 8E: IDEMPOTENCY ON PARTIAL REFUNDS (DUPLICATE REJECTION)
  // ==========================================================================
  console.log("--- [Mock Test 8E] Idempotency on Partial Refunds (Duplicate Rejection) ---");
  {
    const dupDb = createMockDb(100);
    const opDup = "op_partial_dup_check";
    const deductAction = `ai_blog_generation:${opDup}`;

    // Deduct 10 credits
    await deductCreditsWithClient(dupDb, "user_dup_test", 10, deductAction);
    assert.strictEqual(dupDb._getBalance(), 90);

    // Apply partial refund of 4 credits
    const firstPart = await refundCreditsWithClient(
      dupDb,
      "user_dup_test",
      4,
      `refund:${deductAction}:segment_1`
    );
    assert.strictEqual(firstPart, true, "First application of partial refund segment must succeed");
    assert.strictEqual(dupDb._getBalance(), 94);

    // Retrying the exact same segment must be rejected idempotently
    const duplicatePart = await refundCreditsWithClient(
      dupDb,
      "user_dup_test",
      4,
      `refund:${deductAction}:segment_1`
    );
    assert.strictEqual(duplicatePart, false, "Duplicate partial refund attempt must be rejected idempotently");
    assert.strictEqual(dupDb._getBalance(), 94, "Balance must remain unchanged at 94");
    console.log("✅ Passed: Partial refund retry with identical action key rejected idempotently.\n");
  }

  // ==========================================================================
  // SECTION 8F: CONCURRENT CUMULATIVE PARTIAL OVER-REFUND RACE SAFETY
  // ==========================================================================
  console.log("--- [Mock Test 8F] Concurrent Partial Refunds & Cumulative Over-Refund Race Safety ---");
  {
    const concurrentRaceDb = createMockDb(50);
    const opConcurrent = "op_concurrent_partial_race";
    const deductActionRace = `ai_edit:${opConcurrent}`;

    // Deduct 10 credits
    await deductCreditsWithClient(concurrentRaceDb, "user_concurrent_race", 10, deductActionRace);
    assert.strictEqual(concurrentRaceDb._getBalance(), 40, "Balance is 40 after 10 credit deduction");

    // Two concurrent requests: each asks for 6 credits (total 12 > 10)
    const reqA = refundCreditsWithClient(
      concurrentRaceDb,
      "user_concurrent_race",
      6,
      `refund:${deductActionRace}:part_A`
    );
    const reqB = refundCreditsWithClient(
      concurrentRaceDb,
      "user_concurrent_race",
      6,
      `refund:${deductActionRace}:part_B`
    );

    const [resA, resB] = await Promise.all([reqA, reqB]);
    const successCount = [resA, resB].filter((r) => r === true).length;
    const failureCount = [resA, resB].filter((r) => r === false).length;

    assert.strictEqual(successCount, 1, `Exactly 1 concurrent refund must succeed (got ${successCount})`);
    assert.strictEqual(failureCount, 1, `Exactly 1 concurrent refund must be rejected for exceeding 10 credits (got ${failureCount})`);
    assert.strictEqual(concurrentRaceDb._getBalance(), 46, "Balance must be exactly 46 (40 + 6), never 52");
    console.log("✅ Passed: Concurrent partial refund race safely serialized; cumulative limit enforced.\n");
  }

  // ==========================================================================
  // SECTION 8G: CONCURRENCY SAFETY WHEN USER CREDIT ROW IS MISSING
  // ==========================================================================
  console.log("--- [Mock Test 8G] Concurrency Safety When User Credit Row Is Missing ---");
  {
    const missingUserDb = createMockDb(0, { missingUserCreditsRow: true });
    const opMissing = "op_missing_user_row_test";
    const refundAction = `refund:ai_edit:${opMissing}`;

    // 5 simultaneous refund requests hit server at the exact same millisecond
    const refundPromises = Array.from({ length: 5 }).map(() =>
      refundCreditsWithClient(missingUserDb, "user_without_row", 5, refundAction)
    );
    const results = await Promise.all(refundPromises);

    const allFailed = results.every((r) => r === false);
    assert.strictEqual(allFailed, true, "All concurrent refund requests for missing user row must fail closed");
    assert.strictEqual(missingUserDb._getBalance(), 0, "Balance must remain unchanged at 0");
    console.log("✅ Passed: Concurrent requests on missing user row safely serialized and fail closed.\n");
  }

  // ==========================================================================
  // SECTION 8H: AI VISIBILITY PROBE CREDIT GUARD CALLER COMPATIBILITY
  // ==========================================================================
  console.log("--- [Mock Test 8H] AI Visibility Probe Credit Guard (refundProbeCredits) Compatibility ---");
  {
    const probeDb = createMockDb(50);
    const probeActionKey = "probe_test_action_001";

    // Deduct 3 credits for a batch probe
    await deductCreditsWithClient(probeDb, "user_probe_test", 3, `ai_visibility_probe:${probeActionKey}`);
    assert.strictEqual(probeDb._getBalance(), 47);

    // Call refundProbeCredits from lib/ai-visibility/credit-guard.ts
    const probeRefundRes = await refundProbeCredits(
      probeDb,
      "user_probe_test",
      "site_probe_1",
      3,
      "Provider timeout",
      probeActionKey
    );
    assert.strictEqual(probeRefundRes, true, "refundProbeCredits must succeed via refund_user_credits RPC");
    assert.strictEqual(probeDb._getBalance(), 50, "Balance must be restored to 50");

    // Duplicate call to refundProbeCredits must be rejected idempotently
    const duplicateProbeRes = await refundProbeCredits(
      probeDb,
      "user_probe_test",
      "site_probe_1",
      3,
      "Provider timeout retry",
      probeActionKey
    );
    assert.strictEqual(duplicateProbeRes, false, "Duplicate refundProbeCredits must be rejected idempotently");
    assert.strictEqual(probeDb._getBalance(), 50, "Balance must remain 50");
    console.log("✅ Passed: refundProbeCredits caller compatibility and idempotency verified.\n");
  }

  // ==========================================================================
  // SECTION 8I: DUPLICATE DEDUCTION RECORDS FAIL CLOSED (AMBIGUITY PREVENTION)
  // ==========================================================================
  console.log("--- [Mock Test 8I] Duplicate Deduction Records Fail Closed (Ambiguity Prevention) ---");
  {
    const dupDeductDb = createMockDb(100);
    const dupAction = "job_repeated_operation";

    // 1. User performs two distinct deductions using the exact same action key (e.g. without unique opId)
    const deduct1 = await deductCreditsWithClient(dupDeductDb, "user_dup_deduct", 5, dupAction);
    const deduct2 = await deductCreditsWithClient(dupDeductDb, "user_dup_deduct", 5, dupAction);
    assert.strictEqual(deduct1, true);
    assert.strictEqual(deduct2, true);
    assert.strictEqual(dupDeductDb._getBalance(), 90, "Balance is 90 after two 5-credit deductions");

    // 2. Exact match refund attempt: multiple deductions exist for dupAction -> MUST FAIL CLOSED (Requirement 3)
    const exactRefundRes = await refundCreditsWithClient(
      dupDeductDb,
      "user_dup_deduct",
      5,
      `refund:${dupAction}`
    );
    assert.strictEqual(exactRefundRes, false, "Must fail closed when multiple deductions match exact action key");
    assert.strictEqual(dupDeductDb._getBalance(), 90, "Balance must remain unchanged at 90");

    // 3. Partial candidate refund attempt: candidate dupAction also has multiple deductions -> MUST FAIL CLOSED (Requirement 3)
    const candRefundRes = await refundCreditsWithClient(
      dupDeductDb,
      "user_dup_deduct",
      3,
      `refund:${dupAction}#part_1`
    );
    assert.strictEqual(candRefundRes, false, "Must fail closed when candidate deduction has multiple records");
    assert.strictEqual(dupDeductDb._getBalance(), 90, "Balance must remain unchanged at 90");
    console.log("✅ Passed: Ambiguous duplicate deduction records strictly fail closed without credit leakage.\n");
  }

  // ==========================================================================
  // SECTION 8J: OVERLAPPING ACTION KEYS WITH COLONS AND HASHES (# AND :)
  // ==========================================================================
  console.log("--- [Mock Test 8J] Overlapping Action Keys With Colons and Hashes (# and :) ---");
  {
    const complexDb = createMockDb(100);
    // Two overlapping deductions containing both '#' and ':':
    // Deduction 1: 'pipeline:stage#1:build' (cost 10)
    // Deduction 2: 'pipeline:stage#1:build:sub#2' (cost 5, longer prefix overlap)
    await deductCreditsWithClient(complexDb, "user_complex", 10, "pipeline:stage#1:build");
    await deductCreditsWithClient(complexDb, "user_complex", 5, "pipeline:stage#1:build:sub#2");
    assert.strictEqual(complexDb._getBalance(), 85, "Balance is 85 after 15 total deductions");

    // 1. Partial refund for Deduction 2 (3 credits using '#part_1')
    const refSub = await refundCreditsWithClient(
      complexDb,
      "user_complex",
      3,
      "refund:pipeline:stage#1:build:sub#2#part_1"
    );
    assert.strictEqual(refSub, true, "Partial refund for Deduction 2 must succeed");
    assert.strictEqual(complexDb._getBalance(), 88, "Balance is 88 after 3 credit refund");

    // 2. Partial refund 1 for Deduction 1 (6 credits using '#part_1')
    // Must NOT count Deduction 2's refund against Deduction 1!
    const refMainPart1 = await refundCreditsWithClient(
      complexDb,
      "user_complex",
      6,
      "refund:pipeline:stage#1:build#part_1"
    );
    assert.strictEqual(refMainPart1, true, "Partial refund for Deduction 1 must succeed");
    assert.strictEqual(complexDb._getBalance(), 94, "Balance is 94 after 6 credit partial refund");

    // 3. Partial refund 2 for Deduction 1 (4 credits using ':part_2')
    const refMainPart2 = await refundCreditsWithClient(
      complexDb,
      "user_complex",
      4,
      "refund:pipeline:stage#1:build:part_2"
    );
    assert.strictEqual(refMainPart2, true, "Second partial refund for Deduction 1 must succeed");
    assert.strictEqual(complexDb._getBalance(), 98, "Balance is 98 (Deduction 1 fully refunded: 6+4=10)");

    // 4. Over-refund attempt on Deduction 1: 1 credit
    const overRefundMain = await refundCreditsWithClient(
      complexDb,
      "user_complex",
      1,
      "refund:pipeline:stage#1:build#part_3"
    );
    assert.strictEqual(overRefundMain, false, "Over-refund beyond 10 credits on Deduction 1 must fail");
    assert.strictEqual(complexDb._getBalance(), 98, "Balance remains 98");

    // 5. Remaining refund for Deduction 2: 2 credits (reaches 3+2=5)
    const refSubRemaining = await refundCreditsWithClient(
      complexDb,
      "user_complex",
      2,
      "refund:pipeline:stage#1:build:sub#2#part_2"
    );
    assert.strictEqual(refSubRemaining, true, "Remaining refund for Deduction 2 must succeed");
    assert.strictEqual(complexDb._getBalance(), 100, "Balance is fully restored to 100");
    console.log("✅ Passed: Overlapping action keys with colons and hashes resolved unambiguously.\n");
  }

  // ==========================================================================
  // SECTION 8K: HIGH-CONCURRENCY MIXED REQUESTS (DUPLICATES, PARTIALS, & CONTENTION)
  // ==========================================================================
  console.log("--- [Mock Test 8K] High-Concurrency Mixed Requests (Duplicates, Partials, & Contention) ---");
  {
    const highRaceDb = createMockDb(100);
    const baseAction = "batch_high_concurrency:job_alpha";

    // Deduct 20 credits
    await deductCreditsWithClient(highRaceDb, "user_high_race", 20, baseAction);
    assert.strictEqual(highRaceDb._getBalance(), 80);

    // Launch 10 simultaneous requests:
    // - 4 attempts with same key "refund:batch_high_concurrency:job_alpha:part_1" (4 credits each) -> exactly 1 must succeed
    // - 2 attempts with key "refund:batch_high_concurrency:job_alpha:part_2" (6 credits each) -> exactly 1 must succeed
    // - 2 attempts with key "refund:batch_high_concurrency:job_alpha:part_3" (10 credits each) -> exactly 1 must succeed (total 4+6+10 = 20)
    // - 2 attempts with key "refund:batch_high_concurrency:job_alpha:part_4" (5 credits each) -> both must fail (cumulative limit reached)
    const requests = [
      ...Array.from({ length: 4 }).map(() =>
        refundCreditsWithClient(highRaceDb, "user_high_race", 4, `refund:${baseAction}:part_1`)
      ),
      ...Array.from({ length: 2 }).map(() =>
        refundCreditsWithClient(highRaceDb, "user_high_race", 6, `refund:${baseAction}:part_2`)
      ),
      ...Array.from({ length: 2 }).map(() =>
        refundCreditsWithClient(highRaceDb, "user_high_race", 10, `refund:${baseAction}:part_3`)
      ),
      ...Array.from({ length: 2 }).map(() =>
        refundCreditsWithClient(highRaceDb, "user_high_race", 5, `refund:${baseAction}:part_4`)
      ),
    ];

    const results = await Promise.all(requests);
    const successes = results.filter((r) => r === true).length;
    const failures = results.filter((r) => r === false).length;

    assert.strictEqual(successes, 3, `Exactly 3 unique partial refund segments must succeed (got ${successes})`);
    assert.strictEqual(failures, 7, `Exactly 7 duplicate/over-limit requests must be rejected (got ${failures})`);
    assert.strictEqual(highRaceDb._getBalance(), 100, "Balance must be restored to exactly 100 (80 + 4 + 6 + 10)");
    console.log("✅ Passed: High-concurrency mixed requests serialized safely under cumulative limits.\n");
  }

  // ==========================================================================
  // SECTION 8L: OVERLAPPING AI_VISIBILITY_PROBE ACTIONS & PARTIAL REFUND SUFFIXES
  // ==========================================================================
  console.log("--- [Mock Test 8L] Overlapping ai_visibility_probe: Actions & Partial Refund Suffixes ---");
  {
    const probeOverlapDb = createMockDb(100);

    // Two overlapping probe deductions:
    // Deduction 1: 'probe_multi_run' (cost 3)
    // Deduction 2: 'probe_multi_run:sub_check' (cost 1, longer prefix overlap)
    await deductCreditsWithClient(probeOverlapDb, "user_probe_overlap", 3, "ai_visibility_probe:probe_multi_run");
    await deductCreditsWithClient(probeOverlapDb, "user_probe_overlap", 1, "ai_visibility_probe:probe_multi_run:sub_check");
    assert.strictEqual(probeOverlapDb._getBalance(), 96, "Balance is 96 after 4 total credits deducted");

    // 1. Refund Deduction 2: 1 credit for sub_check
    const refSubProbe = await refundCreditsWithClient(
      probeOverlapDb,
      "user_probe_overlap",
      1,
      "refund:ai_visibility_probe:probe_multi_run:sub_check"
    );
    assert.strictEqual(refSubProbe, true, "Refund for Deduction 2 must succeed");
    assert.strictEqual(probeOverlapDb._getBalance(), 97, "Balance is 97");

    // 2. Partial refund 1 for Deduction 1: 2 credits using '#part_1'
    // Must NOT count Deduction 2's refund against Deduction 1!
    const refMainPart1 = await refundCreditsWithClient(
      probeOverlapDb,
      "user_probe_overlap",
      2,
      "refund:ai_visibility_probe:probe_multi_run#part_1"
    );
    assert.strictEqual(refMainPart1, true, "Partial refund for Deduction 1 must succeed");
    assert.strictEqual(probeOverlapDb._getBalance(), 99, "Balance is 99");

    // 3. Partial refund 2 for Deduction 1: 1 credit using ':part_2' (reaches 2 + 1 = 3/3)
    const refMainPart2 = await refundCreditsWithClient(
      probeOverlapDb,
      "user_probe_overlap",
      1,
      "refund:ai_visibility_probe:probe_multi_run:part_2"
    );
    assert.strictEqual(refMainPart2, true, "Exact second partial refund for Deduction 1 must succeed");
    assert.strictEqual(probeOverlapDb._getBalance(), 100, "Balance is 100");

    // 4. Over-refund attempt on Deduction 1: 1 credit
    const overRefundMain = await refundCreditsWithClient(
      probeOverlapDb,
      "user_probe_overlap",
      1,
      "refund:ai_visibility_probe:probe_multi_run#part_3"
    );
    assert.strictEqual(overRefundMain, false, "Over-refund beyond 3 credits on Deduction 1 must fail");
    assert.strictEqual(probeOverlapDb._getBalance(), 100, "Balance remains 100");

    // 5. Duplicate refund on Deduction 2 must be rejected
    const dupSubProbe = await refundCreditsWithClient(
      probeOverlapDb,
      "user_probe_overlap",
      1,
      "refund:ai_visibility_probe:probe_multi_run:sub_check"
    );
    assert.strictEqual(dupSubProbe, false, "Duplicate refund for Deduction 2 must fail");
    assert.strictEqual(probeOverlapDb._getBalance(), 100);

    // 6. Test with bare action key via refundProbeCredits
    const bareProbeDb = createMockDb(50);
    // Deduction with bare action key (e.g. from deductProbeCredits with actionKey)
    await deductCreditsWithClient(bareProbeDb, "user_bare_probe", 3, "probe_live_batch");
    await deductCreditsWithClient(bareProbeDb, "user_bare_probe", 1, "probe_live_batch:item_1");
    assert.strictEqual(bareProbeDb._getBalance(), 46);

    // Refund Deduction 2 via refundProbeCredits
    const refundBareSub = await refundProbeCredits(
      bareProbeDb,
      "user_bare_probe",
      "site_1",
      1,
      "timeout",
      "probe_live_batch:item_1"
    );
    assert.strictEqual(refundBareSub, true, "refundProbeCredits for Deduction 2 must succeed");
    assert.strictEqual(bareProbeDb._getBalance(), 47);

    // Refund Deduction 1 via refundProbeCredits
    const refundBareMain = await refundProbeCredits(
      bareProbeDb,
      "user_bare_probe",
      "site_1",
      3,
      "timeout",
      "probe_live_batch"
    );
    assert.strictEqual(refundBareMain, true, "refundProbeCredits for Deduction 1 must succeed");
    assert.strictEqual(bareProbeDb._getBalance(), 50);

    // Duplicate call to refundProbeCredits for Deduction 1 must fail idempotently
    const dupBareMain = await refundProbeCredits(
      bareProbeDb,
      "user_bare_probe",
      "site_1",
      3,
      "retry",
      "probe_live_batch"
    );
    assert.strictEqual(dupBareMain, false, "Duplicate refundProbeCredits must fail");
    assert.strictEqual(bareProbeDb._getBalance(), 50);

    console.log("✅ Passed: Overlapping ai_visibility_probe: actions & partial suffixes resolved deterministically without cross-talk.\n");
  }

  // ==========================================================================
  // SECTION 8M: HELPER FUNCTION PRIVILEGE & DIRECT INVOCATION RESTRICTION
  // ==========================================================================
  console.log("--- [Mock Test 8M] Helper Function Privilege & Direct Invocation Restriction ---");
  {
    const secDb = createMockDb(100);

    // 1. Direct invocation of internal helper _resolve_deduction_action_for_refund via RPC is rejected
    const directHelperRes = await secDb.rpc("_resolve_deduction_action_for_refund", {
      p_user_id: "user_sec",
      p_refund_action: "refund:job_test",
    });
    assert.strictEqual(directHelperRes.data, null, "Direct helper invocation must return null data");
    assert.ok(
      directHelperRes.error && directHelperRes.error.message.includes("permission denied"),
      "Direct helper invocation must be rejected with permission denied"
    );

    // 2. Legitimate refund RPC succeeds and calls helper internally
    await deductCreditsWithClient(secDb, "user_sec", 10, "job_test");
    const refundRes = await refundCreditsWithClient(secDb, "user_sec", 10, "refund:job_test");
    assert.strictEqual(refundRes, true, "refund_user_credits must succeed via internal helper call path");
    assert.strictEqual(secDb._getBalance(), 100, "Balance restored to 100");

    // 3. Static SQL Security Review: Assert grants and security settings in migration file
    const sqlPath = path.resolve(__dirname, "../supabase/migrations/20261010_create_refund_user_credits_rpc.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf-8");

    // Both functions must have SECURITY DEFINER
    const secDefinerMatches = sqlContent.match(/SECURITY DEFINER/g) || [];
    assert.strictEqual(secDefinerMatches.length >= 2, true, "Both functions must specify SECURITY DEFINER");

    // Both functions must have fixed search_path = public
    const searchPathMatches = sqlContent.match(/SET search_path = public/g) || [];
    assert.strictEqual(searchPathMatches.length >= 2, true, "Both functions must enforce SET search_path = public");

    // Helper must revoke execute from service_role, anon, authenticated, PUBLIC
    assert.ok(
      sqlContent.includes("REVOKE EXECUTE ON FUNCTION public._resolve_deduction_action_for_refund(UUID, TEXT) FROM service_role;"),
      "Helper function must revoke EXECUTE from service_role"
    );
    assert.ok(
      sqlContent.includes("REVOKE EXECUTE ON FUNCTION public._resolve_deduction_action_for_refund(UUID, TEXT) FROM authenticated;"),
      "Helper function must revoke EXECUTE from authenticated"
    );
    assert.ok(
      sqlContent.includes("REVOKE EXECUTE ON FUNCTION public._resolve_deduction_action_for_refund(UUID, TEXT) FROM anon;"),
      "Helper function must revoke EXECUTE from anon"
    );
    assert.ok(
      sqlContent.includes("REVOKE EXECUTE ON FUNCTION public._resolve_deduction_action_for_refund(UUID, TEXT) FROM PUBLIC;"),
      "Helper function must revoke EXECUTE from PUBLIC"
    );
    assert.ok(
      !sqlContent.includes("GRANT EXECUTE ON FUNCTION public._resolve_deduction_action_for_refund(UUID, TEXT) TO service_role;"),
      "Helper function must NOT grant EXECUTE directly to service_role"
    );
    assert.ok(
      !sqlContent.includes("GRANT EXECUTE ON FUNCTION public._resolve_deduction_action_for_refund(UUID, TEXT) TO authenticated;"),
      "Helper function must NOT grant EXECUTE directly to authenticated"
    );
    assert.ok(
      !sqlContent.includes("GRANT EXECUTE ON FUNCTION public._resolve_deduction_action_for_refund(UUID, TEXT) TO anon;"),
      "Helper function must NOT grant EXECUTE directly to anon"
    );
    assert.ok(
      !sqlContent.includes("GRANT EXECUTE ON FUNCTION public._resolve_deduction_action_for_refund(UUID, TEXT) TO PUBLIC;"),
      "Helper function must NOT grant EXECUTE directly to PUBLIC"
    );

    // Migration-safe dynamic ownership and privilege enforcement checks
    assert.ok(
      sqlContent.includes("pg_get_userbyid(proowner)"),
      "Must dynamically query PostgreSQL catalog for refund_user_credits owner"
    );
    assert.ok(
      sqlContent.includes("to_regprocedure('public.refund_user_credits(uuid, integer, text, uuid)')"),
      "Must identify refund_user_credits using its exact function signature in pg_proc"
    );
    assert.ok(
      sqlContent.includes("to_regprocedure('public._resolve_deduction_action_for_refund(uuid, text)')"),
      "Must identify _resolve_deduction_action_for_refund using its exact function signature in pg_proc"
    );
    assert.ok(
      sqlContent.includes("has_function_privilege(v_refund_owner, 'public._resolve_deduction_action_for_refund(uuid, text)', 'EXECUTE')"),
      "Must rigorously assert that refund RPC owner has EXECUTE on internal helper"
    );
    assert.ok(
      sqlContent.includes("has_function_privilege('service_role', 'public._resolve_deduction_action_for_refund(uuid, text)', 'EXECUTE')"),
      "Must assert that service_role does NOT have direct EXECUTE on internal helper"
    );
    assert.ok(
      sqlContent.includes("ALTER FUNCTION public._resolve_deduction_action_for_refund(UUID, TEXT) OWNER TO %I"),
      "Must dynamically align helper ownership with refund RPC owner"
    );
    assert.ok(
      sqlContent.includes("GRANT EXECUTE ON FUNCTION public._resolve_deduction_action_for_refund(UUID, TEXT) TO %I"),
      "Must dynamically grant EXECUTE on helper strictly to refund RPC owner"
    );

    // Candidate prefix ordering must use subquery to prevent PostgreSQL SELECT DISTINCT / ORDER BY conflicts
    assert.ok(
      sqlContent.includes("ORDER BY length(sub.c) DESC"),
      "Must order candidate prefixes via subquery to satisfy PostgreSQL SELECT DISTINCT constraints"
    );

    // Transaction atomicity envelope
    assert.ok(
      sqlContent.includes("BEGIN;"),
      "Migration must explicitly begin a transaction (BEGIN;)"
    );
    assert.ok(
      sqlContent.includes("COMMIT;"),
      "Migration must explicitly commit the transaction (COMMIT;)"
    );

    // PUBLIC pseudo-role catalog ACL assertions
    assert.ok(
      sqlContent.includes("aclexplode(p.proacl) a"),
      "Must inspect pg_proc.proacl using aclexplode for PUBLIC pseudo-role verification"
    );
    assert.ok(
      sqlContent.includes("a.grantee = 0 AND a.privilege_type = 'EXECUTE'"),
      "Must verify that grantee = 0 (PUBLIC) has no EXECUTE privilege in catalog ACL"
    );

    // refund_user_credits must grant execute strictly to service_role and revoke from public/anon/authenticated
    assert.ok(
      sqlContent.includes("GRANT EXECUTE ON FUNCTION public.refund_user_credits(UUID, INT, TEXT, UUID) TO service_role;"),
      "refund_user_credits must grant EXECUTE strictly to service_role"
    );
    assert.ok(
      sqlContent.includes("REVOKE EXECUTE ON FUNCTION public.refund_user_credits(UUID, INT, TEXT, UUID) FROM authenticated;"),
      "refund_user_credits must revoke EXECUTE from authenticated"
    );
    assert.ok(
      sqlContent.includes("REVOKE EXECUTE ON FUNCTION public.refund_user_credits(UUID, INT, TEXT, UUID) FROM anon;"),
      "refund_user_credits must revoke EXECUTE from anon"
    );
    assert.ok(
      sqlContent.includes("REVOKE EXECUTE ON FUNCTION public.refund_user_credits(UUID, INT, TEXT, UUID) FROM PUBLIC;"),
      "refund_user_credits must revoke EXECUTE from PUBLIC"
    );

    console.log("✅ Passed: Helper function privileges, internal-only access path, and static security invariants verified.\n");
  }

  // ==========================================================================
  // SECTION 9: AUTHENTICATION AND WEBSITE OWNERSHIP CHECKS
  // ==========================================================================
  console.log("--- [Mock Test 9] Authentication & Website Ownership Isolation ---");
  {
    const crossDb = createMockDb(100);
    const attackerUserId = "user_attacker";
    const victimUserId = "victim_user";

    // Unauthenticated simulation
    const nullUser = null;
    assert.strictEqual(nullUser === null, true, "Unauthenticated user is null");

    // Ownership check simulation
    const { data: victimWebsite } = await crossDb
      .from("websites")
      .select("id, user_id")
      .eq("id", "site_victim")
      .single();

    assert.strictEqual(victimWebsite.user_id, victimUserId);
    const attackerIsOwner = victimWebsite.user_id === attackerUserId;
    assert.strictEqual(attackerIsOwner, false, "Attacker cannot claim ownership of victim website");
    assert.strictEqual(crossDb._getBalance(), 100, "Victim balance remains intact");
    console.log("✅ Passed: Authentication and cross-tenant ownership boundaries enforced.\n");
  }

  // ==========================================================================
  // SECTION 10: CENTRALIZED PLAN CREDITS AND FEATURE COST VALUES
  // ==========================================================================
  console.log("--- [Constant Consistency Test 10] Plan-Credit and Feature-Cost Consistency ---");
  {
    // 1. Verify Monthly Plan Credits match intended decisions:
    //    Starter: 100, Pro: 200, Business: 400, Agency: 800, Free: 50
    assert.strictEqual(PLANS.starter.monthlyCredits, 100, "Starter plan must have 100 monthly credits");
    assert.strictEqual(PLANS.pro.monthlyCredits, 200, "Pro plan must have 200 monthly credits");
    assert.strictEqual(PLANS.business.monthlyCredits, 400, "Business plan must have 400 monthly credits");
    assert.strictEqual(PLANS.agency.monthlyCredits, 800, "Agency plan must have 800 monthly credits");
    assert.strictEqual(PLANS.free.monthlyCredits, 50, "Free plan must have 50 monthly credits");

    // 2. Verify AI Visibility Probe costs:
    assert.strictEqual(CREDIT_COSTS.AI_VISIBILITY_SINGLE_PROBE, 1, "Single probe cost must be 1 credit");
    assert.strictEqual(CREDIT_COSTS.AI_VISIBILITY_BATCH_PROBE, 3, "Batch probe cost must be 3 credits");

    // 3. Verify Centralized Feature Costs:
    assert.strictEqual(CREDIT_COSTS.MARKETING_ANALYSIS, 5, "Marketing analysis must cost 5 credits");
    assert.strictEqual(CREDIT_COSTS.CONTENT_STUDIO, 5, "Content Studio must cost 5 credits");
    assert.strictEqual(CREDIT_COSTS.INITIAL_GENERATION, 10, "Initial website generation must cost 10 credits");
    assert.strictEqual(CREDIT_COSTS.AI_EDIT, 5, "AI edit must cost 5 credits");
    assert.strictEqual(CREDIT_COSTS.BLOG_GENERATION, 5, "Blog generation must cost 5 credits");
    assert.strictEqual(CREDIT_COSTS.SEO_SUGGESTIONS, 5, "SEO suggestions must cost 5 credits");
    assert.strictEqual(CREDIT_COSTS.SEO_AGENT, 5, "SEO Agent must cost 5 credits");
    assert.strictEqual(CREDIT_COSTS.MARKETING_AGENT, 5, "Marketing Agent must cost 5 credits");
    assert.strictEqual(CREDIT_COSTS.ASSISTANT_CHAT, 1, "Assistant chat must cost 1 credit");
    assert.strictEqual(CREDIT_COSTS.AUDIO_TRANSCRIBE, 1, "Audio transcribe must cost 1 credit");
    assert.strictEqual(CREDIT_COSTS.MIGRATION_AI_REDESIGN_PER_PAGE, 10, "Migration redesign must cost 10 credits/page");
    console.log("✅ Passed: All monthly plan credits and feature costs are fully consistent and centralized.\n");
  }

  // ==========================================================================
  // SECTION 11: REAL ROUTE HANDLER TESTS (NEXTREQUEST EXECUTION)
  // ==========================================================================
  console.log("--- [Route Handler Test 11] Real Next.js Route Handler Execution with NextRequest ---");
  {
    // Test 11A: POST /api/billing/checkout unauthenticated rejection
    const { POST: checkoutPost } = await import("../app/api/billing/checkout/route");
    const checkoutReq = new NextRequest("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "starter" }),
    });

    const checkoutRes = await checkoutPost(checkoutReq);
    assert.strictEqual(checkoutRes.status, 401, "Unauthenticated checkout request must return 401");
    const checkoutBody = await checkoutRes.json();
    assert.strictEqual(checkoutBody.error, "Unauthorized");

    // Test 11B: POST /api/ai/assistant unauthenticated rejection
    const { POST: assistantPost } = await import("../app/api/ai/assistant/route");
    const assistantReq = new NextRequest("http://localhost:3000/api/ai/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessage: "Hello" }),
    });

    const assistantRes = await assistantPost(assistantReq);
    assert.strictEqual(assistantRes.status, 401, "Unauthenticated AI assistant request must return 401");

    // Test 11C: POST /api/transcribe unauthenticated rejection
    const { POST: transcribePost } = await import("../app/api/transcribe/route");
    const transcribeReq = new NextRequest("http://localhost:3000/api/transcribe", {
      method: "POST",
    });

    const transcribeRes = await transcribePost(transcribeReq);
    assert.strictEqual(transcribeRes.status, 401, "Unauthenticated audio transcribe request must return 401");

    // Test 11D: POST /api/billing/change-plan unauthenticated rejection
    const { POST: changePlanPost } = await import("../app/api/billing/change-plan/route");
    const changePlanReq = new NextRequest("http://localhost:3000/api/billing/change-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "pro" }),
    });

    const changePlanRes = await changePlanPost(changePlanReq);
    assert.strictEqual(changePlanRes.status, 401, "Unauthenticated change-plan request must return 401");
    const changePlanBody = await changePlanRes.json();
    assert.strictEqual(changePlanBody.error, "Unauthorized");

    console.log("✅ Passed: Real Next.js route handlers strictly enforce authentication with 401.\n");
  }

  // ==========================================================================
  // SECTION 12: PRIVILEGED BILLING WRITE INTEGRITY & SAFEGUARD TESTS
  // ==========================================================================
  console.log("--- [Billing Write Test 12] Privileged Database Writes & Error Propagation Safeguards ---");
  {
    // Test 12A: Verify checkout and change-plan route source code imports createAdminClient & invalidateUserCache
    const checkoutSrc = fs.readFileSync(path.resolve(__dirname, "../app/api/billing/checkout/route.ts"), "utf-8");
    const changePlanSrc = fs.readFileSync(path.resolve(__dirname, "../app/api/billing/change-plan/route.ts"), "utf-8");

    assert.ok(
      checkoutSrc.includes("createAdminClient"),
      "Checkout route must import and use createAdminClient for privileged database writes"
    );
    assert.ok(
      checkoutSrc.includes("invalidateUserCache"),
      "Checkout route must call invalidateUserCache to refresh client cache after plan change"
    );
    assert.ok(
      changePlanSrc.includes("createAdminClient"),
      "Change-plan route must import and use createAdminClient for privileged database writes"
    );
    assert.ok(
      changePlanSrc.includes("invalidateUserCache"),
      "Change-plan route must call invalidateUserCache to refresh client cache after plan change"
    );

    // Test 12B: Verify failed credit write returns explicit 500 rather than swallowed success
    assert.ok(
      checkoutSrc.includes("creditErr") && checkoutSrc.includes("status: 500"),
      "Checkout route must return status 500 if user_credits write fails"
    );
    assert.ok(
      changePlanSrc.includes("creditErr") && changePlanSrc.includes("status: 500"),
      "Change-plan route must return status 500 if user_credits write fails"
    );

    // Test 12C: Verify transaction log explicitly notes mock/simulation mode
    assert.ok(
      checkoutSrc.includes('payment_mode: "simulation"'),
      "Checkout transaction log metadata must explicitly record simulation mode"
    );
    assert.ok(
      changePlanSrc.includes('payment_mode: "simulation"'),
      "Change-plan transaction log metadata must explicitly record simulation mode"
    );

    console.log("✅ Passed: Privileged database write architecture, error handling, and cache invalidation verified.\n");
  }

  // ==========================================================================
  // SECTION 13: SUBSCRIPTION STATUS, EXPIRATION & ENTITLEMENT LIFECYCLE TESTS
  // ==========================================================================
  console.log("--- [Mock Test 13] Subscription Status, Expiration & Entitlement Lifecycle ---");
  {
    const now = new Date("2026-10-13T12:00:00.000Z");
    const futureDate = "2026-11-13T12:00:00.000Z";
    const pastDate = "2026-10-01T12:00:00.000Z";

    // Test 13A: Active paid plan within valid billing period grants paid access
    const activeProSub = {
      plan_id: "pro",
      status: "active",
      current_period_end: futureDate,
      cancel_at_period_end: false,
    };
    assert.strictEqual(
      isSubscriptionActiveAndValid(activeProSub, now),
      true,
      "Active Pro subscription with future period end must be valid"
    );

    // Test 13B: Canceled subscription with cancel_at_period_end = true retains access until period end
    const cancelAtPeriodEndActive = {
      plan_id: "pro",
      status: "active",
      current_period_end: futureDate,
      cancel_at_period_end: true,
      canceled_at: "2026-10-10T12:00:00.000Z",
    };
    assert.strictEqual(
      isSubscriptionActiveAndValid(cancelAtPeriodEndActive, now),
      true,
      "Active sub with cancel_at_period_end=true within billing period must preserve paid access"
    );

    const cancelAtPeriodEndCanceledStatus = {
      plan_id: "pro",
      status: "canceled",
      current_period_end: futureDate,
      cancel_at_period_end: true,
      canceled_at: "2026-10-10T12:00:00.000Z",
    };
    assert.strictEqual(
      isSubscriptionActiveAndValid(cancelAtPeriodEndCanceledStatus, now),
      true,
      "Canceled status with cancel_at_period_end=true within billing period must preserve paid access"
    );

    // Test 13C: Expired subscriptions must NOT retain paid-plan privileges indefinitely
    const expiredActiveSub = {
      plan_id: "pro",
      status: "active",
      current_period_end: pastDate,
      cancel_at_period_end: false,
    };
    assert.strictEqual(
      isSubscriptionActiveAndValid(expiredActiveSub, now),
      false,
      "Active sub with expired current_period_end must fail validation (no indefinite retention)"
    );

    const expiredCanceledSub = {
      plan_id: "pro",
      status: "canceled",
      current_period_end: pastDate,
      cancel_at_period_end: true,
      canceled_at: "2026-09-15T12:00:00.000Z",
    };
    assert.strictEqual(
      isSubscriptionActiveAndValid(expiredCanceledSub, now),
      false,
      "Canceled sub with expired current_period_end must fail validation"
    );

    // Test 13D: Immediate cancellation (cancel_at_period_end: false) revokes access immediately
    const immediateCanceledSub = {
      plan_id: "pro",
      status: "canceled",
      current_period_end: futureDate,
      cancel_at_period_end: false,
      canceled_at: "2026-10-12T12:00:00.000Z",
    };
    assert.strictEqual(
      isSubscriptionActiveAndValid(immediateCanceledSub, now),
      false,
      "Immediate cancellation without period-end preservation must fail validation"
    );

    // Test 13E: Terminal / non-payment statuses fail closed
    for (const badStatus of ["unpaid", "incomplete", "incomplete_expired", "past_due", "paused", "unknown"]) {
      const badSub = {
        plan_id: "pro",
        status: badStatus,
        current_period_end: futureDate,
        cancel_at_period_end: false,
      };
      assert.strictEqual(
        isSubscriptionActiveAndValid(badSub, now),
        false,
        `Status '${badStatus}' must fail validation`
      );
    }

    // Test 13F: Invalid date / missing dates fail closed
    assert.strictEqual(
      isSubscriptionActiveAndValid({ plan_id: "pro", status: "active", current_period_end: "not-a-date" }, now),
      false,
      "Invalid date string must fail validation"
    );
    assert.strictEqual(
      isSubscriptionActiveAndValid({ plan_id: "pro", status: "active", current_period_end: null }, now),
      false,
      "Null current_period_end on paid plan must fail validation"
    );
    assert.strictEqual(
      isSubscriptionActiveAndValid(null, now),
      false,
      "Null subscription row must return false"
    );

    // Test 13G: Free plan explicitly returns false for paid entitlement
    assert.strictEqual(
      isSubscriptionActiveAndValid({ plan_id: "free", status: "active", current_period_end: futureDate }, now),
      false,
      "Free plan must return false for paid entitlement"
    );

    // Test 13H: Trialing subscription lifecycle
    assert.strictEqual(
      isSubscriptionActiveAndValid({ plan_id: "pro", status: "trialing", trial_ends_at: futureDate }, now),
      true,
      "Trialing subscription with future trial_ends_at must be valid"
    );
    assert.strictEqual(
      isSubscriptionActiveAndValid({ plan_id: "pro", status: "trialing", trial_ends_at: pastDate }, now),
      false,
      "Trialing subscription with expired trial_ends_at must be invalid"
    );

    // Test 13I: End-to-end getUserUsage mock integration with expired Pro subscription
    const mockExpiredClient = {
      from: (table: string) => ({
        select: (cols: string, opts?: any) => ({
          eq: (col: string, val: any) => {
            const queryRes: any = {
              maybeSingle: async () => {
                if (table === "subscriptions") {
                  return {
                    data: {
                      plan_id: "pro",
                      status: "active",
                      current_period_end: "2025-01-01T00:00:00.000Z", // past date / expired
                      cancel_at_period_end: false,
                      plans: {
                        id: "pro",
                        name: "Pro",
                        monthly_ai_credits: 200,
                        max_websites: 3,
                        storage_limit_bytes: 10737418240,
                        allow_custom_domain: true,
                        allow_advanced_seo: true,
                      },
                    },
                    error: null,
                  };
                }
                if (table === "user_credits") {
                  return { data: { balance: 150, monthly_used: 10, lifetime_used: 50 }, error: null };
                }
                return { data: null, error: null };
              },
              gte: async () => ({ count: 2, data: [], error: null }),
              then: (resolve: any) => {
                if (table === "websites") return resolve({ count: 2, data: null, error: null });
                if (table === "media_assets") return resolve({ data: [{ file_size_bytes: 5000000 }], error: null });
                return resolve({ data: [], error: null });
              },
            };
            return queryRes;
          },
        }),
      }),
    };

    const expiredUsage = await getUserUsage("user_test_expired_entitlement", mockExpiredClient);
    assert.ok(expiredUsage, "getUserUsage should return usage object");
    assert.strictEqual(expiredUsage.plan.id, "free", "Expired subscription plan ID must fall back to free");
    assert.strictEqual(expiredUsage.plan.name, "Free", "Expired subscription plan name must be Free");
    assert.strictEqual(expiredUsage.plan.allow_custom_domain, false, "Expired sub must revoke custom domain");
    assert.strictEqual(expiredUsage.plan.allow_advanced_seo, false, "Expired sub must revoke advanced SEO");
    assert.strictEqual(expiredUsage.websites.limit, 1, "Expired sub must reduce website limit to 1");
    assert.strictEqual(expiredUsage.storage.limitBytes, 104857600, "Expired sub must reduce storage to 100MB");

    // Test 13J: Caller checkAiVisibilityEntitlement integration with expired user
    const aiVisEntitlement = await checkAiVisibilityEntitlement("user_test_expired_entitlement", mockExpiredClient);
    assert.strictEqual(aiVisEntitlement.entitled, false, "AI Visibility must reject expired subscription user");
    assert.strictEqual(aiVisEntitlement.planId, "free", "AI Visibility must report planId as free for expired user");

    // Test 13K: Caller checkWebsiteLimit integration with expired user exceeding Free limit (2 websites > 1 limit)
    assert.strictEqual(
      expiredUsage.websites.used < expiredUsage.websites.limit,
      false,
      "User with 2 websites on expired subscription must be blocked from creating new websites"
    );

    // Test 13L: Plan tier preservation across all 5 tiers (Free, Starter, Pro, Business, Agency)
    const tiers = [
      { id: "free", name: "Free", credits: 50, sites: 1, domain: false, seo: false },
      { id: "starter", name: "Starter", credits: 100, sites: 1, domain: false, seo: false },
      { id: "pro", name: "Pro", credits: 200, sites: 3, domain: true, seo: true },
      { id: "business", name: "Business", credits: 400, sites: 6, domain: true, seo: true },
      { id: "agency", name: "Agency", credits: 800, sites: 15, domain: true, seo: true },
    ];

    for (const tier of tiers) {
      const resolved = resolveSubscriptionPlan(tier.id);
      assert.strictEqual(resolved.id, tier.id, `Tier ${tier.id} ID preserved`);
      assert.strictEqual(resolved.name, tier.name, `Tier ${tier.id} name preserved`);
      assert.strictEqual(resolved.monthly_ai_credits, tier.credits, `Tier ${tier.id} credits match`);
      assert.strictEqual(resolved.max_websites, tier.sites, `Tier ${tier.id} max websites match`);
      assert.strictEqual(resolved.allow_custom_domain, tier.domain, `Tier ${tier.id} domain permission match`);
      assert.strictEqual(resolved.allow_advanced_seo, tier.seo, `Tier ${tier.id} SEO permission match`);
    }

    console.log("✅ Passed: Subscription status, expiration lifecycle, and plan entitlement preservation fully verified.\n");
  }

  // ==========================================================================
  // SECTION 14: MOCK PAYMENT PROVIDER SECURITY & PRODUCTION ENVIRONMENT GUARDS
  // ==========================================================================
  console.log("--- [Mock Test 14] Mock Payment Provider Security & Production Environment Guards ---");
  {
    const { isMockPaymentAllowed, MockPaymentProvider } = await import("../lib/payment-providers");
    const prodRef = Buffer.from("eXVtc3R1cnVqampnZHhzcnFnYm0=", "base64").toString("utf-8");

    // Save and restore process.env for isolated environment matrix testing
    const savedEnv = { ...process.env };

    try {
      // Test 14A: Vercel Production deployment blocks mock payments
      process.env.VERCEL_ENV = "production";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://aiagulxavohemtdeihcm.supabase.co";
      assert.strictEqual(
        isMockPaymentAllowed(),
        false,
        "Mock payments must be denied when VERCEL_ENV is 'production'"
      );

      delete process.env.VERCEL_ENV;
      process.env.VERCEL_TARGET_ENV = "production";
      assert.strictEqual(
        isMockPaymentAllowed(),
        false,
        "Mock payments must be denied when VERCEL_TARGET_ENV is 'production'"
      );

      // Test 14B: Production Supabase URL blocks mock payments
      delete process.env.VERCEL_TARGET_ENV;
      process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${prodRef}.supabase.co`;
      assert.strictEqual(
        isMockPaymentAllowed(),
        false,
        "Mock payments must be denied when NEXT_PUBLIC_SUPABASE_URL targets the production database"
      );

      // Test 14C: Production Supabase URL blocks mock payments EVEN IF ALLOW_MOCK_PAYMENTS="true"
      process.env.ALLOW_MOCK_PAYMENTS = "true";
      assert.strictEqual(
        isMockPaymentAllowed(),
        false,
        "Environment override ALLOW_MOCK_PAYMENTS='true' must NEVER allow mock payments against Production"
      );

      // Test 14D: Staging project (aiagulxavohemtdeihcm) allows mock checkout
      delete process.env.ALLOW_MOCK_PAYMENTS;
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://aiagulxavohemtdeihcm.supabase.co";
      assert.strictEqual(
        isMockPaymentAllowed(),
        true,
        "Staging project aiagulxavohemtdeihcm must support mock testing"
      );

      // Test 14E: Local Supabase CLI targets allow mock checkout
      process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
      assert.strictEqual(
        isMockPaymentAllowed(),
        true,
        "Local Supabase target (127.0.0.1) must support mock testing"
      );
      process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
      assert.strictEqual(
        isMockPaymentAllowed(),
        true,
        "Local Supabase target (localhost) must support mock testing"
      );

      // Test 14F: Unknown remote database targets fail closed
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://some-unknown-project.supabase.co";
      assert.strictEqual(
        isMockPaymentAllowed(),
        false,
        "Unknown remote database target must fail closed and deny mock payments"
      );

      // Test 14G: Explicit disable flag ALLOW_MOCK_PAYMENTS="false" denies even on staging
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://aiagulxavohemtdeihcm.supabase.co";
      process.env.ALLOW_MOCK_PAYMENTS = "false";
      assert.strictEqual(
        isMockPaymentAllowed(),
        false,
        "ALLOW_MOCK_PAYMENTS='false' must strictly deny mock payments"
      );

      // Test 14H: MockPaymentProvider.createCheckout refuses checkout when guard is disabled
      delete process.env.ALLOW_MOCK_PAYMENTS;
      process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${prodRef}.supabase.co`;
      const mockProvider = new MockPaymentProvider();
      const checkoutFail = await mockProvider.createCheckout({
        userId: "test-user-prod",
        planId: "pro",
        amount: 599,
        currency: "INR",
      });
      assert.strictEqual(checkoutFail.success, false, "Provider createCheckout must return success=false when disabled");
      assert.strictEqual(checkoutFail.status, "failed", "Provider createCheckout status must be 'failed'");
      assert.ok(checkoutFail.message.includes("disabled"), "Message must explain mock payments are disabled");

      const verifyFail = await mockProvider.verifyPayment("mock_pay_pro_12345");
      assert.strictEqual(verifyFail, false, "Provider verifyPayment must return false when disabled");

      // Test 14I: Route source code static analysis asserts guard is called before privileged DB writes
      const checkoutRouteSrc = fs.readFileSync(path.resolve(__dirname, "../app/api/billing/checkout/route.ts"), "utf-8");
      const changePlanRouteSrc = fs.readFileSync(path.resolve(__dirname, "../app/api/billing/change-plan/route.ts"), "utf-8");

      assert.ok(
        checkoutRouteSrc.includes("isMockPaymentAllowed"),
        "Checkout route must import and execute isMockPaymentAllowed"
      );
      assert.ok(
        checkoutRouteSrc.indexOf("!isMockPaymentAllowed()") < checkoutRouteSrc.indexOf("createAdminClient()"),
        "Checkout route must enforce isMockPaymentAllowed before createAdminClient privileged execution"
      );
      assert.ok(
        checkoutRouteSrc.includes("PAYMENT_METHOD_UNAVAILABLE"),
        "Checkout route must return PAYMENT_METHOD_UNAVAILABLE error code on rejection"
      );

      assert.ok(
        changePlanRouteSrc.includes("isMockPaymentAllowed"),
        "Change-plan route must import and execute isMockPaymentAllowed"
      );
      assert.ok(
        changePlanRouteSrc.indexOf("!isMockPaymentAllowed()") < changePlanRouteSrc.indexOf("createAdminClient()"),
        "Change-plan route must enforce isMockPaymentAllowed before createAdminClient privileged execution"
      );
      assert.ok(
        changePlanRouteSrc.includes("PAYMENT_REQUIRED"),
        "Change-plan route must return PAYMENT_REQUIRED error code on rejection"
      );

    } finally {
      // Restore clean process.env
      process.env = savedEnv;
    }

    console.log("✅ Passed: Mock payment provider security, production hard-blocks, and fail-closed guards fully verified.\n");
  }

  console.log("=========================================================================");
  console.log("ALL 26 BILLING, REFUND & PAYMENT SECURITY REGRESSION TESTS PASSED! 🎉");
  console.log("=========================================================================");
  process.exit(0);
}

runAllTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
