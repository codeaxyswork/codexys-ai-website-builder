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

const emails = ["user@example.com", "test@example.com", "admin@example.com"];
const passwords = ["password123", "password", "123456", "Password123!", "admin123", "secret", "codeaxys"];

async function checkLogin() {
  const targetUserId = "0b0c2e91-4c06-438d-92a6-053d37843b14";

  for (const email of emails) {
    for (const password of passwords) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (data?.session) {
        console.log(`✅ SUCCESS! Logged in as ${email}. User ID: ${data.user.id}`);
        if (data.user.id === targetUserId) {
          console.log("🎯 EXACT OWNER USER ID MATCH!");
        }
        return { supabase, session: data.session, user: data.user };
      }
    }
  }
  console.log("❌ No password match among tested combinations.");
}

checkLogin();
