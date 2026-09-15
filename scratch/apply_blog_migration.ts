import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

function getServiceKey() {
  const envPath = path.join(process.cwd(), ".env.production.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    const match = content.match(/SUPABASE_SERVICE_ROLE_KEY=["']?([^"'\r\n]+)["']?/);
    if (match && match[1] && match[1] !== "[SENSITIVE]") {
      return match[1];
    }
  }
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_qZERNQHUEVJN_deBFMDGLw_DQgJDwcS";
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yumsturujjjgdxsrqgbm.supabase.co";
const SUPABASE_KEY = getServiceKey();

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyOrInsertDummy() {
  console.log("Checking blog_posts table in Supabase database...");
  const { data, error } = await supabase.from("blog_posts").select("id").limit(1);

  if (!error) {
    console.log("[SUCCESS] 'blog_posts' table exists and is accessible.");
  } else {
    console.log("[INFO] Table query status:", error.message);
  }
}

verifyOrInsertDummy().catch(console.error);
