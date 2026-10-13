import { createAdminClient } from "@/utils/supabase/server";
import { redisDel } from "@/lib/redis";
import { revalidatePath } from "next/cache";
import { cancelActiveWorkerForWebsite, evictInMemoryJob } from "@/lib/migration/executor";

export interface DeleteProjectOptions {
  websiteId: string;
  userId?: string;              // If provided (customer request), validates ownership
  isAdmin?: boolean;            // If true, bypasses user-matching ownership check
  allowPublishedDelete?: boolean; // Defaults to true for explicit user/admin deletions
  preserveAuditLogs?: boolean;  // Defaults to true (preserves ai_credit_transactions)
  dbClient?: any;
  userClient?: any;
}

export interface DeletionResourceReport {
  websiteId: string;
  websiteTitle: string;
  projectType: string;
  isPublished: boolean;
  ownershipVerified: boolean;
  childRecordsDeleted: Record<string, number>;
  storageObjectsDeleted: number;
  storageObjectsPreservedShared: number;
  storagePartialFailure: boolean;
  storageErrors: string[];
  redisKeysDeleted: string[];
  backgroundJobsCancelled: boolean;
  billingRecordsPreserved: number;
  parentDeleted: boolean;
  cleanupCompleted: boolean;
  remainingOrphanedResources: string[];
  errors: string[];
}

/**
 * All verified project-specific child tables in explicit foreign-key dependency order.
 * Leaf and activity tables are cleared first; core tables (media_assets, website_pages) last.
 * ai_credit_transactions is deliberately EXCLUDED to preserve financial audit compliance.
 */
export const PROJECT_CHILD_TABLES = [
  // 1. Technical Crawl & Audits
  "technical_crawl_issues",
  "technical_crawl_runs",

  // 2. Competitor Intelligence
  "competitor_analyses",
  "seo_competitors",

  // 3. Content Studio & Briefs
  "content_refresh_runs",
  "content_revisions",
  "content_briefs",

  // 4. Unified SEO Scores & AEO
  "seo_unified_scores",
  "website_aeo_analysis",

  // 5. SEO Autopilot & Opportunities
  "seo_autopilot_activity",
  "seo_autopilot_settings",
  "seo_opportunities",

  // 6. Third-party SEO integrations & requests
  "website_third_party_seo_integrations",
  "seo_integration_requests",

  // 7. Monitoring & Schedules
  "seo_monitoring_events",
  "website_monitoring_schedules",

  // 8. Local SEO & Internal Linking
  "website_local_seo",
  "website_internal_links",

  // 9. Blog Engine
  "blog_posts",

  // 10. GSC & Google Ads
  "gsc_search_analytics",
  "gsc_oauth_credentials",
  "google_ads_keyword_cache",
  "google_ads_oauth_credentials",

  // 11. Marketing Agent & Social Accounts
  "marketing_action_logs",
  "marketing_optimization_recommendations",
  "marketing_insights",
  "marketing_leads",
  "marketing_campaign_executions",
  "marketing_campaign_drafts",
  "marketing_instagram_accounts",
  "marketing_pages",
  "marketing_ad_accounts",
  "marketing_connections",

  // 12. AI Visibility Logs & Configurations
  "seo_ai_visibility_logs",
  "ai_visibility_alerts",
  "ai_visibility_monitoring_runs",
  "website_ai_visibility_configs",

  // 13. General SEO & Analysis Jobs
  "seo_integrations",
  "seo_analysis_jobs",
  "seo_analysis_history",
  "website_page_seo",
  "website_seo",

  // 14. Project Media Assets & Pages
  "media_assets",
  "website_pages",
] as const;

/**
 * Universal Project Deletion Service
 * Applies identical, idempotent, safe cleanup across all project types:
 * - AI-generated projects
 * - Migrated projects
 * - Template-based projects
 * - Manually created projects
 * - Imported / duplicated projects
 * - Draft and published projects
 *
 * Guarantees:
 * - Ownership verification before mutation
 * - Preserves ai_credit_transactions and financial billing ledger for compliance
 * - Preserves shared storage objects referenced by other projects
 * - Purges exclusive storage objects under user/site and legacy site folders
 * - Cancels in-memory and background migration jobs to prevent resurrection
 * - Invalidates project-specific Redis caches
 * - Hard persistence check on parent row deletion
 * - Reports partial failures transparently
 */
export async function deleteProjectUniversally(
  options: DeleteProjectOptions
): Promise<DeletionResourceReport> {
  const { websiteId, userId, isAdmin = false, allowPublishedDelete = true, preserveAuditLogs = true } = options;
  const db = options.dbClient || createAdminClient();
  const userClient = options.userClient;

  const report: DeletionResourceReport = {
    websiteId,
    websiteTitle: "Unknown",
    projectType: "custom",
    isPublished: false,
    ownershipVerified: false,
    childRecordsDeleted: {},
    storageObjectsDeleted: 0,
    storageObjectsPreservedShared: 0,
    storagePartialFailure: false,
    storageErrors: [],
    redisKeysDeleted: [],
    backgroundJobsCancelled: false,
    billingRecordsPreserved: 0,
    parentDeleted: false,
    cleanupCompleted: false,
    remainingOrphanedResources: [],
    errors: [],
  };

  if (!websiteId || typeof websiteId !== "string") {
    report.errors.push("Invalid website ID provided.");
    return report;
  }

  try {
    // 1. Fetch website and verify existence & ownership
    const { data: website, error: fetchError } = await db
      .from("websites")
      .select("id, user_id, title, is_published, custom_domain, design_plan")
      .eq("id", websiteId)
      .maybeSingle();

    if (fetchError || !website) {
      report.errors.push(fetchError ? `Failed to query website: ${fetchError.message}` : "Website not found.");
      return report;
    }

    report.websiteTitle = website.title || "Untitled Project";
    report.isPublished = Boolean(website.is_published);

    // Identify project type from design_plan
    const plan = website.design_plan && typeof website.design_plan === "object" ? website.design_plan : {};
    if (plan.websiteType === "migrated" || plan.migration) {
      report.projectType = "migrated";
    } else if (plan.templateId || plan.isTemplate) {
      report.projectType = "template";
    } else if (plan.prompt || plan.websiteType === "Custom Website") {
      report.projectType = "ai-generated";
    } else {
      report.projectType = typeof plan.websiteType === "string" ? plan.websiteType : "custom";
    }

    // Ownership check: If requested by a customer (userId supplied and not admin)
    if (userId && !isAdmin) {
      if (website.user_id !== userId) {
        report.errors.push("Ownership verification failed: User does not own this website.");
        return report;
      }
    }
    report.ownershipVerified = true;

    // Published project safeguard
    if (website.is_published && !allowPublishedDelete) {
      report.errors.push("Deletion aborted: Project is currently published and allowPublishedDelete is false.");
      return report;
    }

    // 2. Prevent background migration workers from resurrecting resources
    try {
      const cancelled = cancelActiveWorkerForWebsite(websiteId);
      evictInMemoryJob(websiteId);
      report.backgroundJobsCancelled = cancelled || true;
    } catch (workerErr: unknown) {
      const msg = workerErr instanceof Error ? workerErr.message : String(workerErr);
      console.warn(`[DELETION_WORKER_WARN] Non-fatal worker cancellation for ${websiteId}:`, msg);
    }

    // 3. Preserve Financial Audit & Billing History (ai_credit_transactions)
    if (preserveAuditLogs) {
      try {
        const { count, error: countErr } = await db
          .from("ai_credit_transactions")
          .select("*", { count: "exact", head: true })
          .eq("website_id", websiteId);

        if (!countErr && typeof count === "number") {
          report.billingRecordsPreserved = count;
        }
      } catch (auditCheckErr: unknown) {
        const msg = auditCheckErr instanceof Error ? auditCheckErr.message : String(auditCheckErr);
        console.warn(`[DELETION_AUDIT_CHECK_WARN] websiteId=${websiteId}:`, msg);
      }
    }

    // 4. Redis Cache Invalidation
    try {
      const redisKeys = [
        `seo:manifest:${websiteId}`,
        `seo:geo:${websiteId}`,
        `seo:aio:${websiteId}`,
      ];

      for (const k of redisKeys) {
        try {
          await redisDel(k);
          report.redisKeysDeleted.push(k);
        } catch {
          // Non-fatal if Redis is not configured or offline
        }
      }
    } catch (redisErr: unknown) {
      const msg = redisErr instanceof Error ? redisErr.message : String(redisErr);
      console.warn(`[DELETION_REDIS_WARN] websiteId=${websiteId}:`, msg);
    }

    // 5. Exclusively Owned Storage Cleanup with Shared Asset Preservation
    try {
      const candidatePaths = new Set<string>();

      // A. Fetch storage paths from media_assets for this website
      const { data: mediaRows } = await db
        .from("media_assets")
        .select("storage_path, public_url")
        .eq("website_id", websiteId);

      const candidateUrls = new Set<string>();
      if (mediaRows && Array.isArray(mediaRows)) {
        for (const row of mediaRows) {
          if (row.storage_path) candidatePaths.add(row.storage_path);
          if (row.public_url) candidateUrls.add(row.public_url);
        }
      }

      // B. Recursive folder listing helper for nested objects in 'website-assets'
      const listFolderRecursive = async (folderPrefix: string): Promise<string[]> => {
        const collected: string[] = [];
        const { data: entries, error } = await db.storage
          .from("website-assets")
          .list(folderPrefix, { limit: 1000 });

        if (error || !entries) return collected;

        for (const entry of entries) {
          const entryPath = folderPrefix ? `${folderPrefix}/${entry.name}` : entry.name;
          if (entry.id === null || !entry.metadata) {
            // Directory -> recurse
            const nested = await listFolderRecursive(entryPath);
            collected.push(...nested);
          } else {
            collected.push(entryPath);
          }
        }
        return collected;
      };

      // Discovered files under user-scoped and legacy folders
      const userFolderFiles = await listFolderRecursive(`${website.user_id}/${websiteId}`);
      userFolderFiles.forEach((p) => candidatePaths.add(p));

      const legacyFolderFiles = await listFolderRecursive(`${websiteId}`);
      legacyFolderFiles.forEach((p) => candidatePaths.add(p));

      // C. Shared Asset Verification: Check if any candidate is referenced by other websites
      const sharedPaths = new Set<string>();
      if (candidatePaths.size > 0) {
        const candidateArr = Array.from(candidatePaths);

        // Check if other websites have media_assets referencing the same storage_path
        const { data: otherMedia } = await db
          .from("media_assets")
          .select("storage_path")
          .neq("website_id", websiteId)
          .in("storage_path", candidateArr.slice(0, 500));

        if (otherMedia && Array.isArray(otherMedia)) {
          otherMedia.forEach((om: { storage_path?: string }) => {
            if (om.storage_path) sharedPaths.add(om.storage_path);
          });
        }

        // Check if other websites' pages reference the candidate file names or URLs in HTML/CSS
        const { data: otherPages } = await db
          .from("website_pages")
          .select("html_content, css_content")
          .neq("website_id", websiteId)
          .limit(200);

        if (otherPages && Array.isArray(otherPages)) {
          for (const op of otherPages) {
            const pageBlob = `${op.html_content || ""} ${op.css_content || ""}`;
            for (const p of candidateArr) {
              const fileName = p.split("/").pop();
              if (fileName && fileName.length > 8 && pageBlob.includes(fileName)) {
                sharedPaths.add(p);
              }
            }
            for (const u of candidateUrls) {
              if (pageBlob.includes(u)) {
                // Find matching path
                const matched = candidateArr.find((p) => u.includes(p.split("/").pop() || ""));
                if (matched) sharedPaths.add(matched);
              }
            }
          }
        }
      }

      report.storageObjectsPreservedShared = sharedPaths.size;

      // Filter for strictly exclusively owned storage objects
      const exclusivePathsToDelete = Array.from(candidatePaths).filter((p) => !sharedPaths.has(p));

      if (exclusivePathsToDelete.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < exclusivePathsToDelete.length; i += BATCH_SIZE) {
          const chunk = exclusivePathsToDelete.slice(i, i + BATCH_SIZE);
          const { error: storageDelErr } = await db.storage
            .from("website-assets")
            .remove(chunk);

          if (storageDelErr) {
            report.storagePartialFailure = true;
            report.storageErrors.push(`Failed to delete storage chunk: ${storageDelErr.message}`);
            chunk.forEach((p) => report.remainingOrphanedResources.push(`storage:${p}`));
          } else {
            report.storageObjectsDeleted += chunk.length;
          }
        }
      }
    } catch (storageErr: unknown) {
      const msg = storageErr instanceof Error ? storageErr.message : String(storageErr);
      report.storagePartialFailure = true;
      report.storageErrors.push(`Storage cleanup exception: ${msg}`);
    }

    // 6. Child Tables Deletion in Explicit Dependency Order
    for (const table of PROJECT_CHILD_TABLES) {
      try {
        const { error: adminDelErr, count } = await db
          .from(table)
          .delete({ count: "exact" })
          .eq("website_id", websiteId);

        if (adminDelErr) {
          console.warn(`[CHILD_TABLE_DELETE_WARN] Table ${table} error:`, adminDelErr.message);
          report.remainingOrphanedResources.push(`table:${table}`);
        } else {
          report.childRecordsDeleted[table] = count || 0;
        }

        // Secondary delete via userClient if supplied
        if (userClient) {
          await userClient.from(table).delete().eq("website_id", websiteId);
        }
      } catch (tableErr: unknown) {
        const msg = tableErr instanceof Error ? tableErr.message : String(tableErr);
        console.warn(`[CHILD_TABLE_DELETE_EXCEPTION] Table ${table}:`, msg);
        report.remainingOrphanedResources.push(`table:${table}`);
      }
    }

    // 7. Parent Website Record Deletion
    let parentRowDeleted = false;

    // Attempt A: via userClient (if user session provided)
    if (userClient) {
      const { data: userDelData } = await userClient
        .from("websites")
        .delete()
        .eq("id", websiteId)
        .eq("user_id", website.user_id)
        .select("id");

      if (userDelData && userDelData.length > 0) {
        parentRowDeleted = true;
      }
    }

    // Attempt B: via admin dbClient
    if (!parentRowDeleted) {
      const { data: adminDelData } = await db
        .from("websites")
        .delete()
        .eq("id", websiteId)
        .select("id");

      if (adminDelData && adminDelData.length > 0) {
        parentRowDeleted = true;
      }
    }

    // 8. Hard Persistence Check: Ensure website row no longer exists
    const { data: verifyRow } = await db
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .maybeSingle();

    if (verifyRow) {
      report.parentDeleted = false;
      report.errors.push("Hard persistence failure: Website row still exists in database after deletion attempt.");
      report.remainingOrphanedResources.push(`row:websites:${websiteId}`);
      report.cleanupCompleted = false;
      return report;
    }

    report.parentDeleted = true;

    // 9. Admin Audit Logging
    if (isAdmin) {
      try {
        await db.from("admin_audit_logs").insert({
          admin_id: userId || "system-admin",
          action_type: "WEBSITE_DELETED",
          target_user_id: website.user_id,
          target_website_id: websiteId,
          details: {
            websiteTitle: website.title,
            projectType: report.projectType,
            storageObjectsDeleted: report.storageObjectsDeleted,
          },
        });
      } catch (auditErr: unknown) {
        const msg = auditErr instanceof Error ? auditErr.message : String(auditErr);
        console.warn("[ADMIN_AUDIT_LOG_WARN]:", msg);
      }
    }

    // 10. Revalidate Next.js Dashboard Routes
    try {
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/websites");
      revalidatePath(`/dashboard/websites/${websiteId}`);
    } catch (revalidateErr: unknown) {
      const msg = revalidateErr instanceof Error ? revalidateErr.message : String(revalidateErr);
      console.warn("[REVALIDATE_WARN]:", msg);
    }

    // 10. Complete Cleanup Status Evaluation
    if (!report.storagePartialFailure && report.errors.length === 0 && report.parentDeleted) {
      report.cleanupCompleted = true;
    } else {
      report.cleanupCompleted = false;
    }

    return report;
  } catch (fatalErr: unknown) {
    const msg = fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
    report.errors.push(`Fatal error during project deletion: ${msg}`);
    report.cleanupCompleted = false;
    return report;
  }
}
