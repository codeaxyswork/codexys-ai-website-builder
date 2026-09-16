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

// Load env files
loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env.development.local"));
loadEnvFile(path.join(process.cwd(), ".env.production.local"));

console.log("NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("SUPABASE_SERVICE_ROLE_KEY present:", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));
console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY present:", Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
