import { NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";
import { createClient, createAdminClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const adminCtx = await requireAdmin();
    if (!adminCtx) {
      return NextResponse.json({ error: "Unauthorized access denied." }, { status: 403 });
    }

    const supabase = await createClient();

    const { data: settings } = await supabase.from("platform_settings").select("*");

    const settingsObj: Record<string, any> = {};
    (settings || []).forEach((s: { setting_key: string; setting_value: unknown }) => {
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
        primaryModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
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

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request payload." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Request payload must be a JSON object." }, { status: 400 });
    }

    const adminDb = createAdminClient();
    const { maintenance_mode, registration_enabled, app_name, support_email } = body;

    const updates = [
      { setting_key: "maintenance_mode", setting_value: maintenance_mode || { enabled: false }, updated_at: new Date().toISOString() },
      { setting_key: "registration_enabled", setting_value: registration_enabled || { enabled: true }, updated_at: new Date().toISOString() },
      { setting_key: "app_name", setting_value: app_name || { name: "Codexys AI Website Builder" }, updated_at: new Date().toISOString() },
      { setting_key: "support_email", setting_value: support_email || { email: "support@codexys.site" }, updated_at: new Date().toISOString() },
    ];

    const succeededKeys: string[] = [];
    const failedKeys: { key: string; error: string }[] = [];

    // Note: Individual HTTP upserts are non-transactional across keys.
    for (const update of updates) {
      const { error: upsertErr } = await adminDb
        .from("platform_settings")
        .upsert(update, { onConflict: "setting_key" });

      if (upsertErr) {
        console.error(`[ADMIN_SETTINGS_UPSERT_ERROR] Key: ${update.setting_key}:`, upsertErr.message);
        failedKeys.push({ key: update.setting_key, error: "Failed to persist setting." });
      } else {
        succeededKeys.push(update.setting_key);
      }
    }

    if (failedKeys.length > 0) {
      if (succeededKeys.length > 0) {
        // Partial update: some succeeded, some failed
        await logAdminAction({
          adminId: adminCtx.user.id,
          actionType: "SETTINGS_UPDATED_PARTIAL",
          details: { succeededKeys, failedKeys: failedKeys.map((f) => f.key) },
        });

        return NextResponse.json(
          {
            success: false,
            status: "partial_failure",
            error: "Partial settings update failure. Some settings could not be saved.",
            succeededKeys,
            failedKeys,
          },
          { status: 500 }
        );
      }

      // Complete failure
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update platform settings.",
          failedKeys,
        },
        { status: 500 }
      );
    }

    // All succeeded cleanly
    await logAdminAction({
      adminId: adminCtx.user.id,
      actionType: "SETTINGS_UPDATED",
      details: { updatedKeys: succeededKeys },
    });

    return NextResponse.json({ success: true, status: "complete", message: "Platform settings updated successfully." });
  } catch (err: any) {
    console.error("PUT Admin Settings Error:", err);
    return NextResponse.json({ error: "Failed to update settings." }, { status: 500 });
  }
}
