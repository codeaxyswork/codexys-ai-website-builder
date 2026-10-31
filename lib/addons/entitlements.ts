/**
 * Codeaxys AI Website Builder — Add-on Entitlement Engine
 * Evaluates active add-on subscriptions, status, expiry, and plan eligibility.
 *
 * SECURITY INVARIANT: Fail-closed. An add-on is never granted based solely on
 * client-supplied parameters; it must be verified against server-side records.
 */

import { UserAddonRecord, EffectiveEntitlementResult, EffectiveQuotas } from "./types";
import { getAddonDefinition, isAddonEligibleForPlan } from "./catalog";
import { canUseFeature, FeatureKey } from "@/lib/features";
import { PLANS } from "@/lib/constants";

/**
 * Validates whether an individual user add-on record grants active entitlement.
 *
 * Rules:
 * 1. Must be a non-null object.
 * 2. status === 'active':
 *    - For one_time purchases, remains active unless explicitly expired/consumed.
 *    - For recurring (monthly/yearly), current_period_end must be >= asOf (or null).
 * 3. status === 'canceled':
 *    - If cancel_at_period_end is true and current_period_end >= asOf, access is
 *      preserved until the end of the paid billing period.
 *    - If cancel_at_period_end is false or current_period_end < asOf, returns false.
 * 4. Any other status ('past_due', 'expired', etc.) returns false.
 */
export function isUserAddonActiveAndValid(
  record: UserAddonRecord | null | undefined,
  asOf: Date = new Date()
): boolean {
  if (!record || typeof record !== "object") {
    return false;
  }

  const status = (record.status || "").toLowerCase().trim();
  const now = asOf.getTime();

  // Validate period end date if present
  let periodEndMs: number | null = null;
  if (record.current_period_end) {
    const parsed = new Date(record.current_period_end).getTime();
    if (isNaN(parsed)) {
      return false; // Invalid date fails closed
    }
    periodEndMs = parsed;
  }

  // 1. One-time purchases remain active unless explicitly marked otherwise
  if (record.billing_interval === "one_time") {
    return status === "active";
  }

  // 2. Active recurring subscriptions
  if (status === "active") {
    if (periodEndMs !== null && periodEndMs < now) {
      return false; // Expired
    }
    return true;
  }

  // 3. Canceled recurring subscriptions with grace period
  if (status === "canceled") {
    if (record.cancel_at_period_end && periodEndMs !== null && periodEndMs >= now) {
      return true; // Active until period end
    }
    return false;
  }

  // 4. Any other status fails closed
  return false;
}

/**
 * Feature-to-Addon Mapping Table
 * Declares which add-on ID(s) can satisfy a particular capability.
 */
export const FEATURE_TO_ADDON_MAP: Record<string, string[]> = {
  ai_visibility: ["ai_visibility_tracker"],
  seo_autopilot: ["seo_autopilot_fix_agent"],
  ai_seo: ["seo_autopilot_fix_agent"],
  advanced_schema: ["seo_autopilot_fix_agent"],
  white_label_reports: ["white_label_agency_reports"],
  advanced_integrations: ["white_label_agency_reports"],
  extra_website: ["extra_website_slot"],
  extra_storage: ["media_storage_expansion"],
  ai_credits_topup: ["ai_credit_top_up_pack"],
  marketing_meta: ["digital_marketing_meta_suite"],
};

/**
 * Evaluates whether a user has access to a feature, considering both their
 * base plan entitlement and any active, eligible add-ons.
 * Pure functional evaluation for deterministic unit testing.
 */
export function evaluateEffectiveFeatureAccess(
  basePlanId: string,
  feature: FeatureKey | string,
  userAddons: UserAddonRecord[] = [],
  asOf: Date = new Date()
): EffectiveEntitlementResult {
  const normPlan = (basePlanId || "free").toLowerCase().trim();

  // 1. Check if base plan natively includes this feature
  if (["basic_seo", "ai_seo", "advanced_schema", "analytics", "advanced_integrations"].includes(feature)) {
    if (canUseFeature(normPlan, feature as FeatureKey)) {
      return {
        allowed: true,
        grantedBy: "base_plan",
      };
    }
  }

  // 2. Feature-specific native base-plan checks
  if (feature === "ai_visibility" && ["pro", "business", "agency"].includes(normPlan)) {
    return { allowed: true, grantedBy: "base_plan" };
  }
  if (feature === "seo_autopilot" && ["business", "agency"].includes(normPlan)) {
    return { allowed: true, grantedBy: "base_plan" };
  }
  if (feature === "marketing_meta" && ["pro", "business", "agency"].includes(normPlan)) {
    return { allowed: true, grantedBy: "base_plan" };
  }
  if (feature === "white_label_reports" && normPlan === "agency") {
    return { allowed: true, grantedBy: "base_plan" };
  }

  // 3. Check active add-ons
  const candidateAddonIds = FEATURE_TO_ADDON_MAP[feature] || [];
  for (const addonRecord of userAddons) {
    if (candidateAddonIds.includes(addonRecord.addon_id)) {
      // Must be currently active and not expired
      if (isUserAddonActiveAndValid(addonRecord, asOf)) {
        // Must be eligible for the user's base plan
        if (isAddonEligibleForPlan(addonRecord.addon_id, normPlan)) {
          return {
            allowed: true,
            grantedBy: "addon",
            addonId: addonRecord.addon_id,
          };
        }
      }
    }
  }

  // 4. Denied
  return {
    allowed: false,
    grantedBy: "none",
    reason: `Feature '${feature}' requires a plan upgrade or an active eligible add-on subscription.`,
  };
}

/**
 * Server-side helper to fetch and filter active user add-ons from database.
 * Fails closed on database error or missing user.
 */
export async function getUserActiveAddons(
  userId: string,
  supabaseClient?: any,
  asOf: Date = new Date()
): Promise<UserAddonRecord[]> {
  if (!userId) return [];

  try {
    let client = supabaseClient;
    if (!client) {
      const { createClient } = await import("@/utils/supabase/server");
      client = await createClient();
    }

    const { data: rows, error } = await client
      .from("user_addons")
      .select("*")
      .eq("user_id", userId);

    if (error || !Array.isArray(rows)) {
      console.warn(`[AddonEntitlement] Failed to query user_addons for ${userId}:`, error?.message);
      return [];
    }

    return (rows as UserAddonRecord[]).filter((record) =>
      isUserAddonActiveAndValid(record, asOf)
    );
  } catch (err: any) {
    console.error(`[AddonEntitlement] Exception in getUserActiveAddons for ${userId}:`, err?.message);
    return [];
  }
}

/**
 * Computes effective quotas (websites, storage, credits) by combining
 * base plan limits with active capacity add-ons.
 */
export function calculateEffectiveUsageQuotas(
  basePlanId: string,
  baseUsage: {
    maxWebsites: number;
    storageBytes: number;
    monthlyCredits: number;
    currentBalance: number;
    purchasedCreditsBalance?: number;
  },
  activeAddons: UserAddonRecord[] = [],
  asOf: Date = new Date()
): EffectiveQuotas {
  const normPlan = (basePlanId || "free").toLowerCase().trim();
  const planConfig = PLANS[normPlan] || PLANS.free;

  let extraWebsites = 0;
  let extraStorageBytes = 0;

  for (const record of activeAddons) {
    if (!isUserAddonActiveAndValid(record, asOf)) continue;

    const def = getAddonDefinition(record.addon_id);
    if (!def) continue;

    if (def.quotaConfig.websites) {
      extraWebsites += def.quotaConfig.websites;
    }
    if (def.quotaConfig.storageBytes) {
      extraStorageBytes += def.quotaConfig.storageBytes;
    }
  }

  const purchasedBal = baseUsage.purchasedCreditsBalance || 0;

  return {
    websitesLimit: (baseUsage.maxWebsites || planConfig.maxWebsites) + extraWebsites,
    storageLimitBytes: (baseUsage.storageBytes || planConfig.storageLimitBytes) + extraStorageBytes,
    monthlyCreditsAllowance: baseUsage.monthlyCredits || planConfig.monthlyCredits,
    purchasedCreditsBalance: purchasedBal,
    totalCreditsBalance: baseUsage.currentBalance + purchasedBal,
  };
}
