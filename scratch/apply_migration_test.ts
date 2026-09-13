import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yumsturujjjgdxsrqgbm.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_qZERNQHUEVJN_deBFMDGLw_DQgJDwcS";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testApplyMigration() {
  console.log("Attempting to execute migration against Supabase production database...");
  const sqlScript = fs.readFileSync("supabase/migrations/20260913_seo_phase1.sql", "utf8");

  // Attempt RPC execute if available
  const { data, error } = await supabase.rpc("exec_sql", { query: sqlScript });
  console.log("RPC exec_sql result:", { data, error });
}

testApplyMigration().catch(console.error);
