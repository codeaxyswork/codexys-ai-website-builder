import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateMonitoringSchedule, calculateNextRunAt } from "@/lib/seo-monitoring-engine";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await props.params;
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify website ownership
    const { data: website, error: siteError } = await supabase
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteError || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    // 3. Fetch or initialize schedule
    const schedule = await getOrCreateMonitoringSchedule(supabase, websiteId, user.id);

    return NextResponse.json(schedule);
  } catch (err: any) {
    console.error("GET monitoring schedule error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await props.params;
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify website ownership
    const { data: website, error: siteError } = await supabase
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteError || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    const body = await req.json();
    const { enabled, frequency, preferred_hour } = body;

    if (frequency && !["manual", "daily", "weekly", "monthly"].includes(frequency)) {
      return NextResponse.json({ error: "Invalid frequency value." }, { status: 400 });
    }

    const currentSchedule = await getOrCreateMonitoringSchedule(supabase, websiteId, user.id);

    const isEnabled = typeof enabled === "boolean" ? enabled : currentSchedule.enabled;
    const newFreq = frequency || currentSchedule.frequency;
    const preferredHour = typeof preferred_hour === "number" ? preferred_hour : (currentSchedule.preferred_hour || 3);

    const nextRun = isEnabled
      ? calculateNextRunAt(newFreq, new Date(), preferredHour)
      : null;

    const { data: updated, error: updateErr } = await supabase
      .from("website_monitoring_schedules")
      .upsert({
        website_id: websiteId,
        user_id: user.id,
        enabled: isEnabled,
        frequency: newFreq,
        preferred_hour: preferredHour,
        next_run_at: nextRun ? nextRun.toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "website_id" })
      .select()
      .single();

    if (updateErr) {
      console.error("PUT monitoring schedule error:", updateErr);
      return NextResponse.json({ error: updateErr.message || "Failed to update monitoring schedule." }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("PUT monitoring schedule error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}
