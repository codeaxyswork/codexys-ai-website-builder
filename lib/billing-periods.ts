import { PLANS, PlanConfig } from "./constants";

export type BillingInterval = "monthly" | "yearly" | "triennial";

export interface BillingPeriodDefinition {
  interval: BillingInterval;
  durationMonths: number;
  discountPercent: number;
  label: string;
  badgeLabel: string;
}

export const BILLING_INTERVALS: Record<BillingInterval, BillingPeriodDefinition> = {
  monthly: {
    interval: "monthly",
    durationMonths: 1,
    discountPercent: 0,
    label: "Monthly",
    badgeLabel: "Standard",
  },
  yearly: {
    interval: "yearly",
    durationMonths: 12,
    discountPercent: 16.67,
    label: "12 Months",
    badgeLabel: "16.7% Off",
  },
  triennial: {
    interval: "triennial",
    durationMonths: 36,
    discountPercent: 35.0,
    label: "36 Months",
    badgeLabel: "35% Off",
  },
};

export interface DomainOfferPolicy {
  maxFreeDomains: number; // Strictly 1 across all plans
  freeDurationYears: number; // 1 (First year registration is free)
  eligibleInterval: BillingInterval; // "triennial" (36-month prepaid only)
  eligibleExtensions: string[]; // [".com", ".in", ".net", ".org"]
  isOptional: boolean; // true (Customer can decline)
}

export const APPROVED_DOMAIN_OFFER_POLICY: DomainOfferPolicy = {
  maxFreeDomains: 1,
  freeDurationYears: 1,
  eligibleInterval: "triennial",
  eligibleExtensions: [".com", ".in", ".net", ".org"],
  isOptional: true,
};

export interface PlanBillingCalculation {
  planId: string;
  planName: string;
  currency: string;
  interval: BillingInterval;
  durationMonths: number;
  baseMonthlyPrice: number;
  grossTotal: number;
  referencePrice: number; // monthly price × durationMonths (struck-through reference price for 12m / 36m)
  discountPercent: number;
  discountAmount: number;
  savingsAmount: number; // referencePrice - finalTotal
  savingsPercentFormatted: string;
  finalTotal: number;
  effectiveMonthlyPrice: number;
  monthlyCredits: number;
  maxWebsites: number;
  upfrontChargeNotice: string; // Plain-language disclosure that full amount is charged upfront
  renewalNotice: string; // Plain-language renewal frequency and amount
  // Domain policy separation
  customDomainConnectionLimit: number; // Customer-owned domain connections (Starter 1, Pro 3, Business 6, Agency 15)
  qualifiesForDomainOffer: boolean; // Only true for 36-month (triennial) paid plans
  freeDomainRegistrationCount: number; // Maximum 1 across ALL plans under 36-month offer; 0 if declined or non-36m
  domainOfferDetails: {
    eligible: boolean;
    optedIn: boolean;
    maxFreeDomains: number; // Always 1 across all plans
    freeYears: number; // 1 (First year registration is free)
    eligibleExtensions: string[];
    renewalNotice: string;
  };
}

/**
 * Normalizes user-submitted or URL interval strings into strict BillingInterval.
 * Accepts exact standard names and common aliases:
 * - "monthly" / "month"
 * - "12 months" / "12months" / "12m" / "yearly" / "annual"
 * - "36 months" / "36months" / "36m" / "triennial" / "3years"
 */
export function normalizeBillingInterval(rawInterval?: string | null): BillingInterval {
  const norm = (rawInterval || "").toLowerCase().trim();
  if (
    norm === "yearly" ||
    norm === "annual" ||
    norm === "12_months" ||
    norm === "12months" ||
    norm === "12 months" ||
    norm === "12m" ||
    norm === "12-months"
  ) {
    return "yearly";
  }
  if (
    norm === "triennial" ||
    norm === "36_months" ||
    norm === "36months" ||
    norm === "36 months" ||
    norm === "36m" ||
    norm === "36-months" ||
    norm === "3years"
  ) {
    return "triennial";
  }
  return "monthly";
}

/**
 * Calculates pricing for a given plan and billing interval according to approved financial model:
 * - Monthly: 0% discount
 * - 12 Months: 16.67% discount (10 months charged for 12 months)
 * - 36 Months: 35% discount (prepaid software subscription)
 *
 * Domain Policy:
 * - Every eligible paid plan receives a MAXIMUM of ONE (1) free eligible custom domain
 *   under the qualifying 36-month prepaid domain offer.
 * - Starter: max 1
 * - Pro: max 1
 * - Business: max 1
 * - Agency: max 1
 * - The domain offer is optional. Customers who decline the domain offer pay strictly the software subscription amount.
 * - Multiple websites / custom domain connections do NOT grant multiple free domain registrations.
 */
export function calculatePlanPrice(
  planId: string,
  rawInterval?: string | null,
  options?: { optInDomainOffer?: boolean }
): PlanBillingCalculation {
  const normPlanId = (planId || "starter").toLowerCase().trim();
  const plan: PlanConfig = PLANS[normPlanId] || PLANS.starter;
  const interval = normalizeBillingInterval(rawInterval);
  const baseMonthlyPrice = plan.price;

  let durationMonths = 1;
  let grossTotal = baseMonthlyPrice;
  let discountPercent = 0;
  let finalTotal = baseMonthlyPrice;

  if (interval === "yearly") {
    durationMonths = 12;
    grossTotal = baseMonthlyPrice * 12;
    discountPercent = 16.67;
    // Exactly 10 months billed for 12 months
    finalTotal = baseMonthlyPrice * 10;
  } else if (interval === "triennial") {
    durationMonths = 36;
    grossTotal = baseMonthlyPrice * 36;
    discountPercent = 35.0;
    // Exactly 35% discount on software
    finalTotal = Math.round(baseMonthlyPrice * 36 * 0.65);
  }

  const discountAmount = grossTotal - finalTotal;
  const effectiveMonthlyPrice =
    durationMonths > 1
      ? Math.round((finalTotal / durationMonths) * 100) / 100
      : baseMonthlyPrice;

  const isPaidPlan = plan.id !== "free";
  const qualifiesForDomainOffer = interval === "triennial" && isPaidPlan;
  // Domain offer is optional; customer can opt-in or decline. Default is false (software only)
  const optedIn = Boolean(options?.optInDomainOffer && qualifiesForDomainOffer);

  // APPROVED DOMAIN POLICY:
  // Every eligible paid plan receives a MAXIMUM of ONE (1) free eligible custom domain
  // under the qualifying 36-month prepaid offer.
  // Starter: max 1
  // Pro: max 1 (NOT 3)
  // Business: max 1 (NOT 6)
  // Agency: max 1 (NOT 15)
  // Website connection limits do NOT grant multiple free domain registrations.
  const freeDomainRegistrationCount = optedIn ? 1 : 0;

  // Custom domain connection limit (for connecting customer-owned domains):
  const customDomainConnectionLimit = plan.id === "free" ? 0 : plan.maxWebsites;

  // Clear plain-language disclosures for upfront payments vs monthly equivalents
  const upfrontChargeNotice =
    interval === "yearly"
      ? `Billed upfront as ₹${finalTotal.toLocaleString("en-IN")} for 12 months`
      : interval === "triennial"
      ? `Billed upfront as ₹${finalTotal.toLocaleString("en-IN")} for 36 months`
      : `Billed monthly at ₹${baseMonthlyPrice.toLocaleString("en-IN")}`;

  const renewalNotice =
    interval === "yearly"
      ? `Renews every 12 months at ₹${finalTotal.toLocaleString("en-IN")} unless canceled`
      : interval === "triennial"
      ? `Renews every 36 months at ₹${finalTotal.toLocaleString("en-IN")} unless canceled`
      : `Renews every month at ₹${baseMonthlyPrice.toLocaleString("en-IN")} unless canceled`;

  const savingsPercentFormatted =
    interval === "yearly" ? "16.7%" : interval === "triennial" ? "35%" : "0%";

  return {
    planId: plan.id,
    planName: plan.name,
    currency: plan.currency || "INR",
    interval,
    durationMonths,
    baseMonthlyPrice,
    grossTotal,
    referencePrice: grossTotal,
    discountPercent,
    discountAmount,
    savingsAmount: discountAmount,
    savingsPercentFormatted,
    finalTotal,
    effectiveMonthlyPrice,
    monthlyCredits: plan.monthlyCredits,
    maxWebsites: plan.maxWebsites,
    upfrontChargeNotice,
    renewalNotice,
    customDomainConnectionLimit,
    qualifiesForDomainOffer,
    freeDomainRegistrationCount,
    domainOfferDetails: {
      eligible: qualifiesForDomainOffer,
      optedIn,
      maxFreeDomains: qualifiesForDomainOffer ? APPROVED_DOMAIN_OFFER_POLICY.maxFreeDomains : 0,
      freeYears: APPROVED_DOMAIN_OFFER_POLICY.freeDurationYears,
      eligibleExtensions: APPROVED_DOMAIN_OFFER_POLICY.eligibleExtensions,
      renewalNotice:
        "First-year registration is 100% free for eligible standard extensions (.com, .in, .net, .org). Years 2 and 3 domain renewal charges apply separately at standard registrar rates.",
    },
  };
}

/**
 * Calculates the exact future current_period_end date based on billing interval.
 * - Monthly: 30 days
 * - Yearly: 1 calendar year (12 months)
 * - Triennial: 3 calendar years (36 months)
 */
export function calculatePeriodEndDate(startDate: Date, interval: BillingInterval): Date {
  const endDate = new Date(startDate.getTime());
  if (interval === "yearly") {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else if (interval === "triennial") {
    endDate.setFullYear(endDate.getFullYear() + 3);
  } else {
    endDate.setDate(endDate.getDate() + 30);
  }
  return endDate;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Checks whether an active subscription is due for its periodic monthly AI credit replenishment.
 * Annual and 36-month subscriptions receive normal monthly credits every 30 days.
 * Credits never roll over.
 */
export function isCreditReplenishmentDue(
  subscription: {
    status?: string;
    current_period_end?: string | Date | null;
    last_credit_refreshed_at?: string | Date | null;
    current_period_start?: string | Date | null;
  },
  asOf: Date = new Date()
): boolean {
  if (!subscription || subscription.status !== "active") {
    return false;
  }

  const periodEndMs = subscription.current_period_end
    ? new Date(subscription.current_period_end).getTime()
    : 0;

  // Subscription must still be actively within its paid period
  if (periodEndMs < asOf.getTime()) {
    return false;
  }

  const lastRefreshedMs = subscription.last_credit_refreshed_at
    ? new Date(subscription.last_credit_refreshed_at).getTime()
    : subscription.current_period_start
    ? new Date(subscription.current_period_start).getTime()
    : 0;

  if (isNaN(lastRefreshedMs) || lastRefreshedMs === 0) {
    return true;
  }

  // Due if 30 days have elapsed since last credit refresh
  return asOf.getTime() - lastRefreshedMs >= THIRTY_DAYS_MS;
}
