export type FeatureKey =
  | "basic_seo"
  | "ai_seo"
  | "advanced_schema"
  | "analytics"
  | "advanced_integrations";

export interface PlanFeatures {
  basic_seo: boolean;
  ai_seo: boolean;
  advanced_schema: boolean;
  analytics: boolean;
  advanced_integrations: boolean;
}

export const PLAN_PERMISSIONS: Record<string, PlanFeatures> = {
  free: {
    basic_seo: true,
    ai_seo: false,
    advanced_schema: false,
    analytics: false,
    advanced_integrations: false,
  },
  starter: {
    basic_seo: true,
    ai_seo: false,
    advanced_schema: false,
    analytics: false,
    advanced_integrations: false,
  },
  pro: {
    basic_seo: true,
    ai_seo: true,
    advanced_schema: true,
    analytics: true,
    advanced_integrations: false,
  },
  business: {
    basic_seo: true,
    ai_seo: true,
    advanced_schema: true,
    analytics: true,
    advanced_integrations: false,
  },
  agency: {
    basic_seo: true,
    ai_seo: true,
    advanced_schema: true,
    analytics: true,
    advanced_integrations: true,
  },
};

export function canUseFeature(
  planId: string | undefined | null,
  feature: FeatureKey,
  activeAddonIds?: string[]
): boolean {
  const normalizedPlan = (planId || "free").toLowerCase().trim();
  const plan = PLAN_PERMISSIONS[normalizedPlan] || PLAN_PERMISSIONS.free;
  if (Boolean(plan[feature])) {
    return true;
  }
  if (Array.isArray(activeAddonIds) && activeAddonIds.length > 0) {
    if (feature === "ai_seo" && activeAddonIds.includes("seo_autopilot_fix_agent")) return true;
    if (feature === "advanced_schema" && activeAddonIds.includes("seo_autopilot_fix_agent")) return true;
    if (feature === "advanced_integrations" && activeAddonIds.includes("white_label_agency_reports")) return true;
  }
  return false;
}

export function isAdvancedSeoPlan(planId: string | undefined | null): boolean {
  return canUseFeature(planId, "ai_seo");
}

export function isAgencyPlan(planId: string | undefined | null): boolean {
  return canUseFeature(planId, "advanced_integrations");
}
