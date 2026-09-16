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

async function runSingleDataUpdate() {
  const targetId = "a12be960-0d9d-481f-b974-c0219685e7eb";

  console.log("=================================================");
  console.log("STEP 1: BEFORE UPDATE CHECK");
  console.log("=================================================");
  
  // Select full record before update
  const { data: beforeRecord, error: beforeErr } = await supabase
    .from("websites")
    .select("*")
    .eq("id", targetId)
    .single();

  if (beforeErr || !beforeRecord) {
    console.error("❌ Failed to fetch website before update:", beforeErr);
    process.exit(1);
  }

  console.log("Target Website ID:", beforeRecord.id);
  console.log("Target User ID (Owner):", beforeRecord.user_id);
  console.log("Current (Old) Title:", beforeRecord.title);
  console.log("Slug:", beforeRecord.slug);

  // Check user exists
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const ownerUser = users?.find(u => u.id === beforeRecord.user_id);
    console.log("Owner Email in Auth:", ownerUser ? ownerUser.email : "Found matching user ID");
  }

  const oldTitle = beforeRecord.title;

  console.log("\n=================================================");
  console.log("STEP 2: PERFORM DATA-ONLY UPDATE");
  console.log("=================================================");

  const { data: updateRes, error: updateErr } = await supabase
    .from("websites")
    .update({ title: "Velocity Motors" })
    .eq("id", targetId)
    .select();

  if (updateErr) {
    console.error("❌ Update failed:", updateErr);
    process.exit(1);
  }

  console.log("Update database response:", updateRes);

  console.log("\n=================================================");
  console.log("STEP 3: AFTER UPDATE VERIFICATION");
  console.log("=================================================");

  const { data: afterRecord, error: afterErr } = await supabase
    .from("websites")
    .select("*")
    .eq("id", targetId)
    .single();

  if (afterErr || !afterRecord) {
    console.error("❌ Verification failed:", afterErr);
    process.exit(1);
  }

  console.log("Target Website ID:", afterRecord.id);
  console.log("New Title:", afterRecord.title);

  // Verify that ONLY title changed
  const changedKeys: string[] = [];
  for (const key of Object.keys(beforeRecord)) {
    if (key === "updated_at") continue; // auto timestamp if any
    if (JSON.stringify(beforeRecord[key]) !== JSON.stringify(afterRecord[key])) {
      changedKeys.push(key);
    }
  }

  console.log("\n=================================================");
  console.log("SUMMARY OF CHANGES");
  console.log("=================================================");
  console.log("Changed columns:", changedKeys);
  console.log("Old Title:", oldTitle);
  console.log("New Title:", afterRecord.title);
  console.log("Title equals 'Velocity Motors':", afterRecord.title === "Velocity Motors");
  console.log("Only 'title' changed:", changedKeys.length === 1 && changedKeys[0] === "title");
}

runSingleDataUpdate();
