import { createClient } from "@supabase/supabase-js";
import { loadGscCredentials, refreshGscAccessToken } from "../lib/gsc-client";

async function diagnose() {
  console.log("=== DIAGNOSING GOOGLE SEARCH CONSOLE PROPERTIES API RESPONSE ===");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yumsturujjjgdxsrqgbm.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY is missing in environment.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Find velocity motors website
  const { data: website, error: siteErr } = await supabase
    .from("websites")
    .select("id, title, published_slug, slug")
    .or("published_slug.eq.velocity-motors-an-elite-cinematic-automotive-gallery,slug.eq.velocity-motors-an-elite-cinematic-automotive-gallery")
    .maybeSingle();

  if (siteErr || !website) {
    console.error("❌ Velocity Motors website record not found in Supabase:", siteErr);
    process.exit(1);
  }

  console.log(`✅ Found website: ID = ${website.id}, Slug = ${website.published_slug || website.slug}`);

  // 2. Load stored GSC credentials
  const creds = await loadGscCredentials(supabase, website.id);

  if (!creds.access_token && !creds.refresh_token) {
    console.error("❌ No GSC OAuth credentials found in gsc_oauth_credentials for website:", website.id);
    process.exit(1);
  }

  console.log(`✅ Loaded GSC OAuth credentials: Has AccessToken = ${!!creds.access_token}, Has RefreshToken = ${!!creds.refresh_token}, ExpiresAt = ${new Date(creds.token_expires_at).toISOString()}`);

  let accessToken = creds.access_token;
  if ((!accessToken || Date.now() >= creds.token_expires_at - 60000) && creds.refresh_token) {
    console.log("🔄 Access token expired or expiring soon. Refreshing access token...");
    const refreshed = await refreshGscAccessToken(creds.refresh_token);
    accessToken = refreshed.access_token;
    console.log("✅ Successfully refreshed access token.");
  }

  if (!accessToken) {
    console.error("❌ Failed to obtain valid access token.");
    process.exit(1);
  }

  // 3. Call v3 endpoint: https://www.googleapis.com/webmasters/v3/sites
  console.log("\n--- Calling Google Webmasters API v3: GET https://www.googleapis.com/webmasters/v3/sites ---");
  const resV3 = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  console.log(`v3 HTTP Status: ${resV3.status} ${resV3.statusText}`);
  const jsonV3 = await resV3.json();
  console.log("v3 Raw Response Body:\n", JSON.stringify(jsonV3, null, 2));

  // 4. Call v1 endpoint: https://searchconsole.googleapis.com/v1/sites
  console.log("\n--- Calling Search Console API v1: GET https://searchconsole.googleapis.com/v1/sites ---");
  const resV1 = await fetch("https://searchconsole.googleapis.com/v1/sites", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  console.log(`v1 HTTP Status: ${resV1.status} ${resV1.statusText}`);
  const jsonV1 = await resV1.json();
  console.log("v1 Raw Response Body:\n", JSON.stringify(jsonV1, null, 2));
}

diagnose().catch((err) => {
  console.error("Diagnostic Error:", err);
  process.exit(1);
});
