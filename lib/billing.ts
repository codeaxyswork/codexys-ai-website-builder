import { createClient } from "@/utils/supabase/server";
import { CREDIT_COSTS, ERROR_CODES } from "./constants";

import { getCache, setCache, invalidateUserCache, CACHE_KEYS, CACHE_TTLS } from "./cache";

export interface UserUsageData {
  plan: {
    id: string;
    name: string;
    allow_custom_domain: boolean;
    allow_advanced_seo: boolean;
  };
  credits: {
    balance: number;
    monthlyUsed: number;
    lifetimeUsed: number;
    limit: number;
    monthlyOperations: number;
  };
  websites: {
    used: number;
    limit: number;
  };
  storage: {
    usedBytes: number;
    limitBytes: number;
  };
}

export async function getUserUsage(userId: string): Promise<UserUsageData | null> {
  try {
    const cacheKey = CACHE_KEYS.userUsage(userId);
    const { data: cachedUsage } = await getCache<UserUsageData>(cacheKey);
    if (cachedUsage) {
      return cachedUsage;
    }

    const supabase = await createClient();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Fetch Subscription, Credits, Monthly Operations, Website Count, and Assets concurrently
    const [subRes, creditRes, monthlyOpsRes, websiteRes, assetsRes] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("plan_id, status, plans(*)")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("user_credits")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("ai_credit_transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfMonth.toISOString()),
      supabase
        .from("websites")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("media_assets")
        .select("file_size_bytes")
        .eq("user_id", userId),
    ]);

    const sub = subRes.data;
    let creditRec = creditRes.data;
    const monthlyOpsCount = monthlyOpsRes.count;
    const websiteCount = websiteRes.count;
    const assets = assetsRes.data || [];

    let plan = (sub?.plans as any) || {
      id: "free",
      name: "Free",
      monthly_ai_credits: 50,
      max_websites: 1,
      storage_limit_bytes: 104857600,
      allow_custom_domain: false,
      allow_advanced_seo: false,
    };

    if (!creditRec) {
      // Auto-initialize credits for user if record is missing
      const { data: newCredit } = await supabase
        .from("user_credits")
        .insert({ user_id: userId, balance: plan.monthly_ai_credits || 50 })
        .select()
        .single();
      creditRec = newCredit || { balance: 50, monthly_used: 0, lifetime_used: 0 };
    }

    const totalStorageBytes = assets.reduce(
      (sum, asset) => sum + (Number(asset.file_size_bytes) || 0),
      0
    );

    const result: UserUsageData = {
      plan: {
        id: plan.id,
        name: plan.name,
        allow_custom_domain: Boolean(plan.allow_custom_domain),
        allow_advanced_seo: Boolean(plan.allow_advanced_seo),
      },
      credits: {
        balance: creditRec?.balance ?? 50,
        monthlyUsed: creditRec?.monthly_used ?? 0,
        lifetimeUsed: creditRec?.lifetime_used ?? 0,
        limit: plan.monthly_ai_credits || 50,
        monthlyOperations: monthlyOpsCount || 0,
      },
      websites: {
        used: websiteCount || 0,
        limit: plan.max_websites || 1,
      },
      storage: {
        usedBytes: totalStorageBytes,
        limitBytes: Number(plan.storage_limit_bytes) || 104857600,
      },
    };

    // Cache computed user usage
    await setCache(cacheKey, result, CACHE_TTLS.USER_USAGE);

    return result;
  } catch (err) {
    console.error("getUserUsage Error:", err);
    return null;
  }
}

export async function checkWebsiteLimit(
  userId: string
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const usage = await getUserUsage(userId);
  if (!usage) return { allowed: true, current: 0, limit: 1 };

  return {
    allowed: usage.websites.used < usage.websites.limit,
    current: usage.websites.used,
    limit: usage.websites.limit,
  };
}

export async function checkCreditBalance(
  userId: string,
  requiredCredits: number
): Promise<{ allowed: boolean; balance: number; required: number }> {
  const usage = await getUserUsage(userId);
  if (!usage) return { allowed: true, balance: 50, required: requiredCredits };

  return {
    allowed: usage.credits.balance >= requiredCredits,
    balance: usage.credits.balance,
    required: requiredCredits,
  };
}

export async function deductCreditsWithClient(
  supabase: any,
  userId: string,
  credits: number,
  actionType: string,
  websiteId?: string
): Promise<boolean> {
  const { data: success, error } = await supabase.rpc("deduct_user_credits", {
    p_user_id: userId,
    p_credits: credits,
    p_action_type: actionType,
    p_website_id: websiteId || null,
  });

  if (error) {
    console.error("Deduct Credits RPC Error:", error);
    return false;
  }

  if (success ?? true) {
    await invalidateUserCache(userId);
  }

  return success ?? true;
}

export async function deductCredits(
  userId: string,
  credits: number,
  actionType: string,
  websiteId?: string
): Promise<boolean> {
  try {
    const supabase = await createClient();
    return await deductCreditsWithClient(supabase, userId, credits, actionType, websiteId);
  } catch (err) {
    console.error("deductCredits Error:", err);
    return false;
  }
}
