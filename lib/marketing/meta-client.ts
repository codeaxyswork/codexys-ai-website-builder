import crypto from "crypto";
import { createClient as createSupabaseDirectClient } from "@supabase/supabase-js";

function getHmacSecret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (s && s !== "[SENSITIVE]" && s.length > 20) return s;
  const m = process.env.META_CLIENT_SECRET;
  if (m && m !== "[SENSITIVE]" && m.length > 10) return m;
  const a = process.env.META_APP_SECRET;
  if (a && a !== "[SENSITIVE]" && a.length > 10) return a;
  return process.env.NEXTAUTH_SECRET || "codeaxys-meta-oauth-secret-key-fallback";
}

const HMAC_SECRET = getHmacSecret();

// Derived 32-byte key for AES-256-GCM authenticated encryption
const ENCRYPTION_KEY = crypto.createHash("sha256").update(HMAC_SECRET).digest();

export interface MetaAuthStatePayload {
  websiteId: string;
  userId: string;
  timestamp: number;
  nonce: string;
}

export interface MetaConnectionRecord {
  id?: string;
  website_id: string;
  user_id: string;
  provider: string;
  status: "connected" | "error" | "reauth_required" | "disconnected";
  meta_user_id: string | null;
  meta_user_name: string | null;
  meta_user_email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: number;
  granted_scopes: string[];
  metadata: Record<string, any>;
  last_synced_at?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Server admin Supabase client using SUPABASE_SERVICE_ROLE_KEY if available
 */
/**
 * Server admin Supabase client using SUPABASE_SERVICE_ROLE_KEY if available
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yumsturujjjgdxsrqgbm.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceKey && serviceKey !== "[SENSITIVE]" && serviceKey.length > 20) {
    return createSupabaseDirectClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim().replace(/^["'\s]+|["'\s]+$/g, "");
  if (!anonKey) {
    throw new Error("Supabase API key is missing.");
  }
  return createSupabaseDirectClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Encrypt sensitive OAuth token using AES-256-GCM
 */
export function encryptMetaToken(tokenStr: string | null | undefined): string | null {
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
export function decryptMetaToken(encryptedStr: string | null | undefined): string | null {
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
    console.error("AES-256-GCM Meta Token Decryption Error:", err);
    return null;
  }
}

/**
 * Generate HMAC-signed state for CSRF protection during Meta OAuth
 */
export function generateMetaAuthState(websiteId: string, userId: string): string {
  const payload: MetaAuthStatePayload = {
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
 * Verify and decode Meta OAuth state parameter
 */
export function verifyAndDecodeMetaState(stateStr: string): MetaAuthStatePayload {
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
  const payload: MetaAuthStatePayload = JSON.parse(jsonStr);

  const MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes max
  if (Date.now() - payload.timestamp > MAX_AGE_MS) {
    throw new Error("OAuth state token has expired. Please try connecting Meta again.");
  }

  return payload;
}

/**
 * Construct official Meta Authorization URL
 */
export function getMetaAuthUrl(websiteId: string, userId: string, appUrl?: string): string {
  const clientId = (process.env.META_CLIENT_ID || process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || "").trim();
  if (!clientId || clientId.includes("placeholder") || clientId.includes("_dev") || clientId.includes("your-meta-app-id")) {
    throw new Error("META_CLIENT_ID or META_APP_ID is not configured on the server.");
  }

  const configId = (process.env.META_CONFIG_ID || "").trim();
  const baseUrl = (appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://codeaxys.com").replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/marketing/callback`;
  const state = generateMetaAuthState(websiteId, userId);

  const scopes = [
    "public_profile",
    "ads_management",
    "ads_read",
    "business_management",
    "pages_read_engagement",
    "pages_show_list",
  ].join(",");

  const paramsObj: Record<string, string> = {
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state,
    response_type: "code",
  };

  if (configId) {
    paramsObj.config_id = configId;
    paramsObj.override_default_response_type = "true";
  } else {
    paramsObj.scope = scopes;
  }

  const params = new URLSearchParams(paramsObj);
  const finalUrl = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;

  console.log("[META_OAUTH_PARAMS] Generated OAuth parameters:", {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: paramsObj.response_type,
    config_id: paramsObj.config_id || "NONE",
    override_default_response_type: paramsObj.override_default_response_type || "NONE",
    scope: paramsObj.scope || "NONE",
    state_present: Boolean(state),
    final_authorization_url: finalUrl,
  });

  return finalUrl;
}

/**
 * Exchange OAuth code for Meta access token
 */
export async function exchangeCodeForMetaTokens(
  code: string,
  websiteId: string,
  appUrl?: string
): Promise<{
  access_token: string;
  token_type?: string;
  expires_in?: number;
}> {
  const clientId = (process.env.META_CLIENT_ID || process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || "").trim();
  const clientSecret = (process.env.META_CLIENT_SECRET || process.env.META_APP_SECRET || "").trim();

  if (!clientId || !clientSecret || clientId.includes("placeholder") || clientId.includes("_dev")) {
    throw new Error("Meta OAuth credentials (META_CLIENT_ID / META_CLIENT_SECRET) are missing on the server.");
  }

  const baseUrl = (appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://codeaxys.com").replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/marketing/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Meta Token Exchange Failed:", data);
    throw new Error(data.error?.message || data.error_description || "Failed to exchange authorization code for Meta token.");
  }

  return data;
}

/**
 * Exchange short-lived Meta user access token for long-lived user access token (~60 days)
 */
export async function exchangeForLongLivedMetaToken(
  shortLivedToken: string
): Promise<{
  access_token: string;
  token_type?: string;
  expires_in?: number;
}> {
  const clientId = process.env.META_CLIENT_ID || process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID;
  const clientSecret = process.env.META_CLIENT_SECRET || process.env.META_APP_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Meta OAuth credentials missing.");
  }

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: shortLivedToken,
  });

  const res = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const data = await res.json();

  if (!res.ok) {
    console.warn("Long-lived Meta token exchange warning, proceeding with short-lived token:", data);
    return { access_token: shortLivedToken, expires_in: 7200 };
  }

  return data;
}

/**
 * Fetch Meta User Profile info
 */
export async function fetchMetaUserProfile(accessToken: string): Promise<{
  id: string;
  name: string;
  email?: string;
}> {
  const res = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error("Fetch Meta User Profile Failed:", errData);
    throw new Error(errData.error?.message || "Failed to fetch Meta user profile.");
  }

  return res.json();
}

/**
 * Save encrypted Meta credentials to server-only marketing_connections table
 */
export async function saveMetaConnection(
  supabase: any,
  websiteId: string,
  userId: string,
  tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    granted_scopes?: string[];
  },
  userProfile: {
    id: string;
    name: string;
    email?: string;
  }
) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

  const encAccess = encryptMetaToken(tokens.access_token);
  const encRefresh = tokens.refresh_token ? encryptMetaToken(tokens.refresh_token) : null;
  const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : Date.now() + 60 * 24 * 60 * 60 * 1000;

  const payload = {
    website_id: websiteId,
    user_id: userId,
    provider: "meta",
    status: "connected",
    meta_user_id: userProfile.id,
    meta_user_name: userProfile.name,
    meta_user_email: userProfile.email || null,
    encrypted_access_token: encAccess,
    encrypted_refresh_token: encRefresh,
    token_expires_at: expiresAt,
    granted_scopes: tokens.granted_scopes || [
      "public_profile",
      "ads_management",
      "ads_read",
      "business_management",
      "pages_read_engagement",
      "pages_show_list",
    ],
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await dbClient
    .from("marketing_connections")
    .upsert(payload, { onConflict: "website_id,provider" });

  if (error) {
    console.error("Failed to save marketing_connections:", error.message || error.code);
    throw new Error(`Failed to store Meta connection securely: ${error.message}`);
  }
}

/**
 * Load and decrypt Meta credentials from server-only marketing_connections table
 */
export async function loadMetaConnection(
  supabase: any,
  websiteId: string
): Promise<MetaConnectionRecord | null> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

  const { data, error } = await dbClient
    .from("marketing_connections")
    .select("*")
    .eq("website_id", websiteId)
    .eq("provider", "meta")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    website_id: data.website_id,
    user_id: data.user_id,
    provider: data.provider,
    status: data.status,
    meta_user_id: data.meta_user_id,
    meta_user_name: data.meta_user_name,
    meta_user_email: data.meta_user_email,
    access_token: decryptMetaToken(data.encrypted_access_token),
    refresh_token: decryptMetaToken(data.encrypted_refresh_token),
    token_expires_at: Number(data.token_expires_at) || 0,
    granted_scopes: data.granted_scopes || [],
    metadata: data.metadata || {},
    last_synced_at: data.last_synced_at,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Delete Meta connection from database
 */
export async function deleteMetaConnection(
  supabase: any,
  websiteId: string
): Promise<void> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

  const { error } = await dbClient
    .from("marketing_connections")
    .delete()
    .eq("website_id", websiteId)
    .eq("provider", "meta");

  if (error) {
    console.error("Failed to delete marketing_connections:", error.message || error.code);
    throw new Error(`Failed to disconnect Meta: ${error.message}`);
  }
}

export interface DiscoveredAdAccount {
  id: string;
  name: string;
  account_status?: number;
  currency?: string;
  timezone_name?: string;
}

export interface DiscoveredPage {
  id: string;
  name: string;
  category?: string;
  access_status?: string;
  instagram_business_account?: {
    id: string;
    username?: string;
    name?: string;
  };
}

export interface DiscoveredInstagramAccount {
  id: string;
  username: string;
  name?: string;
  facebook_page_id?: string;
}

/**
 * Server-side Meta Graph API call to discover Ad Accounts available to connected Meta user.
 * Discovers personal ad accounts (/me/adaccounts) as well as Business Portfolio-owned
 * and client ad accounts (/me/businesses -> /{biz_id}/owned_ad_accounts, /{biz_id}/client_ad_accounts).
 */
export async function fetchMetaAdAccounts(accessToken: string): Promise<DiscoveredAdAccount[]> {
  const encToken = encodeURIComponent(accessToken);
  const rawAccounts: any[] = [];
  let lastAuthError: string | null = null;

  // 1. Personal Ad Accounts (/me/adaccounts)
  const personalUrl = `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status,currency,timezone_name&access_token=${encToken}`;
  try {
    const res = await fetch(personalUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(json.data)) {
      rawAccounts.push(...json.data);
    } else if (!res.ok) {
      console.warn("Meta Graph API /me/adaccounts warning:", json);
      if (res.status === 401 || res.status === 400) {
        lastAuthError = json.error?.message || "Invalid or expired Meta access token.";
      }
    }
  } catch (err: any) {
    console.warn("Meta Graph API /me/adaccounts request error:", err?.message || err);
  }

  // 2. Business Portfolios (/me/businesses) & Business-Owned/Client Ad Accounts
  try {
    const bizUrl = `https://graph.facebook.com/v19.0/me/businesses?fields=id,name&access_token=${encToken}`;
    const bizRes = await fetch(bizUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (bizRes.ok) {
      const bizJson = await bizRes.json().catch(() => ({}));
      const businesses: any[] = Array.isArray(bizJson.data) ? bizJson.data : [];

      for (const biz of businesses) {
        if (!biz || !biz.id) continue;

        // Query owned_ad_accounts for Business Portfolio
        try {
          const ownedUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(biz.id)}/owned_ad_accounts?fields=id,name,account_status,currency,timezone_name&access_token=${encToken}`;
          const ownedRes = await fetch(ownedUrl, {
            method: "GET",
            headers: { Accept: "application/json" },
          });
          if (ownedRes.ok) {
            const ownedJson = await ownedRes.json().catch(() => ({}));
            if (Array.isArray(ownedJson.data)) {
              rawAccounts.push(...ownedJson.data);
            }
          }
        } catch (ownedErr: any) {
          console.warn(`Meta Graph API owned_ad_accounts error for business ${biz.id}:`, ownedErr?.message || ownedErr);
        }

        // Query client_ad_accounts for Business Portfolio
        try {
          const clientUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(biz.id)}/client_ad_accounts?fields=id,name,account_status,currency,timezone_name&access_token=${encToken}`;
          const clientRes = await fetch(clientUrl, {
            method: "GET",
            headers: { Accept: "application/json" },
          });
          if (clientRes.ok) {
            const clientJson = await clientRes.json().catch(() => ({}));
            if (Array.isArray(clientJson.data)) {
              rawAccounts.push(...clientJson.data);
            }
          }
        } catch (clientErr: any) {
          console.warn(`Meta Graph API client_ad_accounts error for business ${biz.id}:`, clientErr?.message || clientErr);
        }
      }
    } else {
      const errData = await bizRes.json().catch(() => ({}));
      console.warn("Meta Graph API /me/businesses warning:", errData);
      if ((bizRes.status === 401 || bizRes.status === 400) && !lastAuthError) {
        lastAuthError = errData.error?.message || "Invalid or expired Meta access token.";
      }
    }
  } catch (err: any) {
    console.warn("Meta Graph API /me/businesses request error:", err?.message || err);
  }

  // If both endpoints failed due to authentication failure and 0 accounts retrieved, throw error
  if (rawAccounts.length === 0 && lastAuthError) {
    throw new Error(lastAuthError);
  }

  // 3. Deduplicate by ad account ID & normalize output structure
  const seenIds = new Set<string>();
  const discovered: DiscoveredAdAccount[] = [];

  for (const acc of rawAccounts) {
    if (!acc || !acc.id || seenIds.has(acc.id)) continue;
    seenIds.add(acc.id);

    discovered.push({
      id: acc.id,
      name: acc.name || acc.id,
      account_status: acc.account_status ?? 1,
      currency: acc.currency || "USD",
      timezone_name: acc.timezone_name || "UTC",
    });
  }

  return discovered;
}

/**
 * Server-side Meta Graph API call to discover Facebook Pages & linked Instagram Professional Accounts
 */
export async function fetchMetaPages(accessToken: string): Promise<{
  pages: DiscoveredPage[];
  instagramAccounts: DiscoveredInstagramAccount[];
}> {
  const url = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,category,tasks,instagram_business_account{id,username,name}&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error("Meta Graph API fetchPages Error:", errData);
    throw new Error(errData.error?.message || "Failed to fetch Facebook Pages from Graph API.");
  }

  const json = await res.json();
  const rawPages: any[] = json.data || [];

  const pages: DiscoveredPage[] = [];
  const instagramAccounts: DiscoveredInstagramAccount[] = [];

  for (const page of rawPages) {
    pages.push({
      id: page.id,
      name: page.name || page.id,
      category: page.category || "Business",
      access_status: "active",
      instagram_business_account: page.instagram_business_account || undefined,
    });

    if (page.instagram_business_account && page.instagram_business_account.id) {
      const ig = page.instagram_business_account;
      instagramAccounts.push({
        id: ig.id,
        username: ig.username || ig.id,
        name: ig.name || ig.username || ig.id,
        facebook_page_id: page.id,
      });
    }
  }

  return { pages, instagramAccounts };
}

/**
 * Persist discovered Meta assets to DB while preserving existing selections
 */
export async function persistDiscoveredMetaAssets(
  supabase: any,
  websiteId: string,
  userId: string,
  adAccounts: DiscoveredAdAccount[],
  pages: DiscoveredPage[],
  instagramAccounts: DiscoveredInstagramAccount[]
) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

  // 1. Fetch currently selected IDs for website
  const { data: existingSelectedAds } = await dbClient
    .from("marketing_ad_accounts")
    .select("meta_ad_account_id")
    .eq("website_id", websiteId)
    .eq("is_selected", true);

  const { data: existingSelectedPages } = await dbClient
    .from("marketing_pages")
    .select("meta_page_id")
    .eq("website_id", websiteId)
    .eq("is_selected", true);

  const { data: existingSelectedIg } = await dbClient
    .from("marketing_instagram_accounts")
    .select("instagram_account_id")
    .eq("website_id", websiteId)
    .eq("is_selected", true);

  const selectedAdId = existingSelectedAds?.[0]?.meta_ad_account_id;
  const selectedPageId = existingSelectedPages?.[0]?.meta_page_id;
  const selectedIgId = existingSelectedIg?.[0]?.instagram_account_id;

  const defaultAdId = selectedAdId || (adAccounts.length === 1 ? adAccounts[0].id : null);
  const defaultPageId = selectedPageId || (pages.length === 1 ? pages[0].id : null);
  const defaultIgId = selectedIgId || (instagramAccounts.length === 1 ? instagramAccounts[0].id : null);

  // Upsert Ad Accounts
  if (adAccounts.length > 0) {
    const adRows = adAccounts.map((acc) => ({
      website_id: websiteId,
      user_id: userId,
      provider: "meta",
      meta_ad_account_id: acc.id,
      name: acc.name,
      account_status: acc.account_status ?? 1,
      currency: acc.currency || "USD",
      timezone: acc.timezone_name || "UTC",
      is_selected: acc.id === defaultAdId,
      updated_at: new Date().toISOString(),
    }));

    await dbClient.from("marketing_ad_accounts").upsert(adRows, {
      onConflict: "website_id,meta_ad_account_id",
    });
  }

  // Upsert Facebook Pages
  if (pages.length > 0) {
    const pageRows = pages.map((p) => ({
      website_id: websiteId,
      user_id: userId,
      provider: "meta",
      meta_page_id: p.id,
      name: p.name,
      category: p.category || "Business",
      access_status: p.access_status || "active",
      is_selected: p.id === defaultPageId,
      updated_at: new Date().toISOString(),
    }));

    await dbClient.from("marketing_pages").upsert(pageRows, {
      onConflict: "website_id,meta_page_id",
    });
  }

  // Upsert Instagram Accounts
  if (instagramAccounts.length > 0) {
    const igRows = instagramAccounts.map((ig) => ({
      website_id: websiteId,
      user_id: userId,
      provider: "meta",
      instagram_account_id: ig.id,
      username: ig.username,
      name: ig.name || ig.username,
      facebook_page_id: ig.facebook_page_id || null,
      is_selected: ig.id === defaultIgId,
      updated_at: new Date().toISOString(),
    }));

    await dbClient.from("marketing_instagram_accounts").upsert(igRows, {
      onConflict: "website_id,instagram_account_id",
    });
  }
}

/**
 * Retrieve stored Meta assets and current active selections for a website
 */
export async function getWebsiteMetaAssets(supabase: any, websiteId: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

  const [{ data: adAccounts }, { data: pages }, { data: instagramAccounts }] = await Promise.all([
    dbClient.from("marketing_ad_accounts").select("*").eq("website_id", websiteId).order("name"),
    dbClient.from("marketing_pages").select("*").eq("website_id", websiteId).order("name"),
    dbClient.from("marketing_instagram_accounts").select("*").eq("website_id", websiteId).order("username"),
  ]);

  const safeAdAccounts = (adAccounts || []).map((a: any) => ({
    id: a.meta_ad_account_id,
    name: a.name,
    accountStatus: a.account_status,
    currency: a.currency,
    timezone: a.timezone,
    isSelected: Boolean(a.is_selected),
  }));

  const safePages = (pages || []).map((p: any) => ({
    id: p.meta_page_id,
    name: p.name,
    category: p.category,
    accessStatus: p.access_status,
    isSelected: Boolean(p.is_selected),
  }));

  const safeIgAccounts = (instagramAccounts || []).map((ig: any) => ({
    id: ig.instagram_account_id,
    username: ig.username,
    name: ig.name,
    facebookPageId: ig.facebook_page_id,
    isSelected: Boolean(ig.is_selected),
  }));

  return {
    adAccounts: safeAdAccounts,
    pages: safePages,
    instagramAccounts: safeIgAccounts,
    selectedAdAccount: safeAdAccounts.find((a: any) => a.isSelected) || null,
    selectedPage: safePages.find((p: any) => p.isSelected) || null,
    selectedInstagramAccount: safeIgAccounts.find((ig: any) => ig.isSelected) || null,
  };
}

/**
 * Update selected Meta assets for a website (single active selection per asset type)
 */
export async function setWebsiteMetaSelection(
  supabase: any,
  websiteId: string,
  userId: string,
  selection: {
    selectedAdAccountId?: string | null;
    selectedPageId?: string | null;
    selectedInstagramAccountId?: string | null;
  }
) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient =
    serviceKey && serviceKey !== "[SENSITIVE]" && serviceKey.length > 20
      ? createAdminClient()
      : supabase;

  // 1. Update Ad Account selection
  if (selection.selectedAdAccountId !== undefined) {
    const { error: clearErr } = await dbClient
      .from("marketing_ad_accounts")
      .update({ is_selected: false, updated_at: new Date().toISOString() })
      .eq("website_id", websiteId)
      .eq("user_id", userId);

    if (clearErr) {
      console.error("marketing_ad_accounts selection clear error:", clearErr);
    }

    if (selection.selectedAdAccountId) {
      const { error: setErr } = await dbClient
        .from("marketing_ad_accounts")
        .update({ is_selected: true, updated_at: new Date().toISOString() })
        .eq("website_id", websiteId)
        .eq("user_id", userId)
        .eq("meta_ad_account_id", selection.selectedAdAccountId);

      if (setErr) {
        console.error("marketing_ad_accounts selection set error:", setErr);
      }
    }
  }

  // 2. Update Facebook Page selection
  if (selection.selectedPageId !== undefined) {
    const { error: clearErr } = await dbClient
      .from("marketing_pages")
      .update({ is_selected: false, updated_at: new Date().toISOString() })
      .eq("website_id", websiteId)
      .eq("user_id", userId);

    if (clearErr) {
      console.error("marketing_pages selection clear error:", clearErr);
    }

    if (selection.selectedPageId) {
      const { error: setErr } = await dbClient
        .from("marketing_pages")
        .update({ is_selected: true, updated_at: new Date().toISOString() })
        .eq("website_id", websiteId)
        .eq("user_id", userId)
        .eq("meta_page_id", selection.selectedPageId);

      if (setErr) {
        console.error("marketing_pages selection set error:", setErr);
      }
    }
  }

  // 3. Update Instagram Account selection
  if (selection.selectedInstagramAccountId !== undefined) {
    const { error: clearErr } = await dbClient
      .from("marketing_instagram_accounts")
      .update({ is_selected: false, updated_at: new Date().toISOString() })
      .eq("website_id", websiteId)
      .eq("user_id", userId);

    if (clearErr) {
      console.error("marketing_instagram_accounts selection clear error:", clearErr);
    }

    if (selection.selectedInstagramAccountId) {
      const { error: setErr } = await dbClient
        .from("marketing_instagram_accounts")
        .update({ is_selected: true, updated_at: new Date().toISOString() })
        .eq("website_id", websiteId)
        .eq("user_id", userId)
        .eq("instagram_account_id", selection.selectedInstagramAccountId);

      if (setErr) {
        console.error("marketing_instagram_accounts selection set error:", setErr);
      }
    }
  }
}

