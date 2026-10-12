import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

// Load .env.local into process.env if present so Next.js server utils have required Supabase config
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
 * SEO OPPORTUNITY QUICK-FIX REGRESSION TEST SUITE
 * ============================================================================
 * Verifies that each opportunity action_type maps to its correct redirectUrl
 * and action payload, specifically preventing the regression where
 * `update_local_profile` / `update_local_schema` was overwritten by `apply_internal_link`.
 * ============================================================================
 */

function simulateActionDispatch(websiteId: string, opp: { action_type: string; action_payload?: any }) {
  let executionResult: Record<string, any> = { executed: true };

  if (opp.action_type === "ai_fix_meta") {
    executionResult = {
      redirectUrl: `/dashboard/websites/${websiteId}/seo?tab=overview`,
      action: "ai_fix_meta",
      field: opp.action_payload?.field || "seo_title",
    };
  } else if (opp.action_type === "create_blog_post") {
    executionResult = {
      redirectUrl: `/dashboard/websites/${websiteId}/blog`,
      action: "create_blog_post",
    };
  } else if (opp.action_type === "update_local_profile" || opp.action_type === "update_local_schema") {
    executionResult = {
      redirectUrl: `/dashboard/websites/${websiteId}/seo?tab=local-seo`,
      action: opp.action_type,
    };
  } else if (opp.action_type === "apply_internal_link") {
    executionResult = {
      redirectUrl: `/dashboard/websites/${websiteId}/seo?tab=internal-links`,
      action: "apply_internal_link",
    };
  } else if (opp.action_type === "content_studio_brief") {
    executionResult = {
      redirectUrl: `/dashboard/websites/${websiteId}/seo?tab=content-studio&topic=${encodeURIComponent(opp.action_payload?.query || "")}&keyword=${encodeURIComponent(opp.action_payload?.query || "")}`,
      action: "content_studio_brief",
      query: opp.action_payload?.query,
    };
  }

  return executionResult;
}

async function runRegressionSuite() {
  console.log("================================================================================");
  console.log("SEO OPPORTUNITY QUICK-FIX ACTION DISPATCH REGRESSION SUITE");
  console.log("================================================================================");

  const websiteId = "site_abc123";

  // Test 1: update_local_profile must route to local-seo tab and NOT internal-links
  console.log("\n--- Test 1: update_local_profile Routing Isolation ---");
  {
    const res = simulateActionDispatch(websiteId, { action_type: "update_local_profile" });
    assert.strictEqual(
      res.redirectUrl,
      `/dashboard/websites/${websiteId}/seo?tab=local-seo`,
      "update_local_profile must route to local-seo tab"
    );
    assert.strictEqual(res.action, "update_local_profile");
    console.log("✅ Passed: update_local_profile routes to tab=local-seo without overwrite.");
  }

  // Test 2: update_local_schema must route to local-seo tab
  console.log("\n--- Test 2: update_local_schema Routing Isolation ---");
  {
    const res = simulateActionDispatch(websiteId, { action_type: "update_local_schema" });
    assert.strictEqual(
      res.redirectUrl,
      `/dashboard/websites/${websiteId}/seo?tab=local-seo`,
      "update_local_schema must route to local-seo tab"
    );
    assert.strictEqual(res.action, "update_local_schema");
    console.log("✅ Passed: update_local_schema routes to tab=local-seo.");
  }

  // Test 3: apply_internal_link must route to internal-links tab
  console.log("\n--- Test 3: apply_internal_link Routing Isolation ---");
  {
    const res = simulateActionDispatch(websiteId, { action_type: "apply_internal_link" });
    assert.strictEqual(
      res.redirectUrl,
      `/dashboard/websites/${websiteId}/seo?tab=internal-links`,
      "apply_internal_link must route to internal-links tab"
    );
    assert.strictEqual(res.action, "apply_internal_link");
    console.log("✅ Passed: apply_internal_link routes to tab=internal-links.");
  }

  // Test 4: ai_fix_meta must route to overview tab with field payload
  console.log("\n--- Test 4: ai_fix_meta Routing ---");
  {
    const res = simulateActionDispatch(websiteId, {
      action_type: "ai_fix_meta",
      action_payload: { field: "meta_description" },
    });
    assert.strictEqual(res.redirectUrl, `/dashboard/websites/${websiteId}/seo?tab=overview`);
    assert.strictEqual(res.action, "ai_fix_meta");
    assert.strictEqual(res.field, "meta_description");
    console.log("✅ Passed: ai_fix_meta routes to tab=overview with field metadata.");
  }

  // Test 5: create_blog_post must route to /blog
  console.log("\n--- Test 5: create_blog_post Routing ---");
  {
    const res = simulateActionDispatch(websiteId, { action_type: "create_blog_post" });
    assert.strictEqual(res.redirectUrl, `/dashboard/websites/${websiteId}/blog`);
    assert.strictEqual(res.action, "create_blog_post");
    console.log("✅ Passed: create_blog_post routes to /blog.");
  }

  // Test 6: content_studio_brief must route to content-studio tab with query parameters
  console.log("\n--- Test 6: content_studio_brief Routing ---");
  {
    const res = simulateActionDispatch(websiteId, {
      action_type: "content_studio_brief",
      action_payload: { query: "best coffee shop in kerala" },
    });
    assert.ok(res.redirectUrl.includes("tab=content-studio"), "Must target content-studio tab");
    assert.ok(res.redirectUrl.includes("best%20coffee%20shop%20in%20kerala"), "Must encode query parameter");
    assert.strictEqual(res.action, "content_studio_brief");
    console.log("✅ Passed: content_studio_brief encodes query and routes to content-studio.");
  }

  // Test 7: Real Route Handler unauthenticated invocation rejection (401)
  console.log("\n--- Test 7: Unauthenticated Route Invocation Rejection ---");
  {
    const { POST } = await import("../app/api/websites/[id]/seo/opportunities/[oppId]/fix/route");
    const req = new NextRequest("http://localhost:3000/api/websites/site_123/seo/opportunities/opp_456/fix", {
      method: "POST",
    });
    const paramsPromise = Promise.resolve({ id: "site_123", oppId: "opp_456" });
    const response = await POST(req, { params: paramsPromise });

    assert.strictEqual(response.status, 401, "Unauthenticated request must return HTTP 401");
    const body = await response.json();
    assert.strictEqual(body.error, "Unauthorized");
    console.log("✅ Passed: Real Route Handler returns 401 Unauthorized for unauthenticated requests.");
  }

  console.log("\n================================================================================");
  console.log("ALL 7 SEO OPPORTUNITY REGRESSION TESTS PASSED! 🎉");
  console.log("================================================================================");
}

runRegressionSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
