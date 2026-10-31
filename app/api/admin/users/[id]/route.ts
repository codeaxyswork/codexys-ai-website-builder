import { NextResponse } from "next/server";
import { requireAdmin, requireSuperAdmin, logAdminAction } from "@/lib/admin-auth";
import { createAdminClient } from "@/utils/supabase/server";
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
    if (!userId || typeof userId !== "string" || !userId.trim()) {
      return NextResponse.json({ error: "Invalid user ID specified." }, { status: 400 });
    }

    const adminDb = createAdminClient();

    // 1. Fetch Profile
    const { data: profile, error: profErr } = await adminDb
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profErr || !profile) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    // 2. Fetch Subscription & Credits
    const { data: sub } = await adminDb.from("subscriptions").select("*").eq("user_id", userId).single();
    const { data: credits } = await adminDb.from("user_credits").select("*").eq("user_id", userId).single();

    // 3. Fetch User Websites
    const { data: websites } = await adminDb
      .from("websites")
      .select("id, title, slug, is_published, published_slug, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    // 4. Fetch Billing History
    const { data: transactions } = await adminDb
      .from("billing_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // 5. Fetch Credit Usage Logs
    const { data: creditLogs } = await adminDb
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
    return NextResponse.json({ error: "Failed to fetch user details." }, { status: 500 });
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
    if (!userId || typeof userId !== "string" || !userId.trim()) {
      return NextResponse.json({ error: "Invalid user ID specified." }, { status: 400 });
    }

    const adminDb = createAdminClient();

    // Verify target user exists before performing any mutations
    const { data: targetUser, error: targetCheckErr } = await adminDb
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (targetCheckErr) {
      console.error("[ADMIN_USER_CHECK_ERROR]", targetCheckErr.message);
      return NextResponse.json({ error: "Failed to verify target user." }, { status: 500 });
    }

    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found." }, { status: 404 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request payload." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Request payload must be a JSON object." }, { status: 400 });
    }

    if (typeof body.action !== "string") {
      return NextResponse.json({ error: "Action must be a valid string." }, { status: 400 });
    }
    const action = body.action.trim();

    // 1. CREDIT ADJUSTMENT (Atomic RPC Invocation)
    if (action === "adjust_credits") {
      if (
        body.amount === undefined ||
        body.amount === null ||
        (typeof body.amount !== "number" && typeof body.amount !== "string")
      ) {
        return NextResponse.json({ error: "Invalid credit amount specified." }, { status: 400 });
      }

      if (typeof body.amount === "string" && body.amount.trim() === "") {
        return NextResponse.json({ error: "Credit amount cannot be empty." }, { status: 400 });
      }

      const amount = typeof body.amount === "string" ? Number(body.amount.trim()) : body.amount;

      if (!Number.isFinite(amount) || isNaN(amount) || !Number.isInteger(amount)) {
        return NextResponse.json(
          { error: "Credit amount must be a finite integer." },
          { status: 400 }
        );
      }

      let type = "add";
      if (body.type !== undefined && body.type !== null) {
        if (typeof body.type !== "string") {
          return NextResponse.json(
            { error: "Adjustment type must be a string ('add' or 'set')." },
            { status: 400 }
          );
        }
        type = body.type.trim().toLowerCase();
      }

      if (type !== "add" && type !== "set") {
        return NextResponse.json(
          { error: "Invalid adjustment type. Must be 'add' or 'set'." },
          { status: 400 }
        );
      }

      if (type === "add" && amount === 0) {
        return NextResponse.json(
          { error: "Credit adjustment amount cannot be zero for 'add'." },
          { status: 400 }
        );
      }

      if (type === "set" && amount < 0) {
        return NextResponse.json(
          { error: "Credit balance cannot be set to a negative number." },
          { status: 400 }
        );
      }

      // Validate Mandatory Idempotency Key
      const rawKey = request.headers.get("idempotency-key") || body.idempotencyKey;
      if (!rawKey || typeof rawKey !== "string" || !rawKey.trim()) {
        return NextResponse.json(
          { error: "Idempotency-Key header is required for credit adjustments." },
          { status: 400 }
        );
      }
      const idempotencyKey = rawKey.trim();
      if (!/^[a-zA-Z0-9_\-:]{16,128}$/.test(idempotencyKey)) {
        return NextResponse.json(
          { error: "Invalid Idempotency-Key format. Must be between 16 and 128 alphanumeric characters, hyphens, underscores, or colons." },
          { status: 400 }
        );
      }

      // Invoke Atomic Server-Side RPC
      const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "admin_adjustment";

      const { data: rpcResult, error: rpcError } = await adminDb.rpc("admin_adjust_user_credits", {
        p_admin_id: adminCtx.user.id,
        p_user_id: userId,
        p_amount: amount,
        p_type: type,
        p_idempotency_key: idempotencyKey,
        p_reason: reason,
      });

      if (rpcError) {
        console.error("[ADMIN_CREDITS_RPC_ERROR]", rpcError.message);
        // Fail closed if RPC does not exist or database is unavailable. Never fall back to legacy non-atomic logic!
        if (rpcError.code === "42883" || rpcError.message?.includes("does not exist")) {
          return NextResponse.json(
            {
              success: false,
              code: "SERVICE_UNAVAILABLE",
              error: "Credit adjustment service is temporarily unavailable. Concurrency-safe atomic execution is required.",
            },
            { status: 503 }
          );
        }
        return NextResponse.json(
          { success: false, error: "Failed to execute credit adjustment." },
          { status: 500 }
        );
      }

      if (!rpcResult || !rpcResult.success) {
        const code = rpcResult?.code;
        let status = 400;
        if (code === "UNAUTHORIZED") status = 403;
        else if (code === "USER_NOT_FOUND") status = 404;
        else if (code === "IDEMPOTENCY_KEY_REUSE_CONFLICT") status = 409;
        else if (code === "DATABASE_ERROR") status = 500;

        return NextResponse.json(
          {
            success: false,
            code: rpcResult?.code || "ADJUSTMENT_FAILED",
            error: rpcResult?.error || "Credit adjustment failed.",
          },
          { status }
        );
      }

      return NextResponse.json(
        {
          success: true,
          status: rpcResult.status || "complete",
          idempotent: rpcResult.idempotent || false,
          oldBalance: rpcResult.oldBalance,
          newBalance: rpcResult.newBalance,
          message: rpcResult.message || `User credits updated to ${rpcResult.newBalance}.`,
        },
        { status: 200 }
      );
    }

    // 2. PLAN CHANGE
    if (action === "change_plan") {
      if (typeof body.planId !== "string") {
        return NextResponse.json({ error: "Invalid plan ID specified. Must be a string." }, { status: 400 });
      }

      const targetPlanId = body.planId.toLowerCase().trim();
      const plan = PLANS[targetPlanId];

      if (!plan) {
        return NextResponse.json({ error: "Invalid plan ID." }, { status: 400 });
      }

      const { error: subUpsertErr } = await adminDb.from("subscriptions").upsert(
        {
          user_id: userId,
          plan_id: plan.id,
          status: "active",
          billing_provider: "admin_override",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (subUpsertErr) {
        console.error("[ADMIN_PLAN_SUB_ERROR]", subUpsertErr.message);
        return NextResponse.json({ error: "Failed to update user subscription plan." }, { status: 500 });
      }

      const { error: credUpsertErr } = await adminDb.from("user_credits").upsert(
        {
          user_id: userId,
          balance: plan.monthlyCredits,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (credUpsertErr) {
        console.error("[ADMIN_PLAN_CREDITS_ERROR]", credUpsertErr.message);
        // Note: Non-atomic multi-step limitation. Subscriptions succeeded, but credit allocation failed.
        await logAdminAction({
          adminId: adminCtx.user.id,
          actionType: "ADMIN_PLAN_CHANGED_PARTIAL",
          targetUserId: userId,
          details: { newPlan: plan.id, warning: credUpsertErr.message },
        });

        return NextResponse.json(
          {
            success: false,
            status: "partial_failure",
            partial: true,
            canRetry: false,
            error: `Subscription plan was updated to ${plan.name}, but credit allocation could not be completed. Do NOT retry this request automatically without verifying current balances.`,
            warning: "Credit allocation incomplete for user subscription.",
          },
          { status: 500 }
        );
      }

      await logAdminAction({
        adminId: adminCtx.user.id,
        actionType: "ADMIN_PLAN_CHANGED",
        targetUserId: userId,
        details: { newPlan: plan.id },
      });

      return NextResponse.json({
        success: true,
        status: "complete",
        message: `User plan updated to ${plan.name}.`,
      });
    }

    // 3. ACCOUNT SUSPENSION / REACTIVATION
    if (action === "change_status") {
      if (typeof body.status !== "string") {
        return NextResponse.json({ error: "Invalid status specified. Must be 'active' or 'suspended'." }, { status: 400 });
      }

      const rawStatus = body.status.toLowerCase().trim();
      if (rawStatus !== "active" && rawStatus !== "suspended") {
        return NextResponse.json({ error: "Invalid status specified. Must be 'active' or 'suspended'." }, { status: 400 });
      }
      const newStatus = rawStatus;

      const { data: updatedProfile, error: statusErr } = await adminDb
        .from("profiles")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .select("id, status")
        .maybeSingle();

      if (statusErr) {
        console.error("[ADMIN_STATUS_UPDATE_ERROR]", statusErr.message);
        return NextResponse.json({ error: "Failed to update user status." }, { status: 500 });
      }

      if (!updatedProfile) {
        return NextResponse.json({ error: "User profile not found or could not be updated." }, { status: 404 });
      }

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

      if (typeof body.role !== "string") {
        return NextResponse.json({ error: "Invalid role specified. Must be 'user', 'admin', or 'super_admin'." }, { status: 400 });
      }

      const rawRole = body.role.toLowerCase().trim();
      if (!["user", "admin", "super_admin"].includes(rawRole)) {
        return NextResponse.json({ error: "Invalid role specified. Must be 'user', 'admin', or 'super_admin'." }, { status: 400 });
      }
      const newRole = rawRole;

      const { data: updatedProfile, error: roleErr } = await adminDb
        .from("profiles")
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .select("id, role")
        .maybeSingle();

      if (roleErr) {
        console.error("[ADMIN_ROLE_UPDATE_ERROR]", roleErr.message);
        return NextResponse.json({ error: "Failed to update user role." }, { status: 500 });
      }

      if (!updatedProfile) {
        return NextResponse.json({ error: "User profile not found or could not be updated." }, { status: 404 });
      }

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
    return NextResponse.json({ error: "Action failed." }, { status: 500 });
  }
}
