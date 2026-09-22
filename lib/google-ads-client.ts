import crypto from "crypto";
import { createClient as createSupabaseDirectClient } from "@supabase/supabase-js";
import { GoogleAdsCredentials, GoogleAdsCustomerAccount, KeywordPlannerRequest } from "./types";

const HMAC_SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXTAUTH_SECRET ||
  process.env.GOOGLE_CLIENT_SECRET ||
  "codeaxys-google-ads-secret-key-fallback";

// Derived 32-byte key for AES-256-GCM authenticated encryption
const ENCRYPTION_KEY = crypto.createHash("sha256").update(HMAC_SECRET).digest();

export interface GoogleAdsAuthStatePayload {
  websiteId: string;
  userId: string;
  timestamp: number;
  nonce: string;
}

export interface DeveloperTokenStatus {
  status: "configured" | "missing" | "pending_approval";
  message: string;
}

/**
 * Create server admin Supabase client using SUPABASE_SERVICE_ROLE_KEY if available
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yumsturujjjgdxsrqgbm.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceKey) {
    return createSupabaseDirectClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim().replace(/^["'\s]+|["'\s]+$/g, "");
  return createSupabaseDirectClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Check if GOOGLE_ADS_DEVELOPER_TOKEN is configured in server env
 */
export function checkDeveloperTokenStatus(): DeveloperTokenStatus {
  const devToken = (process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "").trim();
  if (!devToken || devToken === "YOUR_GOOGLE_ADS_DEVELOPER_TOKEN") {
    return {
      status: "missing",
      message: "GOOGLE_ADS_DEVELOPER_TOKEN is not configured in server environment variables.",
    };
  }
  return {
    status: "configured",
    message: "Developer token configured.",
  };
}

/**
 * Encrypt sensitive OAuth token using AES-256-GCM
 */
export function encryptGoogleAdsToken(tokenStr: string | null | undefined): string | null {
  if (!tokenStr) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(tokenStr, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt AES-256-GCM encrypted OAuth token
 */
export function decryptGoogleAdsToken(encryptedStr: string | null | undefined): string | null {
  if (!encryptedStr || !encryptedStr.includes(":")) return null;
  try {
    const [ivHex, authTagHex, encryptedText] = encryptedStr.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("AES-256-GCM Google Ads Decryption Error:", err);
    return null;
  }
}

/**
 * Save encrypted tokens into server-only google_ads_oauth_credentials table
 */
export async function saveGoogleAdsCredentials(
  supabase: any,
  websiteId: string,
  userId: string,
  tokens: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  }
) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey ? createAdminClient() : supabase;

  const encAccess = encryptGoogleAdsToken(tokens.access_token);
  const encRefresh = tokens.refresh_token ? encryptGoogleAdsToken(tokens.refresh_token) : undefined;
  const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined;

  const payload: any = {
    website_id: websiteId,
    user_id: userId,
    provider: "google_ads",
    updated_at: new Date().toISOString(),
  };

  if (encAccess) payload.encrypted_access_token = encAccess;
  if (encRefresh) payload.encrypted_refresh_token = encRefresh;
  if (expiresAt) payload.token_expires_at = expiresAt;
  if (tokens.scope) payload.scope = tokens.scope;

  const { error } = await dbClient
    .from("google_ads_oauth_credentials")
    .upsert(payload, { onConflict: "website_id" });

  if (error) {
    console.error("Failed to save google_ads_oauth_credentials:", error.message || error.code);
    throw new Error(`Failed to store Google Ads credentials securely: ${error.message}`);
  }
}

/**
 * Load and decrypt tokens from server-only google_ads_oauth_credentials table
 */
export async function loadGoogleAdsCredentials(
  supabase: any,
  websiteId: string
): Promise<GoogleAdsCredentials> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey ? createAdminClient() : supabase;

  const { data, error } = await dbClient
    .from("google_ads_oauth_credentials")
    .select("encrypted_access_token, encrypted_refresh_token, token_expires_at, scope, google_ads_customer_id")
    .eq("website_id", websiteId)
    .single();

  if (error || !data) {
    return {
      access_token: null,
      refresh_token: null,
      token_expires_at: 0,
      scope: null,
      google_ads_customer_id: null,
    };
  }

  return {
    access_token: decryptGoogleAdsToken(data.encrypted_access_token),
    refresh_token: decryptGoogleAdsToken(data.encrypted_refresh_token),
    token_expires_at: Number(data.token_expires_at) || 0,
    scope: data.scope || null,
    google_ads_customer_id: data.google_ads_customer_id || null,
  };
}

/**
 * Update selected Google Ads customer ID in database
 */
export async function updateSelectedGoogleAdsCustomer(
  supabase: any,
  websiteId: string,
  customerId: string
) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey ? createAdminClient() : supabase;

  const cleanId = customerId.replace(/-/g, "").trim();

  const { error } = await dbClient
    .from("google_ads_oauth_credentials")
    .update({
      google_ads_customer_id: cleanId,
      updated_at: new Date().toISOString(),
    })
    .eq("website_id", websiteId);

  if (error) {
    console.error("Failed to update selected google_ads_customer_id:", error.message || error.code);
    throw new Error(`Failed to save selected Google Ads customer account: ${error.message}`);
  }
}

/**
 * Delete Google Ads credentials from server-only table
 */
export async function deleteGoogleAdsCredentials(
  supabase: any,
  websiteId: string
): Promise<void> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey ? createAdminClient() : supabase;

  const { error } = await dbClient
    .from("google_ads_oauth_credentials")
    .delete()
    .eq("website_id", websiteId);

  if (error) {
    console.error("Failed to delete google_ads_oauth_credentials:", error.message || error.code);
    throw new Error(`Failed to disconnect Google Ads: ${error.message}`);
  }
}

/**
 * Generate HMAC-signed state for CSRF protection during OAuth
 */
export function generateGoogleAdsAuthState(websiteId: string, userId: string): string {
  const payload: GoogleAdsAuthStatePayload = {
    websiteId,
    userId,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const jsonStr = JSON.stringify(payload);
  const base64Payload = Buffer.from(jsonStr).toString("base64url");
  const signature = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(base64Payload)
    .digest("base64url");

  return `${base64Payload}.${signature}`;
}

/**
 * Verify and decode Google Ads OAuth state parameter
 */
export function verifyAndDecodeGoogleAdsState(stateStr: string): GoogleAdsAuthStatePayload {
  if (!stateStr || !stateStr.includes(".")) {
    throw new Error("Invalid OAuth state parameter structure.");
  }

  const [base64Payload, signature] = stateStr.split(".");
  const expectedSig = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(base64Payload)
    .digest("base64url");

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSig);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid OAuth state signature. Potential CSRF attempt.");
  }

  const jsonStr = Buffer.from(base64Payload, "base64url").toString("utf8");
  const payload: GoogleAdsAuthStatePayload = JSON.parse(jsonStr);

  const MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes max
  if (Date.now() - payload.timestamp > MAX_AGE_MS) {
    throw new Error("OAuth state token has expired. Please try connecting Google Ads again.");
  }

  return payload;
}

/**
 * Generate Google Ads Authorization URL
 */
export function getGoogleAdsAuthUrl(websiteId: string, userId: string, appUrl: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured on the server.");
  }

  const baseUrl = (appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://codexys-ai-website-builder.vercel.app").replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/seo/google-ads/callback`;
  const state = generateGoogleAdsAuthState(websiteId, userId);
  const scope = "https://www.googleapis.com/auth/adwords";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "select_account consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange OAuth code for Google Ads tokens
 */
export async function exchangeCodeForGoogleAdsTokens(
  code: string,
  appUrl: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) are missing.");
  }

  const baseUrl = (appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://codexys-ai-website-builder.vercel.app").replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/seo/google-ads/callback`;

  const bodyParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bodyParams.toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Google Ads Token Exchange Failed:", data);
    throw new Error(data.error_description || data.error || "Failed to exchange authorization code for Google Ads tokens.");
  }

  return data;
}

/**
 * Refresh Google Ads Access Token
 */
export async function refreshGoogleAdsAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) are missing.");
  }

  const bodyParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bodyParams.toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Google Ads Token Refresh Failed:", data);
    if (data.error === "invalid_grant") {
      throw new Error("Google Ads authorization has expired or been revoked. Please reconnect.");
    }
    throw new Error(data.error_description || data.error || "Failed to refresh Google Ads access token.");
  }

  return data;
}

/**
 * Fetch accessible Google Ads Customer accounts for authenticated account
 * Endpoint: GET https://googleads.googleapis.com/v17/customers:listAccessibleCustomers
 */
export async function fetchAccessibleGoogleAdsCustomers(
  accessToken: string
): Promise<GoogleAdsCustomerAccount[]> {
  const devTokenStatus = checkDeveloperTokenStatus();
  const devToken = (process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "").trim();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };

  if (devToken) {
    headers["developer-token"] = devToken;
  }

  const res = await fetch("https://googleads.googleapis.com/v17/customers:listAccessibleCustomers", {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error("Fetch Accessible Google Ads Customers Error:", res.status, errData);

    if (res.status === 401) {
      throw new Error("Google Ads authorization token expired or invalid.");
    }
    if (res.status === 403) {
      const msg = errData?.error?.message || "";
      if (msg.includes("DEVELOPER_TOKEN") || msg.includes("developer token")) {
        throw new Error("Google Ads Developer Token is missing, unapproved, or unauthorized. Please verify your developer token status in the Google Ads API Center.");
      }
      throw new Error("Insufficient permissions to access Google Ads account list.");
    }
    throw new Error(errData?.error?.message || `Failed to fetch Google Ads customer accounts (HTTP ${res.status}).`);
  }

  const data = await res.json();
  const resourceNames: string[] = data.resourceNames || [];

  return resourceNames.map((rName: string) => {
    // format: "customers/1234567890"
    const rawId = rName.replace("customers/", "");
    const formattedId = rawId.length === 10 ? `${rawId.slice(0, 3)}-${rawId.slice(3, 6)}-${rawId.slice(6)}` : rawId;

    return {
      id: rawId,
      resourceName: rName,
      descriptiveName: `Google Ads Account (${formattedId})`,
    };
  });
}

/**
 * Server-side verification that a given customerId is accessible under authorized OAuth tokens
 */
export async function verifyCustomerAccountAccess(
  accessToken: string,
  targetCustomerId: string
): Promise<boolean> {
  const cleanTarget = targetCustomerId.replace(/-/g, "").trim();
  const accounts = await fetchAccessibleGoogleAdsCustomers(accessToken);
  return accounts.some((acc) => acc.id.replace(/-/g, "") === cleanTarget);
}

/**
 * Generate Keyword Ideas using Google Ads KeywordPlanIdeaService REST API
 * Endpoint: POST https://googleads.googleapis.com/v17/customers/{customerId}:generateKeywordIdeas
 */
export async function generateKeywordIdeas(
  accessToken: string,
  customerId: string,
  request: KeywordPlannerRequest
): Promise<any[]> {
  const devTokenStatus = checkDeveloperTokenStatus();
  if (devTokenStatus.status === "missing") {
    throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN is not configured on the server. A valid Google Ads Developer Token is required to fetch keyword ideas.");
  }

  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!.trim();
  const cleanCustomerId = customerId.replace(/-/g, "").trim();

  const endpoint = `https://googleads.googleapis.com/v17/customers/${cleanCustomerId}:generateKeywordIdeas`;

  const payload: Record<string, any> = {
    language: request.languageId ? `languages/${request.languageId}` : "languages/1000", // Default English
    includeAdultKeywords: request.includeAdultKeywords || false,
    keywordPlanNetwork: "GOOGLE_SEARCH",
  };

  if (request.locationId) {
    payload.geoTargetConstants = [`geoTargetConstants/${request.locationId}`];
  }

  // Construct seed specification
  if (request.keywords && request.keywords.length > 0 && request.pageUrl) {
    payload.keywordAndUrlSeed = {
      keywords: request.keywords,
      url: request.pageUrl,
    };
  } else if (request.keywords && request.keywords.length > 0) {
    payload.keywordSeed = {
      keywords: request.keywords,
    };
  } else if (request.pageUrl) {
    payload.urlSeed = {
      url: request.pageUrl,
    };
  } else {
    throw new Error("Keyword Planner request must supply at least one keyword seed or a URL seed.");
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": devToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error("Google Ads generateKeywordIdeas Error:", res.status, errData);

    const msg = errData?.error?.message || errData?.error?.details?.[0]?.message || "";

    if (res.status === 401) {
      throw new Error("Google Ads authorization token has expired. Please reconnect.");
    }
    if (res.status === 403) {
      if (msg.includes("DEVELOPER_TOKEN_NOT_APPROVED") || msg.includes("developer token")) {
        throw new Error("Your Google Ads Developer Token is currently pending approval or unauthorized for production endpoints. Basic/Test access requires test accounts in Google Ads.");
      }
      throw new Error("Permission denied for specified Google Ads Customer ID. Verify your customer account selection.");
    }
    if (res.status === 429) {
      throw new Error("Google Ads API rate limit exceeded. Please wait a moment before trying again.");
    }

    throw new Error(msg || `Google Ads Keyword Planner request failed (HTTP ${res.status}).`);
  }

  const data = await res.json();
  return data.results || data.keywordIdeas || [];
}
