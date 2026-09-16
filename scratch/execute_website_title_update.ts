import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key] && val && val !== "[SENSITIVE]") {
        process.env[key] = val;
      }
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yumsturujjjgdxsrqgbm.supabase.co";

async function executeTitleFix() {
  const targetId = "a12be960-0d9d-481f-b974-c0219685e7eb";
  const expectedOwner = "0b0c2e91-4c06-438d-92a6-053d37843b14";
  const newTitle = "Velocity Motors";

  if (!serviceKey || serviceKey === "[SENSITIVE]") {
    console.log("❌ SUPABASE_SERVICE_ROLE_KEY is required to bypass RLS for direct record updates.");
    console.log("Please run this script with your SUPABASE_SERVICE_ROLE_KEY:");
    console.log(`SUPABASE_SERVICE_ROLE_KEY="<your_service_role_key>" npx tsx scratch/execute_website_title_update.ts`);
    console.log("\nOr execute the following SQL statement directly in your Supabase SQL Editor:");
    console.log(`UPDATE public.websites SET title = '${newTitle}', updated_at = NOW() WHERE id = '${targetId}' AND user_id = '${expectedOwner}';`);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Verify before update
  const { data: before, error: beforeErr } = await supabase
    .from("websites")
    .select("*")
    .eq("id", targetId)
    .single();

  if (beforeErr || !before) {
    console.error("❌ Pre-update verification failed. Record not found:", beforeErr);
    process.exit(1);
  }

  if (before.user_id !== expectedOwner) {
    console.error(`❌ Owner mismatch! Expected ${expectedOwner}, found ${before.user_id}`);
    process.exit(1);
  }

  const oldTitle = before.title;
  console.log("✅ Website ID matched:", before.id);
  console.log("✅ Website Owner matched:", before.user_id);
  console.log("Old Title:", oldTitle);

  // 2. Perform DATA-ONLY update on websites.title
  const { error: updateErr } = await supabase
    .from("websites")
    .update({ title: newTitle, updated_at: new Date().toISOString() })
    .eq("id", targetId)
    .eq("user_id", expectedOwner);

  if (updateErr) {
    console.error("❌ Update failed:", updateErr);
    process.exit(1);
  }

  // 3. Post-update verification
  const { data: after, error: afterErr } = await supabase
    .from("websites")
    .select("*")
    .eq("id", targetId)
    .single();

  if (afterErr || !after) {
    console.error("❌ Post-update verification failed:", afterErr);
    process.exit(1);
  }

  // Compare fields to confirm ONLY title (and updated_at) changed
  const alteredFields: string[] = [];
  for (const key of Object.keys(before)) {
    if (key === "updated_at") continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      alteredFields.push(key);
    }
  }

  console.log("\n==========================================");
  console.log("VERIFICATION RESULT:");
  console.log("==========================================");
  console.log("Single Record Updated:", after.title === newTitle);
  console.log("Old Title:", oldTitle);
  console.log("New Title:", after.title);
  console.log("Altered Fields:", alteredFields);
  console.log("Confirmation no other fields changed:", alteredFields.length === 1 && alteredFields[0] === "title");
}

executeTitleFix();
