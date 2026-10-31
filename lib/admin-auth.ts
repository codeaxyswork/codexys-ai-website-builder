import { createClient, createAdminClient } from "@/utils/supabase/server";

export interface AdminUserContext {
  user: any;
  profile: {
    id: string;
    full_name?: string;
    role: "user" | "admin" | "super_admin";
    status: "active" | "suspended";
  };
  isSuperAdmin: boolean;
}

export async function requireAdmin(): Promise<AdminUserContext | null> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, role, status")
      .eq("id", user.id)
      .single();

    if (!profile) return null;

    const role = profile.role || "user";
    const status = profile.status || "active";

    if (status === "suspended") return null;

    if (role !== "admin" && role !== "super_admin") {
      return null;
    }

    return {
      user,
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        role: role as any,
        status: status as any,
      },
      isSuperAdmin: role === "super_admin",
    };
  } catch (err) {
    console.error("requireAdmin Exception:", err);
    return null;
  }
}

export async function requireSuperAdmin(): Promise<AdminUserContext | null> {
  const context = await requireAdmin();
  if (!context || !context.isSuperAdmin) {
    return null;
  }
  return context;
}

export async function isUserSuspended(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", userId)
      .single();

    return profile?.status === "suspended";
  } catch (e) {
    return false;
  }
}

function redactSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") {
    if (typeof obj === "string") {
      if (/^Bearer\s+/i.test(obj) || /^sk_(?:live|test)_/i.test(obj) || /^sbp_[a-f0-9]/i.test(obj)) {
        return "[REDACTED]";
      }
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }
  const SENSITIVE_KEY_REGEX = /password|passwd|secret|token|apikey|api_key|authorization|bearer|credential|private_key/i;
  const sanitized: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEY_REGEX.test(k)) {
      sanitized[k] = "[REDACTED]";
    } else if (typeof v === "object" && v !== null) {
      sanitized[k] = redactSensitiveData(v);
    } else if (typeof v === "string" && (/^Bearer\s+/i.test(v) || /^sk_(?:live|test)_/i.test(v) || /^sbp_[a-f0-9]/i.test(v))) {
      sanitized[k] = "[REDACTED]";
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

export async function logAdminAction(params: {
  adminId: string;
  actionType: string;
  targetUserId?: string;
  targetWebsiteId?: string;
  details?: Record<string, any>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();
    const sanitizedDetails = redactSensitiveData(params.details || {});

    const { error: auditErr } = await supabase.from("admin_audit_logs").insert({
      admin_id: params.adminId,
      action_type: params.actionType,
      target_user_id: params.targetUserId || null,
      target_website_id: params.targetWebsiteId || null,
      details: sanitizedDetails,
    });

    if (auditErr) {
      console.error(
        `[ADMIN_AUDIT_LOG_ERROR] Failed to record audit log for action "${params.actionType}":`,
        auditErr.message
      );
      return { success: false, error: auditErr.message };
    }

    return { success: true };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error(
      `[ADMIN_AUDIT_LOG_EXCEPTION] Unexpected error while recording audit log for action "${params.actionType}":`,
      msg
    );
    return { success: false, error: msg };
  }
}

