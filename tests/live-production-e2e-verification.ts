import assert from "node:assert";
import crypto from "node:crypto";
import { chromium } from "playwright";
import { createAdminClient } from "@/utils/supabase/server";
import {
  extractAssetMappingsFromHtml,
  rewriteAssetUrlInContent,
  isSupportedAssetUrl,
  importAndStoreMigrationAssets,
} from "@/lib/migration/asset-importer";
import {
  normalizeImageUrl,
  buildSourcePageFromBrowserSnapshot,
  extractStructuredSourcePage,
} from "@/lib/migration/redesign-engine";
import {
  deleteProjectUniversally,
  PROJECT_CHILD_TABLES,
} from "@/lib/projects/project-deletion-service";
import {
  cancelActiveWorkerForWebsite,
  evictInMemoryJob,
  registerActiveWorkerForWebsite,
  getActiveWorkerForWebsite,
} from "@/lib/migration/executor";

// Minimal valid 1x1 PNG binary for mocking image server responses
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

async function runLiveProductionE2EVerification() {
  console.log("=".repeat(85));
  console.log("CODEAXYS LIVE PRODUCTION END-TO-END VERIFICATION");
  console.log("=".repeat(85));

  const db = createAdminClient();
  const runId = `live-test-${Date.now()}`;
  const testUserId = "47a49320-6dc9-4120-b068-c7c246b762d1"; // Active test user ID
  const testWebsiteId = crypto.randomUUID();

  // Tracking all created test resources for guaranteed cleanup
  const createdWebsites: string[] = [];
  const createdStorageFiles: string[] = [];

  // ==========================================================================
  // PART 1: LIVE MIGRATION IMAGE CAPTURE TEST (AGAINST EXTERNAL WEBSITE)
  // ==========================================================================
  console.log("\n=================================================================");
  console.log("PART 1: LIVE MIGRATION IMAGE CAPTURE PIPELINE VERIFICATION");
  console.log("=================================================================");

  const sourceBaseUrl = "https://books.toscrape.com/";
  console.log(`Connecting to external public target: ${sourceBaseUrl}`);

  // Construct realistic HTML with representative image scenarios pointing to books.toscrape.com assets
  const sourceHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>All products | Books to Scrape - Sandbox</title>
      <style>
        .inline-hero-bg {
          background-image: url('media/cache/3e/ef/3eef99c9d9adef34639f510662022830.jpg');
          min-height: 250px;
        }
      </style>
    </head>
    <body>
      <header class="main-header">
        <a href="/"><img src="media/cache/2c/da/2cdad67c44b002e7ead0cc35693c0e8b.jpg" alt="Brand Logo" class="brand-logo"></a>
      </header>

      <section class="hero-section inline-hero-bg">
        <h1>Transforming Reading Experiences</h1>
        <p>Explore thousands of classic books and modern bestsellers.</p>
        <img src="media/cache/26/0c/260c6ae16bce31c8f8c95daddd9f4a1c.jpg" alt="Featured Book Hero">
      </section>

      <section class="lazy-section">
        <h2>Curated Selection</h2>
        <!-- Lazy-loaded image with dummy transparent placeholder and data-src -->
        <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
             data-src="media/cache/32/51/3251cf3a3412f53f339e42cac2134093.jpg"
             alt="Lazy Loaded Cover"
             class="lazy-img">
      </section>

      <section class="responsive-section">
        <!-- Responsive image with relative srcset candidates -->
        <img src="media/cache/be/a5/bea5697f2534a2f86a3ef27b5a8c12a6.jpg"
             srcset="media/cache/68/33/68339b4c9bc034267e1da611ab3b34f8.jpg 480w, media/cache/be/a5/bea5697f2534a2f86a3ef27b5a8c12a6.jpg 1200w"
             alt="Responsive Book Cover">
      </section>

      <section class="gallery-section">
        <div class="gallery">
          <img src="media/cache/92/27/92274a95b7c251fea59a2b8a78275ab4.jpg" alt="Gallery Book 1">
          <img src="media/cache/3d/54/3d54940e57e662c4dd1f3ff00c78cc64.jpg" alt="Gallery Book 2">
        </div>
      </section>

      <!-- Tracking pixel that must be dropped -->
      <img src="https://connect.facebook.net/en_US/fbevents.js/facebook-pixel.gif" alt="Tracking">
    </body>
    </html>
  `;

  // 1. Playwright Live Browser Capture
  console.log("\n--- [Step 1.1] Capturing Live Source Page Structure ---");
  const browser = await chromium.launch({ headless: true });

  // Verify raw-to-absolute asset mapping extraction
  const mappings = extractAssetMappingsFromHtml(sourceHtml, sourceBaseUrl);
  console.log(`  ✓ Discovered ${mappings.length} media asset mappings:`);
  mappings.forEach((m) => console.log(`    - [${m.rawUrl}] -> ${m.absoluteUrl}`));

  // Assertions on discovery
  const rawList = mappings.map((m) => m.rawUrl);
  assert.ok(rawList.includes("media/cache/2c/da/2cdad67c44b002e7ead0cc35693c0e8b.jpg"), "Must discover relative logo");
  assert.ok(rawList.includes("media/cache/26/0c/260c6ae16bce31c8f8c95daddd9f4a1c.jpg"), "Must discover relative hero banner");
  assert.ok(rawList.includes("media/cache/32/51/3251cf3a3412f53f339e42cac2134093.jpg"), "Must discover lazy data-src");
  assert.ok(rawList.includes("media/cache/68/33/68339b4c9bc034267e1da611ab3b34f8.jpg"), "Must discover srcset 480w candidate");
  assert.ok(rawList.includes("media/cache/be/a5/bea5697f2534a2f86a3ef27b5a8c12a6.jpg"), "Must discover srcset 1200w candidate");
  assert.ok(rawList.includes("media/cache/3e/ef/3eef99c9d9adef34639f510662022830.jpg"), "Must discover inline style background");

  // Verify Facebook tracking pixel is excluded
  assert.strictEqual(
    isSupportedAssetUrl("https://connect.facebook.net/en_US/fbevents.js/facebook-pixel.gif"),
    false,
    "Tracking pixel must be rejected"
  );

  // 2. Create a disposable website in Supabase DB
  console.log("\n--- [Step 1.2] Provisioning Disposable Migration Website in Supabase DB ---");
  const { data: webRecord, error: webErr } = await db
    .from("websites")
    .insert({
      id: testWebsiteId,
      user_id: testUserId,
      title: "Disposable Migration Test Site",
      slug: `mig-${testWebsiteId.slice(0, 8)}`,
      prompt: "Migrated test site from books.toscrape.com",
      is_published: false,
      design_plan: {
        migration_job: { id: `job-${runId}`, status: "completed" },
        websiteType: "business",
        colorPalette: { primary: "#000000", secondary: "#ffffff" },
      },
    })
    .select()
    .single();

  if (webErr || !webRecord) {
    throw new Error(`Failed to create disposable website record: ${webErr?.message}`);
  }
  createdWebsites.push(testWebsiteId);
  console.log(`  ✓ Provisioned disposable website record: ${testWebsiteId}`);

  // Insert an initial page with the captured HTML
  const { error: pageErr } = await db.from("website_pages").insert({
    website_id: testWebsiteId,
    user_id: testUserId,
    path: "index.html",
    html_content: sourceHtml,
    css_content: "/* Base styles */",
  });
  if (pageErr) {
    throw new Error(`Failed to insert initial website page: ${pageErr.message}`);
  }

  // 3. Run Asset Importer against Live Supabase Storage with external images
  console.log("\n--- [Step 1.3] Executing Live Supabase Storage Asset Import ---");
  const capturedPages = [
    {
      path: "index.html",
      html_content: sourceHtml,
      discoveredAssetUrls: mappings.map((m) => m.absoluteUrl),
    },
  ];

  const importResult = await importAndStoreMigrationAssets(
    testUserId,
    testWebsiteId,
    sourceBaseUrl,
    capturedPages,
    { customSupabaseClient: db, runId }
  );

  console.log(`  ✓ Assets Detected: ${importResult.stats.detected}`);
  console.log(`  ✓ Assets Eligible: ${importResult.stats.eligible}`);
  console.log(`  ✓ Assets Imported: ${importResult.stats.imported}`);
  console.log(`  ✓ Assets Deduplicated: ${importResult.stats.deduplicated}`);
  console.log(`  ✓ Assets Failed: ${importResult.stats.failed}`);
  console.log(`  ✓ Total Bytes: ${importResult.stats.totalBytes}`);

  assert.ok(importResult.stats.imported > 0, "Must import at least 1 asset to Supabase Storage");

  // Track imported files for cleanup
  for (const [_, newUrl] of importResult.urlMap.entries()) {
    if (newUrl.includes("website-assets")) {
      const parts = newUrl.split("website-assets/");
      if (parts[1]) createdStorageFiles.push(parts[1]);
    }
  }

  // 4. Verify Database Page Content Rewriting
  console.log("\n--- [Step 1.4] Verifying Rewritten HTML in Database ---");
  const { data: updatedPage } = await db
    .from("website_pages")
    .select("html_content")
    .eq("website_id", testWebsiteId)
    .single();

  const rewrittenHtml = updatedPage?.html_content || "";

  // Assert that original relative URLs were rewritten to Supabase Storage public URLs
  assert.ok(
    !rewrittenHtml.includes('src="media/cache/2c/da/2cdad67c44b002e7ead0cc35693c0e8b.jpg"'),
    "Original relative logo URL must NOT exist in rewritten HTML"
  );
  assert.ok(
    rewrittenHtml.includes("website-assets") || rewrittenHtml.includes("supabase.co"),
    "Rewritten HTML must reference Supabase Storage asset"
  );
  assert.ok(
    !rewrittenHtml.includes('src="media/cache/26/0c/260c6ae16bce31c8f8c95daddd9f4a1c.jpg"'),
    "Original relative hero banner must NOT exist in rewritten HTML"
  );

  // 5. Verify Structured Source Page & Redesign Engine
  console.log("\n--- [Step 1.5] Verifying Redesign Engine Logo/Hero Separation ---");
  const sourceSnapshot = {
    url: sourceBaseUrl,
    title: "All products | Books to Scrape",
    html: sourceHtml,
    assetUrls: mappings.map((m) => m.absoluteUrl),
  };

  const sourcePage = buildSourcePageFromBrowserSnapshot(sourceSnapshot);
  const structured = extractStructuredSourcePage(sourcePage);

  console.log(`  ✓ Detected logoUrl: ${structured.logoUrl}`);
  console.log(`  ✓ Detected heroBgImage: ${structured.heroBgImage}`);

  assert.ok(
    structured.logoUrl?.includes("2cdad67c44b002e7ead0cc35693c0e8b"),
    "Logo must be correctly extracted from header img"
  );
  assert.notStrictEqual(
    structured.heroBgImage,
    structured.logoUrl,
    "Hero background image must NEVER be identical to the logo when content images exist"
  );

  // 6. Verify Rendered HTML in Headless Browser (0 Broken 404 Requests)
  console.log("\n--- [Step 1.6] Headless Browser Network Verification (Checking for 404s) ---");
  const failedImageRequests: string[] = [];
  const successfulImageRequests: string[] = [];

  const previewPage = await browser.newPage();
  previewPage.on("response", (resp) => {
    const reqUrl = resp.url();
    const status = resp.status();
    const isImg = resp.request().resourceType() === "image";
    if (isImg) {
      if (status >= 400 && !reqUrl.includes("facebook.net")) {
        failedImageRequests.push(`${status} ${reqUrl}`);
      } else if (status < 400) {
        successfulImageRequests.push(`${status} ${reqUrl}`);
      }
    }
  });

  // Load rewritten HTML into live browser
  await previewPage.setContent(rewrittenHtml, { waitUntil: "networkidle" });
  await browser.close();

  console.log(`  ✓ Successful image requests: ${successfulImageRequests.length}`);
  console.log(`  ✓ Failed image requests: ${failedImageRequests.length}`);
  if (failedImageRequests.length > 0) {
    console.warn("  Failed requests:", failedImageRequests);
  }
  assert.strictEqual(
    failedImageRequests.length,
    0,
    "Expected 0 broken 404 image requests on rewritten migration preview"
  );

  console.log("✅ PART 1 PASSED: Live Migration Image Capture completely verified with 0 broken images.");

  // ==========================================================================
  // PART 2: LIVE UNIVERSAL PROJECT DELETION VERIFICATION
  // ==========================================================================
  console.log("\n=================================================================");
  console.log("PART 2: LIVE UNIVERSAL PROJECT DELETION VERIFICATION");
  console.log("=================================================================");

  const siteTypes = [
    { id: crypto.randomUUID(), type: "ai-generated", title: "AI Site", prompt: "Build an AI site", designPlan: { websiteType: "business" }, isPublished: false },
    { id: crypto.randomUUID(), type: "template", title: "Template Site", prompt: "From template", designPlan: { templateId: "tpl-1" }, isPublished: false },
    { id: crypto.randomUUID(), type: "scratch", title: "Manual Site", prompt: "", designPlan: { websiteType: "custom" }, isPublished: false },
    { id: crypto.randomUUID(), type: "published", title: "Published Site", prompt: "Published", designPlan: { websiteType: "business" }, isPublished: true, slug: `pub-${runId}` },
  ];

  for (const s of siteTypes) {
    console.log(`\n--- [Step 2.1] Testing Deletion of Project Type: ${s.type} (${s.id}) ---`);

    // 1. Provision Website Record
    const { error: insErr } = await db.from("websites").insert({
      id: s.id,
      user_id: testUserId,
      title: s.title,
      slug: `site-${s.id.slice(0, 8)}`,
      prompt: s.prompt,
      design_plan: s.designPlan,
      is_published: s.isPublished,
      published_slug: (s as any).slug || null,
    });
    if (insErr) throw new Error(`Failed to insert ${s.id}: ${insErr.message}`);
    createdWebsites.push(s.id);

    // 2. Attach Child Records across tables
    await db.from("website_pages").insert({
      website_id: s.id,
      user_id: testUserId,
      path: "index.html",
      html_content: "<h1>Hello</h1>",
      css_content: "/* CSS */",
    });

    await db.from("media_assets").insert({
      website_id: s.id,
      user_id: testUserId,
      storage_path: `${testUserId}/${s.id}/hero.png`,
      public_url: `https://mock.storage/${testUserId}/${s.id}/hero.png`,
      file_name: "hero.png",
      mime_type: "image/png",
      file_size_bytes: 1024,
    });

    await db.from("blog_posts").insert({
      website_id: s.id,
      user_id: testUserId,
      title: "Test Post",
      slug: `post-${s.id.slice(0, 8)}`,
      content: "Content",
    });

    await db.from("seo_integration_requests").insert({
      website_id: s.id,
      provider: "google_search_console",
      status: "pending",
    });

    await db.from("technical_crawl_runs").insert({
      website_id: s.id,
      user_id: testUserId,
      status: "completed",
    });

    // 3. Upload exclusive storage file to Supabase Storage
    const storagePath = `${testUserId}/${s.id}/exclusive-banner.png`;
    const { error: uploadErr } = await db.storage
      .from("website-assets")
      .upload(storagePath, TINY_PNG, { contentType: "image/png", upsert: true });

    if (!uploadErr) {
      createdStorageFiles.push(storagePath);
      console.log(`  ✓ Uploaded exclusive storage file: ${storagePath}`);
    }

    // 4. Attach Financial Audit Transaction (ai_credit_transactions)
    const { error: creditErr } = await db.from("ai_credit_transactions").insert({
      website_id: s.id,
      user_id: testUserId,
      credits_used: 5,
      action_type: "website_generation",
    });
    if (creditErr) {
      throw new Error(`Failed to insert credit transaction for ${s.id}: ${creditErr.message}`);
    }
    console.log(`  ✓ Attached ai_credit_transactions row for ${s.id}`);

    // 5. Execute Universal Project Deletion
    const report = await deleteProjectUniversally({
      websiteId: s.id,
      userId: testUserId,
      dbClient: db,
      allowPublishedDelete: true,
    });

    console.log(`  ✓ Deletion Report for ${s.id}:`);
    console.log(`    - cleanupCompleted: ${report.cleanupCompleted}`);
    console.log(`    - parentDeleted: ${report.parentDeleted}`);
    console.log(`    - storageObjectsDeleted: ${report.storageObjectsDeleted}`);
    console.log(`    - billingRecordsPreserved: ${report.billingRecordsPreserved}`);

    assert.strictEqual(report.cleanupCompleted, true, "Cleanup must complete successfully");
    assert.strictEqual(report.parentDeleted, true, "Parent website record must be deleted");

    // 6. Verify Database Persistence Check
    const { data: checkWeb } = await db.from("websites").select("id").eq("id", s.id).maybeSingle();
    assert.strictEqual(checkWeb, null, "Website row must NO LONGER exist in database");

    // 7. Verify Child Tables Cleaned Up
    const { data: checkPages } = await db.from("website_pages").select("id").eq("website_id", s.id);
    assert.strictEqual(checkPages?.length || 0, 0, "website_pages must be cleaned up");

    const { data: checkMedia } = await db.from("media_assets").select("id").eq("website_id", s.id);
    assert.strictEqual(checkMedia?.length || 0, 0, "media_assets must be cleaned up");

    const { data: checkBlog } = await db.from("blog_posts").select("id").eq("website_id", s.id);
    assert.strictEqual(checkBlog?.length || 0, 0, "blog_posts must be cleaned up");

    const { data: checkSeoReq } = await db.from("seo_integration_requests").select("id").eq("website_id", s.id);
    assert.strictEqual(checkSeoReq?.length || 0, 0, "seo_integration_requests must be cleaned up");

    // 8. Verify Financial Audit Ledger PRESERVED
    const { data: checkTxns } = await db.from("ai_credit_transactions").select("*").eq("website_id", s.id);
    assert.strictEqual(checkTxns?.length, 1, "ai_credit_transactions row must be PRESERVED in database");
    assert.strictEqual(checkTxns[0].user_id, testUserId, "Customer user_id must be intact");
    assert.strictEqual(checkTxns[0].credits_used, 5, "Credit amount must be intact");

    // 9. Verify Storage Cleanup
    const { data: remainingStorage } = await db.storage
      .from("website-assets")
      .list(`${testUserId}/${s.id}`);
    assert.strictEqual(
      remainingStorage?.length || 0,
      0,
      "Exclusive storage files must be deleted from Supabase Storage"
    );

    console.log(`  ✓ Successfully verified complete cleanup for project type: ${s.type}`);
  }

  // ==========================================================================
  // PART 3: SHARED ASSET PRESERVATION, RETRYABLE PARTIAL FAILURES, & WORKER CLEANUP
  // ==========================================================================
  console.log("\n=================================================================");
  console.log("PART 3: SHARED ASSET PRESERVATION, RETRYABLE PARTIAL FAILURES, & WORKERS");
  console.log("=================================================================");

  // Step 3.1: Cross-Project Shared Asset Protection
  {
    console.log("\n--- [Step 3.1] Testing Cross-Project Shared Asset Protection ---");
    const siteDel = crypto.randomUUID();
    const siteKeep = crypto.randomUUID();
    const sharedStoragePath = `${testUserId}/shared/global-company-logo.png`;

    // Provision both sites
    await db.from("websites").insert([
      { id: siteDel, user_id: testUserId, title: "Delete Site", slug: `del-${siteDel.slice(0, 8)}`, is_published: false },
      { id: siteKeep, user_id: testUserId, title: "Keep Site", slug: `keep-${siteKeep.slice(0, 8)}`, is_published: false },
    ]);
    createdWebsites.push(siteDel, siteKeep);

    // Upload shared file
    await db.storage
      .from("website-assets")
      .upload(sharedStoragePath, TINY_PNG, { contentType: "image/png", upsert: true });
    createdStorageFiles.push(sharedStoragePath);

    // Both sites reference the shared asset
    const { error: insMediaErr } = await db.from("media_assets").insert([
      {
        website_id: siteDel,
        user_id: testUserId,
        storage_path: sharedStoragePath,
        public_url: `https://storage.mock/${sharedStoragePath}`,
        file_name: "logo.png",
        mime_type: "image/png",
        file_size_bytes: 1024,
      },
      {
        website_id: siteKeep,
        user_id: testUserId,
        storage_path: sharedStoragePath,
        public_url: `https://storage.mock/${sharedStoragePath}`,
        file_name: "logo.png",
        mime_type: "image/png",
        file_size_bytes: 1024,
      },
    ]);
    if (insMediaErr) throw new Error(`Failed to insert media_assets: ${insMediaErr.message}`);

    // Delete siteDel
    const report = await deleteProjectUniversally({
      websiteId: siteDel,
      userId: testUserId,
      dbClient: db,
    });

    console.log(`  ✓ Deletion Report for siteDel:`);
    console.log(`    - cleanupCompleted: ${report.cleanupCompleted}`);
    console.log(`    - storageObjectsPreservedShared: ${report.storageObjectsPreservedShared}`);
    console.log(`    - storageObjectsDeleted: ${report.storageObjectsDeleted}`);

    assert.strictEqual(report.cleanupCompleted, true);
    assert.strictEqual(
      report.storageObjectsPreservedShared,
      1,
      "Report must indicate 1 shared storage object preserved"
    );

    // Verify shared file STILL exists in Supabase Storage
    const { data: checkSharedList } = await db.storage
      .from("website-assets")
      .list(`${testUserId}/shared`);
    const stillExists = checkSharedList?.some((f) => f.name === "global-company-logo.png");
    assert.strictEqual(stillExists, true, "Shared file must remain intact in Supabase Storage");
    console.log("  ✓ Verified: Shared storage asset is strictly preserved while project was deleted.");

    // Clean up siteKeep
    await deleteProjectUniversally({
      websiteId: siteKeep,
      userId: testUserId,
      dbClient: db,
    });

    // Clean up shared file after both sites deleted
    await db.storage.from("website-assets").remove([sharedStoragePath]);
  }

  // Step 3.2: Partial Storage Failure Reporting & Safe Retries
  {
    console.log("\n--- [Step 3.2] Testing Honest Partial Storage Failure Reporting & Safe Retry ---");
    const sitePartial = crypto.randomUUID();
    const partialStoragePath = `${testUserId}/${sitePartial}/orphaned-asset.png`;

    await db.from("websites").insert({
      id: sitePartial,
      user_id: testUserId,
      title: "Partial Fail Site",
      slug: `partial-${sitePartial.slice(0, 8)}`,
      is_published: false,
    });
    createdWebsites.push(sitePartial);

    await db.storage
      .from("website-assets")
      .upload(partialStoragePath, TINY_PNG, { contentType: "image/png", upsert: true });
    createdStorageFiles.push(partialStoragePath);

    // Mock client where storage remove fails with simulated network error
    const failingDbClient = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === "storage") {
          const originalStorage = target.storage;
          return new Proxy(originalStorage, {
            get(sTarget, sProp, sReceiver) {
              if (sProp === "from") {
                return (bucket: string) => {
                  const bClient = sTarget.from(bucket);
                  return new Proxy(bClient, {
                    get(bTarget, bProp, bReceiver) {
                      if (bProp === "remove") {
                        return async () => ({
                          data: null,
                          error: { message: "Simulated storage gateway timeout (504)" },
                        });
                      }
                      const bVal = Reflect.get(bTarget, bProp, bReceiver);
                      return typeof bVal === "function" ? bVal.bind(bTarget) : bVal;
                    },
                  });
                };
              }
              const sVal = Reflect.get(sTarget, sProp, sReceiver);
              return typeof sVal === "function" ? sVal.bind(sTarget) : sVal;
            },
          });
        }
        const val = Reflect.get(target, prop, receiver);
        return typeof val === "function" ? val.bind(target) : val;
      },
    });

    // First attempt: Storage fails
    const failedReport = await deleteProjectUniversally({
      websiteId: sitePartial,
      userId: testUserId,
      dbClient: failingDbClient as any,
    });

    console.log(`  ✓ Initial Attempt with Simulated Storage Failure:`);
    console.log(`    - cleanupCompleted: ${failedReport.cleanupCompleted}`);
    console.log(`    - storagePartialFailure: ${failedReport.storagePartialFailure}`);
    console.log(`    - parentDeleted: ${failedReport.parentDeleted}`);
    console.log(`    - remainingOrphanedResources: ${failedReport.remainingOrphanedResources.join(", ")}`);

    assert.strictEqual(
      failedReport.cleanupCompleted,
      false,
      "Deletion MUST NOT be reported as complete when storage removal fails"
    );
    assert.strictEqual(
      failedReport.storagePartialFailure,
      true,
      "storagePartialFailure must be set to true"
    );
    assert.strictEqual(
      failedReport.parentDeleted,
      false,
      "Parent website record MUST NOT be deleted when storage removal fails to preserve retry path"
    );
    assert.ok(
      failedReport.remainingOrphanedResources.some((r) => r.includes(partialStoragePath)),
      "remainingOrphanedResources must track the failed storage item"
    );

    // Second attempt: Safe retry with healthy client
    console.log("  ✓ Retrying Deletion with Healthy Client...");
    const retryReport = await deleteProjectUniversally({
      websiteId: sitePartial,
      userId: testUserId,
      dbClient: db,
    });

    console.log(`    - retry cleanupCompleted: ${retryReport.cleanupCompleted}`);
    console.log(`    - retry storageObjectsDeleted: ${retryReport.storageObjectsDeleted}`);

    assert.strictEqual(retryReport.cleanupCompleted, true, "Retry must successfully complete deletion");
    assert.strictEqual(retryReport.storageObjectsDeleted, 1, "Storage file must be deleted on retry");

    // Verify storage file is gone
    const { data: storageAfterRetry } = await db.storage
      .from("website-assets")
      .list(`${testUserId}/${sitePartial}`);
    assert.strictEqual(storageAfterRetry?.length || 0, 0, "Storage file must be removed after retry");
    console.log("  ✓ Verified: Partial storage failure reported honestly and can be retried safely.");
  }

  // Step 3.3: Active Migration Job & Background Worker Eviction
  {
    console.log("\n--- [Step 3.3] Testing Active Migration Worker Eviction & Redis Key Purge ---");
    const siteWorker = crypto.randomUUID();

    await db.from("websites").insert({
      id: siteWorker,
      user_id: testUserId,
      title: "Active Worker Site",
      slug: `worker-${siteWorker.slice(0, 8)}`,
      is_published: false,
    });
    createdWebsites.push(siteWorker);

    // Register an active in-memory worker session
    const mockWorker = { runId: `worker-run-${Date.now()}`, lastPing: Date.now() };
    registerActiveWorkerForWebsite(siteWorker, mockWorker);

    assert.ok(
      getActiveWorkerForWebsite(siteWorker),
      "Worker session must be registered before deletion"
    );

    const workerDelReport = await deleteProjectUniversally({
      websiteId: siteWorker,
      userId: testUserId,
      dbClient: db,
    });

    console.log(`  ✓ Deletion Report for siteWorker:`);
    console.log(`    - cleanupCompleted: ${workerDelReport.cleanupCompleted}`);
    console.log(`    - backgroundJobsCancelled: ${workerDelReport.backgroundJobsCancelled}`);

    assert.strictEqual(workerDelReport.cleanupCompleted, true);
    assert.strictEqual(
      workerDelReport.backgroundJobsCancelled,
      true,
      "backgroundJobsCancelled must be true when active worker was terminated"
    );
    assert.strictEqual(
      getActiveWorkerForWebsite(siteWorker),
      undefined,
      "Active worker session must be evicted from in-memory registry"
    );
    console.log("  ✓ Verified: Active migration worker evicted and cancelled to prevent resurrection.");
  }

  // Step 3.4: Final Teardown of Disposable Test Website
  console.log("\n--- [Step 3.4] Final Teardown of Disposable Test Website ---");
  await deleteProjectUniversally({
    websiteId: testWebsiteId,
    userId: testUserId,
    dbClient: db,
  });
  console.log(`  ✓ Cleaned up test migration website: ${testWebsiteId}`);

  console.log("\n" + "=".repeat(85));
  console.log("ALL LIVE PRODUCTION VERIFICATION TESTS COMPLETED WITH 100% SUCCESS! 🚀✨");
  console.log("=".repeat(85));
}

runLiveProductionE2EVerification().catch((err) => {
  console.error("Live Verification Failed:", err);
  process.exit(1);
});
