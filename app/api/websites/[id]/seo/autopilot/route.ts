import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAutopilotSettings, updateAutopilotSettings, runAutopilotCycle } from "@/lib/seo-opportunities/autopilot";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/websites/[id]/seo/autopilot
 * Returns Autopilot status, settings, top pending actions, and recent activity log.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check website ownership
    const { data: website } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (!website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    // Fetch settings
    const settings = await getAutopilotSettings(supabase, websiteId, user.id);

    // Fetch recent activity
    const { data: activity } = await supabase
      .from("seo_autopilot_activity")
      .select("*")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .limit(15);

    // Fetch pending actions (Critical and High priority new opportunities)
    const { data: pendingActions } = await supabase
      .from("seo_opportunities")
      .select("*")
      .eq("website_id", websiteId)
      .in("status", ["new", "viewed", "in_progress"])
      .order("priority_score", { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      settings,
      activity: activity || [],
      pendingActions: pendingActions || [],
    });
  } catch (err: any) {
    console.error("GET Autopilot Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch Autopilot data." }, { status: 500 });
  }
}

/**
 * PUT /api/websites/[id]/seo/autopilot
 * Updates Autopilot status (active/paused) or settings configuration.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const updatedSettings = await updateAutopilotSettings(supabase, websiteId, user.id, body);

    // If status changed to active, trigger an immediate autopilot cycle scan
    if (body.status === "active") {
      await runAutopilotCycle(supabase, websiteId, user.id);
    }

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
    });
  } catch (err: any) {
    console.error("PUT Autopilot Error:", err);
    return NextResponse.json({ error: err.message || "Failed to update Autopilot settings." }, { status: 500 });
  }
}
