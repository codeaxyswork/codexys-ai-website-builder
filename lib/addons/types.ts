/**
 * Codeaxys AI Website Builder — Add-on Pricing & Entitlement Foundation
 * Types & Domain Model
 */

export type AddonCategory = "seo" | "marketing" | "agency" | "capacity";

export type AddonBillingModel = "recurring_monthly" | "recurring_annual" | "one_time_pack";

export type AddonCatalogStatus = "inactive" | "active" | "mock_only";

export type AddonOperationalStatus = "operational" | "partially_implemented" | "unavailable";

export type UserAddonStatus = "active" | "canceled" | "past_due" | "expired";

export type AddonBillingInterval = "monthly" | "yearly" | "annual" | "one_time";

export interface AddonQuotaConfig {
  credits?: number;
  websites?: number;
  storageBytes?: number;
  probesPerMonth?: number;
  fixesPerMonth?: number;
}

export interface AddonDefinition {
  id: string;
  name: string;
  category: AddonCategory;
  description: string;
  features: string[];
  billingModel: AddonBillingModel;
  eligibleBasePlans: string[]; // Base plan IDs eligible to purchase this add-on
  quotaConfig: AddonQuotaConfig;
  pricing: {
    monthlyPriceUnapproved?: number; // In INR; unapproved in Phase 1
    annualPriceUnapproved?: number;  // In INR; unapproved in Phase 1
    oneTimePriceUnapproved?: number; // In INR; unapproved in Phase 1
    currency: "INR";
  };
  status: AddonCatalogStatus;
  operationalStatus: AddonOperationalStatus;
  isApproved: boolean; // Always false in Phase 1 until cost model approval
  metadata?: Record<string, any>;
}

export interface UserAddonRecord {
  id: string;
  user_id: string;
  addon_id: string;
  status: UserAddonStatus;
  billing_interval: AddonBillingInterval;
  current_period_start: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  price_paid: number;
  currency: string;
  metadata: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface EffectiveEntitlementResult {
  allowed: boolean;
  grantedBy: "base_plan" | "addon" | "none";
  addonId?: string;
  reason?: string;
}

export interface EffectiveQuotas {
  websitesLimit: number;
  storageLimitBytes: number;
  monthlyCreditsAllowance: number;
  purchasedCreditsBalance: number;
  totalCreditsBalance: number;
}
