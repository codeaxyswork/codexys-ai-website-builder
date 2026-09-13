import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yumsturujjjgdxsrqgbm.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_qZERNQHUEVJN_deBFMDGLw_DQgJDwcS";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkProductionDatabaseSchema() {
  console.log("==================================================");
  console.log("CHECKING PRODUCTION SUPABASE DATABASE SCHEMA");
  console.log(`URL: ${SUPABASE_URL}`);
  console.log("==================================================\n");

  const results: Record<string, boolean> = {};

  // 1. Check website_page_seo table
  try {
    const { data, error } = await supabase.from("website_page_seo").select("id").limit(1);
    if (!error) {
      console.log("[PASS] Table 'website_page_seo' exists in production.");
      results.website_page_seo = true;
    } else {
      console.log(`[FAIL/NOT MIGRATED] Table 'website_page_seo' error: ${error.message}`);
      results.website_page_seo = false;
    }
  } catch (err: any) {
    console.log(`[FAIL/NOT MIGRATED] Table 'website_page_seo' exception: ${err.message}`);
    results.website_page_seo = false;
  }

  // 2. Check seo_analysis_jobs table
  try {
    const { data, error } = await supabase.from("seo_analysis_jobs").select("id").limit(1);
    if (!error) {
      console.log("[PASS] Table 'seo_analysis_jobs' exists in production.");
      results.seo_analysis_jobs = true;
    } else {
      console.log(`[FAIL/NOT MIGRATED] Table 'seo_analysis_jobs' error: ${error.message}`);
      results.seo_analysis_jobs = false;
    }
  } catch (err: any) {
    console.log(`[FAIL/NOT MIGRATED] Table 'seo_analysis_jobs' exception: ${err.message}`);
    results.seo_analysis_jobs = false;
  }

  // 3. Check website_seo column additions
  try {
    const { data, error } = await supabase
      .from("website_seo")
      .select("is_dirty, analysis_status, critical_issues_count, warnings_count, opportunities_count, passed_checks_count, last_analyzed_at, analysis_version")
      .limit(1);
    if (!error) {
      console.log("[PASS] Columns 'is_dirty', 'analysis_status', 'critical_issues_count', 'analysis_version', etc. exist on 'website_seo'.");
      results.website_seo_columns = true;
    } else {
      console.log(`[FAIL/NOT MIGRATED] 'website_seo' new columns error: ${error.message}`);
      results.website_seo_columns = false;
    }
  } catch (err: any) {
    console.log(`[FAIL/NOT MIGRATED] 'website_seo' columns exception: ${err.message}`);
    results.website_seo_columns = false;
  }

  // 4. Check seo_analysis_history column additions
  try {
    const { data, error } = await supabase
      .from("seo_analysis_history")
      .select("trigger_type, analysis_version, critical_issues_count, warnings_count, opportunities_count")
      .limit(1);
    if (!error) {
      console.log("[PASS] Columns 'trigger_type', 'analysis_version', etc. exist on 'seo_analysis_history'.");
      results.seo_analysis_history_columns = true;
    } else {
      console.log(`[FAIL/NOT MIGRATED] 'seo_analysis_history' new columns error: ${error.message}`);
      results.seo_analysis_history_columns = false;
    }
  } catch (err: any) {
    console.log(`[FAIL/NOT MIGRATED] 'seo_analysis_history' columns exception: ${err.message}`);
    results.seo_analysis_history_columns = false;
  }

  console.log("\n--------------------------------------------------");
  console.log("SCHEMA AUDIT RESULTS:", results);
  console.log("--------------------------------------------------\n");

  const allPassed = Object.values(results).every(Boolean);
  if (allPassed) {
    console.log(">>> MIGRATION IS ALREADY FULLY APPLIED TO PRODUCTION DATABASE. <<<");
  } else {
    console.log(">>> MIGRATION IS NOT YET APPLIED TO PRODUCTION DATABASE. <<<");
  }
}

checkProductionDatabaseSchema().catch(console.error);
