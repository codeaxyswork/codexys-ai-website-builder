import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://yumsturujjjgdxsrqgbm.supabase.co";
const ANON_KEY = "sb_publishable_qZERNQHUEVJN_deBFMDGLw_DQgJDwcS";

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function testQuery() {
  console.log("Testing anon queries...");
  const { data: sites, error: siteErr } = await supabase
    .from("websites")
    .select("id, title, slug, published_slug, user_id");
  
  console.log("Websites query:", { count: sites?.length, siteErr });
  if (sites && sites.length > 0) {
    console.log("Websites sample:", sites.slice(0, 3));
  }

  const { data: ints, error: intErr } = await supabase
    .from("seo_integrations")
    .select("id, website_id, provider, status, configuration, connected_at, updated_at");

  console.log("SEO Integrations query:", { count: ints?.length, intErr });
  if (ints && ints.length > 0) {
    console.log("Integrations:", JSON.stringify(ints, null, 2));
  }
}

testQuery();
