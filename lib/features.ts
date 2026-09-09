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
  pro: {
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

export function canUseFeature(planId: string | undefined | null, feature: FeatureKey): boolean {
  const normalizedPlan = (planId || "free").toLowerCase();
  const plan = PLAN_PERMISSIONS[normalizedPlan] || PLAN_PERMISSIONS.free;
  return Boolean(plan[feature]);
}
