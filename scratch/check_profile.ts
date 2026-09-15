import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yumsturujjjgdxsrqgbm.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_qZERNQHUEVJN_deBFMDGLw_DQgJDwcS";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkProfile() {
  const userId = "0b0c2e91-4c06-438d-92a6-053d37843b14";
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  console.log("Profile:", profile, error);
}

checkProfile().catch(console.error);
