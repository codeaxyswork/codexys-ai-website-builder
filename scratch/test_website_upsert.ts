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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, anonKey);

async function testUpsert() {
  const targetId = "a12be960-0d9d-481f-b974-c0219685e7eb";

  // Fetch record first to preserve all fields
  const { data: current, error: fetchErr } = await supabase
    .from("websites")
    .select("*")
    .eq("id", targetId)
    .single();

  if (fetchErr || !current) {
    console.error("Fetch error:", fetchErr);
    return;
  }

  console.log("Current record fetched:", { id: current.id, title: current.title, user_id: current.user_id });

  // Attempt upsert with title updated to Velocity Motors
  const updatedRecord = {
    ...current,
    title: "Velocity Motors",
    updated_at: new Date().toISOString()
  };

  const { data: upsertData, error: upsertErr } = await supabase
    .from("websites")
    .upsert(updatedRecord, { onConflict: "id" })
    .select();

  console.log("Upsert error:", upsertErr);
  console.log("Upsert data returned:", upsertData);

  // Re-verify after
  const { data: after } = await supabase
    .from("websites")
    .select("id, title, user_id")
    .eq("id", targetId)
    .single();

  console.log("After title:", after?.title);
}

testUpsert();
