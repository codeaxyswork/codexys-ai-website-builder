import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { runMonitoringAuditForWebsite, getOrCreateMonitoringSchedule, calculateNextRunAt } from "@/lib/seo-monitoring-engine";

export async function POST(
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

    // 3. Run full multi-category deterministic monitoring audit (0 AI credits)
    const auditResult = await runMonitoringAuditForWebsite(supabase, websiteId, user.id);

    // 4. Update schedule record
    const schedule = await getOrCreateMonitoringSchedule(supabase, websiteId, user.id);
    const nowIso = new Date().toISOString();
    const nextRun = schedule.enabled
      ? calculateNextRunAt(schedule.frequency, new Date(), schedule.preferred_hour || 3)
      : null;

    await supabase
      .from("website_monitoring_schedules")
      .update({
        last_run_at: nowIso,
        last_successful_run_at: nowIso,
        next_run_at: nextRun ? nextRun.toISOString() : null,
        failure_count: 0,
        last_error: null,
        updated_at: nowIso,
      })
      .eq("website_id", websiteId);

    return NextResponse.json({
      success: true,
      auditResult,
    });
  } catch (err: any) {
    console.error("POST monitoring run error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}
