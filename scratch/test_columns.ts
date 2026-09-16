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

async function testSelectColumns() {
  console.log("=== TESTING WEBSITES COLUMN SELECT ===");

  const websiteId = "a12be960-0d9d-481f-b974-c0219685e7eb";

  // Test 1: select id, user_id, title, pages, html_content
  const { data: w1, error: e1 } = await supabase
    .from("websites")
    .select("id, user_id, title, pages, html_content")
    .eq("id", websiteId)
    .single();

  console.log("\nTest 1 (select id, user_id, title, pages, html_content):");
  console.log("Error:", e1);
  console.log("Data:", w1);

  // Test 2: select id, user_id, title
  const { data: w2, error: e2 } = await supabase
    .from("websites")
    .select("id, user_id, title")
    .eq("id", websiteId)
    .single();

  console.log("\nTest 2 (select id, user_id, title):");
  console.log("Error:", e2);
  console.log("Data:", w2);
}

testSelectColumns();
