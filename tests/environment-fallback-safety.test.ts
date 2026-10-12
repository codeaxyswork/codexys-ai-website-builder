import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { getGeminiConfig } from "@/lib/gemini";
import { createAdminClient } from "@/utils/supabase/server";
import { GET as getSharedReport } from "@/app/api/seo/reports/shared/[token]/route";

/**
 * ============================================================================
 * ENVIRONMENT SAFETY & FAIL-CLOSED HARDENING REGRESSION TEST SUITE
 * ============================================================================
 *
 * Verifies that:
 * 1. getGeminiConfig fails closed when GEMINI_API_KEY is missing/placeholder.
 * 2. createAdminClient fails closed without falling back to anon key or production URL.
 * 3. Public shared report endpoint fails closed with HTTP 500 if Supabase config is missing.
 * 4. Zero hardcoded production project references (yumsturujjjgdxsrqgbm) exist in source code.
 * 5. scripts/dev-staging.mjs correctly targets .env.staging.local and port 3001.
 */

async function runEnvironmentSafetyTests() {
  console.log("=".repeat(80));
  console.log("ENVIRONMENT SAFETY & FAIL-CLOSED HARDENING REGRESSION TEST SUITE");
  console.log("=".repeat(80));

  // Save current process.env to restore afterwards
  const originalEnv = { ...process.env };

  try {
    // ------------------------------------------------------------------------
    // Test 1: getGeminiConfig fail-closed behavior
    // ------------------------------------------------------------------------
    console.log("\n--- Test 1: getGeminiConfig Missing Key Fail-Closed ---");
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;

    assert.throws(
      () => getGeminiConfig(),
      /GEMINI_API_KEY is not set or is empty/,
      "Expected getGeminiConfig to throw when GEMINI_API_KEY is unset."
    );

    process.env.GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
    assert.throws(
      () => getGeminiConfig(),
      /GEMINI_API_KEY is not set or is empty/,
      "Expected getGeminiConfig to throw when GEMINI_API_KEY is placeholder."
    );

    process.env.GEMINI_API_KEY = "test-valid-gemini-key";
    process.env.GEMINI_MODEL = "gemini-test-custom";
    const cfg = getGeminiConfig();
    assert.strictEqual(cfg.apiKey, "test-valid-gemini-key");
    assert.strictEqual(cfg.model, "gemini-test-custom");
    console.log("✅ Passed: getGeminiConfig strictly fails closed on missing/placeholder keys and succeeds with valid config.");

    // ------------------------------------------------------------------------
    // Test 2: createAdminClient fail-closed without fallbacks
    // ------------------------------------------------------------------------
    console.log("\n--- Test 2: createAdminClient Fail-Closed Enforcement ---");
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "valid-length-service-role-key-1234567890";

    assert.throws(
      () => createAdminClient(),
      /\[Supabase Config Error\] NEXT_PUBLIC_SUPABASE_URL is missing or invalid/,
      "Expected createAdminClient to throw error when NEXT_PUBLIC_SUPABASE_URL is missing."
    );

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://aiagulxavohemtdeihcm.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-that-must-never-be-used-as-admin";

    assert.throws(
      () => createAdminClient(),
      /\[Supabase Config Error\] SUPABASE_SERVICE_ROLE_KEY is required for privileged operations/,
      "Expected createAdminClient to reject missing service role key rather than falling back to anon."
    );
    console.log("✅ Passed: createAdminClient fails closed on missing URL and rejects anon key fallback.");

    // ------------------------------------------------------------------------
    // Test 3: Shared Report Route Fail-Closed on Missing Public Supabase Config
    // ------------------------------------------------------------------------
    console.log("\n--- Test 3: Shared SEO Report Endpoint Fail-Closed Check ---");
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const reqMissing = new NextRequest("http://localhost:3000/api/seo/reports/shared/test-token-123");
    const resMissing = await getSharedReport(reqMissing, { params: Promise.resolve({ token: "test-token-123" }) });
    assert.strictEqual(resMissing.status, 500, "Expected status 500 when Supabase config is missing");
    const jsonMissing = await resMissing.json();
    assert.ok(jsonMissing.error.includes("Configuration error"), "Expected configuration error message");
    console.log("✅ Passed: Shared SEO report endpoint returns 500 and does NOT target production when URL is unset.");

    // ------------------------------------------------------------------------
    // Test 4: Zero Hardcoded Production References In Source Code
    // ------------------------------------------------------------------------
    console.log("\n--- Test 4: Codebase Invariant: Zero Production URL Fallbacks in Source ---");
    const rootDir = path.resolve(__dirname, "..");
    const forbiddenRef = "yumsturujjjgdxsrqgbm";
    const checkedDirs = ["app", "lib", "utils", "components"];
    const foundViolations: string[] = [];

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.includes(forbiddenRef)) {
            foundViolations.push(path.relative(rootDir, fullPath));
          }
        }
      }
    }

    for (const d of checkedDirs) {
      const fullDir = path.join(rootDir, d);
      if (fs.existsSync(fullDir)) {
        scanDir(fullDir);
      }
    }

    assert.strictEqual(
      foundViolations.length,
      0,
      `Found hardcoded production references in source files: ${foundViolations.join(", ")}`
    );
    console.log(`✅ Passed: 0 hardcoded production project references found in executable source directories (${checkedDirs.join(", ")}).`);

    // ------------------------------------------------------------------------
    // Test 5: dev:staging Runner Script Verification
    // ------------------------------------------------------------------------
    console.log("\n--- Test 5: dev:staging Runner Script Integrity ---");
    const devStagingPath = path.resolve(rootDir, "scripts/dev-staging.mjs");
    assert.ok(fs.existsSync(devStagingPath), "scripts/dev-staging.mjs must exist");
    const scriptContent = fs.readFileSync(devStagingPath, "utf-8");
    assert.ok(scriptContent.includes(".env.staging.local"), "Must target .env.staging.local");
    assert.ok(scriptContent.includes("3001"), "Must default to port 3001");
    console.log("✅ Passed: scripts/dev-staging.mjs exists and correctly targets .env.staging.local and port 3001.");

    console.log("\n" + "=".repeat(80));
    console.log("ALL 5 ENVIRONMENT SAFETY REGRESSION TESTS PASSED! 🎉");
    console.log("=".repeat(80));
  } finally {
    // Restore original environment
    process.env = originalEnv;
  }
}

runEnvironmentSafetyTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
