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

async function testAuthMethods() {
  console.log("Checking session...");
  const { data: sessionData } = await supabase.auth.getSession();
  console.log("Session:", sessionData.session);

  // Check if we can sign in with dummy password for testing
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: "test@example.com",
    password: "password123",
  });
  console.log("Sign in result:", { signInData, signInErr });
}

testAuthMethods();
