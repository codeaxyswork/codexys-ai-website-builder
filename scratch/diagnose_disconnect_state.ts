import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://yumsturujjjgdxsrqgbm.supabase.co";
const ANON_KEY = "sb_publishable_qZERNQHUEVJN_deBFMDGLw_DQgJDwcS";

async function run() {
  console.log("=== DIAGNOSING DISCONNECT STATE IN PRODUCTION ===");
  const supabase = createClient(SUPABASE_URL, ANON_KEY);

  // 1. Fetch Velocity Motors site
  const { data: site } = await supabase
    .from("websites")
    .select("id, title, slug, published_slug, user_id")
    .eq("id", "a12be960-0d9d-481f-b974-c0219685e7eb")
    .single();

  console.log("Target site:", site);

  // 2. Query production performance API directly via HTTP fetch to live site
  const liveUrl = "https://codexys-ai-website-builder.vercel.app/api/websites/a12be960-0d9d-481f-b974-c0219685e7eb/seo/gsc/performance";
  console.log("Fetching live performance URL:", liveUrl);
  const perfRes = await fetch(liveUrl);
  console.log("Live performance HTTP status:", perfRes.status);
  const perfJson = await perfRes.json().catch(() => ({}));
  console.log("Live performance response:", JSON.stringify(perfJson, null, 2));
}

run();
