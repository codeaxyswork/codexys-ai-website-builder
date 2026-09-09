import { NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const adminCtx = await requireAdmin();
    if (!adminCtx) {
      return NextResponse.json({ error: "Unauthorized access denied." }, { status: 403 });
    }

    const supabase = await createClient();

    const { data: settings } = await supabase.from("platform_settings").select("*");

    const settingsObj: Record<string, any> = {};
    (settings || []).forEach((s) => {
      settingsObj[s.setting_key] = s.setting_value;
    });

    return NextResponse.json({
      settings: {
        maintenance_mode: settingsObj.maintenance_mode || { enabled: false, message: "" },
        registration_enabled: settingsObj.registration_enabled || { enabled: true },
        app_name: settingsObj.app_name || { name: "Codexys AI Website Builder" },
        support_email: settingsObj.support_email || { email: "support@codexys.site" },
      },
      aiEngineInfo: {
        status: "Active",
        primaryModel: process.env.GEMINI_MODEL || "gemini-3.6-flash",
        fallbackChain: "Enabled",
      },
    });
  } catch (err: any) {
    console.error("GET Admin Settings Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch settings." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const adminCtx = await requireAdmin();
    if (!adminCtx) {
      return NextResponse.json({ error: "Unauthorized access denied." }, { status: 403 });
    }

    const supabase = await createClient();
    const body = await request.json();

    const { maintenance_mode, registration_enabled, app_name, support_email } = body;

    const updates = [
      { setting_key: "maintenance_mode", setting_value: maintenance_mode || { enabled: false }, updated_at: new Date().toISOString() },
      { setting_key: "registration_enabled", setting_value: registration_enabled || { enabled: true }, updated_at: new Date().toISOString() },
      { setting_key: "app_name", setting_value: app_name || { name: "Codexys AI Website Builder" }, updated_at: new Date().toISOString() },
      { setting_key: "support_email", setting_value: support_email || { email: "support@codexys.site" }, updated_at: new Date().toISOString() },
    ];

    for (const update of updates) {
      await supabase.from("platform_settings").upsert(update, { onConflict: "setting_key" });
    }

    await logAdminAction({
      adminId: adminCtx.user.id,
      actionType: "SETTINGS_UPDATED",
      details: { maintenance_mode, registration_enabled },
    });

    return NextResponse.json({ success: true, message: "Platform settings updated successfully." });
  } catch (err: any) {
    console.error("PUT Admin Settings Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to update settings." }, { status: 500 });
  }
}
