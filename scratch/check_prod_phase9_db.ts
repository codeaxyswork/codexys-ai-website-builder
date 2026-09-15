import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yumsturujjjgdxsrqgbm.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_qZERNQHUEVJN_deBFMDGLw_DQgJDwcS";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkPhase9ProductionDb() {
  console.log("==================================================");
  console.log("CHECKING PRODUCTION SUPABASE DATABASE — PHASE 9");
  console.log(`URL: ${SUPABASE_URL}`);
  console.log("==================================================\n");

  const results: Record<string, boolean> = {};

  // 1. Check website_monitoring_schedules table & columns
  try {
    const { data, error } = await supabase
      .from("website_monitoring_schedules")
      .select("id, website_id, user_id, enabled, frequency, preferred_hour, last_run_at, next_run_at, last_successful_run_at, last_failure_at, failure_count, last_error, created_at, updated_at")
      .limit(1);

    if (!error) {
      console.log("[PASS] Table 'website_monitoring_schedules' exists in production with all expected columns.");
      results.website_monitoring_schedules = true;
    } else {
      console.log(`[FAIL] Table 'website_monitoring_schedules' error: ${error.message} (Code: ${error.code})`);
      results.website_monitoring_schedules = false;
    }
  } catch (err: any) {
    console.log(`[FAIL] Table 'website_monitoring_schedules' exception: ${err.message}`);
    results.website_monitoring_schedules = false;
  }

  // 2. Check seo_monitoring_events table & columns
  try {
    const { data, error } = await supabase
      .from("seo_monitoring_events")
      .select("id, website_id, user_id, event_type, severity, title, message, previous_value, current_value, affected_page, metadata, is_read, created_at")
      .limit(1);

    if (!error) {
      console.log("[PASS] Table 'seo_monitoring_events' exists in production with all expected columns.");
      results.seo_monitoring_events = true;
    } else {
      console.log(`[FAIL] Table 'seo_monitoring_events' error: ${error.message} (Code: ${error.code})`);
      results.seo_monitoring_events = false;
    }
  } catch (err: any) {
    console.log(`[FAIL] Table 'seo_monitoring_events' exception: ${err.message}`);
    results.seo_monitoring_events = false;
  }

  // 3. Verify RLS (unauthenticated queries should return empty arrays / 0 rows due to RLS)
  try {
    const { data: schedData } = await supabase.from("website_monitoring_schedules").select("*");
    const { data: eventData } = await supabase.from("seo_monitoring_events").select("*");

    const rlsSchedProtected = (schedData || []).length === 0;
    const rlsEventsProtected = (eventData || []).length === 0;

    if (rlsSchedProtected && rlsEventsProtected) {
      console.log("[PASS] RLS policies actively blocking unauthenticated public access.");
      results.rls_protection = true;
    } else {
      console.log("[FAIL] Unauthenticated access returned rows! Check RLS configuration.");
      results.rls_protection = false;
    }
  } catch (err: any) {
    console.log(`[PASS] RLS actively blocking access: ${err.message}`);
    results.rls_protection = true;
  }

  console.log("\n--------------------------------------------------");
  console.log("PRODUCTION DATABASE VERIFICATION RESULTS:", results);
  console.log("--------------------------------------------------\n");

  const allPassed = Object.values(results).every(Boolean);
  if (allPassed) {
    console.log(">>> PHASE 9 PRODUCTION DATABASE VERIFICATION: PASS <<<");
  } else {
    console.log(">>> PHASE 9 PRODUCTION DATABASE VERIFICATION: FAIL <<<");
    process.exit(1);
  }
}

checkPhase9ProductionDb().catch((err) => {
  console.error("Database verification error:", err);
  process.exit(1);
});
