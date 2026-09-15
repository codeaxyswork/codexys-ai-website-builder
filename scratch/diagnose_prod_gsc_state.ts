import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { decryptGscToken } from "../lib/gsc-client";

function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env.production.local"));
loadEnvFile(path.join(process.cwd(), ".env.local"));

async function main() {
  console.log("=== SAFE PRODUCTION STATE DIAGNOSTIC ===");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Fetch Velocity Motors Website
  const { data: websites, error: siteErr } = await supabase
    .from("websites")
    .select("id, title, slug, published_slug, custom_domain, user_id, updated_at");

  if (siteErr) {
    console.error("Error fetching websites:", siteErr);
    process.exit(1);
  }

  const velocitySite = websites.find(w => 
    (w.title && w.title.toLowerCase().includes("velocity")) || 
    (w.slug && w.slug.toLowerCase().includes("velocity")) ||
    (w.published_slug && w.published_slug.toLowerCase().includes("velocity"))
  );

  if (!velocitySite) {
    console.error("Velocity Motors website not found in DB!");
    process.exit(1);
  }

  console.log("\n[Website Record]");
  console.log(` - ID: ${velocitySite.id}`);
  console.log(` - Title: "${velocitySite.title}"`);
  console.log(` - Published Slug: "${velocitySite.published_slug}"`);

  // 2. Fetch seo_integrations record
  const { data: integrations, error: intErr } = await supabase
    .from("seo_integrations")
    .select("id, provider, status, configuration, connected_at, updated_at")
    .eq("website_id", velocitySite.id)
    .eq("provider", "google_search_console");

  console.log("\n[SEO Integrations Record]");
  if (intErr || !integrations || integrations.length === 0) {
    console.log(" - No seo_integrations record found for google_search_console");
  } else {
    const integration = integrations[0];
    const safeConfig = { ...integration.configuration };
    delete safeConfig.access_token;
    delete safeConfig.refresh_token;
    delete safeConfig.client_secret;

    console.log(` - Status: ${integration.status}`);
    console.log(` - Connected At: ${integration.connected_at}`);
    console.log(` - Updated At: ${integration.updated_at}`);
    console.log(` - Safe Configuration:`, JSON.stringify(safeConfig, null, 2));
  }

  // 3. Fetch gsc_oauth_credentials record
  const { data: creds, error: credErr } = await supabase
    .from("gsc_oauth_credentials")
    .select("website_id, user_id, provider, scope, token_expires_at, updated_at, encrypted_access_token, encrypted_refresh_token")
    .eq("website_id", velocitySite.id);

  console.log("\n[GSC OAuth Credentials Metadata]");
  if (credErr || !creds || creds.length === 0) {
    console.log(" - NO credential row exists in gsc_oauth_credentials for this website.");
  } else {
    const cred = creds[0];
    console.log(` - Credential Exists: YES`);
    console.log(` - Updated At: ${cred.updated_at}`);
    console.log(` - Token Expires At: ${cred.token_expires_at} (${new Date(Number(cred.token_expires_at)).toISOString()})`);
    console.log(` - Scope: ${cred.scope}`);
    console.log(` - Has Encrypted Access Token: ${!!cred.encrypted_access_token}`);
    console.log(` - Has Encrypted Refresh Token: ${!!cred.encrypted_refresh_token}`);

    // Reconnect fix timestamp: 2026-09-13T16:51:50Z (22:21:50 IST)
    const fixCommitTime = new Date("2026-09-13T16:51:50Z").getTime();
    const credUpdateTime = new Date(cred.updated_at).getTime();

    console.log("\n[Timestamp Comparison]");
    console.log(` - Fix Commit Time: 2026-09-13T16:51:50Z (${fixCommitTime})`);
    console.log(` - Credential Updated At: ${cred.updated_at} (${credUpdateTime})`);
    if (credUpdateTime > fixCommitTime) {
      console.log(` - Verdict: Credential was updated AFTER the OAuth reconnect fix.`);
    } else {
      console.log(` - Verdict: Credential was updated BEFORE the OAuth reconnect fix (OLD credential).`);
    }

    // Test token authorization status safely with Google APIs
    const accessToken = decryptGscToken(cred.encrypted_access_token);
    const refreshToken = decryptGscToken(cred.encrypted_refresh_token);

    let activeAccessToken = accessToken;
    if (!activeAccessToken || Date.now() >= Number(cred.token_expires_at) - 60000) {
      if (refreshToken && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        console.log("Refreshing token for diagnostic test...");
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }).toString(),
        });
        const refreshData = await refreshRes.json();
        if (refreshRes.ok) {
          activeAccessToken = refreshData.access_token;
          console.log("Token refresh succeeded.");
        } else {
          console.log("Token refresh failed:", refreshRes.status, refreshData.error);
        }
      }
    }

    if (activeAccessToken) {
      // Test tokeninfo safely
      const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${activeAccessToken}`);
      if (tokenInfoRes.ok) {
        const info = await tokenInfoRes.json();
        console.log("\n[Token Info Metadata]");
        console.log(` - Scope: ${info.scope}`);
        console.log(` - Expires In: ${info.expires_in}`);
        console.log(` - Email / Account: ${info.email || "not exposed by tokeninfo"}`);
      }

      // Test sites.get for exact property
      const targetProperty = "https://codexys-ai-website-builder.vercel.app/site/velocity-motors-an-elite-cinematic-automotive-gallery/";
      const encodedProp = encodeURIComponent(targetProperty);
      const getRes = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodedProp}`, {
        headers: { Authorization: `Bearer ${activeAccessToken}` }
      });
      console.log(`\n[GSC sites.get Test for ${targetProperty}]`);
      console.log(` - Status: ${getRes.status}`);
      const getBody = await getRes.json().catch(() => ({}));
      console.log(` - Payload:`, JSON.stringify(getBody));

      // Test searchAnalytics.query for exact property
      const queryRes = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodedProp}/searchAnalytics/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activeAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          startDate: "2026-09-01",
          endDate: "2026-09-13"
        })
      });
      console.log(`\n[GSC searchAnalytics.query Test]`);
      console.log(` - Status: ${queryRes.status}`);
      const queryBody = await queryRes.json().catch(() => ({}));
      console.log(` - Payload:`, JSON.stringify(queryBody));
    }
  }

  console.log("\n=== DIAGNOSTIC COMPLETE ===");
}

main().catch(err => {
  console.error("Diagnostic error:", err);
  process.exit(1);
});
