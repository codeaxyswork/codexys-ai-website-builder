import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

function getServiceKey() {
  const envPath = path.join(process.cwd(), ".env.production.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    const match = content.match(/SUPABASE_SERVICE_ROLE_KEY=["']?([^"'\r\n]+)["']?/);
    if (match && match[1] && match[1] !== "[SENSITIVE]") {
      return match[1];
    }
  }
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_qZERNQHUEVJN_deBFMDGLw_DQgJDwcS";
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yumsturujjjgdxsrqgbm.supabase.co";
const SUPABASE_KEY = getServiceKey();

console.log("Using Supabase Key prefix:", SUPABASE_KEY.substring(0, 15));

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectAndUpdate() {
  const websiteId = "a12be960-0d9d-481f-b974-c0219685e7eb";

  console.log("=== INSPECTING WEBSITE & USER ===");
  const { data: website, error: webErr } = await supabase
    .from("websites")
    .select("id, user_id, title, slug")
    .eq("id", websiteId)
    .single();

  if (webErr || !website) {
    console.error("Website error:", webErr);
    return;
  }

  console.log("Website found:", website);
  const userId = website.user_id;

  // 1. Check current subscription before
  const { data: subBefore } = await supabase
    .from("subscriptions")
    .select("*, plans(*)")
    .eq("user_id", userId)
    .maybeSingle();

  console.log("Subscription BEFORE:", subBefore);

  // 2. Check user credits before
  const { data: creditsBefore } = await supabase
    .from("user_credits")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  console.log("Credits BEFORE:", creditsBefore);

  // 3. Check website_seo before
  const { data: seoBefore } = await supabase
    .from("website_seo")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  console.log("SEO Score BEFORE:", seoBefore?.seo_score);

  // 4. Upgrade user subscription to 'pro' and active
  const now = new Date();
  const periodEnd = new Date();
  periodEnd.setDate(now.getDate() + 30);

  const { data: updatedSub, error: subUpsertErr } = await supabase
    .from("subscriptions")
    .upsert({
      user_id: userId,
      plan_id: "pro",
      status: "active",
      billing_provider: "mock",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: "user_id" })
    .select()
    .single();

  if (subUpsertErr) {
    console.error("Subscription upgrade error:", subUpsertErr);
  } else {
    console.log("Subscription AFTER UPGRADE:", updatedSub);
  }

  // 5. Ensure user credits balance is sufficient (500 for Pro)
  const { data: updatedCredits, error: creditErr } = await supabase
    .from("user_credits")
    .upsert({
      user_id: userId,
      balance: 500,
      updated_at: now.toISOString(),
    }, { onConflict: "user_id" })
    .select()
    .single();

  if (creditErr) {
    console.error("User credits error:", creditErr);
  } else {
    console.log("Credits AFTER UPGRADE:", updatedCredits);
  }
}

inspectAndUpdate().catch(console.error);
