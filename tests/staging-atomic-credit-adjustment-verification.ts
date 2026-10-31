import assert from "node:assert";
import { createAdminClient } from "@/utils/supabase/server";

export async function runStagingVerification() {
  console.log("=".repeat(85));
  console.log("CODEAXYS ATOMIC ADMIN CREDIT ADJUSTMENT: STAGING VERIFICATION SUITE");
  console.log("=".repeat(85));

  // 1. Strict Target Project Safety Guard
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  console.log(`Checking Supabase Target URL: ${supabaseUrl}`);

  if (supabaseUrl.includes("yumsturujjjgdxsrqgbm")) {
    throw new Error("FATAL: Target is PRODUCTION (yumsturujjjgdxsrqgbm)! Aborting immediately.");
  }
  if (!supabaseUrl.includes("aiagulxavohemtdeihcm")) {
    throw new Error("FATAL: Target is NOT Staging (aiagulxavohemtdeihcm)! Aborting.");
  }
  console.log("✅ Verified: Target is explicitly Staging (aiagulxavohemtdeihcm). Production untouched.");

  const db = createAdminClient();

  // Track created resources for guaranteed teardown
  let syntheticAdminId = "";
  let syntheticCustomerId = "";
  const createdIdempotencyKeys: string[] = [];
  const createdAuditLogIds: string[] = [];
  const createdTransactionIds: string[] = [];

  try {
    console.log("\n--- [Phase 1] Verifying Migration Objects on Staging ---");

    // 1A. Verify admin_idempotency_records table existence and accessibility via service_role
    const { data: idempCheck, error: idempErr } = await db
      .from("admin_idempotency_records")
      .select("idempotency_key")
      .limit(1);

    if (idempErr) {
      throw new Error(
        `Migration table 'admin_idempotency_records' not accessible on staging: ${idempErr.message} (Code: ${idempErr.code})`
      );
    }
    console.log("  ✓ Table 'public.admin_idempotency_records' is present and accessible by service_role.");

    // 1B. Verify admin_adjust_user_credits RPC existence
    const { error: rpcProbeErr } = await db.rpc("admin_adjust_user_credits", {
      p_admin_id: "00000000-0000-0000-0000-000000000000",
      p_user_id: "00000000-0000-0000-0000-000000000000",
      p_amount: 0,
      p_type: "add",
      p_idempotency_key: "probe-key-min-16-chars",
      p_reason: "probe",
    });

    if (rpcProbeErr && rpcProbeErr.message.includes("does not exist")) {
      throw new Error(`RPC function 'public.admin_adjust_user_credits' does not exist on staging.`);
    }
    console.log("  ✓ Stored procedure 'public.admin_adjust_user_credits' is deployed and callable by service_role.");

    console.log("\n--- [Phase 2] Provisioning Isolated Synthetic Test Users ---");

    // Create synthetic admin auth user
    const adminEmail = `synthetic-admin-${Date.now()}@codeaxys.test`;
    const { data: adminUserObj, error: createAdminErr } = await db.auth.admin.createUser({
      email: adminEmail,
      password: "TestPassword123!",
      email_confirm: true,
    });
    if (createAdminErr || !adminUserObj?.user) {
      throw new Error(`Failed to create synthetic admin user: ${createAdminErr?.message}`);
    }
    syntheticAdminId = adminUserObj.user.id;
    console.log(`  ✓ Provisioned synthetic admin user: ${syntheticAdminId} (${adminEmail})`);

    // Ensure admin profile exists with role = 'admin'
    const { error: setAdminRoleErr } = await db
      .from("profiles")
      .upsert({ id: syntheticAdminId, role: "admin", updated_at: new Date().toISOString() });
    if (setAdminRoleErr) {
      throw new Error(`Failed to grant admin role to synthetic user: ${setAdminRoleErr.message}`);
    }
    console.log(`  ✓ Verified admin role on profile: ${syntheticAdminId}`);

    // Create synthetic customer auth user
    const customerEmail = `synthetic-customer-${Date.now()}@codeaxys.test`;
    const { data: customerUserObj, error: createCustomerErr } = await db.auth.admin.createUser({
      email: customerEmail,
      password: "TestPassword123!",
      email_confirm: true,
    });
    if (createCustomerErr || !customerUserObj?.user) {
      throw new Error(`Failed to create synthetic customer user: ${createCustomerErr?.message}`);
    }
    syntheticCustomerId = customerUserObj.user.id;
    console.log(`  ✓ Provisioned synthetic customer user: ${syntheticCustomerId} (${customerEmail})`);

    // Ensure customer has a profile
    await db.from("profiles").upsert({ id: syntheticCustomerId, role: "user", updated_at: new Date().toISOString() });

    // Ensure customer has a known initial balance (default 50)
    const { data: initCredit } = await db
      .from("user_credits")
      .select("balance")
      .eq("user_id", syntheticCustomerId)
      .maybeSingle();

    let initialBalance = 50;
    if (!initCredit) {
      await db.from("user_credits").insert({ user_id: syntheticCustomerId, balance: 50 });
    } else {
      initialBalance = initCredit.balance;
    }
    console.log(`  ✓ Initial customer balance: ${initialBalance}`);

    console.log("\n--- [Phase 3] Focused Staging Scenario Tests ---");

    // ------------------------------------------------------------------------
    // Scenario 1: Normal Atomic Credit Adjustment (+100)
    // ------------------------------------------------------------------------
    console.log("  Scenario 1: Testing atomic credit addition (+100)...");
    const key1 = `test-key-1-${Date.now()}-staging-run`;
    createdIdempotencyKeys.push(key1);

    const { data: res1, error: err1 } = await db.rpc("admin_adjust_user_credits", {
      p_admin_id: syntheticAdminId,
      p_user_id: syntheticCustomerId,
      p_amount: 100,
      p_type: "add",
      p_idempotency_key: key1,
      p_reason: "Automated Staging Verification",
    });

    if (err1) throw new Error(`Scenario 1 RPC error: ${err1.message}`);
    assert.strictEqual(res1?.success, true, "Scenario 1 must return success=true");
    assert.strictEqual(res1?.oldBalance, initialBalance, "Scenario 1 oldBalance match");
    assert.strictEqual(res1?.newBalance, initialBalance + 100, "Scenario 1 newBalance match");

    // Verify balance persisted in user_credits
    const { data: credAfter1 } = await db
      .from("user_credits")
      .select("balance")
      .eq("user_id", syntheticCustomerId)
      .single();
    assert.strictEqual(credAfter1?.balance, initialBalance + 100, "Database balance must reflect +100");

    // Verify idempotency record created
    const { data: idempRow1 } = await db
      .from("admin_idempotency_records")
      .select("*")
      .eq("idempotency_key", key1)
      .single();
    assert.ok(idempRow1, "admin_idempotency_records row must exist");
    assert.strictEqual(idempRow1.target_user_id, syntheticCustomerId);
    assert.strictEqual(idempRow1.amount, 100);

    // Verify ledger row in ai_credit_transactions
    const { data: ledgerRow1 } = await db
      .from("ai_credit_transactions")
      .select("*")
      .eq("user_id", syntheticCustomerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    assert.ok(ledgerRow1, "Ledger transaction must exist");
    assert.strictEqual(ledgerRow1.credits_used, -100, "Credit addition is negative deduction in ledger");
    createdTransactionIds.push(ledgerRow1.id);

    // Verify audit log using actual schema columns: admin_id, action_type, target_user_id, details
    const { data: auditRow1 } = await db
      .from("admin_audit_logs")
      .select("*")
      .eq("admin_id", syntheticAdminId)
      .eq("target_user_id", syntheticCustomerId)
      .eq("action_type", "ADMIN_CREDITS_ADJUSTED")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    assert.ok(auditRow1, "Audit log must exist in public.admin_audit_logs");
    assert.strictEqual(auditRow1.action_type, "ADMIN_CREDITS_ADJUSTED");
    createdAuditLogIds.push(auditRow1.id);

    console.log("  ✅ Scenario 1 Passed: Atomic balance, ledger, audit, and idempotency records verified.");

    // ------------------------------------------------------------------------
    // Scenario 2: Duplicate Request Replay (Exact Same Key & Payload)
    // ------------------------------------------------------------------------
    console.log("  Scenario 2: Testing duplicate request replay...");
    const { data: res2, error: err2 } = await db.rpc("admin_adjust_user_credits", {
      p_admin_id: syntheticAdminId,
      p_user_id: syntheticCustomerId,
      p_amount: 100,
      p_type: "add",
      p_idempotency_key: key1,
      p_reason: "Automated Staging Verification",
    });

    if (err2) throw new Error(`Scenario 2 RPC error: ${err2.message}`);
    assert.strictEqual(res2?.success, true, "Scenario 2 replay must return success=true");
    assert.strictEqual(res2?.status, "idempotent_replay", "Status must be idempotent_replay");
    assert.strictEqual(res2?.newBalance, initialBalance + 100, "Replay must return cached newBalance");

    // Confirm NO secondary mutation occurred
    const { data: credAfter2 } = await db
      .from("user_credits")
      .select("balance")
      .eq("user_id", syntheticCustomerId)
      .single();
    assert.strictEqual(credAfter2?.balance, initialBalance + 100, "Balance must NOT increment a second time!");

    const { count: txCountAfter2 } = await db
      .from("ai_credit_transactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", syntheticCustomerId);
    assert.strictEqual(txCountAfter2, 1, "Duplicate call must NOT create second ledger transaction");

    console.log("  ✅ Scenario 2 Passed: Duplicate replay returned cached result with zero secondary mutations.");

    // ------------------------------------------------------------------------
    // Scenario 3: Conflicting Idempotency-Key Reuse (Different Payload)
    // ------------------------------------------------------------------------
    console.log("  Scenario 3: Testing conflicting idempotency-key reuse...");
    const { data: res3, error: err3 } = await db.rpc("admin_adjust_user_credits", {
      p_admin_id: syntheticAdminId,
      p_user_id: syntheticCustomerId,
      p_amount: 200, // Conflict: originally 100!
      p_type: "add",
      p_idempotency_key: key1,
      p_reason: "Automated Staging Verification",
    });

    if (err3) throw new Error(`Scenario 3 RPC error: ${err3.message}`);
    assert.strictEqual(res3?.success, false, "Conflicting key must be rejected with success=false");
    assert.strictEqual(res3?.code, "IDEMPOTENCY_KEY_REUSE_CONFLICT", "Must return IDEMPOTENCY_KEY_REUSE_CONFLICT");

    // Confirm balance remains unchanged
    const { data: credAfter3 } = await db
      .from("user_credits")
      .select("balance")
      .eq("user_id", syntheticCustomerId)
      .single();
    assert.strictEqual(credAfter3?.balance, initialBalance + 100, "Balance must remain unchanged on conflict");

    console.log("  ✅ Scenario 3 Passed: Conflicting key reuse strictly rejected with IDEMPOTENCY_KEY_REUSE_CONFLICT.");

    // ------------------------------------------------------------------------
    // Scenario 4: Insufficient Credit Rejection & Zero Side-Effects
    // ------------------------------------------------------------------------
    console.log("  Scenario 4: Testing insufficient credit deduction rejection...");
    const key4 = `test-key-4-${Date.now()}-staging-run`;
    createdIdempotencyKeys.push(key4);

    const currentBalance = credAfter3?.balance || 150;
    const excessiveDeduction = -(currentBalance + 500); // Deduct more than user has via add with negative delta

    const { data: res4, error: err4 } = await db.rpc("admin_adjust_user_credits", {
      p_admin_id: syntheticAdminId,
      p_user_id: syntheticCustomerId,
      p_amount: excessiveDeduction,
      p_type: "add",
      p_idempotency_key: key4,
      p_reason: "Testing excessive deduction rejection",
    });

    if (err4) throw new Error(`Scenario 4 RPC error: ${err4.message}`);
    assert.strictEqual(res4?.success, false, "Excessive deduction must return success=false");
    assert.strictEqual(res4?.code, "INSUFFICIENT_CREDITS", "Must return INSUFFICIENT_CREDITS code");

    // Confirm balance remains unchanged
    const { data: credAfter4 } = await db
      .from("user_credits")
      .select("balance")
      .eq("user_id", syntheticCustomerId)
      .single();
    assert.strictEqual(credAfter4?.balance, currentBalance, "Balance must remain untouched on rejection");

    // Confirm NO idempotency row was persisted for rejected transaction
    const { data: idempRow4 } = await db
      .from("admin_idempotency_records")
      .select("*")
      .eq("idempotency_key", key4)
      .maybeSingle();
    assert.strictEqual(idempRow4, null, "Zero side-effects: No idempotency row created on rejection");

    console.log("  ✅ Scenario 4 Passed: Insufficient credit cleanly rejected with zero side-effects.");

    // ------------------------------------------------------------------------
    // Scenario 5: Database Check Constraint Enforcement
    // ------------------------------------------------------------------------
    console.log("  Scenario 5: Testing check_user_credits_balance_non_negative constraint...");
    // Attempt direct negative balance update to confirm constraint prevents negative balance
    const { error: directNegErr } = await db
      .from("user_credits")
      .update({ balance: -10 })
      .eq("user_id", syntheticCustomerId);

    assert.ok(directNegErr, "Direct negative balance update MUST be rejected by Postgres check constraint");
    assert.ok(
      directNegErr.message.includes("check_user_credits_balance_non_negative") ||
      directNegErr.code === "23514", // check_violation
      `Error must cite check constraint violation. Got: ${directNegErr.message}`
    );
    console.log("  ✅ Scenario 5 Passed: Constraint 'check_user_credits_balance_non_negative' actively rejected negative balance (SQLSTATE 23514).");

    console.log("\n" + "=".repeat(85));
    console.log("ALL STAGING VERIFICATION SCENARIOS PASSED WITH COMPLETE DATA CONSISTENCY! 🎉");
    console.log("=".repeat(85));
  } finally {
    console.log("\n--- [Phase 4] Guaranteed Teardown of Synthetic Staging Test Artifacts ---");

    // Clean up created idempotency keys
    for (const k of createdIdempotencyKeys) {
      await db.from("admin_idempotency_records").delete().eq("idempotency_key", k);
    }
    console.log(`  ✓ Cleaned up ${createdIdempotencyKeys.length} synthetic idempotency records.`);

    // Clean up created ledger transactions
    for (const txId of createdTransactionIds) {
      await db.from("ai_credit_transactions").delete().eq("id", txId);
    }
    console.log(`  ✓ Cleaned up ${createdTransactionIds.length} synthetic ledger transactions.`);

    // Clean up created audit logs
    for (const logId of createdAuditLogIds) {
      await db.from("admin_audit_logs").delete().eq("id", logId);
    }
    console.log(`  ✓ Cleaned up ${createdAuditLogIds.length} synthetic audit logs.`);

    // Clean up synthetic customer user_credits & auth user
    if (syntheticCustomerId) {
      await db.from("user_credits").delete().eq("user_id", syntheticCustomerId);
      await db.from("profiles").delete().eq("id", syntheticCustomerId);
      await db.auth.admin.deleteUser(syntheticCustomerId);
      console.log(`  ✓ Cleaned up synthetic customer auth user: ${syntheticCustomerId}`);
    }

    // Clean up synthetic admin profile & auth user
    if (syntheticAdminId) {
      await db.from("profiles").delete().eq("id", syntheticAdminId);
      await db.auth.admin.deleteUser(syntheticAdminId);
      console.log(`  ✓ Cleaned up synthetic admin auth user: ${syntheticAdminId}`);
    }

    console.log("  ✓ Teardown complete. Staging database returned to pristine baseline state.\n");
  }
}

if (process.argv[1]?.includes("staging-atomic-credit-adjustment-verification")) {
  runStagingVerification().catch((err) => {
    console.error("FATAL STAGING VERIFICATION FAILURE:", err);
    process.exit(1);
  });
}
