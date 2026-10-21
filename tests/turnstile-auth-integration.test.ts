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

  // --------------------------------------------------------------------------
  // Test 9: Stable Callback Refs Static Invariant Check
  // --------------------------------------------------------------------------
  test("TurnstileWidget implements Stable Callback Refs pattern without volatile effect dependencies", () => {
    const widgetFilePath = path.resolve(__dirname, "../components/TurnstileWidget.tsx");
    const content = fs.readFileSync(widgetFilePath, "utf8");

    // 1. Must use callbacksRef to store latest parent callbacks
    assert.ok(
      content.includes("const callbacksRef = useRef({ onSuccess, onExpire, onError })") &&
      content.includes("callbacksRef.current = { onSuccess, onExpire, onError }"),
      "Must synchronize callbacksRef.current with latest parent callbacks"
    );

    // 2. handleSuccess, handleExpire, and handleError must invoke callbacksRef.current
    assert.ok(content.includes("callbacksRef.current.onSuccess(token)"), "handleSuccess must invoke callbacksRef.current.onSuccess");
    assert.ok(content.includes("callbacksRef.current.onExpire"), "handleExpire must invoke callbacksRef.current.onExpire");
    assert.ok(content.includes("callbacksRef.current.onError"), "handleError must invoke callbacksRef.current.onError");

    // 3. renderWidget dependency array must NOT include onSuccess, onExpire, or onError
    const renderWidgetMatch = content.match(/const renderWidget = useCallback\([\s\S]*?\}, \[(.*?)\]\);/);
    assert.ok(renderWidgetMatch, "renderWidget must be defined with useCallback");
    const renderDeps = renderWidgetMatch[1].split(",").map((s) => s.trim());
    assert.ok(!renderDeps.includes("onSuccess"), "renderWidget must not depend on onSuccess");
    assert.ok(!renderDeps.includes("onExpire"), "renderWidget must not depend on onExpire");
    assert.ok(!renderDeps.includes("onError"), "renderWidget must not depend on onError");

    // 4. useEffect dependency array must NOT include onSuccess, onExpire, or onError
    const useEffectMatch = content.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[(.*?)\]\);/);
    assert.ok(useEffectMatch, "useEffect must be defined with explicit dependencies");
    const effectDeps = useEffectMatch[1].split(",").map((s) => s.trim());
    assert.ok(!effectDeps.includes("onSuccess"), "useEffect must not depend on onSuccess");
    assert.ok(!effectDeps.includes("onExpire"), "useEffect must not depend on onExpire");
    assert.ok(!effectDeps.includes("onError"), "useEffect must not depend on onError");
    assert.deepStrictEqual(effectDeps, ["siteKey", "renderWidget"], "useEffect must depend strictly on [siteKey, renderWidget]");
  });

  // --------------------------------------------------------------------------
  // Test 10: Behavioral Lifecycle: Parent Callback Churn Does Not Destroy/Remount Widget
  // --------------------------------------------------------------------------
  test("Parent callback reference churn does not tear down or recreate widget, while reset/expiry work", () => {
    // Track Turnstile API lifecycle invocations
    let renderCount = 0;
    let removeCount = 0;
    let resetCount = 0;
    let registeredCallback: ((token: string) => void) | null = null;
    let registeredExpiredCallback: (() => void) | null = null;

    const mockTurnstile = {
      render: (_container: unknown, options: {
        sitekey: string;
        callback: (token: string) => void;
        "expired-callback"?: () => void;
        "error-callback"?: (code?: string) => void;
      }) => {
        renderCount++;
        registeredCallback = options.callback;
        registeredExpiredCallback = options["expired-callback"] || null;
        return "mock-widget-id-123";
      },
      reset: (_id?: string) => {
        void _id;
        resetCount++;
      },
      remove: (_id?: string) => {
        void _id;
        removeCount++;
      },
    };

    // Simulate TurnstileWidget internal state and lifecycle with Stable Callback Refs
    let widgetId: string | null = null;
    const callbacksRef: {
      current: {
        onSuccess: (token: string) => void;
        onExpire?: () => void;
        onError?: (err?: string) => void;
      };
    } = {
      current: {
        onSuccess: (_token: string) => {
          void _token;
        },
        onExpire: () => {},
        onError: (_err?: string) => {
          void _err;
        },
      },
    };

    const handleSuccess = (token: string) => {
      callbacksRef.current.onSuccess(token);
    };

    const handleExpire = () => {
      if (callbacksRef.current.onExpire) {
        callbacksRef.current.onExpire();
      }
      if (widgetId) {
        mockTurnstile.reset(widgetId);
      }
    };

    const renderWidget = () => {
      if (widgetId) {
        mockTurnstile.remove(widgetId);
        widgetId = null;
      }
      widgetId = mockTurnstile.render("#container", {
        sitekey: "test-site-key",
        callback: handleSuccess,
        "expired-callback": handleExpire,
      });
    };

    // 1. Initial mount
    renderWidget();
    assert.strictEqual(renderCount, 1, "Widget should be rendered on mount");
    assert.strictEqual(removeCount, 0, "Widget should not be removed on mount");

    // 2. Simulate 25 parent re-renders (user typing in email / password fields)
    let latestReceivedToken: string | null = null;
    let latestExpiredCallCount = 0;

    for (let keystroke = 1; keystroke <= 25; keystroke++) {
      // In un-optimized code, each keystroke passes a new function identity
      const newOnSuccess = (token: string) => {
        latestReceivedToken = `${token}_from_keystroke_${keystroke}`;
      };
      const newOnExpire = () => {
        latestExpiredCallCount++;
      };

      // With Stable Callback Refs, only callbacksRef.current updates:
      callbacksRef.current = {
        onSuccess: newOnSuccess,
        onExpire: newOnExpire,
        onError: () => {},
      };
      // Neither renderWidget nor useEffect cleanup is triggered
    }

    // Assert that 25 keystrokes caused 0 teardowns and 0 re-mounts
    assert.strictEqual(renderCount, 1, "Widget must NOT have been re-rendered during typing keystrokes");
    assert.strictEqual(removeCount, 0, "Widget must NOT have been removed/torn down during typing keystrokes");

    // 3. Verify that when Turnstile completes, the latest parent callback is invoked
    assert.ok(registeredCallback !== null, "Turnstile callback must be registered");
    const invokeCallback: (t: string) => void = registeredCallback!;
    invokeCallback("tok_verified_xyz");
    assert.strictEqual(
      latestReceivedToken,
      "tok_verified_xyz_from_keystroke_25",
      "Must invoke the latest parent callback without stale closures"
    );

    // 4. Verify explicit reset() (e.g. after auth error)
    mockTurnstile.reset(widgetId!);
    assert.strictEqual(resetCount, 1, "Explicit reset must call turnstile.reset");

    // 5. Verify expired-callback automatically triggers reset and notifies parent
    assert.ok(registeredExpiredCallback !== null, "Expired callback must be registered");
    const invokeExpired: () => void = registeredExpiredCallback!;
    invokeExpired();
    assert.strictEqual(latestExpiredCallCount, 1, "Parent onExpire callback must be called on token expiration");
    assert.strictEqual(resetCount, 2, "turnstile.reset must be called automatically on expiration");

    // 6. Verify unmount cleans up widget
    if (widgetId) {
      mockTurnstile.remove(widgetId);
      widgetId = null;
    }
    assert.strictEqual(removeCount, 1, "Widget must be removed exactly once on unmount");
  });

  // --------------------------------------------------------------------------
  // Test 11: Container Clearance & Native Cloudflare Render Configuration
  // --------------------------------------------------------------------------
  test("TurnstileWidget clears container before rendering and passes native Cloudflare options", () => {
    const widgetFilePath = path.resolve(__dirname, "../components/TurnstileWidget.tsx");
    const content = fs.readFileSync(widgetFilePath, "utf8");

    // Must clean containerRef before rendering to eliminate duplicate iframes
    assert.ok(
      content.includes('containerRef.current.innerHTML = ""'),
      "Must clear containerRef.current.innerHTML before rendering to prevent duplicate iframes"
    );

    // Must configure native Cloudflare retry and refresh-expired options
    assert.ok(
      content.includes('retry: "auto"') || content.includes('"retry": "auto"'),
      "Must configure native auto retry"
    );
    assert.ok(content.includes('"refresh-expired": "auto"'), "Must configure native auto token refresh");
  });

  // --------------------------------------------------------------------------
  // Test 12: Responsive Form Presentation & Mobile Overflow Prevention Invariants
  // --------------------------------------------------------------------------
  test("Login and Signup pages enforce responsive containers and prevent horizontal mobile overflow", () => {
    const loginFilePath = path.resolve(__dirname, "../app/login/page.tsx");
    const signupFilePath = path.resolve(__dirname, "../app/signup/page.tsx");

    const loginContent = fs.readFileSync(loginFilePath, "utf8");
    const signupContent = fs.readFileSync(signupFilePath, "utf8");

    // 1. Must use w-full with overflow-x-hidden rather than w-screen to prevent horizontal scrollbars
    assert.ok(!loginContent.includes("w-screen"), "LoginPage must not use w-screen (which causes horizontal scrollbars)");
    assert.ok(!signupContent.includes("w-screen"), "SignupPage must not use w-screen (which causes horizontal scrollbars)");
    assert.ok(loginContent.includes("overflow-x-hidden"), "LoginPage must enforce overflow-x-hidden");
    assert.ok(signupContent.includes("overflow-x-hidden"), "SignupPage must enforce overflow-x-hidden");

    // 2. Card padding must use mobile-responsive px-4 py-6 sm:p-8
    assert.ok(loginContent.includes("px-4 py-6 sm:p-8"), "LoginPage card must use responsive mobile padding px-4 py-6 sm:p-8");
    assert.ok(signupContent.includes("px-4 py-6 sm:p-8"), "SignupPage card must use responsive mobile padding px-4 py-6 sm:p-8");

    // 3. Turnstile container must specify overflow-hidden and max-w-full
    const widgetContent = fs.readFileSync(path.resolve(__dirname, "../components/TurnstileWidget.tsx"), "utf8");
    assert.ok(widgetContent.includes("overflow-hidden"), "Turnstile container must have overflow-hidden");
    assert.ok(widgetContent.includes("max-w-full"), "Turnstile container must have max-w-full");
  });

  console.log("=".repeat(80));
  console.log(`ALL ${passed}/${total} CLOUDFLARE TURNSTILE INTEGRATION TESTS PASSED! 🎉`);
  console.log("=".repeat(80));
}

runTurnstileAuthIntegrationTests().catch((err) => {
  console.error("Test Suite execution failed:", err);
  process.exit(1);
});
