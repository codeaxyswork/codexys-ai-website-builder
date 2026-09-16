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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function attemptUpdate() {
  const targetId = "a12be960-0d9d-481f-b974-c0219685e7eb";
  const userId = "0b0c2e91-4c06-438d-92a6-053d37843b14";

  console.log("Supabase URL:", supabaseUrl);
  console.log("Target Website ID:", targetId);
  console.log("Target Owner User ID:", userId);

  // Test update using supabase client
  const supabase = createClient(supabaseUrl, anonKey);

  const { data: before, error: errBefore } = await supabase
    .from("websites")
    .select("id, user_id, title, slug, prompt, is_published, updated_at")
    .eq("id", targetId)
    .single();

  console.log("\n--- BEFORE UPDATE ---");
  console.log("Website Record Found:", before);

  if (!before) {
    console.error("Website not found!");
    return;
  }

  const oldTitle = before.title;
  console.log("Old Title:", oldTitle);

  // Attempt update
  const res = await fetch(`${supabaseUrl}/rest/v1/websites?id=eq.${targetId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "apikey": anonKey,
      "Authorization": `Bearer ${anonKey}`,
      "Prefer": "return=representation"
    },
    body: JSON.stringify({
      title: "Velocity Motors"
    })
  });

  console.log("\n--- PATCH REST RESULT ---");
  console.log("HTTP Status:", res.status);
  const text = await res.text();
  console.log("HTTP Response Text:", text);

  // Verify
  const { data: after } = await supabase
    .from("websites")
    .select("id, user_id, title, slug, prompt, is_published, updated_at")
    .eq("id", targetId)
    .single();

  console.log("\n--- AFTER UPDATE ---");
  console.log("After Title:", after?.title);
}

attemptUpdate();
