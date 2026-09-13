import { createClient } from "@/utils/supabase/server";
import { CREDIT_COSTS, ERROR_CODES } from "./constants";

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
    const supabase = await createClient();

    // 1. Fetch Subscription & Plan
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan_id, status, plans(*)")
      .eq("user_id", userId)
      .maybeSingle();

    let plan = (sub?.plans as any) || {
      id: "free",
      name: "Free",
      monthly_ai_credits: 50,
      max_websites: 1,
      storage_limit_bytes: 104857600,
      allow_custom_domain: false,
      allow_advanced_seo: false,
    };

    // 2. Fetch User Credits
    let { data: creditRec } = await supabase
      .from("user_credits")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!creditRec) {
      // Auto-initialize credits for user if record is missing
      const { data: newCredit } = await supabase
        .from("user_credits")
        .insert({ user_id: userId, balance: plan.monthly_ai_credits || 50 })
        .select()
        .single();
      creditRec = newCredit || { balance: 50, monthly_used: 0, lifetime_used: 0 };
    }

    // 2b. Fetch monthly AI operations count from ai_credit_transactions
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: monthlyOpsCount } = await supabase
      .from("ai_credit_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startOfMonth.toISOString());

    // 3. Fetch Websites Count
    const { count: websiteCount } = await supabase
      .from("websites")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    // 4. Fetch Storage Usage Bytes
    const { data: assets } = await supabase
      .from("media_assets")
      .select("file_size_bytes")
      .eq("user_id", userId);

    const totalStorageBytes = (assets || []).reduce(
      (sum, asset) => sum + (Number(asset.file_size_bytes) || 0),
      0
    );

    return {
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

export async function deductCredits(
  userId: string,
  credits: number,
  actionType: string,
  websiteId?: string
): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Call PostgreSQL RPC function for atomic credit deduction with row locking
    const { data: success, error } = await supabase.rpc("deduct_user_credits", {
      p_user_id: userId,
      p_credits: credits,
      p_action_type: actionType,
      p_website_id: websiteId || null,
    });

    if (error) {
      console.error("Deduct Credits RPC Error:", error);
      // Fallback manual update if RPC is missing
      const { data: current } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .single();

      if (!current || current.balance < credits) return false;

      await supabase
        .from("user_credits")
        .update({
          balance: current.balance - credits,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      await supabase.from("ai_credit_transactions").insert({
        user_id: userId,
        website_id: websiteId || null,
        credits_used: credits,
        action_type: actionType,
      });

      return true;
    }

    return Boolean(success);
  } catch (err) {
    console.error("deductCredits Exception:", err);
    return false;
  }
}
