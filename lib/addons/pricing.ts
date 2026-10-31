/**
 * Codeaxys AI Website Builder — Add-on Pricing & Cart Calculation Interface
 * Calculates multi-item checkout breakdowns: Base Subscription + Selected Add-ons.
 *
 * SAFETY INVARIANT: Add-on checkout is DISABLED in Phase 1.
 * Add-on prices are unapproved placeholders and cannot be charged to customers.
 */

import {
  BillingInterval,
  PlanBillingCalculation,
  calculatePlanPrice,
} from "@/lib/billing-periods";
import { getAddonDefinition, isAddonEligibleForPlan } from "./catalog";

export interface AddonCartItem {
  addonId: string;
  interval?: "monthly" | "yearly" | "annual" | "one_time";
}

export interface CartAddonLineItem {
  addonId: string;
  name: string;
  category: string;
  billingModel: string;
  interval: string;
  priceUnapproved: number;
  isApproved: boolean; // Always false in Phase 1
  isEligible: boolean;
  ineligibilityReason?: string;
}

export interface CartPriceCalculation {
  planId: string;
  planName: string;
  interval: BillingInterval;
  basePlanCalculation: PlanBillingCalculation;
  addonLineItems: CartAddonLineItem[];
  // Price breakdown
  basePlanTotal: number;
  addonsUnapprovedTotal: number;
  grossCombinedTotal: number;
  finalTotal: number; // In Phase 1, only the base plan is charged because add-ons are inactive
  currency: "INR";
  // Safety flags
  isCheckoutEnabled: boolean; // Strictly false in Phase 1 for add-ons
  checkoutNotice: string;
  // Domain separation preserved
  customDomainConnectionLimit: number;
  freeDomainRegistrationCount: number;
}

/**
 * Calculates a complete itemized checkout breakdown.
 * Integrates base plan calculation with optional add-on line items.
 */
export function calculateCartPrice(
  planId: string,
  interval: BillingInterval = "monthly",
  selectedAddons: AddonCartItem[] = [],
  options?: { optInDomainOffer?: boolean }
): CartPriceCalculation {
  // 1. Calculate base plan pricing (approved production logic)
  const basePlanCalculation = calculatePlanPrice(planId, interval, options);

  // 2. Evaluate selected add-ons
  const addonLineItems: CartAddonLineItem[] = [];
  let addonsUnapprovedTotal = 0;

  for (const item of selectedAddons) {
    const def = getAddonDefinition(item.addonId);
    if (!def) continue;

    const isEligible = isAddonEligibleForPlan(def.id, basePlanCalculation.planId);
    let resolvedInterval = item.interval || (def.billingModel === "one_time_pack" ? "one_time" : interval);
    if (resolvedInterval === "triennial") {
      // Add-ons operate on monthly or annual cycles; map triennial to annual for calculation
      resolvedInterval = "yearly";
    }

    let unapprovedPrice = 0;
    if (def.billingModel === "one_time_pack") {
      unapprovedPrice = def.pricing.oneTimePriceUnapproved || 0;
    } else if (resolvedInterval === "yearly" || resolvedInterval === "annual") {
      unapprovedPrice = def.pricing.annualPriceUnapproved || (def.pricing.monthlyPriceUnapproved ? def.pricing.monthlyPriceUnapproved * 10 : 0);
    } else {
      unapprovedPrice = def.pricing.monthlyPriceUnapproved || 0;
    }

    if (isEligible) {
      addonsUnapprovedTotal += unapprovedPrice;
    }

    addonLineItems.push({
      addonId: def.id,
      name: def.name,
      category: def.category,
      billingModel: def.billingModel,
      interval: resolvedInterval,
      priceUnapproved: unapprovedPrice,
      isApproved: false, // Invariant: all add-on pricing is unapproved in Phase 1
      isEligible,
      ineligibilityReason: isEligible
        ? undefined
        : `Add-on '${def.name}' is not eligible for the ${basePlanCalculation.planName} plan.`,
    });
  }

  const grossCombinedTotal = basePlanCalculation.finalTotal + addonsUnapprovedTotal;

  return {
    planId: basePlanCalculation.planId,
    planName: basePlanCalculation.planName,
    interval: basePlanCalculation.interval,
    basePlanCalculation,
    addonLineItems,
    basePlanTotal: basePlanCalculation.finalTotal,
    addonsUnapprovedTotal,
    grossCombinedTotal,
    // In Phase 1: finalTotal charges strictly base software subscription amount
    finalTotal: basePlanCalculation.finalTotal,
    currency: "INR",
    isCheckoutEnabled: false, // Add-on checkout strictly disabled in Phase 1
    checkoutNotice:
      "Optional add-ons are currently in Phase 1 architectural design. Add-on checkout and charging are inactive.",
    customDomainConnectionLimit: basePlanCalculation.customDomainConnectionLimit,
    freeDomainRegistrationCount: basePlanCalculation.freeDomainRegistrationCount,
  };
}
