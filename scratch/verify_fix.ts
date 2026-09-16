import { createClient } from "@supabase/supabase-js";
import fs from "fs";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  const envContent = fs.readFileSync(file, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnv(".env.local");
loadEnv(".env.development.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInternalLinksQuery() {
  const websiteId = "a12be960-0d9d-481f-b974-c0219685e7eb";
  const userId = "0b0c2e91-4c06-438d-92a6-053d37843b14";

  console.log("=== TESTING FIXED WEBSITE QUERY ===");
  const { data: website, error: siteError } = await supabase
    .from("websites")
    .select("id, user_id, title")
    .eq("id", websiteId)
    .eq("user_id", userId)
    .single();

  console.log("siteError:", siteError);
  console.log("website:", website);

  if (website && !siteError) {
    console.log("-> Ownership check SUCCESS! Query succeeds without column errors.");
  } else {
    console.log("-> Ownership check FAILED!");
  }
}

testInternalLinksQuery();
