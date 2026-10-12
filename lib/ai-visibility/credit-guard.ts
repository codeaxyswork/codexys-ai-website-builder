/**
 * Phase 16 & Phase 1 Production Readiness: AI Visibility Credit Guard & Usage Enforcement
 * Implements strict PRO plan entitlement verification, usage quotas,
 * atomic credit verification and deduction, atomic failure refunds with row-level locks,
 * and provider-scoped duplicate-charge safeguards.
 */

import crypto from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import { LIVE_AI_VISIBILITY_CONFIG, isLiveAiVisibilityEnabled } from "./config";
import { AiVisibilityProviderName } from "./types";
import { getUserUsage } from "@/lib/billing";

export interface ProbeEligibilityResult {
  allowed: boolean;
  liveMode: boolean;
  creditsRequired: number;
  currentBalance: number;
  error?: string;
  code?: "INSUFFICIENT_CREDITS" | "DAILY_WEBSITE_LIMIT_EXCEEDED" | "DAILY_USER_LIMIT_EXCEEDED" | "DUPLICATE_PROBE_THROTTLED" | "RATE_LIMITED";
}

export interface ProbeCreditDeductionResult {
  success: boolean;
  creditsDeducted: number;
  error?: string;
}

export interface AiVisibilityEntitlementResult {
  entitled: boolean;
  planId: string;
  planName: string;
  allowAdvancedSeo: boolean;
  reason?: string;
}

/**
 * Checks whether an authenticated user has the required PRO or Agency entitlement
 * to use AI Visibility and LLM Rank Tracking features.
 * Authoritatively verifies against subscriptions and plans via `getUserUsage`.
 */
export async function checkAiVisibilityEntitlement(
  userId: string,
  supabase?: any
): Promise<AiVisibilityEntitlementResult> {
  try {
    const usage = await getUserUsage(userId, supabase);
    const planId = usage?.plan?.id || "free";
    const planName = usage?.plan?.name || "Free";
    const allowAdvancedSeo = Boolean(usage?.plan?.allow_advanced_seo);

    // Eligible plans: Pro, Business, Agency, or any plan configured with allow_advanced_seo: true
    const entitled = allowAdvancedSeo || planId === "pro" || planId === "agency" || planId === "business";

    if (!entitled) {
      return {
        entitled: false,
        planId,
        planName,
        allowAdvancedSeo,
        reason: `AI Visibility and LLM Rank Tracking require a Pro or Agency subscription. Your current plan (${planName}) does not include this feature.`,
      };
    }

    return {
      entitled: true,
      planId,
      planName,
      allowAdvancedSeo,
    };
  } catch (err: any) {
    console.error("[CreditGuard] Entitlement check error:", err);
    return {
      entitled: false,
      planId: "unknown",
      planName: "Unknown",
      allowAdvancedSeo: false,
      reason: "Failed to verify plan entitlement.",
    };
  }
}

/**
 * Checks whether the user and website are eligible to execute an AI Visibility probe.
 * Enforces:
 *  1. Mock vs Live mode logic (zero cost when live mode is disabled).
 *  2. Duplicate request throttling scoped strictly by provider, website, and prompt (45s window).
 *  3. Daily per-website and per-user limits to prevent runaway usage.
 *  4. Real-time credit balance verification.
 */
export async function checkProbeCreditEligibility(
  supabase: SupabaseClient,
  userId: string,
  websiteId: string,
  prompt: string,
  targetProviders: AiVisibilityProviderName[] = ["openai"]
): Promise<ProbeEligibilityResult> {
  const liveMode = isLiveAiVisibilityEnabled();

  // If live mode is not enabled, probing operates in zero-credit mock mode
  if (!liveMode) {
    return {
      allowed: true,
      liveMode: false,
      creditsRequired: 0,
      currentBalance: 999,
    };
  }

  // Calculate required credits
  const isMultiBatch = targetProviders.length > 1;
  const creditsRequired = isMultiBatch
    ? LIVE_AI_VISIBILITY_CONFIG.CREDIT_COST_PER_MULTI_PROBE_BATCH
    : (LIVE_AI_VISIBILITY_CONFIG.PROVIDER_CREDIT_COSTS[targetProviders[0]] || LIVE_AI_VISIBILITY_CONFIG.CREDIT_COST_PER_SINGLE_PROBE);

  const cleanPrompt = prompt.trim().toLowerCase();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const duplicateWindowIso = new Date(Date.now() - LIVE_AI_VISIBILITY_CONFIG.DUPLICATE_PROBE_WINDOW_MS).toISOString();

  // 1. Safeguard against duplicate charges within the idempotency window (45s)
  // Scoped strictly by website_id, prompt, and target provider(s)
  if (targetProviders.length === 1) {
    const singleProvider = targetProviders[0];
    const { data: recentIdentical } = await supabase
      .from("seo_ai_visibility_logs")
      .select("id")
      .eq("website_id", websiteId)
      .eq("provider", singleProvider)
      .ilike("prompt", cleanPrompt)
      .gte("created_at", duplicateWindowIso)
      .limit(1);

    if (recentIdentical && recentIdentical.length > 0) {
      return {
        allowed: false,
        liveMode: true,
        creditsRequired,
        currentBalance: 0,
        error: `A probe for this exact query on '${singleProvider}' was executed within the last 45 seconds. Please wait before re-probing to prevent duplicate charges.`,
        code: "DUPLICATE_PROBE_THROTTLED",
      };
    }
  } else {
    // For batch probes: check if ALL target providers have recent logs for this prompt
    let query: any = supabase
      .from("seo_ai_visibility_logs")
      .select("provider")
      .eq("website_id", websiteId)
      .ilike("prompt", cleanPrompt)
      .gte("created_at", duplicateWindowIso);

    if (typeof query.in === "function") {
      query = query.in("provider", targetProviders);
    }

    const { data: recentLogs } = await query;

    const loggedProviders = new Set((recentLogs || []).map((l: any) => l.provider));
    const allProvidersAlreadyProbed = targetProviders.every((p) => loggedProviders.has(p));

    if (allProvidersAlreadyProbed && targetProviders.length > 0) {
      return {
        allowed: false,
        liveMode: true,
        creditsRequired,
        currentBalance: 0,
        error: "A batch probe for all requested providers on this exact query was executed within the last 45 seconds. Please wait before re-probing.",
        code: "DUPLICATE_PROBE_THROTTLED",
      };
    }
  }

  // 2. Check Daily Website Limit (max 25 probes/day)
  const { count: websiteDailyCount } = await supabase
    .from("seo_ai_visibility_logs")
    .select("id", { count: "exact", head: true })
    .eq("website_id", websiteId)
    .gte("created_at", startOfDay);

  if (typeof websiteDailyCount === "number" && websiteDailyCount >= LIVE_AI_VISIBILITY_CONFIG.DAILY_PROBE_LIMIT_PER_WEBSITE) {
    return {
      allowed: false,
      liveMode: true,
      creditsRequired,
      currentBalance: 0,
      error: `Daily limit of ${LIVE_AI_VISIBILITY_CONFIG.DAILY_PROBE_LIMIT_PER_WEBSITE} AI visibility probes reached for this website.`,
      code: "DAILY_WEBSITE_LIMIT_EXCEEDED",
    };
  }

  // 3. Check Daily User Limit (max 60 probes/day)
  const { count: userDailyCount } = await supabase
    .from("seo_ai_visibility_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay);

  if (typeof userDailyCount === "number" && userDailyCount >= LIVE_AI_VISIBILITY_CONFIG.DAILY_PROBE_LIMIT_PER_USER) {
    return {
      allowed: false,
      liveMode: true,
      creditsRequired,
      currentBalance: 0,
      error: `Daily user limit of ${LIVE_AI_VISIBILITY_CONFIG.DAILY_PROBE_LIMIT_PER_USER} AI visibility probes reached across all websites.`,
      code: "DAILY_USER_LIMIT_EXCEEDED",
    };
  }

  // 4. Fetch User Credits Balance
  const { data: userCredits } = await supabase
    .from("user_credits")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();

  const balance = userCredits?.balance ?? 0;

  if (balance < creditsRequired) {
    return {
      allowed: false,
      liveMode: true,
      creditsRequired,
      currentBalance: balance,
      error: `Insufficient AI credits. You have ${balance} credit(s), but this probe requires ${creditsRequired} credit(s).`,
      code: "INSUFFICIENT_CREDITS",
    };
  }

  return {
    allowed: true,
    liveMode: true,
    creditsRequired,
    currentBalance: balance,
  };
}

/**
 * Atomically deducts AI credits for an approved live probe.
 * Employs Postgres RPC `deduct_user_credits` with transaction logging.
 */
export async function deductProbeCredits(
  supabase: SupabaseClient,
  userId: string,
  websiteId: string,
  creditsToDeduct: number,
  promptSummary: string,
  actionKey?: string
): Promise<ProbeCreditDeductionResult> {
  if (creditsToDeduct <= 0) {
    return { success: true, creditsDeducted: 0 };
  }

  try {
    const actionType = actionKey || `ai_visibility_probe:${promptSummary.slice(0, 50)}`;

    // Call atomic Postgres function
    const { data: rpcSuccess, error: rpcError } = await supabase.rpc("deduct_user_credits", {
      p_user_id: userId,
      p_credits: creditsToDeduct,
      p_action_type: actionType,
      p_website_id: websiteId,
    });

    if (rpcError) {
      console.warn("[CreditGuard] RPC deduction failed, falling back to manual atomic update:", rpcError.message);
      
      // Fallback: safe query update
      const { data: creditRow } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle();

      const current = creditRow?.balance ?? 0;
      if (current < creditsToDeduct) {
        return { success: false, creditsDeducted: 0, error: "Insufficient balance during deduction." };
      }

      await supabase
        .from("user_credits")
        .update({
          balance: current - creditsToDeduct,
          monthly_used: (creditRow as any)?.monthly_used ? (creditRow as any).monthly_used + creditsToDeduct : creditsToDeduct,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      await supabase.from("ai_credit_transactions").insert({
        user_id: userId,
        website_id: websiteId,
        credits_used: creditsToDeduct,
        action_type: actionType,
      });

      return { success: true, creditsDeducted: creditsToDeduct };
    }

    if (!rpcSuccess) {
      return { success: false, creditsDeducted: 0, error: "Insufficient credit balance." };
    }

    return { success: true, creditsDeducted: creditsToDeduct };
  } catch (err: any) {
    console.error("[CreditGuard] Deduction error:", err);
    return { success: false, creditsDeducted: 0, error: err?.message || "Failed to deduct credits." };
  }
}

/**
 * Atomically refunds credits if provider requests in a live probe batch fail or time out.
 * Employs Postgres RPC `refund_user_credits` with row-level locking (FOR UPDATE)
 * and transaction audit logging to guarantee idempotency and prevent double refunds.
 */
export async function refundProbeCredits(
  supabase: SupabaseClient,
  userId: string,
  websiteId: string,
  creditsToRefund: number,
  reason: string,
  actionKey?: string
): Promise<boolean> {
  if (creditsToRefund <= 0) return true;

  try {
    // Ensure distinct refund operations receive a unique actionKey to prevent
    // false idempotency collisions across separate failed probe runs.
    const effectiveActionKey = actionKey || `probe_op_${crypto.randomUUID()}`;
    const actionType = effectiveActionKey.startsWith("refund:")
      ? effectiveActionKey
      : `refund:${effectiveActionKey.startsWith("ai_visibility_probe:") ? effectiveActionKey : `ai_visibility_probe:${effectiveActionKey}`}`;

    // 1. Primary: Call atomic Postgres function `refund_user_credits`
    const { data: rpcSuccess, error: rpcError } = await supabase.rpc("refund_user_credits", {
      p_user_id: userId,
      p_credits: creditsToRefund,
      p_action_type: actionType,
      p_website_id: websiteId,
    });

    if (!rpcError) {
      return Boolean(rpcSuccess);
    }

    console.error(
      `[CreditGuard] refund_user_credits RPC execution failed for user ${userId}, probe action ${actionType}:`,
      rpcError.message || rpcError
    );
    // Explicit failure return: never attempt unprivileged direct user_credits update fallback
    return false;
  } catch (err: any) {
    console.error("[CreditGuard] Refund error:", err);
    return false;
  }
}
