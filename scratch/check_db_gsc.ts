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
  console.log("=== GSC DIAGNOSTIC SCRIPT ===");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", { supabaseUrl: !!supabaseUrl, serviceKey: !!serviceKey });
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Fetch websites
  const { data: websites, error: siteErr } = await supabase
    .from("websites")
    .select("id, title, slug, published_slug, custom_domain, user_id");

  if (siteErr) {
    console.error("Error fetching websites:", siteErr);
    process.exit(1);
  }

  console.log(`Found ${websites.length} websites:`);
  for (const site of websites) {
    console.log(` - ID: ${site.id} | Title: "${site.title}" | Slug: "${site.slug}" | PublishedSlug: "${site.published_slug}" | Domain: "${site.custom_domain}"`);
  }

  // Find Velocity Motors
  const velocitySite = websites.find(w => 
    (w.title && w.title.toLowerCase().includes("velocity")) || 
    (w.slug && w.slug.toLowerCase().includes("velocity")) ||
    (w.published_slug && w.published_slug.toLowerCase().includes("velocity"))
  );

  if (!velocitySite) {
    console.error("Velocity Motors website not found in DB!");
    process.exit(1);
  }

  console.log("\nTarget Velocity Motors Site:", velocitySite);

  // 2. Fetch GSC Credentials
  const { data: creds, error: credErr } = await supabase
    .from("gsc_oauth_credentials")
    .select("*")
    .eq("website_id", velocitySite.id);

  if (credErr) {
    console.error("Error fetching credentials:", credErr);
    process.exit(1);
  }

  console.log(`\nFound ${creds?.length || 0} credential records for site ${velocitySite.id}`);

  if (!creds || creds.length === 0) {
    console.error("No GSC OAuth credentials stored for Velocity Motors!");
    process.exit(1);
  }

  const cred = creds[0];
  console.log("Credentials metadata:", {
    website_id: cred.website_id,
    provider: cred.provider,
    token_expires_at: cred.token_expires_at,
    is_expired: Date.now() >= Number(cred.token_expires_at),
    scope: cred.scope,
    updated_at: cred.updated_at
  });

  const accessToken = decryptGscToken(cred.encrypted_access_token);
  const refreshToken = decryptGscToken(cred.encrypted_refresh_token);

  console.log("Token decryption check:", {
    has_access_token: !!accessToken,
    has_refresh_token: !!refreshToken
  });

  if (!accessToken && !refreshToken) {
    console.error("Failed to decrypt tokens!");
    process.exit(1);
  }

  let activeAccessToken = accessToken;

  // Refresh token if needed
  if (!activeAccessToken || Date.now() >= Number(cred.token_expires_at) - 60000) {
    console.log("Access token is expired or missing. Refreshing using refresh token...");
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret || !refreshToken) {
      console.error("Missing clientId, clientSecret, or refreshToken to perform refresh.");
      process.exit(1);
    }

    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });

    const refreshData = await refreshRes.json();
    if (!refreshRes.ok) {
      console.error("Refresh token request failed:", refreshRes.status, refreshData);
      process.exit(1);
    }

    activeAccessToken = refreshData.access_token;
    console.log("Access token successfully refreshed!");
  }

  // 3. Test GET /webmasters/v3/sites (sites.list)
  console.log("\n--- Calling Google Search Console API sites.list ---");
  const listRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: {
      Authorization: `Bearer ${activeAccessToken}`,
      Accept: "application/json",
    },
  });

  console.log("sites.list HTTP Status:", listRes.status);
  const listData = await listRes.json();
  console.log("sites.list Response Payload:", JSON.stringify(listData, null, 2));

  // 4. Test GET /webmasters/v3/sites/{siteUrl} (sites.get) for candidate URLs
  const baseUrl = "https://codexys-ai-website-builder.vercel.app";
  const pubSlug = velocitySite.published_slug || velocitySite.slug;

  const candidateUrls = [
    `${baseUrl}/site/${pubSlug}/`,
    `${baseUrl}/site/${pubSlug}`,
  ];

  if (velocitySite.custom_domain) {
    const cleanDomain = velocitySite.custom_domain.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    candidateUrls.push(`https://${cleanDomain}/`);
    candidateUrls.push(`https://${cleanDomain}`);
  }

  console.log("\n--- Testing Candidate URLs via sites.get ---");
  for (const candidateUrl of candidateUrls) {
    const encodedUrl = encodeURIComponent(candidateUrl);
    const getEndpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodedUrl}`;
    console.log(`\nTesting candidateUrl: "${candidateUrl}"`);
    console.log(`Encoded URL: "${encodedUrl}"`);
    console.log(`Request Endpoint: "${getEndpoint}"`);

    const getRes = await fetch(getEndpoint, {
      headers: {
        Authorization: `Bearer ${activeAccessToken}`,
        Accept: "application/json",
      },
    });

    console.log(`sites.get HTTP Status for ${candidateUrl}:`, getRes.status);
    const getBody = await getRes.json().catch(() => ({}));
    console.log(`sites.get Body for ${candidateUrl}:`, JSON.stringify(getBody, null, 2));
  }
}

main().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
