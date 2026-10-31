/**
 * Codeaxys AI Website Builder — Unified Premium Features Bundle Specification
 *
 * GOVERNANCE RULES:
 * 1. Single optional bundle within the unified plan-selection experience.
 * 2. Tailored to the selected base plan: only includes verified capabilities
 *    that the base plan does NOT already provide. Never charges twice for
 *    features already included in that plan.
 * 3. Bundle pricing remains UNAPPROVED (Phase 2 Preview). Displays as preview-only
 *    with price clearly labeled as "Pricing Pending Approval (₹0 Billed Today)".
 * 4. Synchronizes interval (Monthly, 12 Months, 36 Months) with the base plan selection.
 */

import { BillingInterval } from "@/lib/billing-periods";

export interface PremiumBundleFeature {
  id: string;
  name: string;
  category: "seo" | "automation" | "agency" | "marketing";
  description: string;
  isVerifiedLive: boolean;
}

export interface PlanBundlePreview {
  planId: string;
  planName: string;
  interval: BillingInterval;
  intervalLabel: string;
  bundleTitle: string;
  badgeLabel: string;
  status: "pending_approval";
  isApproved: false;
  priceAmount: number; // Strictly 0 in preview mode
  priceDisplay: string;
  featuresIncluded: PremiumBundleFeature[];
  featuresAlreadyInBasePlan: string[];
  alreadyFullyIncluded: boolean;
  disclosureNotice: string;
  renewalNotice: string;
}

// Master pool of candidate premium capabilities
const MASTER_BUNDLE_FEATURES: Record<string, PremiumBundleFeature> = {
  ai_visibility_tracker: {
    id: "ai_visibility_tracker",
    name: "Multi-Engine AI Visibility Tracker",
    category: "seo",
    description: "Monitor domain presence, sentiment, and prompt rankings across OpenAI ChatGPT, Perplexity, Google Gemini, and Anthropic Claude.",
    isVerifiedLive: true,
  },
  seo_autopilot_fix_agent: {
    id: "seo_autopilot_fix_agent",
    name: "Autonomous SEO Autopilot & Fix Agent",
    category: "automation",
    description: "Automated background health scanning, intelligent meta fixes, schema repairs, and one-click code enhancements.",
    isVerifiedLive: true,
  },
  ai_seo_suggestions: {
    id: "ai_seo_suggestions",
    name: "AI SEO Suggestions & Content Studio",
    category: "seo",
    description: "Real-time AI-powered on-page content optimization, keyword intent targeting, and SEO recommendations.",
    isVerifiedLive: true,
  },
  advanced_schema_engine: {
    id: "advanced_schema_engine",
    name: "JSON-LD Structured Data & Rich Snippets",
    category: "seo",
    description: "Automated schema markup generation for Organizations, Local Businesses, FAQs, and Breadcrumbs.",
    isVerifiedLive: true,
  },
  technical_crawl_diagnostics: {
    id: "technical_crawl_diagnostics",
    name: "Deep Technical Site Crawl & Diagnostics",
    category: "seo",
    description: "Comprehensive multi-page crawl analyzing broken links, redirect chains, Core Web Vitals, and indexing issues.",
    isVerifiedLive: true,
  },
  competitor_tracking_studio: {
    id: "competitor_tracking_studio",
    name: "Competitor Domain Tracking & Gap Analysis",
    category: "seo",
    description: "Track competitor organic positions, keyword gaps, and topical authority opportunities.",
    isVerifiedLive: true,
  },
  white_label_agency_reports: {
    id: "white_label_agency_reports",
    name: "White-Label Agency Client Reports",
    category: "agency",
    description: "Custom-branded, client-ready PDF performance reports with custom agency logos and scheduled email delivery.",
    isVerifiedLive: true,
  },
  agency_third_party_integrations: {
    id: "agency_third_party_integrations",
    name: "Advanced Third-Party SEO Integrations & GSC Sync",
    category: "agency",
    description: "Direct Google Search Console synchronization, crawl data webhooks, and third-party SEO analytics connections.",
    isVerifiedLive: true,
  },
  digital_marketing_meta_suite: {
    id: "digital_marketing_meta_suite",
    name: "Digital Marketing & Meta Ads Planner",
    category: "marketing",
    description: "AI-driven ad copy generation, campaign structure planning, and audience target recommendations.",
    isVerifiedLive: true,
  },
};

/**
 * Returns a plan-tailored Premium Features Bundle preview.
 *
 * Rules:
 * - Starter: Lacks advanced SEO, schema, technical crawl, competitor tracking, AI visibility, autopilot, and marketing.
 * - Pro: Natively includes AI SEO, schema, crawl, competitor tracking, AI visibility, and marketing.
 *        Bundle adds: SEO Autopilot, White-Label Reports, and Third-Party Integrations.
 * - Business: Natively includes everything in Pro + SEO Autopilot.
 *        Bundle adds: White-Label Reports and Third-Party Integrations.
 * - Agency: Natively includes ALL verified premium capabilities.
 *        Bundle indicates 100% included (no double-charge).
 */
export function getPlanBundleDefinition(
  planId: string,
  interval: BillingInterval = "yearly"
): PlanBundlePreview {
  const normPlan = (planId || "starter").toLowerCase().trim();
  const intervalLabel =
    interval === "yearly"
      ? "12 Months"
      : interval === "triennial"
      ? "36 Months"
      : "Monthly";

  if (normPlan === "agency") {
    return {
      planId: "agency",
      planName: "Agency",
      interval,
      intervalLabel,
      bundleTitle: "Marketing & Growth Features Bundle (All Included)",
      badgeLabel: "Included Natively",
      status: "pending_approval",
      isApproved: false,
      priceAmount: 0,
      priceDisplay: "Included in Agency Base Plan (₹0 Extra)",
      featuresIncluded: [],
      featuresAlreadyInBasePlan: [
        "Multi-Engine AI Visibility Tracker",
        "Autonomous SEO Autopilot & Fix Agent",
        "AI SEO Suggestions & Content Studio",
        "JSON-LD Structured Data & Rich Snippets",
        "Deep Technical Site Crawl & Diagnostics",
        "Competitor Domain Tracking & Gap Analysis",
        "White-Label Agency Client Reports",
        "Advanced Third-Party SEO Integrations & GSC Sync",
        "Digital Marketing & Meta Ads Planner",
      ],
      alreadyFullyIncluded: true,
      disclosureNotice:
        "All verified premium capabilities are already natively included in your Agency plan at no additional cost. You will never be double-charged for bundle features.",
      renewalNotice: "Included natively in subscription.",
    };
  }

  if (normPlan === "business") {
    const includedFeatures = [
      MASTER_BUNDLE_FEATURES.white_label_agency_reports,
      MASTER_BUNDLE_FEATURES.agency_third_party_integrations,
    ];
    return {
      planId: "business",
      planName: "Business",
      interval,
      intervalLabel,
      bundleTitle: "Marketing & Growth Features Bundle (Business Edition)",
      badgeLabel: "Preview · Pricing Pending Approval",
      status: "pending_approval",
      isApproved: false,
      priceAmount: 0,
      priceDisplay: "Pricing Pending Approval (₹0 Billed Today)",
      featuresIncluded: includedFeatures,
      featuresAlreadyInBasePlan: [
        "Autonomous SEO Autopilot & Fix Agent (Included in Business)",
        "Multi-Engine AI Visibility Tracker (Included in Business)",
        "AI SEO Suggestions & Content Studio (Included in Business)",
        "JSON-LD Structured Data & Rich Snippets (Included in Business)",
        "Deep Technical Site Crawl & Diagnostics (Included in Business)",
        "Competitor Domain Tracking & Gap Analysis (Included in Business)",
        "Digital Marketing & Meta Ads Planner (Included in Business)",
      ],
      alreadyFullyIncluded: false,
      disclosureNotice:
        "Preview-only bundle tailored for Business subscribers. Bundle features exclude all capabilities already provided by your Business plan so you are never charged twice.",
      renewalNotice:
        "Pricing is pending formal approval. Preview activations do not charge customers.",
    };
  }

  if (normPlan === "pro") {
    const includedFeatures = [
      MASTER_BUNDLE_FEATURES.seo_autopilot_fix_agent,
      MASTER_BUNDLE_FEATURES.white_label_agency_reports,
      MASTER_BUNDLE_FEATURES.agency_third_party_integrations,
    ];
    return {
      planId: "pro",
      planName: "Pro",
      interval,
      intervalLabel,
      bundleTitle: "Marketing & Growth Features Bundle (Pro Edition)",
      badgeLabel: "Preview · Pricing Pending Approval",
      status: "pending_approval",
      isApproved: false,
      priceAmount: 0,
      priceDisplay: "Pricing Pending Approval (₹0 Billed Today)",
      featuresIncluded: includedFeatures,
      featuresAlreadyInBasePlan: [
        "Multi-Engine AI Visibility Tracker (Included in Pro)",
        "AI SEO Suggestions & Content Studio (Included in Pro)",
        "JSON-LD Structured Data & Rich Snippets (Included in Pro)",
        "Deep Technical Site Crawl & Diagnostics (Included in Pro)",
        "Competitor Domain Tracking & Gap Analysis (Included in Pro)",
        "Digital Marketing & Meta Ads Planner (Included in Pro)",
      ],
      alreadyFullyIncluded: false,
      disclosureNotice:
        "Preview-only bundle tailored for Pro subscribers. Excludes all capabilities already provided by your Pro subscription to guarantee zero duplicate charges.",
      renewalNotice:
        "Pricing is pending formal approval. Preview activations do not charge customers.",
    };
  }

  // Default: Starter plan bundle
  const starterFeatures = [
    MASTER_BUNDLE_FEATURES.ai_visibility_tracker,
    MASTER_BUNDLE_FEATURES.seo_autopilot_fix_agent,
    MASTER_BUNDLE_FEATURES.ai_seo_suggestions,
    MASTER_BUNDLE_FEATURES.advanced_schema_engine,
    MASTER_BUNDLE_FEATURES.technical_crawl_diagnostics,
    MASTER_BUNDLE_FEATURES.competitor_tracking_studio,
    MASTER_BUNDLE_FEATURES.digital_marketing_meta_suite,
  ];

  return {
    planId: "starter",
    planName: "Starter",
    interval,
    intervalLabel,
    bundleTitle: "Marketing & Growth Features Bundle (Starter Edition)",
    badgeLabel: "Preview · Pricing Pending Approval",
    status: "pending_approval",
    isApproved: false,
    priceAmount: 0,
    priceDisplay: "Pricing Pending Approval (₹0 Billed Today)",
    featuresIncluded: starterFeatures,
    featuresAlreadyInBasePlan: [
      "AI Website Builder & Visual Canvas (Included in Starter)",
      "Basic SEO Essentials & Sitemaps (Included in Starter)",
      "1 Custom Domain Connection (Included in Starter)",
      "100 Monthly AI Credits (Included in Starter)",
    ],
    alreadyFullyIncluded: false,
    disclosureNotice:
      "Preview-only bundle tailored for Starter subscribers. Unlocks Advanced SEO, AI Visibility, and Autopilot without double-charging for Starter's native Basic SEO.",
    renewalNotice:
      "Pricing is pending formal approval. Preview activations do not charge customers.",
  };
}
