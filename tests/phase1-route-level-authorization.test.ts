import assert from "node:assert";
import { NextRequest } from "next/server";
import { setTestClientOverride, resetTestClientOverride } from "../utils/supabase/server";

// Import real Next.js Route Handlers
import { GET as getGoogleAdsCustomers } from "../app/api/websites/[id]/seo/google-ads/customers/route";
import { POST as postGoogleAdsSelectAccount } from "../app/api/websites/[id]/seo/google-ads/select-account/route";
import { POST as postGoogleAdsKeywords } from "../app/api/websites/[id]/seo/google-ads/keywords/route";
import {
  GET as getAutopilot,
  PUT as putAutopilot,
  POST as postAutopilot,
} from "../app/api/websites/[id]/seo/autopilot/route";
import {
  GET as getBlogList,
  POST as postBlogCreate,
} from "../app/api/websites/[id]/blog/route";
import {
  PUT as putBlogPost,
  DELETE as deleteBlogPost,
} from "../app/api/websites/[id]/blog/[postId]/route";
import { POST as postBlogGenerate } from "../app/api/websites/[id]/blog/generate/route";

console.log("================================================================================");
console.log("PHASE 1.2 — ROUTE-LEVEL AUTHORIZATION & SECURITY TEST SUITE");
console.log("================================================================================");

let testsPassed = 0;

interface MockDatabaseState {
  userId?: string | null;
  planId?: string;
  userAddons?: Array<{ addon_id: string; status: string; current_period_end?: string }>;
  ownedWebsites?: string[];
  creditsBalance?: number;
  googleAdsConnected?: boolean;
}

function createMockSupabase(state: MockDatabaseState) {
  const currentUserId = state.userId === undefined ? "test_user_id" : state.userId;
  const userPlan = state.planId || "free";
  const ownedWebsites = state.ownedWebsites ?? ["site_owned_1"];
  const futureDate = new Date(Date.now() + 30 * 86400000).toISOString();
  const creditsBalance = state.creditsBalance !== undefined ? state.creditsBalance : 100;
  const addons = state.userAddons || [];

  let deductedCreditsTotal = 0;
  let refundedCreditsTotal = 0;

  const client: any = {
    _metrics: {
      get deducted() { return deductedCreditsTotal; },
      get refunded() { return refundedCreditsTotal; },
    },
    auth: {
      getUser: async () => ({
        data: {
          user: currentUserId ? { id: currentUserId, email: `${currentUserId}@example.com` } : null,
        },
        error: currentUserId ? null : { message: "No active session." },
      }),
    },
    rpc: async (funcName: string, params: any) => {
      if (funcName === "deduct_user_credits") {
        deductedCreditsTotal += params?.p_credits || 0;
        return { data: true, error: null };
      }
      if (funcName === "refund_user_credits") {
        refundedCreditsTotal += params?.p_credits || 0;
        return { data: true, error: null };
      }
      return { data: true, error: null };
    },
    from: (table: string) => {
      let filterWebsiteId: string | null = null;
      let filterUserId: string | null = null;
      let filterStatus: string | null = null;
      let filterPostId: string | null = null;

      const builder: any = {
        select: (cols: any, opts: any) => builder,
        eq: (col: string, val: any) => {
          if (col === "id" && table === "websites") filterWebsiteId = val;
          if (col === "website_id") filterWebsiteId = val;
          if (col === "user_id") filterUserId = val;
          if (col === "status") filterStatus = val;
          if (col === "id" && table === "blog_posts") filterPostId = val;
          return builder;
        },
        gte: () => builder,
        lte: () => builder,
        in: () => builder,
        order: () => builder,
        limit: () => builder,
        upsert: () => builder,
        insert: (insertData: any) => {
          return {
            ...builder,
            select: () => ({
              single: async () => ({
                data: { id: "new_record_1", ...insertData },
                error: null,
              }),
              maybeSingle: async () => ({
                data: { id: "new_record_1", ...insertData },
                error: null,
              }),
            }),
          };
        },
        update: (updateData: any) => ({
          ...builder,
          select: () => ({
            single: async () => ({
              data: { id: filterPostId || "updated_record", ...updateData },
              error: null,
            }),
            maybeSingle: async () => ({
              data: { id: filterPostId || "updated_record", ...updateData },
              error: null,
            }),
          }),
        }),
        delete: () => builder,
        single: async () => {
          if (table === "websites") {
            const isOwned = ownedWebsites.includes(filterWebsiteId || "");
            if (isOwned && (!filterUserId || filterUserId === currentUserId)) {
              return {
                data: {
                  id: filterWebsiteId,
                  user_id: currentUserId,
                  title: "Test Website",
                  prompt: "Portfolio website",
                  published_slug: "test-site",
                  is_published: true,
                },
                error: null,
              };
            }
            return { data: null, error: { message: "Website not found or access denied." } };
          }
          if (table === "blog_posts") {
            return {
              data: {
                id: filterPostId || "post_1",
                website_id: filterWebsiteId || "site_owned_1",
                user_id: currentUserId,
                title: "Existing Post Title",
                slug: "existing-post-title",
                content: "<p>Hello</p>",
                status: "draft",
              },
              error: null,
            };
          }
          if (table === "seo_autopilot_settings") {
            return {
              data: {
                website_id: filterWebsiteId || "site_owned_1",
                user_id: currentUserId,
                status: "active",
                scan_frequency: "weekly",
                auto_stage_safe_fixes: true,
                notify_on_critical: true,
              },
              error: null,
            };
          }
          if (table === "website_integrations") {
            if (state.googleAdsConnected) {
              return {
                data: {
                  credentials: {
                    refresh_token: "mock_refresh_token_xyz",
                    customer_id: "123-456-7890",
                  },
                },
                error: null,
              };
            }
            return { data: null, error: { message: "Not connected" } };
          }
          return { data: null, error: { message: "Not found" } };
        },
        maybeSingle: async () => {
          if (table === "subscriptions") {
            if (userPlan === "free") {
              return { data: null, error: null };
            }
            return {
              data: {
                plan_id: userPlan,
                status: "active",
                current_period_start: new Date().toISOString(),
                current_period_end: futureDate,
                billing_interval: "monthly",
                duration_months: 1,
                discount_percent: 0,
                plans: {
                  id: userPlan,
                  name: userPlan.toUpperCase(),
                  max_websites: 5,
                  allow_custom_domain: true,
                  allow_advanced_seo: ["pro", "business", "agency"].includes(userPlan),
                },
              },
              error: null,
            };
          }
          if (table === "user_credits") {
            return {
              data: {
                balance: creditsBalance,
                monthly_used: 0,
                purchased_credits: 0,
              },
              error: null,
            };
          }
          if (table === "website_seo") {
            return {
              data: {
                focus_keywords: ["seo", "ai web builder"],
                seo_title: "Test Site SEO Title",
                meta_description: "Test Site Meta Description",
              },
              error: null,
            };
          }
          if (table === "seo_autopilot_settings") {
            return {
              data: {
                website_id: filterWebsiteId || "site_owned_1",
                user_id: currentUserId,
                status: "active",
                scan_frequency: "weekly",
                auto_stage_safe_fixes: true,
                notify_on_critical: true,
              },
              error: null,
            };
          }
          if (table === "website_integrations") {
            if (state.googleAdsConnected) {
              return {
                data: {
                  credentials: {
                    refresh_token: "mock_refresh_token_xyz",
                    customer_id: "123-456-7890",
                  },
                },
                error: null,
              };
            }
            return { data: null, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve: any) => {
          if (table === "user_addons") {
            const matched = addons.map((a, idx) => ({
              id: `ua_${idx}`,
              user_id: currentUserId,
              addon_id: a.addon_id,
              status: a.status || "active",
              billing_interval: "monthly",
              current_period_end: a.current_period_end || futureDate,
              created_at: new Date().toISOString(),
            }));
            return Promise.resolve({ data: matched, error: null }).then(resolve);
          }
          if (table === "blog_posts") {
            return Promise.resolve({
              data: [
                {
                  id: "post_1",
                  title: "Existing Post",
                  slug: "existing-post",
                  status: "published",
                },
              ],
              error: null,
            }).then(resolve);
          }
          return Promise.resolve({ data: [], count: 0, error: null }).then(resolve);
        },
      };

      return builder;
    },
  };

  return client;
}

// -----------------------------------------------------------------------------
// Suite 1: Google Ads Route Handler Authorization
// -----------------------------------------------------------------------------
async function runGoogleAdsTests() {
  console.log("\n--- Suite 1: Google Ads Route Handler Authorization ---");
  const websiteId = "site_owned_1";
  const params = Promise.resolve({ id: websiteId });

  // 1.1 Unauthenticated requests return 401 across all 3 routes
  {
    setTestClientOverride(createMockSupabase({ userId: null }));
    const req = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/google-ads/customers`);
    const res = await getGoogleAdsCustomers(req, { params });
    assert.strictEqual(res.status, 401, "customers must return 401 when unauthenticated");

    const reqAcc = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/google-ads/select-account`, {
      method: "POST",
      body: JSON.stringify({ customerId: "123" }),
    });
    const resAcc = await postGoogleAdsSelectAccount(reqAcc, { params });
    assert.strictEqual(resAcc.status, 401, "select-account must return 401 when unauthenticated");

    const reqKw = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/google-ads/keywords`, {
      method: "POST",
      body: JSON.stringify({ keywords: ["test"] }),
    });
    const resKw = await postGoogleAdsKeywords(reqKw, { params });
    assert.strictEqual(resKw.status, 401, "keywords must return 401 when unauthenticated");

    console.log("✅ Passed 1.1: All Google Ads endpoints reject unauthenticated requests with 401.");
    testsPassed++;
  }

  // 1.2 Unowned website requests are rejected
  {
    setTestClientOverride(createMockSupabase({ userId: "user_a", ownedWebsites: ["different_site"] }));
    const req = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/google-ads/customers`);
    const res = await getGoogleAdsCustomers(req, { params });
    assert.ok(res.status === 403 || res.status === 404, "customers rejects unowned website");

    const reqAcc = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/google-ads/select-account`, {
      method: "POST",
      body: JSON.stringify({ customerId: "123" }),
    });
    const resAcc = await postGoogleAdsSelectAccount(reqAcc, { params });
    assert.ok(resAcc.status === 403 || resAcc.status === 404, "select-account rejects unowned website");

    const reqKw = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/google-ads/keywords`, {
      method: "POST",
      body: JSON.stringify({ keywords: ["test"] }),
    });
    const resKw = await postGoogleAdsKeywords(reqKw, { params });
    assert.ok(resKw.status === 403 || resKw.status === 404, "keywords rejects unowned website");

    console.log("✅ Passed 1.2: Unowned website requests rejected across all Google Ads routes.");
    testsPassed++;
  }

  // 1.3 Non-agency plans return 403 UPGRADE_REQUIRED across all 3 routes
  const nonAgencyPlans = ["free", "starter", "pro", "business"];
  for (const plan of nonAgencyPlans) {
    setTestClientOverride(createMockSupabase({ userId: "user_a", planId: plan, ownedWebsites: [websiteId] }));

    const reqCust = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/google-ads/customers`);
    const resCust = await getGoogleAdsCustomers(reqCust, { params });
    assert.strictEqual(resCust.status, 403, `${plan} must be denied customer lookup`);
    const jsonCust = await resCust.json();
    assert.strictEqual(jsonCust.code, "UPGRADE_REQUIRED");
    assert.strictEqual(jsonCust.requiredTier, "agency");

    const reqAcc = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/google-ads/select-account`, {
      method: "POST",
      body: JSON.stringify({ customerId: "123" }),
    });
    const resAcc = await postGoogleAdsSelectAccount(reqAcc, { params });
    assert.strictEqual(resAcc.status, 403, `${plan} must be denied account selection`);

    const reqKw = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/google-ads/keywords`, {
      method: "POST",
      body: JSON.stringify({ keywords: ["test"] }),
    });
    const resKw = await postGoogleAdsKeywords(reqKw, { params });
    assert.strictEqual(resKw.status, 403, `${plan} must be denied keyword intelligence`);
  }
  console.log("✅ Passed 1.3: Free, Starter, Pro, and Business plans consistently denied with 403 UPGRADE_REQUIRED.");
  testsPassed++;

  // 1.4 Agency plan passes authorization guard
  {
    setTestClientOverride(createMockSupabase({ userId: "user_a", planId: "agency", ownedWebsites: [websiteId], googleAdsConnected: false }));
    const reqCust = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/google-ads/customers`);
    const resCust = await getGoogleAdsCustomers(reqCust, { params });
    // Passed authorization! Reached credentials check and returned 400 (not 403 forbidden)
    assert.strictEqual(resCust.status, 400, "Agency plan passes authorization guard (returns 400 for unconfigured creds)");
    const jsonCust = await resCust.json();
    assert.ok(jsonCust.error.includes("Google Ads is not connected"), "Shows integration connection prompt");
    console.log("✅ Passed 1.4: Agency plan successfully clears route authorization guard.");
    testsPassed++;
  }
}

// -----------------------------------------------------------------------------
// Suite 2: SEO Autopilot Route Handlers (GET, PUT, POST)
// -----------------------------------------------------------------------------
async function runAutopilotTests() {
  console.log("\n--- Suite 2: SEO Autopilot Route Handlers (GET, PUT, POST) ---");
  const websiteId = "site_owned_1";
  const params = Promise.resolve({ id: websiteId });

  // 2.1 Unauthenticated requests return 401
  {
    setTestClientOverride(createMockSupabase({ userId: null }));
    const reqGet = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/autopilot`);
    assert.strictEqual((await getAutopilot(reqGet, { params })).status, 401);

    const reqPut = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/autopilot`, {
      method: "PUT",
      body: JSON.stringify({ status: "active" }),
    });
    assert.strictEqual((await putAutopilot(reqPut, { params })).status, 401);

    const reqPost = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/autopilot`, {
      method: "POST",
    });
    assert.strictEqual((await postAutopilot(reqPost, { params })).status, 401);

    console.log("✅ Passed 2.1: Autopilot GET, PUT, POST reject unauthenticated requests with 401.");
    testsPassed++;
  }

  // 2.2 Requests for unowned websites return 404
  {
    setTestClientOverride(createMockSupabase({ userId: "user_a", ownedWebsites: ["different_site"] }));
    const reqGet = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/autopilot`);
    assert.strictEqual((await getAutopilot(reqGet, { params })).status, 404);

    const reqPut = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/autopilot`, {
      method: "PUT",
      body: JSON.stringify({ status: "active" }),
    });
    assert.strictEqual((await putAutopilot(reqPut, { params })).status, 404);

    const reqPost = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/autopilot`, {
      method: "POST",
    });
    assert.strictEqual((await postAutopilot(reqPost, { params })).status, 404);

    console.log("✅ Passed 2.2: Autopilot GET, PUT, POST reject unowned websites with 404.");
    testsPassed++;
  }

  // 2.3 Free, Starter (no add-on), and Pro (no add-on) receive 403 UPGRADE_REQUIRED
  {
    for (const plan of ["free", "starter", "pro"]) {
      setTestClientOverride(createMockSupabase({ userId: "user_a", planId: plan, ownedWebsites: [websiteId] }));
      const reqGet = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/autopilot`);
      const resGet = await getAutopilot(reqGet, { params });
      assert.strictEqual(resGet.status, 403, `${plan} must be denied Autopilot GET`);
      const jsonGet = await resGet.json();
      assert.strictEqual(jsonGet.code, "UPGRADE_REQUIRED");
      assert.strictEqual(jsonGet.requiredTier, "business");

      const reqPut = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/autopilot`, {
        method: "PUT",
        body: JSON.stringify({ status: "active" }),
      });
      assert.strictEqual((await putAutopilot(reqPut, { params })).status, 403);

      const reqPost = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/autopilot`, {
        method: "POST",
      });
      assert.strictEqual((await postAutopilot(reqPost, { params })).status, 403);
    }
    console.log("✅ Passed 2.3: Free, Starter, and Pro without add-on receive 403 UPGRADE_REQUIRED.");
    testsPassed++;
  }

  // 2.4 Business and Agency plans receive 200 OK
  {
    for (const plan of ["business", "agency"]) {
      setTestClientOverride(createMockSupabase({ userId: "user_a", planId: plan, ownedWebsites: [websiteId] }));
      const reqGet = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/autopilot`);
      const resGet = await getAutopilot(reqGet, { params });
      assert.strictEqual(resGet.status, 200, `${plan} must be allowed Autopilot GET`);
      const jsonGet = await resGet.json();
      assert.strictEqual(jsonGet.success, true);
      assert.ok(jsonGet.settings);

      const reqPut = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/autopilot`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      const resPut = await putAutopilot(reqPut, { params });
      assert.strictEqual(resPut.status, 200, `${plan} must be allowed Autopilot PUT`);

      const reqPost = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/autopilot`, {
        method: "POST",
      });
      const resPost = await postAutopilot(reqPost, { params });
      assert.strictEqual(resPost.status, 200, `${plan} must be allowed Autopilot POST`);
    }
    console.log("✅ Passed 2.4: Business and Agency plans authorized natively for GET, PUT, POST.");
    testsPassed++;
  }

  // 2.5 Pro with active eligible seo_autopilot_fix_agent add-on receives 200 OK
  {
    setTestClientOverride(
      createMockSupabase({
        userId: "user_a",
        planId: "pro",
        ownedWebsites: [websiteId],
        userAddons: [{ addon_id: "seo_autopilot_fix_agent", status: "active" }],
      })
    );

    const reqGet = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/autopilot`);
    const resGet = await getAutopilot(reqGet, { params });
    assert.strictEqual(resGet.status, 200, "Pro with active eligible add-on must be allowed Autopilot GET");

    const reqPut = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/autopilot`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    const resPut = await putAutopilot(reqPut, { params });
    assert.strictEqual(resPut.status, 200, "Pro with active eligible add-on must be allowed Autopilot PUT");

    const reqPost = new NextRequest(`http://localhost:3000/api/websites/${websiteId}/seo/autopilot`, {
      method: "POST",
    });
    const resPost = await postAutopilot(reqPost, { params });
    assert.strictEqual(resPost.status, 200, "Pro with active eligible add-on must be allowed Autopilot POST");

    // Starter is not an eligible plan for seo_autopilot_fix_agent (catalog requires AI SEO foundation from Pro)
    setTestClientOverride(
      createMockSupabase({
        userId: "user_a",
        planId: "starter",
        ownedWebsites: [websiteId],
        userAddons: [{ addon_id: "seo_autopilot_fix_agent", status: "active" }],
      })
    );
    const starterResGet = await getAutopilot(reqGet, { params });
    assert.strictEqual(starterResGet.status, 403, "Starter is ineligible for Autopilot add-on and fails closed with 403");

    console.log("✅ Passed 2.5: Pro with active add-on authorized for GET/PUT/POST; ineligible Starter fails closed.");
    testsPassed++;
  }
}

// -----------------------------------------------------------------------------
// Suite 3: Manual Blog Publishing Policy
// -----------------------------------------------------------------------------
async function runBlogManualTests() {
  console.log("\n--- Suite 3: Manual Blog Publishing Policy ---");
  const websiteId = "site_owned_1";
  const params = Promise.resolve({ id: websiteId });
  const postParams = Promise.resolve({ id: websiteId, postId: "post_1" });

  // 3.1 Unauthenticated requests return 401
  {
    setTestClientOverride(createMockSupabase({ userId: null }));
    const reqGet = new Request(`http://localhost:3000/api/websites/${websiteId}/blog`);
    assert.strictEqual((await getBlogList(reqGet, { params })).status, 401);

    const reqPost = new Request(`http://localhost:3000/api/websites/${websiteId}/blog`, {
      method: "POST",
      body: JSON.stringify({ title: "My Post" }),
    });
    assert.strictEqual((await postBlogCreate(reqPost, { params })).status, 401);

    console.log("✅ Passed 3.1: Blog routes reject unauthenticated requests with 401.");
    testsPassed++;
  }

  // 3.2 Unowned website returns 404
  {
    setTestClientOverride(createMockSupabase({ userId: "user_a", ownedWebsites: ["different_site"] }));
    const reqGet = new Request(`http://localhost:3000/api/websites/${websiteId}/blog`);
    assert.strictEqual((await getBlogList(reqGet, { params })).status, 404);

    const reqPost = new Request(`http://localhost:3000/api/websites/${websiteId}/blog`, {
      method: "POST",
      body: JSON.stringify({ title: "My Post" }),
    });
    assert.strictEqual((await postBlogCreate(reqPost, { params })).status, 404);

    console.log("✅ Passed 3.2: Blog routes reject unowned websites with 404.");
    testsPassed++;
  }

  // 3.3 Starter plan user can list, create, update, and delete manual blog posts (No plan restriction)
  {
    setTestClientOverride(createMockSupabase({ userId: "user_a", planId: "starter", ownedWebsites: [websiteId] }));

    // List blog posts
    const reqGet = new Request(`http://localhost:3000/api/websites/${websiteId}/blog`);
    const resGet = await getBlogList(reqGet, { params });
    assert.strictEqual(resGet.status, 200, "Starter plan must be allowed to list blog posts");
    const jsonGet = await resGet.json();
    assert.ok(Array.isArray(jsonGet.posts));

    // Create blog post
    const reqPost = new Request(`http://localhost:3000/api/websites/${websiteId}/blog`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Starter Manual Blog Post",
        content: "<p>Manual content by author</p>",
        status: "published",
      }),
    });
    const resPost = await postBlogCreate(reqPost, { params });
    assert.strictEqual(resPost.status, 200, "Starter plan must be allowed to publish manual blog posts");

    // Update blog post
    const reqPut = new Request(`http://localhost:3000/api/websites/${websiteId}/blog/post_1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    });
    const resPut = await putBlogPost(reqPut, { params: postParams });
    assert.strictEqual(resPut.status, 200, "Starter plan must be allowed to edit manual blog posts");

    // Delete blog post
    const reqDel = new Request(`http://localhost:3000/api/websites/${websiteId}/blog/post_1`, {
      method: "DELETE",
    });
    const resDel = await deleteBlogPost(reqDel, { params: postParams });
    assert.strictEqual(resDel.status, 200, "Starter plan must be allowed to delete manual blog posts");

    console.log("✅ Passed 3.3: Manual blog publishing, editing, and deletion fully accessible on Starter.");
    testsPassed++;
  }

  // 3.4 Missing title returns 400
  {
    setTestClientOverride(createMockSupabase({ userId: "user_a", planId: "starter", ownedWebsites: [websiteId] }));
    const reqPost = new Request(`http://localhost:3000/api/websites/${websiteId}/blog`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    const resPost = await postBlogCreate(reqPost, { params });
    assert.strictEqual(resPost.status, 400, "Empty title must return 400");
    console.log("✅ Passed 3.4: Blog post creation validates title requirement (400).");
    testsPassed++;
  }
}

// -----------------------------------------------------------------------------
// Suite 4: AI Blog Generation Handler
// -----------------------------------------------------------------------------
async function runBlogGenerateTests() {
  console.log("\n--- Suite 4: AI Blog Generation Handler ---");
  const websiteId = "site_owned_1";
  const params = Promise.resolve({ id: websiteId });

  // 4.1 Unauthenticated requests return 401
  {
    setTestClientOverride(createMockSupabase({ userId: null }));
    const req = new Request(`http://localhost:3000/api/websites/${websiteId}/blog/generate`, {
      method: "POST",
      body: JSON.stringify({ topic: "AI in 2026" }),
    });
    const res = await postBlogGenerate(req, { params });
    assert.strictEqual(res.status, 401, "AI Blog generation returns 401 when unauthenticated");
    console.log("✅ Passed 4.1: AI generation rejects unauthenticated requests with 401.");
    testsPassed++;
  }

  // 4.2 Unowned website returns 404
  {
    setTestClientOverride(createMockSupabase({ userId: "user_a", ownedWebsites: ["different_site"] }));
    const req = new Request(`http://localhost:3000/api/websites/${websiteId}/blog/generate`, {
      method: "POST",
      body: JSON.stringify({ topic: "AI in 2026" }),
    });
    const res = await postBlogGenerate(req, { params });
    assert.strictEqual(res.status, 404, "AI Blog generation returns 404 for unowned website");
    console.log("✅ Passed 4.2: AI generation rejects unowned website with 404.");
    testsPassed++;
  }

  // 4.3 Free plan users are blocked with 403 UPGRADE_REQUIRED
  {
    setTestClientOverride(createMockSupabase({ userId: "user_a", planId: "free", ownedWebsites: [websiteId] }));
    const req = new Request(`http://localhost:3000/api/websites/${websiteId}/blog/generate`, {
      method: "POST",
      body: JSON.stringify({ topic: "AI in 2026" }),
    });
    const res = await postBlogGenerate(req, { params });
    assert.strictEqual(res.status, 403, "Free plan must be blocked from AI blog generation");
    const json = await res.json();
    assert.strictEqual(json.code, "UPGRADE_REQUIRED");
    assert.strictEqual(json.requiredTier, "starter");
    console.log("✅ Passed 4.3: Free plan users blocked with 403 UPGRADE_REQUIRED (requires Starter+).");
    testsPassed++;
  }

  // 4.4 Insufficient AI credits (< 5) returns 402 INSUFFICIENT_CREDITS
  {
    setTestClientOverride(
      createMockSupabase({
        userId: "user_a",
        planId: "starter",
        ownedWebsites: [websiteId],
        creditsBalance: 2, // Less than required 5 credits
      })
    );
    const req = new Request(`http://localhost:3000/api/websites/${websiteId}/blog/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "AI in 2026" }),
    });
    const res = await postBlogGenerate(req, { params });
    assert.strictEqual(res.status, 402, "Insufficient credits must return 402");
    const json = await res.json();
    assert.strictEqual(json.code, "INSUFFICIENT_CREDITS");
    console.log("✅ Passed 4.4: Insufficient AI credits strictly returns 402 INSUFFICIENT_CREDITS.");
    testsPassed++;
  }

  // 4.5 Downstream generation failure refunds deducted credits correctly
  {
    // Save original GEMINI env to restore afterwards
    const originalApiKey = process.env.GEMINI_API_KEY;
    // Set invalid key so downstream call fails safely without calling live API
    process.env.GEMINI_API_KEY = "dummy_invalid_test_key";

    const mockDb = createMockSupabase({
      userId: "user_a",
      planId: "starter",
      ownedWebsites: [websiteId],
      creditsBalance: 50,
    });
    setTestClientOverride(mockDb);

    const req = new Request(`http://localhost:3000/api/websites/${websiteId}/blog/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "Test AI Generation" }),
    });

    const res = await postBlogGenerate(req, { params });
    assert.strictEqual(res.status, 500, "Failure returns 500");
    const json = await res.json();
    assert.ok(json.error, "Error response returned on failure");

    // Verify accounting metrics
    assert.strictEqual(mockDb._metrics.deducted, 5, "5 credits must be deducted upfront");
    assert.strictEqual(mockDb._metrics.refunded, 5, "5 credits must be refunded on generation failure");

    // Restore environment
    if (originalApiKey !== undefined) {
      process.env.GEMINI_API_KEY = originalApiKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }

    console.log("✅ Passed 4.5: Upfront deduction and automatic failure refund verified (net 0 credit loss).");
    testsPassed++;
  }
}

// -----------------------------------------------------------------------------
// Main Test Runner
// -----------------------------------------------------------------------------
async function runAllRouteTests() {
  try {
    await runGoogleAdsTests();
    await runAutopilotTests();
    await runBlogManualTests();
    await runBlogGenerateTests();

    resetTestClientOverride();

    console.log("\n================================================================================");
    console.log(`ALL ${testsPassed} ROUTE-LEVEL AUTHORIZATION & SECURITY TESTS PASSED! 🎉`);
    console.log("================================================================================");
  } catch (err) {
    resetTestClientOverride();
    console.error("\n❌ Route-Level Test Suite Failed:", err);
    process.exit(1);
  }
}

runAllRouteTests();
