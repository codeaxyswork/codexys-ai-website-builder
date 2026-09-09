import { createClient } from "@/utils/supabase/server";

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

export async function logAdminAction(params: {
  adminId: string;
  actionType: string;
  targetUserId?: string;
  targetWebsiteId?: string;
  details?: Record<string, any>;
}) {
  try {
    const supabase = await createClient();
    await supabase.from("admin_audit_logs").insert({
      admin_id: params.adminId,
      action_type: params.actionType,
      target_user_id: params.targetUserId || null,
      target_website_id: params.targetWebsiteId || null,
      details: params.details || {},
    });
  } catch (err) {
    console.error("Failed to log admin action:", err);
  }
}
