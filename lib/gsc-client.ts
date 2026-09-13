import crypto from "crypto";
import { createClient as createSupabaseDirectClient } from "@supabase/supabase-js";

const HMAC_SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXTAUTH_SECRET ||
  process.env.GOOGLE_CLIENT_SECRET ||
  "codeaxys-seo-gsc-secret-key-fallback";

// Derived 32-byte key for AES-256-GCM authenticated encryption
const ENCRYPTION_KEY = crypto.createHash("sha256").update(HMAC_SECRET).digest();

export interface GscStatePayload {
  websiteId: string;
  userId: string;
  timestamp: number;
  nonce: string;
}

export interface GscProperty {
  siteUrl: string;
  permissionLevel: string;
  isDomainProperty: boolean;
  type: "domain" | "url_prefix";
}

export interface SearchAnalyticsRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
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
 * Encrypt sensitive OAuth token using AES-256-GCM
 */
export function encryptGscToken(tokenStr: string | null | undefined): string | null {
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
export function decryptGscToken(encryptedStr: string | null | undefined): string | null {
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
    console.error("AES-256-GCM Decryption Error:", err);
    return null;
  }
}

/**
 * Save encrypted tokens into server-only gsc_oauth_credentials table
 */
export async function saveGscCredentials(
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
  if (!serviceKey) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY is missing in server environment variables.");
  }

  const dbClient = serviceKey ? createAdminClient() : supabase;

  const encAccess = encryptGscToken(tokens.access_token);
  const encRefresh = tokens.refresh_token ? encryptGscToken(tokens.refresh_token) : undefined;
  const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined;

  const payload: any = {
    website_id: websiteId,
    user_id: userId,
    provider: "google_search_console",
    updated_at: new Date().toISOString(),
  };

  if (encAccess) payload.encrypted_access_token = encAccess;
  if (encRefresh) payload.encrypted_refresh_token = encRefresh;
  if (expiresAt) payload.token_expires_at = expiresAt;
  if (tokens.scope) payload.scope = tokens.scope;

  const { error } = await dbClient
    .from("gsc_oauth_credentials")
    .upsert(payload, { onConflict: "website_id" });

  if (error) {
    const safeDetail = error.message ? `${error.message} (Code: ${error.code || 'DB_ERR'})` : "Database write error";
    console.error("Failed to save gsc_oauth_credentials:", safeDetail);
    throw new Error(`Failed to store OAuth credentials securely: ${safeDetail}`);
  }
}

/**
 * Load and decrypt tokens from server-only gsc_oauth_credentials table
 */
export async function loadGscCredentials(
  supabase: any,
  websiteId: string
): Promise<{
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: number;
  scope: string | null;
}> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey ? createAdminClient() : supabase;

  const { data, error } = await dbClient
    .from("gsc_oauth_credentials")
    .select("encrypted_access_token, encrypted_refresh_token, token_expires_at, scope")
    .eq("website_id", websiteId)
    .single();

  if (error || !data) {
    if (error && error.code !== "PGRST116") {
      console.error("Failed to load gsc_oauth_credentials:", error.message || error.code);
    }
    return { access_token: null, refresh_token: null, token_expires_at: 0, scope: null };
  }

  return {
    access_token: decryptGscToken(data.encrypted_access_token),
    refresh_token: decryptGscToken(data.encrypted_refresh_token),
    token_expires_at: Number(data.token_expires_at) || 0,
    scope: data.scope || null,
  };
}

/**
 * Generate CSRF-safe OAuth state token signed with HMAC
 */
export function generateGscAuthState(websiteId: string, userId: string): string {
  const payload: GscStatePayload = {
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
 * Verify and decode OAuth state token
 */
export function verifyAndDecodeGscState(stateStr: string): GscStatePayload {
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
  const payload: GscStatePayload = JSON.parse(jsonStr);

  // Check state expiration (15 minutes limit)
  const MAX_AGE_MS = 15 * 60 * 1000;
  if (Date.now() - payload.timestamp > MAX_AGE_MS) {
    throw new Error("OAuth state token has expired. Please try connecting again.");
  }

  return payload;
}

/**
 * Generate Google OAuth 2.0 Authorization URL
 */
export function getGscAuthUrl(websiteId: string, userId: string, appUrl: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured on the server.");
  }

  const baseUrl = (appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://codexys-ai-website-builder.vercel.app").replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/seo/gsc/callback`;
  const state = generateGscAuthState(websiteId, userId);
  const scope = "https://www.googleapis.com/auth/webmasters.readonly";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Securely exchange OAuth code for access & refresh tokens
 */
export async function exchangeCodeForGscTokens(
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
  const redirectUri = `${baseUrl}/api/seo/gsc/callback`;

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
    console.error("Google Token Exchange Failed:", data);
    throw new Error(data.error_description || data.error || "Failed to exchange authorization code for tokens.");
  }

  return data;
}

/**
 * Refresh GSC Access Token using Refresh Token
 */
export async function refreshGscAccessToken(refreshToken: string): Promise<{
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
    console.error("Google Token Refresh Failed:", data);
    if (data.error === "invalid_grant") {
      throw new Error("Search Console authorization has expired or been revoked. Please reconnect.");
    }
    throw new Error(data.error_description || data.error || "Failed to refresh Google access token.");
  }

  return data;
}

/**
 * Fetch Search Console properties accessible by authenticated account
 */
export async function fetchGscProperties(accessToken: string): Promise<GscProperty[]> {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error("Fetch GSC Sites Error:", res.status, errData);
    if (res.status === 401 || res.status === 403) {
      throw new Error("Google Search Console authorization failed or insufficient permissions.");
    }
    throw new Error(errData?.error?.message || "Failed to fetch Search Console properties.");
  }

  const data = await res.json();
  const siteEntries = data.siteEntry || [];

  return siteEntries.map((site: any) => {
    const url = site.siteUrl || "";
    const isDomain = url.startsWith("sc-domain:");
    return {
      siteUrl: url,
      permissionLevel: site.permissionLevel || "siteFullUser",
      isDomainProperty: isDomain,
      type: isDomain ? "domain" : "url_prefix",
    };
  });
}

/**
 * Query Search Analytics API from GSC
 */
export async function queryGscSearchAnalytics(
  accessToken: string,
  propertyUrl: string,
  options: {
    startDate: string;
    endDate: string;
    dimensions?: string[];
    rowLimit?: number;
  }
): Promise<SearchAnalyticsRow[]> {
  const encodedProperty = encodeURIComponent(propertyUrl);
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodedProperty}/searchAnalytics/query`;

  const payload: Record<string, any> = {
    startDate: options.startDate,
    endDate: options.endDate,
    rowLimit: options.rowLimit || 100,
  };

  if (options.dimensions && options.dimensions.length > 0) {
    payload.dimensions = options.dimensions;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error("Query Search Analytics Error:", res.status, errData);
    if (res.status === 401) {
      throw new Error("Google Search Console access token expired.");
    }
    if (res.status === 403) {
      throw new Error("Insufficient Search Console permissions for this property.");
    }
    if (res.status === 404) {
      throw new Error("Specified Search Console property was not found.");
    }
    if (res.status === 429) {
      throw new Error("Google Search Console API rate limit exceeded. Please try again later.");
    }
    throw new Error(errData?.error?.message || `Search Analytics query failed (HTTP ${res.status}).`);
  }

  const data = await res.json();
  return data.rows || [];
}

/**
 * Validate compatibility between website domain/slug and GSC property URL
 */
export function checkDomainCompatibility(websiteUrlOrSlug: string, propertyUrl: string): boolean {
  if (!websiteUrlOrSlug || !propertyUrl) return false;

  const cleanWebsite = websiteUrlOrSlug
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim()
    .toLowerCase();

  const cleanProperty = propertyUrl
    .replace(/^sc-domain:/i, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim()
    .toLowerCase();

  if (!cleanWebsite || !cleanProperty) return false;

  return cleanWebsite === cleanProperty || cleanWebsite.includes(cleanProperty) || cleanProperty.includes(cleanWebsite);
}
