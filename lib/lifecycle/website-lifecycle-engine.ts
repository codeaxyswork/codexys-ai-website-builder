import { createAdminClient } from "@/utils/supabase/server";
import { isSubscriptionActiveAndValid } from "@/lib/billing";
import { PLANS } from "@/lib/constants";
import { TRIAL_DURATION_DAYS, TRIAL_DURATION_MS } from "@/lib/website-trial";

export const RETENTION_DURATION_DAYS = 90;
export const RETENTION_DURATION_MS = RETENTION_DURATION_DAYS * 24 * 60 * 60 * 1000;

export interface WebsiteVisibilityResult {
  isPubliclyVisible: boolean;
  status: "active_paid" | "trial_active" | "trial_expired_suspended" | "draft" | "error";
  isOwnerPaid: boolean;
  daysRemaining?: number;
  reason?: string;
  planId?: string;
}

export interface MinimalWebsiteRecord {
  id: string;
  user_id: string;
  title?: string;
  is_published?: boolean | null;
  created_at?: string | Date | null;
  [key: string]: any;
}

/**
 * Server-side gate verifying whether a published website is allowed to be served
 * to public internet visitors or should be suspended (offline).
 *
 * Rules:
 * 1. Unpublished websites (drafts) are NEVER publicly visible.
 * 2. Websites owned by users with an active paid plan (Starter, Pro, Business, Agency)
 *    are ALWAYS publicly visible.
 * 3. Websites on Free accounts are publicly visible for the 10-day initial trial.
 * 4. Websites on Free accounts older than 10 days are SUSPENDED from public visitors.
 * 5. Expired paid subscriptions enter the 90-day retention window and are suspended
 *    from public visitors until renewed.
 */
export async function checkWebsitePublicVisibility(
  website: MinimalWebsiteRecord,
  customDbClient?: any,
  asOf: Date = new Date()
): Promise<WebsiteVisibilityResult> {
  if (!website || !website.is_published) {
    return {
      isPubliclyVisible: false,
      status: "draft",
      isOwnerPaid: false,
      reason: "Website is unpublished draft.",
    };
  }

  const userId = website.user_id;
  if (!userId) {
    return {
      isPubliclyVisible: false,
      status: "error",
      isOwnerPaid: false,
      reason: "Missing website owner identity.",
    };
  }

  try {
    const db = customDbClient || createAdminClient();

    // 1. Fetch website owner's current subscription
    const { data: sub, error: subErr } = await db
      .from("subscriptions")
      .select("id, user_id, plan_id, status, current_period_end, trial_ends_at, cancel_at_period_end, metadata")
      .eq("user_id", userId)
      .maybeSingle();

    if (subErr) {
      console.warn(`[VisibilityGate] Subscriptions lookup error for user ${userId}:`, subErr.message);
    }

    const planId = typeof sub?.plan_id === "string" ? sub.plan_id.toLowerCase().trim() : "free";
    const isPaidPlan = planId !== "" && planId !== "free";

    // 2. Check if owner has an active, valid paid subscription
    if (isPaidPlan && sub && isSubscriptionActiveAndValid(sub, asOf)) {
      return {
        isPubliclyVisible: true,
        status: "active_paid",
        isOwnerPaid: true,
        planId,
      };
    }

    // 3. User is Free or subscription is expired/unpaid. Evaluate 10-Day Website Trial
    const createdAt = website.created_at ? new Date(website.created_at) : asOf;
    const ageMs = asOf.getTime() - createdAt.getTime();
    const remainingMs = TRIAL_DURATION_MS - ageMs;

    if (remainingMs > 0) {
      const daysRemaining = Math.max(1, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
      return {
        isPubliclyVisible: true,
        status: "trial_active",
        isOwnerPaid: false,
        daysRemaining,
        planId: "free",
      };
    }

    // 4. Trial has ended without an active paid subscription -> Public access is suspended
    return {
      isPubliclyVisible: false,
      status: "trial_expired_suspended",
      isOwnerPaid: false,
      daysRemaining: 0,
      reason: "10-day website trial has ended. Active paid subscription required for public hosting.",
      planId: "free",
    };
  } catch (err: any) {
    console.error(`[VisibilityGate] Unexpected error evaluating visibility for website ${website.id}:`, err?.message || err);
    // Fail closed on error to prevent unauthorized public leaks
    return {
      isPubliclyVisible: false,
      status: "error",
      isOwnerPaid: false,
      reason: "Security evaluation failure.",
    };
  }
}

/**
 * Returns clean, modern, responsive HTML for public visitors when a website is suspended.
 * Sets noindex, nofollow robots tags and directs the owner to log in to their dashboard.
 */
export function renderWebsiteSuspendedHTML(websiteTitle: string = "Website"): string {
  const sanitizedTitle = (websiteTitle || "Website")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Website Offline | Codeaxys</title>
  <meta name="robots" content="noindex, nofollow" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #0b0f19;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: linear-gradient(180deg, #131b2e 0%, #0e1626 100%);
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 24px;
      padding: 48px 36px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
    }
    .icon-wrap {
      width: 64px;
      height: 64px;
      margin: 0 auto 24px;
      border-radius: 20px;
      background: rgba(147, 51, 234, 0.12);
      border: 1px solid rgba(147, 51, 234, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
    }
    .site-tag {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 8px;
      background: rgba(148, 163, 184, 0.1);
      border: 1px solid rgba(148, 163, 184, 0.2);
      font-size: 13px;
      color: #cbd5e1;
      margin-bottom: 20px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #94a3b8;
      margin-bottom: 28px;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      padding: 12px 28px;
      border-radius: 12px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 14px 0 rgba(124, 58, 237, 0.4);
    }
    .btn:hover {
      opacity: 0.95;
      transform: translateY(-1px);
    }
    .footer {
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px solid rgba(148, 163, 184, 0.1);
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrap">🌐</div>
    <h1>Website Temporarily Offline</h1>
    <div class="site-tag">${sanitizedTitle}</div>
    <p>This website is currently offline. If you are the owner of this website, please log in to your Codeaxys dashboard to activate or renew your subscription and restore live public access.</p>
    <a href="https://codeaxys.com/login" class="btn">Website Owner Login →</a>
    <div class="footer">Hosted on Codeaxys AI Website Builder</div>
  </div>
</body>
</html>`;
}

/**
 * Resets a customer's monthly AI credits strictly to their plan allowance
 * upon a verified successful subscription renewal event.
 * INVARIANT: NO ROLLOVER. The existing balance is overwritten by the monthly allowance.
 */
export async function resetMonthlyAllowanceWithoutRollover(
  userId: string,
  planId: string,
  dbClient?: any
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  if (!userId) {
    return { success: false, newBalance: 0, error: "Missing userId" };
  }

  const normPlan = (planId || "free").toLowerCase().trim();
  const planConfig = PLANS[normPlan] || PLANS.free;
  const targetCredits = planConfig.monthlyCredits;
  const now = new Date().toISOString();

  try {
    const db = dbClient || createAdminClient();

    // 1. Reset user_credits balance strictly to plan monthly allowance (no carry-over)
    const { error: creditErr } = await db
      .from("user_credits")
      .upsert(
        {
          user_id: userId,
          balance: targetCredits,
          monthly_used: 0,
          last_refreshed_at: now,
          updated_at: now,
        },
        { onConflict: "user_id" }
      );

    if (creditErr) {
      console.error(`[CreditReset] Failed to reset credits for user ${userId}:`, creditErr.message);
      return { success: false, newBalance: 0, error: creditErr.message };
    }

    // 2. Log credit refresh event in ai_credit_transactions for financial auditing
    await db.from("ai_credit_transactions").insert({
      user_id: userId,
      credits_used: 0,
      action_type: "monthly_subscription_renewal_reset",
    });

    return { success: true, newBalance: targetCredits };
  } catch (err: any) {
    console.error(`[CreditReset] Unexpected error resetting credits for user ${userId}:`, err?.message || err);
    return { success: false, newBalance: 0, error: err?.message || "Unknown error" };
  }
}

export interface RetentionCleanupReport {
  timestamp: string;
  dryRun: boolean;
  scannedCount: number;
  eligibleForDeletionCount: number;
  preservedActivePaidCount: number;
  preservedWithinRetentionCount: number;
  simulatedDetails: Array<{
    websiteId: string;
    userId: string;
    title: string;
    daysExpired: number;
    eligibleForDeletion: boolean;
  }>;
}

/**
 * Safe retention cleanup engine for expired websites.
 * Operates in DRY-RUN mode by default to ensure zero customer data is destroyed.
 */
export async function processRetentionCleanup(options: {
  supabase?: any;
  dryRun?: boolean;
  asOfDate?: Date;
  batchLimit?: number;
} = {}): Promise<RetentionCleanupReport> {
  const db = options.supabase || createAdminClient();
  const isDryRun = options.dryRun !== false; // HARD-CODED DEFAULT: true
  const asOf = options.asOfDate || new Date();
  const limit = options.batchLimit || 50;

  const report: RetentionCleanupReport = {
    timestamp: asOf.toISOString(),
    dryRun: isDryRun,
    scannedCount: 0,
    eligibleForDeletionCount: 0,
    preservedActivePaidCount: 0,
    preservedWithinRetentionCount: 0,
    simulatedDetails: [],
  };

  try {
    // 1. Fetch websites
    const { data: websites, error: webErr } = await db
      .from("websites")
      .select("id, user_id, title, is_published, created_at, updated_at")
      .limit(limit);

    if (webErr || !websites) {
      console.error("[RetentionEngine] Websites scan error:", webErr?.message);
      return report;
    }

    report.scannedCount = websites.length;

    for (const site of websites) {
      // Fetch user's subscription
      const { data: sub } = await db
        .from("subscriptions")
        .select("id, plan_id, status, current_period_end, canceled_at, metadata")
        .eq("user_id", site.user_id)
        .maybeSingle();

      const planId = sub?.plan_id?.toLowerCase()?.trim() || "free";
      const isPaid = planId !== "free" && isSubscriptionActiveAndValid(sub, asOf);

      if (isPaid) {
        report.preservedActivePaidCount++;
        continue;
      }

      // Calculate days since expiration or trial end
      let referenceTime: number;
      if (sub?.current_period_end) {
        referenceTime = new Date(sub.current_period_end).getTime();
      } else if (site.created_at) {
        // Free account: expires 10 days after creation
        referenceTime = new Date(site.created_at).getTime() + TRIAL_DURATION_MS;
      } else {
        referenceTime = asOf.getTime();
      }

      const elapsedMs = asOf.getTime() - referenceTime;
      const daysElapsed = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

      if (daysElapsed > RETENTION_DURATION_DAYS) {
        // Eligible for cleanup after 90 days
        report.eligibleForDeletionCount++;
        report.simulatedDetails.push({
          websiteId: site.id,
          userId: site.user_id,
          title: site.title || "Untitled",
          daysExpired: daysElapsed,
          eligibleForDeletion: true,
        });

        if (!isDryRun) {
          console.warn(`[RetentionEngine] LIVE DELETION BLOCKED: Permanent customer deletion requires explicit management sign-off.`);
        }
      } else {
        report.preservedWithinRetentionCount++;
      }
    }

    return report;
  } catch (err: any) {
    console.error("[RetentionEngine] Unexpected error during retention scan:", err?.message || err);
    return report;
  }
}
