import { getProviderAdapter, listSupportedProviders } from "./registry";
import { encryptCredentials, decryptCredentials } from "./encryption";
import { SEOIntegrationRecord, SEOConnectionCredential } from "./types";

/**
 * Returns all connected third-party integrations for a website with masked credentials.
 */
export async function getWebsiteThirdPartyIntegrations(
  supabase: any,
  websiteId: string,
  userId: string
) {
  const { data: rows, error } = await supabase
    .from("website_third_party_seo_integrations")
    .select("id, website_id, user_id, provider, status, credential_type, masked_credential, provider_account_id, provider_account_name, provider_project_id, provider_project_name, metadata, last_tested_at, last_successful_sync_at, last_error, created_at, updated_at")
    .eq("website_id", websiteId);

  if (error) {
    console.error("Failed to fetch third-party integrations:", error);
    throw new Error(`Failed to load integrations: ${error.message}`);
  }

  const supportedProviders = listSupportedProviders();

  return {
    connectedIntegrations: (rows || []) as SEOIntegrationRecord[],
    supportedProviders,
  };
}

/**
 * Connects and securely persists credentials for a third-party SEO tool.
 */
export async function connectThirdPartyProvider(
  supabase: any,
  websiteId: string,
  userId: string,
  providerId: string,
  credentials: SEOConnectionCredential
) {
  const adapter = getProviderAdapter(providerId);
  if (!adapter || providerId === "other") {
    throw new Error(`Unsupported SEO provider: ${providerId}`);
  }

  // 1. Run adapter connection test
  const testResult = await adapter.testConnection(credentials);
  if (!testResult.success) {
    throw new Error(testResult.message || "Connection test failed.");
  }

  // 2. Encrypt credentials with AES-256-GCM
  const encryptedCredentials = encryptCredentials(credentials);
  const maskedCredential = adapter.maskCredential(credentials);
  const nowIso = new Date().toISOString();

  // 3. Upsert into database table
  const payload = {
    website_id: websiteId,
    user_id: userId,
    provider: adapter.config.id,
    status: "connected",
    credential_type: adapter.config.authType,
    encrypted_credentials: encryptedCredentials,
    masked_credential: maskedCredential,
    provider_account_name: testResult.accountName || `${adapter.config.name} Account`,
    provider_project_name: testResult.projectName || `${adapter.config.name} Project`,
    last_tested_at: nowIso,
    last_successful_sync_at: nowIso,
    last_error: null,
    updated_at: nowIso,
  };

  const { data, error } = await supabase
    .from("website_third_party_seo_integrations")
    .upsert(payload, { onConflict: "website_id,provider" })
    .select("id, website_id, user_id, provider, status, credential_type, masked_credential, provider_account_name, provider_project_name, last_tested_at, created_at, updated_at")
    .single();

  if (error) {
    console.error("Failed to connect third-party provider:", error);
    throw new Error(`Failed to store integration: ${error.message}`);
  }

  return {
    success: true,
    integration: data,
    message: testResult.message || "Connection successful.",
  };
}

/**
 * Tests an existing connected third-party integration by decrypting credentials server-side.
 */
export async function testThirdPartyConnection(
  supabase: any,
  websiteId: string,
  userId: string,
  providerId: string
) {
  const adapter = getProviderAdapter(providerId);
  if (!adapter) {
    throw new Error(`Unsupported SEO provider: ${providerId}`);
  }

  const { data: row, error } = await supabase
    .from("website_third_party_seo_integrations")
    .select("encrypted_credentials")
    .eq("website_id", websiteId)
    .eq("provider", providerId)
    .single();

  if (error || !row) {
    throw new Error(`No active connection found for ${providerId}.`);
  }

  const credentials = decryptCredentials(row.encrypted_credentials);
  const testResult = await adapter.testConnection(credentials);

  const nowIso = new Date().toISOString();
  await supabase
    .from("website_third_party_seo_integrations")
    .update({
      status: testResult.success ? "connected" : "error",
      last_tested_at: nowIso,
      last_error: testResult.success ? null : testResult.message,
      updated_at: nowIso,
    })
    .eq("website_id", websiteId)
    .eq("provider", providerId);

  return testResult;
}

/**
 * Safely disconnects a third-party provider connection.
 */
export async function disconnectThirdPartyProvider(
  supabase: any,
  websiteId: string,
  userId: string,
  providerId: string
) {
  const { error } = await supabase
    .from("website_third_party_seo_integrations")
    .delete()
    .eq("website_id", websiteId)
    .eq("provider", providerId);

  if (error) {
    console.error(`Failed to disconnect ${providerId}:`, error);
    throw new Error(`Failed to disconnect integration: ${error.message}`);
  }

  return { success: true };
}

/**
 * Records an integration request for an unsupported tool.
 */
export async function submitIntegrationRequest(
  supabase: any,
  userId: string,
  websiteId: string | null,
  requestPayload: { toolName: string; toolWebsite?: string; apiDocsUrl?: string; message?: string }
) {
  if (!requestPayload.toolName || !requestPayload.toolName.trim()) {
    throw new Error("Tool name is required.");
  }

  const { data, error } = await supabase
    .from("seo_integration_requests")
    .insert({
      user_id: userId,
      website_id: websiteId || null,
      tool_name: requestPayload.toolName.trim(),
      tool_website: requestPayload.toolWebsite?.trim() || null,
      api_docs_url: requestPayload.apiDocsUrl?.trim() || null,
      message: requestPayload.message?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to submit integration request:", error);
    throw new Error(`Failed to submit request: ${error.message}`);
  }

  return { success: true, request: data };
}
