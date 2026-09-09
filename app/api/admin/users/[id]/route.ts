import { NextResponse } from "next/server";
import { requireAdmin, requireSuperAdmin, logAdminAction } from "@/lib/admin-auth";
import { createClient } from "@/utils/supabase/server";
import { PLANS } from "@/lib/constants";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCtx = await requireAdmin();
    if (!adminCtx) {
      return NextResponse.json({ error: "Unauthorized access denied." }, { status: 403 });
    }

    const { id: userId } = await params;
    const supabase = await createClient();

    // 1. Fetch Profile
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profErr || !profile) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    // 2. Fetch Subscription & Credits
    const { data: sub } = await supabase.from("subscriptions").select("*").eq("user_id", userId).single();
    const { data: credits } = await supabase.from("user_credits").select("*").eq("user_id", userId).single();

    // 3. Fetch User Websites
    const { data: websites } = await supabase
      .from("websites")
      .select("id, title, slug, is_published, published_slug, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    // 4. Fetch Billing History
    const { data: transactions } = await supabase
      .from("billing_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // 5. Fetch Credit Usage Logs
    const { data: creditLogs } = await supabase
      .from("ai_credit_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      user: {
        ...profile,
        subscription: sub || { plan_id: "free", status: "active" },
        credits: credits || { balance: 50, monthly_used: 0, lifetime_used: 0 },
      },
      websites: websites || [],
      transactions: transactions || [],
      creditLogs: creditLogs || [],
    });
  } catch (err: any) {
    console.error("GET Admin User Details Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch user details." }, { status: 500 });
  }
}

// Handler for Credit Adjustments, Plan Changes, Account Suspension, Role Updates
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCtx = await requireAdmin();
    if (!adminCtx) {
      return NextResponse.json({ error: "Unauthorized access denied." }, { status: 403 });
    }

    const { id: userId } = await params;
    const supabase = await createClient();
    const body = await request.json();
    const { action } = body;

    // 1. CREDIT ADJUSTMENT
    if (action === "adjust_credits") {
      const amount = Number(body.amount) || 0;
      const type = body.type || "add"; // "add" or "set"

      const { data: currentCred } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .single();

      const oldBalance = currentCred?.balance ?? 50;
      const newBalance = type === "set" ? amount : oldBalance + amount;

      await supabase.from("user_credits").upsert(
        {
          user_id: userId,
          balance: newBalance,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      // Log into ai_credit_transactions
      await supabase.from("ai_credit_transactions").insert({
        user_id: userId,
        credits_used: type === "add" ? -amount : -(newBalance - oldBalance),
        action_type: "admin_adjustment",
      });

      await logAdminAction({
        adminId: adminCtx.user.id,
        actionType: "ADMIN_CREDITS_ADJUSTED",
        targetUserId: userId,
        details: { oldBalance, newBalance, adjustment: amount, type },
      });

      return NextResponse.json({
        success: true,
        newBalance,
        message: `User credits updated to ${newBalance}.`,
      });
    }

    // 2. PLAN CHANGE
    if (action === "change_plan") {
      const targetPlanId = (body.planId || "").toLowerCase().trim();
      const plan = PLANS[targetPlanId];

      if (!plan) {
        return NextResponse.json({ error: "Invalid plan ID." }, { status: 400 });
      }

      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          plan_id: plan.id,
          status: "active",
          billing_provider: "admin_override",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      await supabase.from("user_credits").upsert(
        {
          user_id: userId,
          balance: plan.monthlyCredits,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      await logAdminAction({
        adminId: adminCtx.user.id,
        actionType: "ADMIN_PLAN_CHANGED",
        targetUserId: userId,
        details: { newPlan: plan.id },
      });

      return NextResponse.json({
        success: true,
        message: `User plan updated to ${plan.name}.`,
      });
    }

    // 3. ACCOUNT SUSPENSION / REACTIVATION
    if (action === "change_status") {
      const newStatus = body.status === "suspended" ? "suspended" : "active";

      await supabase
        .from("profiles")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", userId);

      await logAdminAction({
        adminId: adminCtx.user.id,
        actionType: newStatus === "suspended" ? "USER_SUSPENDED" : "USER_REACTIVATED",
        targetUserId: userId,
        details: { status: newStatus },
      });

      return NextResponse.json({
        success: true,
        status: newStatus,
        message: `User status set to ${newStatus}.`,
      });
    }

    // 4. ROLE CHANGE (Super Admin Only)
    if (action === "change_role") {
      const superAdminCtx = await requireSuperAdmin();
      if (!superAdminCtx) {
        return NextResponse.json({ error: "Super Admin privileges required to change roles." }, { status: 403 });
      }

      const newRole = ["user", "admin", "super_admin"].includes(body.role) ? body.role : "user";

      await supabase
        .from("profiles")
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq("id", userId);

      await logAdminAction({
        adminId: adminCtx.user.id,
        actionType: "USER_ROLE_CHANGED",
        targetUserId: userId,
        details: { newRole },
      });

      return NextResponse.json({
        success: true,
        role: newRole,
        message: `User role updated to ${newRole}.`,
      });
    }

    return NextResponse.json({ error: "Invalid action specified." }, { status: 400 });
  } catch (err: any) {
    console.error("POST Admin User Action Error:", err);
    return NextResponse.json({ error: err?.message || "Action failed." }, { status: 500 });
  }
}
