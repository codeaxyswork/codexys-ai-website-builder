import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  getWebsiteMonitoringConfig,
  upsertWebsiteMonitoringConfig,
  getWebsiteMonitoringTrends,
} from "@/lib/ai-visibility";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;

    // 1. Authentication Check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized access. Please log in." },
        { status: 401 }
      );
    }

    // 2. Website Ownership Check
    const { data: website, error: websiteErr } = await supabase
      .from("websites")
      .select("id, title, user_id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (websiteErr || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 403 }
      );
    }

    // 3. Get existing config or create default config structure
    let config = await getWebsiteMonitoringConfig(supabase, websiteId);

    if (!config) {
      config = await upsertWebsiteMonitoringConfig(
        supabase,
        websiteId,
        user.id,
        { enabled: true, frequency: "daily" },
        website.title
      );
    }

    // 4. Fetch trend analytics summary & alerts
    const trends = await getWebsiteMonitoringTrends(supabase, websiteId, 20);

    const { data: alertRows } = await supabase
      .from("ai_visibility_alerts")
      .select("*")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .limit(10);

    const alerts = (alertRows || []).map((a: any) => ({
      id: a.id,
      configId: a.config_id,
      websiteId: a.website_id,
      userId: a.user_id,
      runId: a.run_id,
      alertType: a.alert_type,
      severity: a.severity,
      title: a.title,
      message: a.message,
      metricName: a.metric_name,
      previousValue: a.previous_value,
      currentValue: a.current_value,
      changeDelta: a.change_delta,
      acknowledged: a.acknowledged,
      createdAt: a.created_at,
    }));

    return NextResponse.json({
      success: true,
      config,
      trends,
      alerts,
    });
  } catch (err: any) {
    console.error("AI Visibility Config GET Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch AI visibility monitoring config." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;

    // 1. Authentication Check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized access. Please log in." },
        { status: 401 }
      );
    }

    // 2. Website Ownership Check
    const { data: website, error: websiteErr } = await supabase
      .from("websites")
      .select("id, title, user_id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (websiteErr || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 403 }
      );
    }

    // 3. Payload Extraction
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    // 4. Update configuration safely
    const updatedConfig = await upsertWebsiteMonitoringConfig(
      supabase,
      websiteId,
      user.id,
      body,
      website.title
    );

    if (!updatedConfig) {
      return NextResponse.json(
        { error: "Failed to update monitoring configuration." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      config: updatedConfig,
    });
  } catch (err: any) {
    console.error("AI Visibility Config POST Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to update AI visibility monitoring config." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  paramsCtx: { params: Promise<{ id: string }> }
) {
  return POST(request, paramsCtx);
}
