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

const supabase = createClient(supabaseUrl, anonKey);

async function testSignIn() {
  const testEmail = "developer@codeaxys.com";
  const testPass = "CodeaxysPass123!";

  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPass,
  });

  console.log("SignIn response:", {
    user: signInData?.user?.id,
    session: !!signInData?.session,
    error: signInErr?.message,
  });

  if (signInData?.session) {
    console.log("Access Token acquired!");
  }
}

testSignIn();
