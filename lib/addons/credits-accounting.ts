/**
 * Codeaxys AI Website Builder — AI Credits Addon Accounting Engine
 * Implements safe, separate accounting for monthly subscription allowances vs
 * non-expiring purchased credit top-up packs.
 *
 * SAFETY INVARIANT: Monthly subscription replenishment resets the monthly allowance
 * without rollover, but NEVER overwrites or wipes out purchased top-up credits.
 */

export interface CreditLedger {
  monthlyAllowanceBalance: number; // Resets every 30 days up to plan allowance
  purchasedCreditsBalance: number; // Non-expiring purchased credits
  totalSpendableBalance: number;   // Total available = monthly + purchased
  monthlyAllowanceCap: number;     // Plan monthly allowance (e.g. 100 for Starter)
}

/**
 * Initializes a new clean credit ledger.
 */
export function initializeCreditLedger(
  planMonthlyAllowance: number,
  initialPurchasedCredits: number = 0
): CreditLedger {
  const cap = Math.max(0, planMonthlyAllowance);
  const purchased = Math.max(0, initialPurchasedCredits);
  return {
    monthlyAllowanceBalance: cap,
    purchasedCreditsBalance: purchased,
    totalSpendableBalance: cap + purchased,
    monthlyAllowanceCap: cap,
  };
}

/**
 * Replenishes monthly credits on a subscription renewal cycle.
 *
 * KEY GUARANTEE:
 * - Unspent monthly allowance does NOT roll over (resets to planMonthlyAllowance).
 * - Purchased top-up credits are 100% PRESERVED without loss.
 */
export function replenishWithPurchasedCreditsPreserved(
  currentLedger: CreditLedger,
  planMonthlyAllowance: number
): {
  newLedger: CreditLedger;
  preservedPurchasedCredits: number;
  resetMonthlyAllowance: number;
} {
  const cap = Math.max(0, planMonthlyAllowance);
  const preservedPurchased = Math.max(0, currentLedger.purchasedCreditsBalance);

  const newLedger: CreditLedger = {
    monthlyAllowanceBalance: cap,
    purchasedCreditsBalance: preservedPurchased,
    totalSpendableBalance: cap + preservedPurchased,
    monthlyAllowanceCap: cap,
  };

  return {
    newLedger,
    preservedPurchasedCredits: preservedPurchased,
    resetMonthlyAllowance: cap,
  };
}

/**
 * Deducts credits using customer-friendly priority order:
 * 1. Monthly allowance is consumed first (since it expires every 30 days).
 * 2. Non-expiring purchased credits are consumed only after monthly allowance is depleted.
 *
 * Fails closed if requiredCredits > totalSpendableBalance.
 */
export function deductFromCreditLedger(
  requiredCredits: number,
  currentLedger: CreditLedger
): {
  success: boolean;
  newLedger: CreditLedger;
  deductedFromMonthly: number;
  deductedFromPurchased: number;
  error?: string;
} {
  if (requiredCredits <= 0) {
    return {
      success: true,
      newLedger: { ...currentLedger },
      deductedFromMonthly: 0,
      deductedFromPurchased: 0,
    };
  }

  if (requiredCredits > currentLedger.totalSpendableBalance) {
    return {
      success: false,
      newLedger: { ...currentLedger },
      deductedFromMonthly: 0,
      deductedFromPurchased: 0,
      error: `Insufficient AI credits. Required: ${requiredCredits}, available total: ${currentLedger.totalSpendableBalance}.`,
    };
  }

  let remainingToDeduct = requiredCredits;
  let deductedFromMonthly = 0;
  let deductedFromPurchased = 0;

  let newMonthlyBalance = currentLedger.monthlyAllowanceBalance;
  let newPurchasedBalance = currentLedger.purchasedCreditsBalance;

  // 1. Deduct from monthly allowance first
  if (newMonthlyBalance > 0) {
    const fromMonthly = Math.min(newMonthlyBalance, remainingToDeduct);
    newMonthlyBalance -= fromMonthly;
    remainingToDeduct -= fromMonthly;
    deductedFromMonthly = fromMonthly;
  }

  // 2. Deduct remaining from non-expiring purchased credits
  if (remainingToDeduct > 0) {
    const fromPurchased = Math.min(newPurchasedBalance, remainingToDeduct);
    newPurchasedBalance -= fromPurchased;
    remainingToDeduct -= fromPurchased;
    deductedFromPurchased = fromPurchased;
  }

  const newLedger: CreditLedger = {
    monthlyAllowanceBalance: newMonthlyBalance,
    purchasedCreditsBalance: newPurchasedBalance,
    totalSpendableBalance: newMonthlyBalance + newPurchasedBalance,
    monthlyAllowanceCap: currentLedger.monthlyAllowanceCap,
  };

  return {
    success: true,
    newLedger,
    deductedFromMonthly,
    deductedFromPurchased,
  };
}

/**
 * Adds purchased top-up credits to the ledger.
 * Does not modify or reset the monthly allowance.
 */
export function addPurchasedCredits(
  currentLedger: CreditLedger,
  creditsToAdd: number
): CreditLedger {
  const validAdd = Math.max(0, creditsToAdd);
  const newPurchased = currentLedger.purchasedCreditsBalance + validAdd;

  return {
    monthlyAllowanceBalance: currentLedger.monthlyAllowanceBalance,
    purchasedCreditsBalance: newPurchased,
    totalSpendableBalance: currentLedger.monthlyAllowanceBalance + newPurchased,
    monthlyAllowanceCap: currentLedger.monthlyAllowanceCap,
  };
}
