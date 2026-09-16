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

async function directUpdateTest() {
  const targetId = "a12be960-0d9d-481f-b974-c0219685e7eb";

  console.log("Fetching before record...");
  const { data: before } = await supabase.from("websites").select("id, title, user_id").eq("id", targetId).single();
  console.log("Before record:", before);

  console.log("Executing update...");
  const { data, error, count, status, statusText } = await supabase
    .from("websites")
    .update({ title: "Velocity Motors" })
    .eq("id", targetId)
    .select();

  console.log("Update response:", { data, error, count, status, statusText });

  const { data: after } = await supabase.from("websites").select("id, title, user_id").eq("id", targetId).single();
  console.log("After record:", after);
}

directUpdateTest();
