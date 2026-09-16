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

console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Key Present:", !!supabaseKey);

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log("=== LOCAL DATABASE DIAGNOSIS ===");

  // 1. List websites in local DB
  const { data: websites, error: webErr } = await supabase
    .from("websites")
    .select("id, user_id, title, created_at");

  console.log("\nWebsites in database:", webErr ? webErr : JSON.stringify(websites, null, 2));

  // 2. List auth users in local DB if service role key available
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data: { users }, error: usersErr } = await supabase.auth.admin.listUsers();
    console.log("\nAuth users in database:", usersErr ? usersErr : users?.map(u => ({ id: u.id, email: u.email })));
  }

  // 3. Check internal links table
  const { data: links, error: linkErr } = await supabase
    .from("website_internal_links")
    .select("id, website_id, internal_link_score");
  console.log("\nWebsite internal links rows:", linkErr ? linkErr : JSON.stringify(links, null, 2));
}

diagnose();
