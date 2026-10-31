import assert from "node:assert";
import { MockAiVisibilityAdapter, executeProviderProbeSafe } from "@/lib/ai-visibility/provider-abstraction";
import { OpenAiVisibilityAdapter } from "@/lib/ai-visibility/adapters/openai-adapter";
import { PerplexityVisibilityAdapter } from "@/lib/ai-visibility/adapters/perplexity-adapter";
import { GeminiVisibilityAdapter } from "@/lib/ai-visibility/adapters/gemini-adapter";
import { ClaudeVisibilityAdapter } from "@/lib/ai-visibility/adapters/claude-adapter";
import { persistProbeResults, getHistoricalVisibilityLogs } from "@/lib/ai-visibility/persistence";
import { validateAndSanitizeConfigInput } from "@/lib/ai-visibility/monitoring/config-manager";
import { setTestClientOverride, resetTestClientOverride, createClient, createAdminClient } from "@/utils/supabase/server";
import { refundProbeCredits, deductProbeCredits } from "@/lib/ai-visibility/credit-guard";
import { POST as runProbeRoute } from "@/app/api/websites/[id]/seo/ai-visibility/probe/route";
import { GET as getConfigRoute } from "@/app/api/websites/[id]/seo/ai-visibility/config/route";
import { GET as getHistoryRoute } from "@/app/api/websites/[id]/seo/ai-visibility/history/route";

async function runPhase2RemediationTests() {
  console.log("=".repeat(80));
  console.log("CODEAXYS PHASE 2 — AI VISIBILITY REMEDIATION VERIFICATION SUITE");
  console.log("=".repeat(80));

  const originalEnv = { ...process.env };

  try {
    // =========================================================================
    // TEST 1: Mock Tagging & Historical Isolation
    // =========================================================================
    console.log("\n--- [Test 1] Mock Tagging & Historical Isolation ---");
    {
      const mockAdapter = new MockAiVisibilityAdapter("openai", "gpt-4o-mini");
      assert.strictEqual(
        mockAdapter.defaultModel,
        "mock-gpt-4o-mini",
        "Mock adapter must prefix model with mock-"
      );

      const probeResult = await mockAdapter.executeProbe({
        websiteId: "site-mock-1",
        userId: "user-1",
        brandName: "Acme Brand",
        prompt: "Best tools for website design",
        category: "informational",
      });

      assert.strictEqual(probeResult.isMock, true, "Mock probe must have isMock=true");
      assert.strictEqual(probeResult.isGroundedSearch, false, "Mock probe must not be grounded search");
      assert.strictEqual(probeResult.status, "success");
      assert.ok(probeResult.model.startsWith("mock-"), "Model must start with mock-");

      // Verify DB persistence attaches is_mock: true
      const insertedRows: any[] = [];
      const mockSupabaseClient: any = {
        from: (table: string) => ({
          insert: async (rows: any[]) => {
            insertedRows.push(...rows);
            return { error: null };
          },
        }),
      };

      const persisted = await persistProbeResults(
        mockSupabaseClient,
        "site-mock-1",
        "user-1",
        probeResult
      );
      assert.strictEqual(persisted, true, "Persistence must succeed");
      assert.strictEqual(insertedRows.length, 1);
      assert.strictEqual(insertedRows[0].is_mock, true, "Database row must have is_mock=true");
      assert.strictEqual(insertedRows[0].model_name, "mock-gpt-4o-mini");

      // Verify getHistoricalVisibilityLogs strictly excludes mock records from live analytics
      const mockRowsInDb = [
        {
          id: "log-1",
          website_id: "site-mock-1",
          user_id: "user-1",
          provider: "openai",
          model_name: "mock-gpt-4o-mini",
          is_mock: true,
          status: "success",
          brand_mentioned: true,
          citation_urls: ["https://acme.com"],
          citation_domains: ["acme.com"],
        },
        {
          id: "log-2",
          website_id: "site-mock-1",
          user_id: "user-1",
          provider: "perplexity",
          model_name: "sonar",
          is_mock: false,
          status: "success",
          brand_mentioned: true,
          citation_urls: ["https://genuine-citation.org"],
          citation_domains: ["genuine-citation.org"],
        },
      ];

      const queryDb: any = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: mockRowsInDb, error: null }),
              }),
            }),
          }),
        }),
      };

      const historySummary = await getHistoricalVisibilityLogs(queryDb, "site-mock-1", 50);
      assert.strictEqual(
        historySummary.totalProbes,
        1,
        "totalProbes in summary must strictly count only live rows (excluding mock rows)"
      );
      assert.strictEqual(historySummary.successCount, 1);
      assert.strictEqual(historySummary.brandMentionCount, 1);
      assert.strictEqual(historySummary.totalCitations, 1);
      assert.deepStrictEqual(historySummary.uniqueCitationDomains, ["genuine-citation.org"]);
      assert.strictEqual(historySummary.recentHistory.length, 2);
      assert.strictEqual(historySummary.recentHistory[0].isMock, true);
      assert.strictEqual(historySummary.recentHistory[1].isMock, false);

      console.log("✅ Passed: Mock results tag is_mock=true and are strictly isolated from live analytics.");
    }

    // =========================================================================
    // TEST 2: Fail Closed on Missing API Credentials in Live Mode
    // =========================================================================
    console.log("\n--- [Test 2] Fail Closed on Missing API Credentials in Live Mode ---");
    {
      process.env.FEATURE_LIVE_AI_VISIBILITY = "true";
      delete process.env.OPENAI_API_KEY;
      delete process.env.PERPLEXITY_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      const dummyInput = {
        websiteId: "site-live-1",
        userId: "user-1",
        brandName: "Acme Live",
        prompt: "Top web tools",
        category: "informational" as const,
      };

      // OpenAI
      const openaiAdapter = new OpenAiVisibilityAdapter();
      const openaiRes = await openaiAdapter.executeProbe(dummyInput);
      assert.strictEqual(openaiRes.status, "auth_error", "OpenAI must return auth_error when API key is missing");
      assert.strictEqual(openaiRes.isMock, false, "Must not return isMock=true in live mode");
      assert.ok(openaiRes.errorMessage?.includes("OpenAI API key is missing"), "Must have explicit missing key error");

      // Perplexity
      const perplexityAdapter = new PerplexityVisibilityAdapter();
      const perplexityRes = await perplexityAdapter.executeProbe(dummyInput);
      assert.strictEqual(perplexityRes.status, "auth_error", "Perplexity must return auth_error when API key is missing");
      assert.strictEqual(perplexityRes.isMock, false);
      assert.ok(perplexityRes.errorMessage?.includes("Perplexity API key is missing"));

      // Gemini
      const geminiAdapter = new GeminiVisibilityAdapter();
      const geminiRes = await geminiAdapter.executeProbe(dummyInput);
      assert.strictEqual(geminiRes.status, "auth_error", "Gemini must return auth_error when API key is missing");
      assert.strictEqual(geminiRes.isMock, false);
      assert.ok(geminiRes.errorMessage?.includes("Gemini API key is missing"));

      // Claude
      const claudeAdapter = new ClaudeVisibilityAdapter();
      const claudeRes = await claudeAdapter.executeProbe(dummyInput);
      assert.strictEqual(claudeRes.status, "auth_error", "Claude must return auth_error when API key is missing");
      assert.strictEqual(claudeRes.isMock, false);
      assert.ok(claudeRes.errorMessage?.includes("Anthropic Claude API key is missing"));

      // Revert live mode
      delete process.env.FEATURE_LIVE_AI_VISIBILITY;
      console.log("✅ Passed: All 4 adapters fail closed with auth_error when credentials are unset in live mode.");
    }

    // =========================================================================
    // TEST 3: Scheduled Monitoring Opt-In Default
    // =========================================================================
    console.log("\n--- [Test 3] Scheduled Monitoring Opt-In Default ---");
    {
      const defaultSanitized = validateAndSanitizeConfigInput({}, "Acme Brand");
      assert.strictEqual(
        defaultSanitized.enabled,
        false,
        "validateAndSanitizeConfigInput must default enabled to false"
      );

      const explicitOptIn = validateAndSanitizeConfigInput({ enabled: true }, "Acme Brand");
      assert.strictEqual(
        explicitOptIn.enabled,
        true,
        "validateAndSanitizeConfigInput must honor explicit user opt-in"
      );
      console.log("✅ Passed: Scheduled monitoring strictly defaults to disabled.");
    }

    // =========================================================================
    // TEST 4: Claude Model Identifier
    // =========================================================================
    console.log("\n--- [Test 4] Claude Model Identifier ---");
    {
      delete process.env.ANTHROPIC_MODEL;
      const claude = new ClaudeVisibilityAdapter();
      assert.strictEqual(
        claude.defaultModel,
        "claude-3-5-sonnet-20241022",
        "ClaudeVisibilityAdapter must default to official snapshot claude-3-5-sonnet-20241022"
      );
      console.log("✅ Passed: Claude adapter uses supported snapshot claude-3-5-sonnet-20241022.");
    }

    // =========================================================================
    // TEST 5: Fair Partial-Failure Refunds & Atomic Idempotency
    // =========================================================================
    console.log("\n--- [Test 5] Fair Partial-Failure Refunds & Atomic Idempotency ---");
    {
      // Simulate user credit ledger
      let balance = 50;
      const transactions: any[] = [];
      const mockDb: any = {
        _getBalance: () => balance,
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { balance }, error: null }),
            }),
          }),
        }),
        rpc: async (fn: string, params: any) => {
          if (fn === "deduct_user_credits") {
            const { p_credits, p_action_type } = params;
            if (balance < p_credits) return { data: false, error: null };
            balance -= p_credits;
            transactions.push({ action_type: p_action_type, credits_used: p_credits });
            return { data: true, error: null };
          }
          if (fn === "refund_user_credits") {
            const { p_credits, p_action_type } = params;
            // Check duplicate refund action
            if (transactions.some((t) => t.action_type === p_action_type)) {
              return { data: false, error: null };
            }
            balance += p_credits;
            transactions.push({ action_type: p_action_type, credits_used: -p_credits });
            return { data: true, error: null };
          }
          return { data: null, error: new Error(`Unknown RPC ${fn}`) };
        },
      };

      const testActionKey = "probe_test_partial_001";

      // 1. Deduct 3 credits for multi-provider batch
      const deductionRes = await deductProbeCredits(
        mockDb,
        "user_part_test",
        "site_part_1",
        3,
        "Multi-probe batch",
        testActionKey
      );
      assert.strictEqual(deductionRes.success, true);
      assert.strictEqual(balance, 47, "Balance is 47 after 3 credit deduction");

      // 2. Scenario A: 1 provider succeeded, 3 failed. Fair refund = 2 credits (charging 1 credit)
      const partialRefundRes = await refundProbeCredits(
        mockDb,
        "user_part_test",
        "site_part_1",
        2,
        "Partial batch failure: 3 providers failed",
        `${testActionKey}:partial_failure_1`
      );
      assert.strictEqual(partialRefundRes, true, "Partial refund of 2 credits must succeed");
      assert.strictEqual(balance, 49, "Balance restored to 49 (net cost: 1 credit)");

      // 3. Idempotency test: duplicate call with same partial action key must fail
      const duplicateRefund = await refundProbeCredits(
        mockDb,
        "user_part_test",
        "site_part_1",
        2,
        "Duplicate partial refund",
        `${testActionKey}:partial_failure_1`
      );
      assert.strictEqual(duplicateRefund, false, "Duplicate refund must be rejected idempotently");
      assert.strictEqual(balance, 49, "Balance remains 49");

      console.log("✅ Passed: Fair partial-failure refund logic restores balance idempotently.");
    }

    // =========================================================================
    // TEST 6: Production Protection on Test Client Overrides
    // =========================================================================
    console.log("\n--- [Test 6] Production Protection on Test Client Overrides ---");
    {
      (process.env as any).NODE_ENV = "production";
      assert.throws(
        () => {
          setTestClientOverride({ dummy: true });
        },
        /Test client overrides are strictly prohibited in production environment/,
        "setTestClientOverride must throw an error in production"
      );

      // Revert NODE_ENV
      (process.env as any).NODE_ENV = "test";
      resetTestClientOverride();
      console.log("✅ Passed: Test client overrides cannot affect production requests.");
    }

    // =========================================================================
    // TEST 7: Route-Level LiveMode Synchronicity in Config & History
    // =========================================================================
    console.log("\n--- [Test 7] Route-Level LiveMode Synchronicity ---");
    {
      const dummyUser = { id: "user-route-test" };
      const dummySite = { id: "site-route-test", user_id: "user-route-test", title: "Test Site" };

      function createMockSupabaseForRoutes(planId = "pro") {
        const client: any = {
          auth: {
            getUser: async () => ({ data: { user: dummyUser }, error: null }),
          },
          from: (table: string) => {
            const builder: any = {
              select: () => builder,
              eq: () => builder,
              gte: () => builder,
              lte: () => builder,
              in: () => builder,
              order: () => builder,
              limit: () => builder,
              single: async () => builder.maybeSingle(),
              maybeSingle: async () => {
                if (table === "websites") return { data: dummySite, error: null };
                if (table === "subscriptions") {
                  return {
                    data: {
                      plan_id: planId,
                      status: "active",
                      plans: { id: planId, name: planId.toUpperCase(), allow_advanced_seo: true },
                    },
                    error: null,
                  };
                }
                if (table === "user_credits") return { data: { balance: 100 }, error: null };
                if (table === "website_ai_visibility_configs") {
                  return {
                    data: {
                      id: "cfg-1",
                      website_id: "site-route-test",
                      user_id: "user-route-test",
                      is_enabled: false,
                      frequency: "daily",
                    },
                    error: null,
                  };
                }
                return { data: null, error: null };
              },
              then: (resolve: any) => {
                if (table === "websites") return Promise.resolve({ data: [dummySite], error: null }).then(resolve);
                if (table === "ai_visibility_alerts") return Promise.resolve({ data: [], error: null }).then(resolve);
                if (table === "seo_ai_visibility_logs") return Promise.resolve({ data: [], error: null }).then(resolve);
                if (table === "ai_credit_transactions") return Promise.resolve({ data: [], count: 0, error: null }).then(resolve);
                if (table === "media_assets") return Promise.resolve({ data: [], error: null }).then(resolve);
                return Promise.resolve({ data: [], error: null }).then(resolve);
              },
            };
            return builder;
          },
        };
        return client;
      }

      setTestClientOverride(createMockSupabaseForRoutes("pro"));

      // Verify GET /config returns liveMode: false
      delete process.env.FEATURE_LIVE_AI_VISIBILITY;
      const configRes = await getConfigRoute(new Request("http://localhost/api"), {
        params: Promise.resolve({ id: "site-route-test" }),
      });
      const configData = await configRes.json();
      assert.strictEqual(configData.success, true);
      assert.strictEqual(configData.liveMode, false, "GET /config must return liveMode: false when feature is off");
      assert.strictEqual(configData.config.enabled, false, "Monitoring config must be disabled by default");

      // Verify GET /history returns liveMode: false
      const historyRes = await getHistoryRoute(new Request("http://localhost/api"), {
        params: Promise.resolve({ id: "site-route-test" }),
      });
      const historyData = await historyRes.json();
      assert.strictEqual(historyData.success, true);
      assert.strictEqual(historyData.liveMode, false, "GET /history must return liveMode: false");

      resetTestClientOverride();
      console.log("✅ Passed: Config and history routes correctly return liveMode and disabled monitoring default.");
    }

    // =========================================================================
    // TEST 8: Route-Level Probe Execution in Mock Mode
    // =========================================================================
    console.log("\n--- [Test 8] Route-Level Probe Execution in Mock Mode ---");
    {
      const dummyUser = { id: "user-probe-route" };
      const dummySite = { id: "site-probe-route", user_id: "user-probe-route", title: "Acme Pro Site" };
      const persistedRows: any[] = [];

      const mockProbeClient: any = {
        auth: {
          getUser: async () => ({ data: { user: dummyUser }, error: null }),
        },
        from: (table: string) => {
          const builder: any = {
            select: () => builder,
            eq: () => builder,
            gte: () => builder,
            lte: () => builder,
            in: () => builder,
            order: () => builder,
            limit: () => builder,
            upsert: () => builder,
            single: async () => builder.maybeSingle(),
            maybeSingle: async () => {
              if (table === "websites") return { data: dummySite, error: null };
              if (table === "subscriptions") {
                return {
                  data: {
                    plan_id: "pro",
                    status: "active",
                    current_period_end: new Date(Date.now() + 86400000).toISOString(),
                    plans: { id: "pro", name: "Pro", allow_advanced_seo: true },
                  },
                  error: null,
                };
              }
              if (table === "user_credits") return { data: { balance: 100 }, error: null };
              return { data: null, error: null };
            },
            insert: async (rows: any[]) => {
              persistedRows.push(...rows);
              return { error: null };
            },
            then: (resolve: any) => {
              if (table === "websites") return Promise.resolve({ data: [dummySite], error: null }).then(resolve);
              if (table === "seo_ai_visibility_logs") return Promise.resolve({ data: [], error: null }).then(resolve);
              if (table === "ai_credit_transactions") return Promise.resolve({ data: [], count: 0, error: null }).then(resolve);
              return Promise.resolve({ data: [], error: null }).then(resolve);
            },
          };
          return builder;
        },
      };

      setTestClientOverride(mockProbeClient);
      delete process.env.FEATURE_LIVE_AI_VISIBILITY;

      const req = new Request("http://localhost/api/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "all",
          prompt: "Best luxury web designer in Austin",
          category: "buyer_intent",
          brandName: "Acme Pro",
        }),
      });

      const res = await runProbeRoute(req, {
        params: Promise.resolve({ id: "site-probe-route" }),
      });

      const data = await res.json();
      assert.strictEqual(res.status, 200, "Probe route must return 200");
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.liveMode, false, "liveMode must be false");
      assert.strictEqual(data.creditsDeducted, 0, "Zero credits must be deducted in mock mode");
      assert.strictEqual(data.batch.totalProviders, 4, "Must execute across 4 providers");
      assert.strictEqual(data.responses.length, 4);

      // Verify every response has isMock=true and mock- prefix
      for (const r of data.responses) {
        assert.strictEqual(r.isMock, true, `Provider ${r.provider} response must have isMock=true`);
        assert.ok(r.model.startsWith("mock-"), `Provider ${r.provider} model must start with mock-`);
      }

      // Verify persisted rows in DB all have is_mock=true
      assert.ok(persistedRows.length >= 4, "Must persist all probe responses");
      for (const row of persistedRows) {
        assert.strictEqual(row.is_mock, true, "Persisted row must have is_mock=true");
        assert.ok(row.model_name.startsWith("mock-"), "Persisted row model_name must start with mock-");
      }

      resetTestClientOverride();
      console.log("✅ Passed: Route-level probe runs in zero-credit mock mode and persists is_mock=true.");
    }

    console.log("\n" + "=".repeat(80));
    console.log("ALL PHASE 2 AI VISIBILITY REMEDIATION TESTS PASSED (8/8)");
    console.log("=".repeat(80));
  } finally {
    process.env = originalEnv;
    resetTestClientOverride();
  }
}

runPhase2RemediationTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
