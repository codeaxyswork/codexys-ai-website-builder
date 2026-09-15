import { SEOIntegrationAdapter, SEOProviderConfig, SEOConnectionCredential } from "../types";
import { maskRawCredential } from "../encryption";

export const ahrefsProviderConfig: SEOProviderConfig = {
  id: "ahrefs",
  name: "Ahrefs",
  description: "Connect your Ahrefs API access token to bring backlink profiles, domain rating, and keyword metric data into Codeaxys.",
  websiteUrl: "https://ahrefs.com",
  authType: "api_key",
  capabilities: ["backlinks", "keywords", "domain"],
  credentialFields: [
    {
      key: "apiKey",
      label: "Ahrefs API Token",
      type: "password",
      placeholder: "ahrefs_api_v3_...",
      required: true,
      helpText: "Enter your personal Ahrefs API v3 Token from Ahrefs API Dashboard.",
    },
  ],
  billingDisclaimer: "Your Ahrefs subscription and API usage are billed directly by Ahrefs under your own account. Codeaxys does not provide or pay for Ahrefs API units.",
  documentationUrl: "https://ahrefs.com/api",
};

export const ahrefsAdapter: SEOIntegrationAdapter = {
  config: ahrefsProviderConfig,

  maskCredential(credentials: SEOConnectionCredential): string {
    return maskRawCredential(credentials.apiKey || credentials.accessToken);
  },

  validateCredentials(credentials: SEOConnectionCredential) {
    const key = (credentials.apiKey || credentials.accessToken || "").trim();
    if (!key) {
      return { valid: false, error: "Ahrefs API token is required." };
    }
    if (key.length < 8) {
      return { valid: false, error: "Invalid Ahrefs API token length or format." };
    }
    return { valid: true };
  },

  async testConnection(credentials: SEOConnectionCredential) {
    const validation = this.validateCredentials!(credentials);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error || "Ahrefs API token is required.",
      };
    }

    // Mock bypass for automated integration tests
    if (credentials._mock || process.env.MOCK_PROVIDERS === "true") {
      return {
        success: true,
        accountName: "Ahrefs Account (Mock)",
        projectName: "Ahrefs API v3",
        message: "Connection successful.",
      };
    }

    const key = (credentials.apiKey || credentials.accessToken || "").trim();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch("https://api.ahrefs.com/v3/subscription-info", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return {
          success: true,
          accountName: data?.user_info?.email || "Ahrefs Connected Account",
          projectName: "Ahrefs API v3",
          message: "Connection successful.",
        };
      }

      return {
        success: false,
        message: "Unable to connect. Please verify your third-party account and API access.",
      };
    } catch (err: any) {
      return {
        success: false,
        message: "Unable to connect. Please verify your third-party account and API access.",
      };
    }
  },
};
