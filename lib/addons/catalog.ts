/**
 * Codeaxys AI Website Builder — Add-on Catalog
 * Centralized, typed catalog of optional paid add-ons.
 *
 * SAFETY INVARIANT: All add-ons are INACTIVE by default (status: "inactive", isApproved: false)
 * until explicitly reviewed and approved by finance & engineering.
 */

import { AddonDefinition } from "./types";

export const ADDON_CATALOG: Record<string, AddonDefinition> = {
  ai_visibility_tracker: {
    id: "ai_visibility_tracker",
    name: "AI Visibility & LLM Tracker",
    category: "seo",
    description:
      "Continuous tracking of brand citations, sentiment, and rankings across OpenAI, Perplexity, Claude, and Gemini with automated change alerts.",
    features: [
      "Multi-provider LLM rank & citation probing",
      "Coverage across OpenAI, Perplexity, Claude, and Gemini",
      "Daily sentiment and competitor share-of-voice tracking",
      "Automated probe monitoring via background cron",
    ],
    billingModel: "recurring_monthly",
    // Business and Agency include this natively in the base plan
    eligibleBasePlans: ["starter", "pro"],
    quotaConfig: {
      probesPerMonth: 60,
    },
    pricing: {
      monthlyPriceUnapproved: 299,
      annualPriceUnapproved: 2990,
      currency: "INR",
    },
    status: "inactive", // Inactive by default in Phase 1
    operationalStatus: "operational", // Backend adapters & credit-guard are functional
    isApproved: false,
    metadata: {
      underlyingProviders: ["openai", "perplexity", "claude", "gemini"],
      supportedCategories: ["informational", "commercial", "buyer_intent", "local", "competitor"],
    },
  },

  seo_autopilot_fix_agent: {
    id: "seo_autopilot_fix_agent",
    name: "SEO Autopilot & Fix Agent",
    category: "seo",
    description:
      "Autonomous background scanner that discovers on-page and technical SEO opportunities, auto-stages fixes, and applies self-healing code updates with 1-click rollback.",
    features: [
      "Weekly autonomous website architecture scans",
      "Automated staging of non-destructive metadata fixes",
      "1-click rollback via snapshot change history",
      "Automated audit logs in seo_autopilot_activity",
    ],
    billingModel: "recurring_monthly",
    // Business and Agency include this natively; Starter lacks AI SEO foundation
    eligibleBasePlans: ["pro"],
    quotaConfig: {
      fixesPerMonth: 20,
    },
    pricing: {
      monthlyPriceUnapproved: 399,
      annualPriceUnapproved: 3990,
      currency: "INR",
    },
    status: "inactive",
    operationalStatus: "operational",
    isApproved: false,
    metadata: {
      requiresBaseFeature: "ai_seo",
    },
  },

  white_label_agency_reports: {
    id: "white_label_agency_reports",
    name: "White-Label Agency Reports",
    category: "agency",
    description:
      "Generate custom-branded client SEO audit reports with your agency logo, primary brand colors, client name, and unbranded shareable links.",
    features: [
      "Custom agency branding, logo, and footer signature",
      "Unbranded client-facing shareable web report links",
      "Exportable white-label PDF executive summaries",
      "Zero Codeaxys platform attribution on client exports",
    ],
    billingModel: "recurring_monthly",
    // Agency plan includes this natively
    eligibleBasePlans: ["pro", "business"],
    quotaConfig: {},
    pricing: {
      monthlyPriceUnapproved: 499,
      annualPriceUnapproved: 4990,
      currency: "INR",
    },
    status: "inactive",
    operationalStatus: "operational",
    isApproved: false,
    metadata: {
      endpoint: "/api/websites/[id]/seo/reports/white-label",
    },
  },

  extra_website_slot: {
    id: "extra_website_slot",
    name: "Extra Website Slot (+1 Site)",
    category: "capacity",
    description:
      "Publish an additional live website with full hosting, custom domain connection, and automated SSL certificate without upgrading to the next base plan.",
    features: [
      "+1 active live website publishing allowance",
      "1 customer-owned custom domain connection included",
      "Independent analytics, blog engine, and media library",
      "Fast edge CDN hosting and automated SSL",
    ],
    billingModel: "recurring_monthly",
    eligibleBasePlans: ["starter", "pro", "business", "agency"],
    quotaConfig: {
      websites: 1,
    },
    pricing: {
      monthlyPriceUnapproved: 199,
      annualPriceUnapproved: 1990,
      currency: "INR",
    },
    status: "inactive",
    operationalStatus: "operational",
    isApproved: false,
    metadata: {
      quotaField: "max_websites",
      increment: 1,
    },
  },

  ai_credit_top_up_pack: {
    id: "ai_credit_top_up_pack",
    name: "AI Credit Top-Up Pack (+250 Credits)",
    category: "capacity",
    description:
      "One-time boost of 250 AI credits that never expire while your account remains active. Safely preserved across monthly subscription renewals.",
    features: [
      "250 non-expiring AI credits added to your balance",
      "Usable for website generation, AI editing, and blog creation",
      "Preserved across monthly subscription renewal cycles",
      "Instant activation upon payment confirmation",
    ],
    billingModel: "one_time_pack",
    eligibleBasePlans: ["free", "starter", "pro", "business", "agency"],
    quotaConfig: {
      credits: 250,
    },
    pricing: {
      oneTimePriceUnapproved: 199,
      currency: "INR",
    },
    status: "inactive",
    operationalStatus: "operational",
    isApproved: false,
    metadata: {
      accountingModel: "additive_non_expiring",
    },
  },

  media_storage_expansion: {
    id: "media_storage_expansion",
    name: "Media Storage Expansion (+10 GB)",
    category: "capacity",
    description:
      "Expand your media storage quota by 10 GB for images, assets, and website media uploads.",
    features: [
      "+10 GB cloud asset storage allowance",
      "High-speed global CDN delivery",
      "Full WebP image optimization pipeline",
      "Zero file count limits within storage quota",
    ],
    billingModel: "recurring_monthly",
    eligibleBasePlans: ["starter", "pro", "business", "agency"],
    quotaConfig: {
      storageBytes: 10737418240, // 10 GB
    },
    pricing: {
      monthlyPriceUnapproved: 149,
      annualPriceUnapproved: 1490,
      currency: "INR",
    },
    status: "inactive",
    operationalStatus: "operational",
    isApproved: false,
    metadata: {
      quotaField: "storage_limit_bytes",
      incrementBytes: 10737418240,
    },
  },

  digital_marketing_meta_suite: {
    id: "digital_marketing_meta_suite",
    name: "Digital Marketing Tools (Meta Ads Suite)",
    category: "marketing",
    description:
      "AI marketing campaign strategy generation, Meta Ad Account & Facebook Page discovery, and direct ad campaign publishing via Meta Graph API.",
    features: [
      "AI Meta Ads campaign strategy planner",
      "Automatic Meta Ad Account & Page discovery",
      "Direct campaign publishing with idempotency protection",
      "Conversion lead tracking & analytics synchronization",
    ],
    billingModel: "recurring_monthly",
    // Pro, Business, Agency include marketing plan generator natively
    eligibleBasePlans: ["starter"],
    quotaConfig: {},
    pricing: {
      monthlyPriceUnapproved: 349,
      annualPriceUnapproved: 3490,
      currency: "INR",
    },
    status: "inactive",
    // NOTE: Meta Ads publisher is operational; Google Ads campaign dispatch is explicitly unavailable/mock-only
    operationalStatus: "operational",
    isApproved: false,
    metadata: {
      operationalIntegrations: ["meta_graph_api"],
      unavailableIntegrations: ["google_ads_campaign_publishing"],
      googleAdsNotice:
        "Google Ads campaign publishing is mock-only/unavailable until OAuth and developer token certification are finalized.",
    },
  },
};

/**
 * Retrieves an add-on definition by ID from the catalog.
 */
export function getAddonDefinition(addonId: string): AddonDefinition | null {
  const normId = (addonId || "").toLowerCase().trim();
  return ADDON_CATALOG[normId] || null;
}

/**
 * Verifies whether a base plan is eligible to purchase a specific add-on.
 */
export function isAddonEligibleForPlan(addonId: string, basePlanId: string): boolean {
  const def = getAddonDefinition(addonId);
  if (!def) return false;
  const normPlan = (basePlanId || "free").toLowerCase().trim();
  return def.eligibleBasePlans.includes(normPlan);
}

/**
 * Returns all add-on definitions in the catalog.
 */
export function listAllAddons(): AddonDefinition[] {
  return Object.values(ADDON_CATALOG);
}

/**
 * Lists add-ons available for a specific base plan.
 */
export function listAddonsForPlan(basePlanId: string): AddonDefinition[] {
  const normPlan = (basePlanId || "free").toLowerCase().trim();
  return Object.values(ADDON_CATALOG).filter((addon) =>
    addon.eligibleBasePlans.includes(normPlan)
  );
}

/**
 * Checks whether an add-on is active and approved for customer purchase.
 * In Phase 1, all add-ons must return false.
 */
export function isAddonPurchaseable(addonId: string): boolean {
  const def = getAddonDefinition(addonId);
  if (!def) return false;
  return def.status === "active" && def.isApproved === true;
}
