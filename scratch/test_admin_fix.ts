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

async function testAdminUpdate() {
  const targetWebsiteId = "a12be960-0d9d-481f-b974-c0219685e7eb";

  // Try creating an admin session
  const adminEmail = `fix_admin_${Date.now()}@codeaxys.com`;
  const adminPass = "Password123!";

  console.log(`Creating test user: ${adminEmail}...`);
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: adminEmail,
    password: adminPass,
  });

  console.log("Auth signup result:", { userId: authData.user?.id, hasSession: !!authData.session, authErr });

  if (authData.user && authData.session) {
    // Insert profile with role: 'admin'
    console.log("Inserting admin profile...");
    const { data: profData, error: profErr } = await supabase
      .from("profiles")
      .insert({
        id: authData.user.id,
        full_name: "Admin Fixer",
        role: "admin",
        status: "active",
      })
      .select();

    console.log("Profile insert result:", { profData, profErr });

    // Now attempt update on website
    console.log("Attempting website title update with admin session...");
    const { data: updateData, error: updateErr } = await supabase
      .from("websites")
      .update({ title: "Velocity Motors" })
      .eq("id", targetWebsiteId)
      .select();

    console.log("Website update result:", { updateData, updateErr });
  }
}

testAdminUpdate();
