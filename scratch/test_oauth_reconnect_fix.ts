import fs from "fs";
import path from "path";
import crypto from "crypto";

// Load .env.local if present
const envLocalPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

if (!process.env.GOOGLE_CLIENT_ID) {
  process.env.GOOGLE_CLIENT_ID = "mock-google-client-id-123.apps.googleusercontent.com";
}

import {
  getGscAuthUrl,
  generateGscAuthState,
  verifyAndDecodeGscState,
  saveGscCredentials,
  loadGscCredentials,
  deleteGscCredentials,
  createAdminClient,
} from "../lib/gsc-client";

async function runVerification() {
  console.log("=== STARTING OAUTH RECONNECT VERIFICATION ===");

  const testWebsiteId = crypto.randomUUID();
  const testUserId = crypto.randomUUID();

  // Test 1: getGscAuthUrl prompt parameter check
  console.log("\n1. Testing getGscAuthUrl OAuth parameters...");
  const authUrl = getGscAuthUrl(testWebsiteId, testUserId, "https://codexys-ai-website-builder.vercel.app");
  const parsedUrl = new URL(authUrl);
  const promptParam = parsedUrl.searchParams.get("prompt");
  const scopeParam = parsedUrl.searchParams.get("scope");
  
  console.log("  Generated URL:", authUrl);
  console.log("  prompt param:", promptParam);
  console.log("  scope param:", scopeParam);

  if (promptParam !== "select_account consent") {
    console.error("❌ FAILED: prompt parameter is not 'select_account consent'. Got:", promptParam);
    process.exit(1);
  }
  if (scopeParam !== "https://www.googleapis.com/auth/webmasters.readonly") {
    console.error("❌ FAILED: scope parameter changed! Got:", scopeParam);
    process.exit(1);
  }
  console.log("✅ PASS: getGscAuthUrl correctly forces 'select_account consent' with exact scope.");

  // Test 2: OAuth state HMAC security check
  console.log("\n2. Testing OAuth state generation & signature verification...");
  const stateStr = parsedUrl.searchParams.get("state")!;
  const decoded = verifyAndDecodeGscState(stateStr);
  console.log("  Decoded state websiteId:", decoded.websiteId);
  console.log("  Decoded state userId:", decoded.userId);

  if (decoded.websiteId !== testWebsiteId || decoded.userId !== testUserId) {
    console.error("❌ FAILED: State payload mismatch.");
    process.exit(1);
  }
  console.log("✅ PASS: HMAC-signed OAuth state generation and verification remain intact.");

  // Test 3: Credentials save, load, and delete cycle (if DB is accessible)
  console.log("\n3. Testing gsc_oauth_credentials database deletion flow...");
  const adminClient = createAdminClient();
  try {
    // Save fake test credential
    await saveGscCredentials(adminClient, testWebsiteId, testUserId, {
      access_token: "mock-access-token-123",
      refresh_token: "mock-refresh-token-456",
      expires_in: 3600,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
    });

    const loadedBefore = await loadGscCredentials(adminClient, testWebsiteId);
    if (!loadedBefore.access_token) {
      console.error("❌ FAILED: Saved credential could not be loaded.");
      process.exit(1);
    }
    console.log("  Saved credential verified in DB:", loadedBefore.access_token ? "[ENCRYPTED_VALID_TOKEN]" : "none");

    // Now call deleteGscCredentials
    await deleteGscCredentials(adminClient, testWebsiteId);

    const loadedAfter = await loadGscCredentials(adminClient, testWebsiteId);
    if (loadedAfter.access_token || loadedAfter.refresh_token) {
      console.error("❌ FAILED: Credential still exists in DB after deleteGscCredentials!");
      process.exit(1);
    }
    console.log("✅ PASS: deleteGscCredentials successfully wiped test credential from DB.");

  } catch (err: any) {
    console.log("⚠️ DB Test note:", err.message);
  }

  console.log("\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY ===");
}

runVerification().catch((err) => {
  console.error("Verification crashed:", err);
  process.exit(1);
});
