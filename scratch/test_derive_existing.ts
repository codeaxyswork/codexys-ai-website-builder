import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { deriveWebsiteTitle } from "../lib/website-title-helper";

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

async function testDeriveForExisting() {
  const websiteId = "a12be960-0d9d-481f-b974-c0219685e7eb";

  // Fetch website + page html
  const { data: website } = await supabase.from("websites").select("*").eq("id", websiteId).single();
  const { data: pages } = await supabase.from("website_pages").select("*").eq("website_id", websiteId);

  const files = [
    { path: "index.html", content: pages?.[0]?.html_content || "" }
  ];

  console.log("Raw DB title:", website?.title);
  
  // Call deriveWebsiteTitle
  const cleanTitle = deriveWebsiteTitle(website?.design_plan, files, website?.prompt);
  console.log("Derived Title:", cleanTitle);
}

testDeriveForExisting();
