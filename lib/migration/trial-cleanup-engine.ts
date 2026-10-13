import { createAdminClient } from "@/utils/supabase/server";
import { isSubscriptionActiveAndValid } from "@/lib/billing";
import { dispatchMigrationTrialAlert, MinimalDbClient } from "@/lib/notifications/migration-trial-alerts";

type DbClient = ReturnType<typeof createAdminClient>;

export interface MigrationCleanupOptions {
  supabase?: DbClient;
  dryRun?: boolean;
  batchLimit?: number;
  asOfDate?: Date;
  forceWebsiteId?: string;
  adminUserId?: string;
}

export interface PaymentVerificationResult {
  isVerifiedPaid: boolean;
  status: "paid" | "free" | "indeterminate";
  reason: string;
  planId?: string;
}

export interface MigrationTrialCleanupReport {
  success: boolean;
  timestamp: string;
  dryRun: boolean;
  scanned_websites: number;
  active_trial_count: number;
  preserved_paid_count: number;
  preserved_published_count: number;
  preserved_payment_unverified_count: number;
  reminders_sent: {
    day7: number;
    day9: number;
    day10: number;
  };
  cleaned_websites_count: number;
  deleted_files_count: number;
  freed_storage_bytes: number;
  cleaned_details: Array<{
    websiteId: string;
    websiteTitle: string;
    userId: string;
    ageDays: number;
    status: string;
    deletedFiles: string[];
    freedBytes: number;
    prunedTemporaryArtifacts: boolean;
  }>;
  preserved_details: Array<{
    websiteId: string;
    reason: string;
    status: string;
  }>;
  errors: string[];
  auditLogId?: string;
}

interface MediaAssetRecord {
  id: string;
  user_id: string;
  website_id: string;
  file_name: string;
  file_size_bytes: number | string;
  storage_path: string;
  public_url: string;
}

interface WebsitePageRecord {
  html_content?: string;
  css_content?: string;
  website_id?: string;
}

interface MigrationJobState {
  jobId?: string;
  status?: string;
  completedAt?: string;
  updatedAt?: string;
  capturedPages?: Array<{ path: string; html_content?: string }>;
  manifests?: unknown[];
  temporaryArtifactsPruned?: boolean;
}

interface WebsiteRecord {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  is_published?: boolean;
  published_slug?: string | null;
  published_at?: string | null;
  custom_domain?: string | null;
  created_at?: string;
  updated_at?: string;
  design_plan?: {
    websiteType?: string;
    migration?: Record<string, unknown>;
    migration_job?: MigrationJobState;
    migration_trial_reminders?: Record<string, string>;
    migration_trial?: {
      status: string;
      cleaned_at: string;
      freed_bytes: number;
      deleted_files_count: number;
    };
  };
}

/**
 * Verifies a customer's payment status with fail-closed semantics.
 * If database queries fail or error, returns status="indeterminate" so data is preserved.
 * If the customer has an active paid subscription or completed payment, returns isVerifiedPaid=true.
 */
export async function verifyCustomerPaymentStatus(
  supabase: DbClient,
  userId: string,
  asOf: Date = new Date()
): Promise<PaymentVerificationResult> {
  if (!userId) {
    return {
      isVerifiedPaid: false,
      status: "indeterminate",
      reason: "Missing userId for payment verification",
    };
  }

  try {
    // 1. Query subscriptions table
    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (subError) {
      console.warn(`[PAYMENT_VERIFY] Subscriptions query error for user ${userId}:`, subError.message);
      return {
        isVerifiedPaid: false,
        status: "indeterminate",
        reason: `Subscriptions query error: ${subError.message}`,
      };
    }

    if (sub) {
      const planId = typeof sub.plan_id === "string" ? sub.plan_id.toLowerCase().trim() : "";
      const isPaidPlan = planId !== "" && planId !== "free";
      if (isPaidPlan && isSubscriptionActiveAndValid(sub, asOf)) {
        return {
          isVerifiedPaid: true,
          status: "paid",
          reason: `Verified active subscription on ${planId} plan`,
          planId,
        };
      }
    }

    // 2. Query billing_transactions for completed paid transactions
    const { data: txs, error: txError } = await supabase
      .from("billing_transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "completed");

    if (txError) {
      console.warn(`[PAYMENT_VERIFY] Transactions query error for user ${userId}:`, txError.message);
      return {
        isVerifiedPaid: false,
        status: "indeterminate",
        reason: `Transactions query error: ${txError.message}`,
      };
    }

    if (txs && Array.isArray(txs)) {
      const paidTx = txs.find((t) => {
        const plan = typeof t.plan_id === "string" ? t.plan_id.toLowerCase().trim() : "";
        const isPaidPlan = plan && plan !== "free";
        const hasAmount = Number(t.amount) > 0;
        return isPaidPlan || hasAmount;
      });

      if (paidTx) {
        return {
          isVerifiedPaid: true,
          status: "paid",
          reason: `Verified completed billing transaction: ${String(paidTx.provider_payment_id || paidTx.id)}`,
          planId: typeof paidTx.plan_id === "string" ? paidTx.plan_id : "paid",
        };
      }
    }

    return {
      isVerifiedPaid: false,
      status: "free",
      reason: "No active paid subscription or completed transaction found",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[PAYMENT_VERIFY_FATAL] Error verifying user ${userId}:`, msg);
    return {
      isVerifiedPaid: false,
      status: "indeterminate",
      reason: `Exception during payment verification: ${msg}`,
    };
  }
}

/**
 * Scans active and published website pages across the platform to determine if any candidate
 * assets are referenced. Preserves any file referenced by published sites or active paid customer work.
 */
export async function findReferencedAssets(
  supabase: DbClient,
  candidatePaths: string[],
  candidateUrls: string[]
): Promise<Set<string>> {
  const referenced = new Set<string>();
  if (candidatePaths.length === 0 && candidateUrls.length === 0) {
    return referenced;
  }

  try {
    // 1. Fetch published websites and their pages
    const { data: rawPages, error: pagesErr } = await supabase
      .from("website_pages")
      .select("html_content, css_content, website_id")
      .limit(500);

    if (pagesErr) {
      console.warn("[ASSET_REFERENCE_CHECK] Error querying website_pages:", pagesErr.message);
      // Fail-closed: assume all candidate assets are referenced to avoid accidental deletion
      candidatePaths.forEach((p) => referenced.add(p));
      candidateUrls.forEach((u) => referenced.add(u));
      return referenced;
    }

    const publishedPages = (rawPages || []) as WebsitePageRecord[];
    if (publishedPages.length === 0) {
      return referenced;
    }

    // Combine page contents for fast substring lookup
    for (const page of publishedPages) {
      const combined = `${page.html_content || ""} ${page.css_content || ""}`;
      for (const p of candidatePaths) {
        if (!referenced.has(p) && combined.includes(p)) {
          referenced.add(p);
        }
      }
      for (const u of candidateUrls) {
        if (!referenced.has(u) && combined.includes(u)) {
          referenced.add(u);
        }
      }
    }

    return referenced;
  } catch (err: unknown) {
    console.error("[ASSET_REFERENCE_CHECK_FATAL] Error checking references:", err instanceof Error ? err.message : err);
    candidatePaths.forEach((p) => referenced.add(p));
    candidateUrls.forEach((u) => referenced.add(u));
    return referenced;
  }
}

/**
 * Primary orchestrator for 10-Day Migration Trial Expiry and Automatic Storage Cleanup.
 * Fully idempotent, safe retries, fail-closed payment checks, dry-run support, and audit logging.
 */
export async function processMigrationTrialCleanup(
  options: MigrationCleanupOptions = {}
): Promise<MigrationTrialCleanupReport> {
  const db = options.supabase || createAdminClient();
  const dryRun = Boolean(options.dryRun);
  const asOf = options.asOfDate || new Date();
  const asOfIso = asOf.toISOString();
  const batchLimit = options.batchLimit || 50;

  const report: MigrationTrialCleanupReport = {
    success: true,
    timestamp: asOfIso,
    dryRun,
    scanned_websites: 0,
    active_trial_count: 0,
    preserved_paid_count: 0,
    preserved_published_count: 0,
    preserved_payment_unverified_count: 0,
    reminders_sent: {
      day7: 0,
      day9: 0,
      day10: 0,
    },
    cleaned_websites_count: 0,
    deleted_files_count: 0,
    freed_storage_bytes: 0,
    cleaned_details: [],
    preserved_details: [],
    errors: [],
  };

  try {
    // 1. Query candidate websites
    const websiteQuery = db
      .from("websites")
      .select("id, user_id, title, slug, is_published, published_slug, published_at, custom_domain, design_plan, created_at, updated_at");

    const filteredQuery = options.forceWebsiteId
      ? websiteQuery.eq("id", options.forceWebsiteId)
      : websiteQuery.not("design_plan", "is", null);

    const { data: rawWebsites, error: queryErr } = (await filteredQuery.limit(batchLimit)) as {
      data: WebsiteRecord[] | null;
      error: { message: string } | null;
    };

    if (queryErr) {
      report.success = false;
      report.errors.push(`Failed to query websites: ${queryErr.message}`);
      return report;
    }

    // Filter strictly for migrated websites with completed migration jobs
    const eligibleWebsites = (rawWebsites || []).filter((w) => {
      if (!w.design_plan || typeof w.design_plan !== "object") return false;
      const isMigrated = w.design_plan.websiteType === "migrated" || Boolean(w.design_plan.migration);
      const jobStatus = w.design_plan.migration_job?.status;
      return isMigrated && jobStatus === "COMPLETED";
    });

    report.scanned_websites = eligibleWebsites.length;

    for (const website of eligibleWebsites) {
      try {
        // Ownership validation
        if (!website.user_id) {
          report.errors.push(`Website ${website.id} missing user_id. Skipped for safety.`);
          continue;
        }

        // Rule 6: Preserve published websites unconditionally
        if (website.is_published === true) {
          report.preserved_published_count++;
          report.preserved_details.push({
            websiteId: website.id,
            reason: "Preserved: Website is published.",
            status: "PRESERVED_PUBLISHED",
          });
          continue;
        }

        // Rule 3 & 5: Customer payment verification (fail-closed)
        const paymentCheck = await verifyCustomerPaymentStatus(db, website.user_id, asOf);

        if (paymentCheck.status === "indeterminate") {
          report.preserved_payment_unverified_count++;
          report.preserved_details.push({
            websiteId: website.id,
            reason: `Preserved: Payment verification indeterminate (${paymentCheck.reason}). Retrying later.`,
            status: "PRESERVED_PAYMENT_UNVERIFIED",
          });
          continue;
        }

        if (paymentCheck.isVerifiedPaid) {
          report.preserved_paid_count++;
          report.preserved_details.push({
            websiteId: website.id,
            reason: `Preserved: Customer has verified paid plan (${paymentCheck.planId || "paid"}). Custom domain connection is not required.`,
            status: "PRESERVED_PAID_CUSTOMER",
          });
          continue;
        }

        // Calculate trial duration from completion timestamp
        const migrationJob = website.design_plan?.migration_job || {};
        const completedAtRaw =
          migrationJob.completedAt || migrationJob.updatedAt || website.updated_at || website.created_at;
        const completedTime = completedAtRaw ? new Date(completedAtRaw).getTime() : NaN;

        if (isNaN(completedTime)) {
          report.errors.push(`Website ${website.id} has invalid completion timestamp: ${String(completedAtRaw)}`);
          continue;
        }

        const ageMs = asOf.getTime() - completedTime;
        const ageDays = ageMs / (1000 * 60 * 60 * 24);

        const reminders: Record<string, string> = { ...(website.design_plan?.migration_trial_reminders || {}) };
        let remindersChanged = false;

        // Rule 2: Customer reminders on Day 7, Day 9, Day 10
        // Day 7 Reminder (7 <= ageDays < 9)
        if (ageDays >= 7 && ageDays < 9 && !reminders.day7) {
          if (!dryRun) {
            await dispatchMigrationTrialAlert(db as unknown as MinimalDbClient, {
              websiteId: website.id,
              websiteTitle: website.title,
              userId: website.user_id,
              day: 7,
              daysRemaining: Math.max(1, Math.round(10 - ageDays)),
            });
            reminders.day7 = asOfIso;
            remindersChanged = true;
          }
          report.reminders_sent.day7++;
        }

        // Day 9 Reminder (9 <= ageDays < 10)
        if (ageDays >= 9 && ageDays < 10 && !reminders.day9) {
          if (!dryRun) {
            await dispatchMigrationTrialAlert(db as unknown as MinimalDbClient, {
              websiteId: website.id,
              websiteTitle: website.title,
              userId: website.user_id,
              day: 9,
              daysRemaining: Math.max(1, Math.round(10 - ageDays)),
            });
            reminders.day9 = asOfIso;
            remindersChanged = true;
          }
          report.reminders_sent.day9++;
        }

        // Day 10 Expiration Notification (ageDays >= 10)
        if (ageDays >= 10 && !reminders.day10) {
          if (!dryRun) {
            await dispatchMigrationTrialAlert(db as unknown as MinimalDbClient, {
              websiteId: website.id,
              websiteTitle: website.title,
              userId: website.user_id,
              day: 10,
              daysRemaining: 0,
            });
            reminders.day10 = asOfIso;
            remindersChanged = true;
          }
          report.reminders_sent.day10++;
        }

        // Within 10-day trial window
        if (ageDays < 10) {
          report.active_trial_count++;
          if (remindersChanged && !dryRun && website.design_plan) {
            await db
              .from("websites")
              .update({
                design_plan: {
                  ...website.design_plan,
                  migration_trial_reminders: reminders,
                },
                updated_at: asOfIso,
              })
              .eq("id", website.id);
          }
          report.preserved_details.push({
            websiteId: website.id,
            reason: `Active trial: age is ${ageDays.toFixed(1)} days (< 10 days).`,
            status: "ACTIVE_TRIAL",
          });
          continue;
        }

        // Rule 4: Trial Expired (ageDays >= 10, unpaid, unpublished)
        // Check if already cleaned (idempotency check)
        if (website.design_plan?.migration_trial?.status === "EXPIRED_CLEANED") {
          report.preserved_details.push({
            websiteId: website.id,
            reason: "Already cleaned in prior execution.",
            status: "ALREADY_CLEANED",
          });
          continue;
        }

        // Query media assets belonging to this website
        const { data: rawAssets, error: assetErr } = (await db
          .from("media_assets")
          .select("*")
          .eq("website_id", website.id)) as {
          data: MediaAssetRecord[] | null;
          error: { message: string } | null;
        };

        if (assetErr) {
          report.errors.push(`Failed to query media_assets for website ${website.id}: ${assetErr.message}`);
          continue;
        }

        const candidateAssets = rawAssets || [];
        const candidatePaths = candidateAssets.map((a) => a.storage_path).filter(Boolean);
        const candidateUrls = candidateAssets.map((a) => a.public_url).filter(Boolean);

        // Scan for cross-references to preserve active customer files
        const referenced = await findReferencedAssets(db, candidatePaths, candidateUrls);

        const eligibleAssets = candidateAssets.filter(
          (a) => !referenced.has(a.storage_path) && !referenced.has(a.public_url)
        );

        // Strict ownership check: storage path must belong to userId or websiteId
        const verifiedEligibleAssets = eligibleAssets.filter((a) => {
          const path = a.storage_path || "";
          return path.startsWith(`${website.user_id}/`) || path.includes(`/${website.id}/`);
        });

        const pathsToDelete = verifiedEligibleAssets.map((a) => a.storage_path);
        const assetIdsToDelete = verifiedEligibleAssets.map((a) => a.id);
        const totalBytesFreed = verifiedEligibleAssets.reduce(
          (sum: number, a) => sum + (Number(a.file_size_bytes) || 0),
          0
        );

        const hasTemporaryArtifacts = Boolean(
          website.design_plan?.migration_job?.capturedPages?.length ||
            website.design_plan?.migration_job?.manifests
        );

        report.cleaned_details.push({
          websiteId: website.id,
          websiteTitle: website.title,
          userId: website.user_id,
          ageDays: Number(ageDays.toFixed(2)),
          status: dryRun ? "ELIGIBLE_FOR_CLEANUP" : "EXPIRED_CLEANED",
          deletedFiles: pathsToDelete,
          freedBytes: totalBytesFreed,
          prunedTemporaryArtifacts: hasTemporaryArtifacts,
        });

        report.deleted_files_count += pathsToDelete.length;
        report.freed_storage_bytes += totalBytesFreed;
        report.cleaned_websites_count++;

        if (!dryRun) {
          // Rule 7: Delete temporary files from actual Supabase Storage provider
          if (pathsToDelete.length > 0) {
            const { error: removeErr } = await db.storage
              .from("website-assets")
              .remove(pathsToDelete);

            if (removeErr) {
              console.error(`[STORAGE_DELETE_ERROR] Website ${website.id}:`, removeErr.message);
              report.errors.push(`Storage deletion failed for website ${website.id}: ${removeErr.message}`);
              continue;
            }
          }

          // Delete rows from media_assets table
          if (assetIdsToDelete.length > 0) {
            const { error: dbDeleteErr } = await db
              .from("media_assets")
              .delete()
              .in("id", assetIdsToDelete);

            if (dbDeleteErr) {
              console.warn(`[MEDIA_ASSET_DELETE_WARN] Website ${website.id}:`, dbDeleteErr.message);
            }
          }

          // Rule 9: Prune temporary migration artifacts in design_plan
          const updatedPlan = { ...(website.design_plan || {}) };
          if (updatedPlan.migration_job) {
            delete updatedPlan.migration_job.capturedPages;
            delete updatedPlan.migration_job.manifests;
            updatedPlan.migration_job.temporaryArtifactsPruned = true;
          }

          updatedPlan.migration_trial = {
            status: "EXPIRED_CLEANED",
            cleaned_at: asOfIso,
            freed_bytes: totalBytesFreed,
            deleted_files_count: pathsToDelete.length,
          };
          updatedPlan.migration_trial_reminders = reminders;

          website.design_plan = updatedPlan;

          await db
            .from("websites")
            .update({
              design_plan: updatedPlan,
              updated_at: asOfIso,
            })
            .eq("id", website.id);

          // Audit log for this cleanup operation
          try {
            await db.from("admin_audit_logs").insert({
              admin_id: options.adminUserId || website.user_id,
              action_type: "MIGRATION_TRIAL_CLEANUP_EXECUTED",
              target_user_id: website.user_id,
              target_website_id: website.id,
              details: {
                deleted_files_count: pathsToDelete.length,
                deleted_files: pathsToDelete,
                freed_storage_bytes: totalBytesFreed,
                pruned_temporary_artifacts: hasTemporaryArtifacts,
                age_days: Number(ageDays.toFixed(2)),
              },
            });
          } catch (auditErr: unknown) {
            console.warn("[AUDIT_LOG_WARN] Failed to insert audit log:", auditErr instanceof Error ? auditErr.message : auditErr);
          }
        }
      } catch (siteErr: unknown) {
        const msg = siteErr instanceof Error ? siteErr.message : String(siteErr);
        console.error(`[MIGRATION_CLEANUP_SITE_ERROR] Website ${website.id}:`, msg);
        report.errors.push(`Error processing website ${website.id}: ${msg}`);
      }
    }

    // Overall summary audit log
    if (!dryRun && report.cleaned_websites_count > 0) {
      try {
        const insertBuilder = db.from("admin_audit_logs").insert({
          admin_id: options.adminUserId || eligibleWebsites[0]?.user_id,
          action_type: "MIGRATION_TRIAL_BATCH_CLEANUP",
          details: {
            scanned_websites: report.scanned_websites,
            cleaned_websites_count: report.cleaned_websites_count,
            deleted_files_count: report.deleted_files_count,
            freed_storage_bytes: report.freed_storage_bytes,
            reminders_sent: report.reminders_sent,
          },
        });

        if (insertBuilder.select) {
          const { data: auditRow } = await insertBuilder.select("id").single();
          if (auditRow && typeof auditRow.id === "string") {
            report.auditLogId = auditRow.id;
          }
        }
      } catch (err: unknown) {
        console.warn("[BATCH_AUDIT_LOG_WARN] Failed to record batch audit log:", err instanceof Error ? err.message : err);
      }
    }

    return report;
  } catch (fatalErr: unknown) {
    const msg = fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
    console.error("[MIGRATION_TRIAL_CLEANUP_FATAL]", msg);
    report.success = false;
    report.errors.push(`Fatal error in cleanup: ${msg}`);
    return report;
  }
}
