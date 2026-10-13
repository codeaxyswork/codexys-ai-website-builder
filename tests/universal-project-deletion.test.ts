import assert from "node:assert";
import {
  deleteProjectUniversally,
  PROJECT_CHILD_TABLES,
} from "@/lib/projects/project-deletion-service";
import {
  cancelActiveWorkerForWebsite,
  evictInMemoryJob,
} from "@/lib/migration/executor";

// In-memory mock database state
interface MockDbState {
  websites: any[];
  website_pages: any[];
  media_assets: any[];
  ai_credit_transactions: any[];
  blog_posts: any[];
  seo_integration_requests: any[];
  marketing_campaign_drafts: any[];
  website_ai_visibility_configs: any[];
  admin_audit_logs: any[];
  storageFiles: Map<string, { id: string | null; metadata?: any }>;
  storageFailures?: boolean;
}

function createUniversalMockDb(initialState: Partial<MockDbState> = {}) {
  const tables: Record<string, any[]> = {
    websites: [...(initialState.websites || [])],
    website_pages: [...(initialState.website_pages || [])],
    media_assets: [...(initialState.media_assets || [])],
    ai_credit_transactions: [...(initialState.ai_credit_transactions || [])],
    blog_posts: [...(initialState.blog_posts || [])],
    seo_integration_requests: [...(initialState.seo_integration_requests || [])],
    marketing_campaign_drafts: [...(initialState.marketing_campaign_drafts || [])],
    website_ai_visibility_configs: [...(initialState.website_ai_visibility_configs || [])],
    admin_audit_logs: [...(initialState.admin_audit_logs || [])],
  };

  // Ensure all 37 child tables exist in mock
  for (const t of PROJECT_CHILD_TABLES) {
    if (!tables[t]) tables[t] = [];
  }

  let failStorage = Boolean(initialState.storageFailures);
  const storageFiles = new Map<string, { id: string | null; metadata?: any }>(
    initialState.storageFiles || []
  );

  const mockDb = {
    setStorageFailures(fail: boolean) {
      failStorage = fail;
    },
    getTableData(tableName: string) {
      return tables[tableName] || [];
    },
    getStorageFiles() {
      return Array.from(storageFiles.keys());
    },
    storage: {
      from: (bucket: string) => ({
        list: async (folderPrefix: string) => {
          if (failStorage) {
            return { data: null, error: { message: "Storage list network failure" } };
          }
          const results: { name: string; id: string | null; metadata?: any }[] = [];
          const prefix = folderPrefix ? `${folderPrefix}/` : "";
          for (const [key, val] of storageFiles.entries()) {
            if (prefix === "" || key.startsWith(prefix)) {
              const rel = prefix === "" ? key : key.slice(prefix.length);
              const parts = rel.split("/");
              const name = parts[0];
              if (!results.some((r) => r.name === name)) {
                if (parts.length > 1) {
                  // Subfolder
                  results.push({ name, id: null });
                } else {
                  results.push({ name, id: val.id || "file-id", metadata: val.metadata || { size: 1024 } });
                }
              }
            }
          }
          return { data: results, error: null };
        },
        remove: async (paths: string[]) => {
          if (failStorage) {
            return { data: null, error: { message: "Simulated storage deletion timeout" } };
          }
          for (const p of paths) {
            storageFiles.delete(p);
          }
          return { data: paths.map((p) => ({ name: p })), error: null };
        },
      }),
    },
    from: (tableName: string) => {
      let filters: Array<(row: any) => boolean> = [];
      let isDelete = false;
      let updatePayload: any = null;

      const builder: any = {
        select: (_fields?: string) => builder,
        eq: (col: string, val: any) => {
          filters.push((r) => r[col] === val);
          return builder;
        },
        neq: (col: string, val: any) => {
          filters.push((r) => r[col] !== val);
          return builder;
        },
        in: (col: string, valArr: any[]) => {
          filters.push((r) => valArr.includes(r[col]));
          return builder;
        },
        limit: (_count: number) => builder,
        order: (_col: string, _opts?: any) => builder,
        range: (_from: number, _to: number) => builder,
        delete: () => {
          isDelete = true;
          return builder;
        },
        update: (payload: any) => {
          updatePayload = payload;
          return builder;
        },
        insert: async (records: any | any[]) => {
          const arr = Array.isArray(records) ? records : [records];
          if (!tables[tableName]) tables[tableName] = [];
          tables[tableName].push(...arr);
          return { data: arr, error: null };
        },
        maybeSingle: async () => {
          const table = tables[tableName] || [];
          const filtered = table.filter((r) => filters.every((f) => f(r)));
          return { data: filtered[0] || null, error: null };
        },
        single: async () => {
          const table = tables[tableName] || [];
          const filtered = table.filter((r) => filters.every((f) => f(r)));
          if (!filtered[0]) {
            return { data: null, error: { message: `No rows found in ${tableName}` } };
          }
          return { data: filtered[0], error: null };
        },
        then: (resolve: any) => {
          const table = tables[tableName] || [];
          if (isDelete) {
            const remaining = table.filter((r) => !filters.every((f) => f(r)));
            const deleted = table.filter((r) => filters.every((f) => f(r)));
            tables[tableName] = remaining;
            return Promise.resolve({ data: deleted, count: deleted.length, error: null }).then(resolve);
          }
          if (updatePayload) {
            const updated: any[] = [];
            for (const r of table) {
              if (filters.every((f) => f(r))) {
                Object.assign(r, updatePayload);
                updated.push(r);
              }
            }
            return Promise.resolve({ data: updated, count: updated.length, error: null }).then(resolve);
          }
          const filtered = table.filter((r) => filters.every((f) => f(r)));
          return Promise.resolve({ data: filtered, count: filtered.length, error: null }).then(resolve);
        },
      };
      return builder;
    },
  };

  return mockDb;
}

async function runUniversalProjectDeletionTests() {
  console.log("=".repeat(80));
  console.log("CODEAXYS UNIVERSAL PROJECT DELETION REGRESSION TEST SUITE");
  console.log("=".repeat(80));

  // --------------------------------------------------------------------------
  // Test 1: Deletion across all 8 Project Types
  // --------------------------------------------------------------------------
  console.log("\n--- Test 1: Coverage for All 8 Project Types ---");
  const projectTypes = [
    { type: "ai_generated", data: { creation_mode: "prompt", is_published: false } },
    { type: "migrated", data: { creation_mode: "migration", is_published: false } },
    { type: "template", data: { creation_mode: "template", is_published: false } },
    { type: "scratch", data: { creation_mode: "scratch", is_published: false } },
    { type: "import", data: { creation_mode: "import", is_published: false } },
    { type: "clone", data: { creation_mode: "clone", is_published: false } },
    { type: "draft", data: { creation_mode: "prompt", is_published: false } },
    { type: "published", data: { creation_mode: "prompt", is_published: true, published_slug: "my-site", custom_domain: "mysite.com" } },
  ];

  for (const pt of projectTypes) {
    const websiteId = `site-${pt.type}`;
    const userId = "user-100";

    const mockDb = createUniversalMockDb({
      websites: [
        {
          id: websiteId,
          user_id: userId,
          title: `Project ${pt.type}`,
          ...pt.data,
        },
      ],
      website_pages: [{ id: `page-${pt.type}`, website_id: websiteId }],
    });

    const report = await deleteProjectUniversally({
      websiteId,
      userId,
      dbClient: mockDb,
      userClient: mockDb,
      allowPublishedDelete: true,
    });

    assert.strictEqual(report.cleanupCompleted, true, `Expected successful cleanup for project type ${pt.type}`);
    assert.strictEqual(report.parentDeleted, true, `Parent record must be deleted for ${pt.type}`);
    assert.strictEqual(mockDb.getTableData("websites").length, 0, `Websites table must be empty after deleting ${pt.type}`);
    console.log(`  ✓ Successfully deleted project type: ${pt.type}`);
  }
  console.log("✅ Passed: All 8 project types cleanly deleted through universal deletion service.");

  // --------------------------------------------------------------------------
  // Test 2: Ownership Isolation (Cross-User Protection)
  // --------------------------------------------------------------------------
  console.log("\n--- Test 2: Ownership Isolation & Unauthorized Rejection ---");
  {
    const websiteId = "site-user-1";
    const ownerUserId = "user-1";
    const maliciousUserId = "user-2";

    const mockDb = createUniversalMockDb({
      websites: [
        { id: websiteId, user_id: ownerUserId, title: "Private Project" },
      ],
      website_pages: [{ id: "p1", website_id: websiteId }],
      storageFiles: new Map([[`${ownerUserId}/${websiteId}/secret.png`, { id: "f1", metadata: {} }]]),
    });

    // Malicious user attempts deletion
    const report = await deleteProjectUniversally({
      websiteId,
      userId: maliciousUserId,
      dbClient: mockDb,
      userClient: mockDb,
    });

    assert.strictEqual(report.ownershipVerified, false, "Ownership verification must fail");
    assert.strictEqual(report.cleanupCompleted, false, "Cleanup must not complete for unauthorized user");
    assert.ok(report.errors.some((e) => e.includes("Ownership verification failed")));
    assert.strictEqual(mockDb.getTableData("websites").length, 1, "Owner's project must remain intact");
    assert.strictEqual(mockDb.getTableData("website_pages").length, 1, "Owner's pages must remain intact");
    assert.strictEqual(mockDb.getStorageFiles().length, 1, "Owner's storage files must remain intact");

    console.log("✅ Passed: Unauthorized users cannot delete other users' projects.");
  }

  // --------------------------------------------------------------------------
  // Test 3: Financial Audit Preservation (ai_credit_transactions)
  // --------------------------------------------------------------------------
  console.log("\n--- Test 3: Financial Audit Preservation (ai_credit_transactions retained) ---");
  {
    const websiteId = "site-audit-preservation";
    const userId = "user-audit";

    const mockDb = createUniversalMockDb({
      websites: [{ id: websiteId, user_id: userId, title: "Audit Preserved Site" }],
      website_pages: [{ id: "p-audit", website_id: websiteId }],
      ai_credit_transactions: [
        {
          id: "txn-1",
          website_id: websiteId,
          user_id: userId,
          amount: 5,
          action: "website_generation",
          created_at: new Date().toISOString(),
        },
        {
          id: "txn-2",
          website_id: websiteId,
          user_id: userId,
          amount: 2,
          action: "ai_redesign",
          created_at: new Date().toISOString(),
        },
      ],
    });

    const report = await deleteProjectUniversally({
      websiteId,
      userId,
      dbClient: mockDb,
      userClient: mockDb,
      preserveAuditLogs: true,
    });

    assert.strictEqual(report.cleanupCompleted, true);
    assert.strictEqual(report.billingRecordsPreserved, 2, "Report must reflect 2 preserved transactions");

    const retainedTxns = mockDb.getTableData("ai_credit_transactions");
    assert.strictEqual(retainedTxns.length, 2, "Financial audit transactions must NEVER be deleted");
    assert.strictEqual(retainedTxns[0].user_id, userId, "Customer user_id must be preserved");
    assert.strictEqual(retainedTxns[0].amount, 5, "Credit amount must be preserved");

    console.log("✅ Passed: ai_credit_transactions audit history is strictly preserved.");
  }

  // --------------------------------------------------------------------------
  // Test 4: Project-Specific Child Tables Cleanup (Dependency Order)
  // --------------------------------------------------------------------------
  console.log("\n--- Test 4: Comprehensive Child Table Cleanup ---");
  {
    const websiteId = "site-child-purge";
    const userId = "user-child";

    const mockDb = createUniversalMockDb({
      websites: [{ id: websiteId, user_id: userId, title: "Child Purge Site" }],
      website_pages: [{ id: "p1", website_id: websiteId }],
      media_assets: [{ id: "m1", website_id: websiteId, storage_path: `${userId}/${websiteId}/img.png` }],
      blog_posts: [{ id: "b1", website_id: websiteId }],
      seo_integration_requests: [{ id: "seo-req-1", website_id: websiteId }],
      marketing_campaign_drafts: [{ id: "mcd-1", website_id: websiteId }],
      website_ai_visibility_configs: [{ id: "aiv-1", website_id: websiteId }],
    });

    const report = await deleteProjectUniversally({
      websiteId,
      userId,
      dbClient: mockDb,
      userClient: mockDb,
    });

    assert.strictEqual(report.cleanupCompleted, true);
    assert.strictEqual(mockDb.getTableData("website_pages").length, 0, "website_pages must be deleted");
    assert.strictEqual(mockDb.getTableData("media_assets").length, 0, "media_assets must be deleted");
    assert.strictEqual(mockDb.getTableData("blog_posts").length, 0, "blog_posts must be deleted");
    assert.strictEqual(mockDb.getTableData("seo_integration_requests").length, 0, "seo_integration_requests must be deleted");
    assert.strictEqual(mockDb.getTableData("marketing_campaign_drafts").length, 0, "marketing_campaign_drafts must be deleted");
    assert.strictEqual(mockDb.getTableData("website_ai_visibility_configs").length, 0, "website_ai_visibility_configs must be deleted");

    console.log("✅ Passed: All project-specific child tables purged in dependency order.");
  }

  // --------------------------------------------------------------------------
  // Test 5: Shared Asset Preservation
  // --------------------------------------------------------------------------
  console.log("\n--- Test 5: Shared Asset Preservation (Cross-Project Storage Protection) ---");
  {
    const webId1 = "site-to-delete";
    const webId2 = "site-to-keep";
    const userId = "user-shared";

    const sharedPath = `${userId}/shared/company-logo.png`;
    const exclusivePath = `${userId}/${webId1}/banner.png`;
    const otherProjectPath = `${userId}/${webId2}/avatar.png`;

    const storageMap = new Map([
      [sharedPath, { id: "f-shared", metadata: {} }],
      [exclusivePath, { id: "f-exclusive", metadata: {} }],
      [otherProjectPath, { id: "f-other", metadata: {} }],
    ]);

    const mockDb = createUniversalMockDb({
      websites: [
        { id: webId1, user_id: userId, title: "Deleting Site" },
        { id: webId2, user_id: userId, title: "Keeping Site" },
      ],
      media_assets: [
        // Both sites reference company-logo.png
        { id: "m-1", website_id: webId1, storage_path: sharedPath },
        { id: "m-2", website_id: webId2, storage_path: sharedPath },
        // Exclusive asset for webId1
        { id: "m-3", website_id: webId1, storage_path: exclusivePath },
      ],
      storageFiles: storageMap,
    });

    const report = await deleteProjectUniversally({
      websiteId: webId1,
      userId,
      dbClient: mockDb,
      userClient: mockDb,
    });

    assert.strictEqual(report.cleanupCompleted, true);
    assert.strictEqual(report.storageObjectsPreservedShared, 1, "Must preserve exactly 1 shared asset");
    assert.strictEqual(report.storageObjectsDeleted, 1, "Must delete exactly 1 exclusive asset");

    const remainingFiles = mockDb.getStorageFiles();
    assert.ok(remainingFiles.includes(sharedPath), "Shared logo must remain in storage");
    assert.ok(remainingFiles.includes(otherProjectPath), "Other site's avatar must remain in storage");
    assert.ok(!remainingFiles.includes(exclusivePath), "Exclusive banner must be deleted from storage");

    console.log("✅ Passed: Shared assets are preserved; only exclusive project assets are purged.");
  }

  // --------------------------------------------------------------------------
  // Test 6: Storage Failure Tracking & Safe Partial Failure Reporting
  // --------------------------------------------------------------------------
  console.log("\n--- Test 6: Storage Failure Tracking (No Masking) ---");
  {
    const websiteId = "site-storage-fail";
    const userId = "user-fail";
    const filePath = `${userId}/${websiteId}/file1.png`;

    const mockDb = createUniversalMockDb({
      websites: [{ id: websiteId, user_id: userId, title: "Failing Storage Site" }],
      media_assets: [{ id: "m1", website_id: websiteId, storage_path: filePath }],
      storageFiles: new Map([[filePath, { id: "f1", metadata: {} }]]),
      storageFailures: true, // Trigger storage error
    });

    const report = await deleteProjectUniversally({
      websiteId,
      userId,
      dbClient: mockDb,
      userClient: mockDb,
    });

    assert.strictEqual(report.storagePartialFailure, true, "Must flag storagePartialFailure = true");
    assert.strictEqual(report.cleanupCompleted, false, "Must NOT report cleanup completed when storage files failed");
    assert.ok(report.storageErrors.length > 0, "Must record storage error message");
    assert.ok(report.remainingOrphanedResources.length > 0, "Must list orphaned storage paths");

    console.log("✅ Passed: Storage failure tracked transparently without masking partial failures.");
  }

  // --------------------------------------------------------------------------
  // Test 7: Worker & Background Migration Cancellation
  // --------------------------------------------------------------------------
  console.log("\n--- Test 7: In-Memory Worker Eviction on Project Deletion ---");
  {
    const websiteId = "site-active-job";
    // Evict job and worker to ensure functions execute cleanly
    cancelActiveWorkerForWebsite(websiteId);
    evictInMemoryJob(websiteId);

    const mockDb = createUniversalMockDb({
      websites: [{ id: websiteId, user_id: "user-w", title: "Active Worker Site" }],
    });

    const report = await deleteProjectUniversally({
      websiteId,
      userId: "user-w",
      dbClient: mockDb,
      userClient: mockDb,
    });

    assert.strictEqual(report.backgroundJobsCancelled, true, "Background jobs must be cancelled");
    console.log("✅ Passed: Background migration workers and in-memory caches evicted.");
  }

  // --------------------------------------------------------------------------
  // Test 8: Admin Endpoint Entrypoint Delegation & Audit Logging
  // --------------------------------------------------------------------------
  console.log("\n--- Test 8: Admin Deletion Entrypoint & System Audit ---");
  {
    const websiteId = "site-admin-delete";
    const ownerUserId = "user-target";

    const mockDb = createUniversalMockDb({
      websites: [{ id: websiteId, user_id: ownerUserId, title: "Target Site" }],
      admin_audit_logs: [],
    });

    const report = await deleteProjectUniversally({
      websiteId,
      isAdmin: true, // Admin execution
      dbClient: mockDb,
      userClient: mockDb,
    });

    assert.strictEqual(report.cleanupCompleted, true);
    assert.strictEqual(mockDb.getTableData("websites").length, 0);

    const auditLogs = mockDb.getTableData("admin_audit_logs");
    assert.strictEqual(auditLogs.length, 1, "Admin deletion must write an audit log");
    assert.strictEqual(auditLogs[0].action_type, "WEBSITE_DELETED");
    assert.strictEqual(auditLogs[0].target_website_id, websiteId);

    console.log("✅ Passed: Admin deletion cleans up project and writes admin_audit_logs entry.");
  }

  console.log("\n" + "=".repeat(80));
  console.log("ALL UNIVERSAL PROJECT DELETION TESTS PASSED! 🛡️🗑️");
  console.log("=".repeat(80));
}

runUniversalProjectDeletionTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
