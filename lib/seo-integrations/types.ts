export type SEOProviderCapability =
  | "backlinks"
  | "keywords"
  | "rankings"
  | "domain"
  | "competitors"
  | "technical_audit"
  | "links"
  | "custom_request";

export type SEOAuthType = "api_key" | "access_secret" | "oauth";

export interface CredentialFieldDefinition {
  key: string;
  label: string;
  type: "text" | "password";
  placeholder: string;
  required: boolean;
  helpText?: string;
}

export interface SEOProviderConfig {
  id: string;
  name: string;
  description: string;
  websiteUrl: string;
  authType: SEOAuthType;
  capabilities: SEOProviderCapability[];
  credentialFields: CredentialFieldDefinition[];
  billingDisclaimer: string;
  documentationUrl?: string;
}

export interface SEOConnectionCredential {
  apiKey?: string;
  accessId?: string;
  secretKey?: string;
  accessToken?: string;
  refreshToken?: string;
  [key: string]: any;
}

export interface SEOIntegrationRecord {
  id: string;
  website_id: string;
  user_id: string;
  provider: string;
  status: "connected" | "error" | "reauth_required";
  credential_type: SEOAuthType;
  masked_credential: string | null;
  provider_account_id?: string | null;
  provider_account_name?: string | null;
  provider_project_id?: string | null;
  provider_project_name?: string | null;
  metadata?: Record<string, any>;
  last_tested_at?: string | null;
  last_successful_sync_at?: string | null;
  last_error?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SEOIntegrationAdapter {
  config: SEOProviderConfig;
  maskCredential(credentials: SEOConnectionCredential): string;
  validateCredentials?(credentials: SEOConnectionCredential): { valid: boolean; error?: string };
  testConnection(credentials: SEOConnectionCredential): Promise<{
    success: boolean;
    accountName?: string;
    projectName?: string;
    message: string;
  }>;
}
