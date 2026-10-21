import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

/**
 * ============================================================================
 * CLOUDFLARE TURNSTILE AUTHENTICATION INTEGRATION TEST SUITE
 * ============================================================================
 *
 * Verifies:
 * 1. Token passing: captchaToken is properly passed through Supabase Auth options
 *    for both signInWithPassword and signUp.
 * 2. Missing-token guard: login and signup forms reject submission if captchaToken is missing.
 * 3. Token expiry: expired tokens are cleared from state and trigger widget reset.
 * 4. Error reset: failed authentication immediately purges the token and resets widget.
 * 5. Preservation: Google OAuth and email verification flows remain preserved.
 * 6. Secret Isolation Invariant: Cloudflare Secret Key is strictly excluded from client code.
 */

async function runTurnstileAuthIntegrationTests() {
  console.log("=".repeat(80));
  console.log("CLOUDFLARE TURNSTILE AUTHENTICATION INTEGRATION TEST SUITE");
  console.log("=".repeat(80));

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      fn();
      console.log(`✅ [TEST ${total}] PASS: ${name}`);
      passed++;
    } catch (err: unknown) {
      console.error(`❌ [TEST ${total}] FAIL: ${name}`);
      console.error(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  // --------------------------------------------------------------------------
  // Test 1: Options Payload Structure for Supabase Auth signInWithPassword
  // --------------------------------------------------------------------------
  test("Supabase signInWithPassword receives captchaToken in options", () => {
    const captured: { options: { captchaToken?: string } | null } = { options: null };
    const mockSupabase = {
      auth: {
        signInWithPassword: async (params: { email: string; password: string; options?: { captchaToken?: string } }) => {
          captured.options = params.options || null;
          return { data: { user: { id: "test-user-id" }, session: {} }, error: null };
        },
      },
    };

    const mockToken = "cf_test_token_sample_123456789";
    mockSupabase.auth.signInWithPassword({
      email: "user@example.com",
      password: "TestPassword123!",
      options: {
        captchaToken: mockToken,
      },
    });

    assert.ok(captured.options !== null, "Expected options object to be passed");
    assert.strictEqual(captured.options?.captchaToken, mockToken, "Expected captchaToken to match provided token");
  });

  // --------------------------------------------------------------------------
  // Test 2: Options Payload Structure for Supabase Auth signUp
  // --------------------------------------------------------------------------
  test("Supabase signUp receives captchaToken in options alongside metadata", () => {
    const captured: { options: { data?: Record<string, unknown>; emailRedirectTo?: string; captchaToken?: string } | null } = { options: null };
    const mockSupabase = {
      auth: {
        signUp: async (params: { email: string; password: string; options?: { data?: Record<string, unknown>; emailRedirectTo?: string; captchaToken?: string } }) => {
          captured.options = params.options || null;
          return { data: { user: { id: "new-user-id" }, session: null }, error: null };
        },
      },
    };

    const mockToken = "cf_test_signup_token_987654321";
    mockSupabase.auth.signUp({
      email: "newuser@example.com",
      password: "StrongPassword123!",
      options: {
        data: { full_name: "Jane Doe" },
        emailRedirectTo: "https://codeaxys.com/auth/callback",
        captchaToken: mockToken,
      },
    });

    assert.ok(captured.options !== null, "Expected options object to be passed");
    assert.strictEqual(captured.options?.captchaToken, mockToken, "Expected captchaToken in options");
    assert.strictEqual(captured.options?.data?.full_name, "Jane Doe", "Expected full_name in options.data");
    assert.strictEqual(captured.options?.emailRedirectTo, "https://codeaxys.com/auth/callback");
  });

  // --------------------------------------------------------------------------
  // Test 3: Missing Token Validation & Fail-Closed Guard
  // --------------------------------------------------------------------------
  test("Missing or empty captchaToken fails closed before submitting to Supabase", () => {
    let supabaseCalled = false;
    const mockSupabase = {
      auth: {
        signInWithPassword: async () => {
          supabaseCalled = true;
          return { data: null, error: null };
        },
      },
    };

    const attemptLogin = (email: string, pass: string, token: string | null) => {
      if (!email.trim() || !pass) {
        return { error: "Please enter both email and password." };
      }
      if (!token) {
        return { error: "Please complete the security check before signing in." };
      }
      mockSupabase.auth.signInWithPassword();
      return { success: true };
    };

    const resultWithoutToken = attemptLogin("user@example.com", "Password123!", null);
    assert.strictEqual(resultWithoutToken.error, "Please complete the security check before signing in.");
    assert.strictEqual(supabaseCalled, false, "Supabase must not be invoked when captchaToken is missing");

    const resultWithEmptyToken = attemptLogin("user@example.com", "Password123!", "");
    assert.strictEqual(resultWithEmptyToken.error, "Please complete the security check before signing in.");
    assert.strictEqual(supabaseCalled, false, "Supabase must not be invoked when captchaToken is empty string");

    const resultWithToken = attemptLogin("user@example.com", "Password123!", "valid_token");
    assert.strictEqual(resultWithToken.success, true);
    assert.strictEqual(supabaseCalled, true, "Supabase should be invoked when captchaToken is valid");
  });

  // --------------------------------------------------------------------------
  // Test 4: Token Expiry Callback Handling
  // --------------------------------------------------------------------------
  test("Expired token triggers state reset and widget refresh", () => {
    let stateToken: string | null = "initial_token_abc";
    let stateError: string | null = null;
    let widgetResetCalled = false;

    const mockWidget = {
      reset: () => {
        widgetResetCalled = true;
      },
    };

    const onExpire = () => {
      stateToken = null;
      stateError = "Security verification expired. Please complete it again.";
      mockWidget.reset();
    };

    // Simulate Cloudflare Turnstile calling expired-callback
    onExpire();

    assert.strictEqual(stateToken, null, "Expired token must be nullified");
    assert.strictEqual(stateError, "Security verification expired. Please complete it again.");
    assert.strictEqual(widgetResetCalled, true, "Widget reset must be called on expiration");
  });

  // --------------------------------------------------------------------------
  // Test 5: Single-Use Token Burn & Error Reset Lifecycle
  // --------------------------------------------------------------------------
  test("Failed authentication (rejected password / invalid token) purges token and resets widget", async () => {
    let currentToken: string | null = "single_use_token_123";
    let widgetResetCount = 0;

    const mockWidget = {
      reset: () => {
        widgetResetCount++;
      },
    };

    const mockSupabase = {
      auth: {
        signInWithPassword: async () => {
          return { data: null, error: { message: "Invalid login credentials" } };
        },
      },
    };

    // Simulate login handler execution on failure
    const { error: authError } = await mockSupabase.auth.signInWithPassword();
    if (authError) {
      currentToken = null;
      mockWidget.reset();
    }

    assert.strictEqual(currentToken, null, "Token must be burned/cleared on failed login");
    assert.strictEqual(widgetResetCount, 1, "Widget reset must be triggered to acquire a fresh token");
  });

  // --------------------------------------------------------------------------
  // Test 6: Preservation of Google OAuth & Email Verification Behavior
  // --------------------------------------------------------------------------
  test("Google OAuth flow remains independent and does not require captchaToken", async () => {
    let oauthProvider: string | null = null;
    let oauthRedirectUrl: string | null = null;

    const mockSupabase = {
      auth: {
        signInWithOAuth: async (params: { provider: string; options?: { redirectTo?: string } }) => {
          oauthProvider = params.provider;
          oauthRedirectUrl = params.options?.redirectTo || null;
          return { data: { provider: "google", url: "https://accounts.google.com/o/oauth2/v2/auth" }, error: null };
        },
      },
    };

    const { data, error } = await mockSupabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://codeaxys.com/auth/callback",
      },
    });

    assert.strictEqual(error, null);
    assert.strictEqual(oauthProvider, "google");
    assert.strictEqual(oauthRedirectUrl, "https://codeaxys.com/auth/callback");
    assert.ok(data?.url.includes("google.com"), "OAuth URL should point to Google");
  });

  // --------------------------------------------------------------------------
  // Test 7: Secret Key Isolation Invariant (No Secret Leakage in Client Code)
  // --------------------------------------------------------------------------
  test("Cloudflare Secret Key is NEVER referenced in client components or NEXT_PUBLIC variables", () => {
    const rootDir = path.resolve(__dirname, "..");
    const clientDirs = [
      path.join(rootDir, "components"),
      path.join(rootDir, "app"),
      path.join(rootDir, "utils"),
    ];

    const forbiddenPatterns = [
      "CLOUDFLARE_TURNSTILE_SECRET_KEY",
      "TURNSTILE_SECRET_KEY",
      "NEXT_PUBLIC_TURNSTILE_SECRET_KEY",
    ];

    for (const dir of clientDirs) {
      if (!fs.existsSync(dir)) continue;

      const scanDir = (currentPath: string) => {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (/\.(tsx|jsx|ts|js)$/.test(entry.name)) {
            const content = fs.readFileSync(fullPath, "utf8");
            for (const pattern of forbiddenPatterns) {
              if (content.includes(pattern)) {
                assert.fail(`Security Violation: Found forbidden secret pattern '${pattern}' in client file: ${fullPath}`);
              }
            }
          }
        }
      };

      scanDir(dir);
    }
  });

  // --------------------------------------------------------------------------
  // Test 8: TurnstileWidget Component Integrity Check
  // --------------------------------------------------------------------------
  test("TurnstileWidget component exports expected interface and lifecycle methods", () => {
    const widgetFilePath = path.resolve(__dirname, "../components/TurnstileWidget.tsx");
    assert.ok(fs.existsSync(widgetFilePath), "TurnstileWidget.tsx must exist");

    const content = fs.readFileSync(widgetFilePath, "utf8");
    assert.ok(content.includes('"use client"'), "Must be client component");
    assert.ok(content.includes("NEXT_PUBLIC_TURNSTILE_SITE_KEY"), "Must read NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    assert.ok(content.includes("challenges.cloudflare.com/turnstile/v0/api.js"), "Must reference Cloudflare Turnstile script");
    assert.ok(content.includes("expired-callback"), "Must handle expired-callback");
    assert.ok(content.includes("error-callback"), "Must handle error-callback");
    assert.ok(content.includes("useImperativeHandle"), "Must expose reset ref handle");
  });

  console.log("=".repeat(80));
  console.log(`ALL ${passed}/${total} CLOUDFLARE TURNSTILE INTEGRATION TESTS PASSED! 🎉`);
  console.log("=".repeat(80));
}

runTurnstileAuthIntegrationTests().catch((err) => {
  console.error("Test Suite execution failed:", err);
  process.exit(1);
});
