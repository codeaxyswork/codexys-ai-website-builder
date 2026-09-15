import { SEOIntegrationAdapter, SEOProviderConfig, SEOConnectionCredential } from "../types";
import { maskRawCredential } from "../encryption";

export const semrushProviderConfig: SEOProviderConfig = {
  id: "semrush",
  name: "Semrush",
  description: "Connect your Semrush API Key to bring keyword rankings, organic search volume, and competitor intelligence into Codeaxys.",
  websiteUrl: "https://semrush.com",
  authType: "api_key",
  capabilities: ["keywords", "rankings", "competitors"],
  credentialFields: [
    {
      key: "apiKey",
      label: "Semrush API Key",
      type: "password",
      placeholder: "4a8e9f...",
      required: true,
      helpText: "Enter your 32-character Semrush API Key from Semrush Subscription / API Unit Dashboard.",
    },
  ],
  billingDisclaimer: "Your Semrush subscription and API units are billed directly by Semrush under your own account. Codeaxys does not supply shared Semrush API keys or units.",
  documentationUrl: "https://www.semrush.com/api/",
};

export const semrushAdapter: SEOIntegrationAdapter = {
  config: semrushProviderConfig,

  maskCredential(credentials: SEOConnectionCredential): string {
    return maskRawCredential(credentials.apiKey);
  },

  validateCredentials(credentials: SEOConnectionCredential) {
    const key = (credentials.apiKey || "").trim();
    if (!key) {
      return { valid: false, error: "Semrush API Key is required." };
    }
    if (key.length < 8) {
      return { valid: false, error: "Invalid Semrush API Key length or format." };
    }
    return { valid: true };
  },

  async testConnection(credentials: SEOConnectionCredential) {
    const validation = this.validateCredentials!(credentials);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error || "Semrush API Key is required.",
      };
    }

    // Mock bypass for automated integration tests
    if (credentials._mock || process.env.MOCK_PROVIDERS === "true") {
      return {
        success: true,
        accountName: "Semrush Account (Mock)",
        projectName: "Semrush API",
        message: "Connection successful.",
      };
    }

    const key = (credentials.apiKey || "").trim();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`https://api.semrush.com/?type=user_info&key=${encodeURIComponent(key)}`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text().catch(() => "");
        if (text.includes("ERROR")) {
          return {
            success: false,
            message: "Unable to connect. Please verify your third-party account and API access.",
          };
        }
        return {
          success: true,
          accountName: "Semrush Connected Account",
          projectName: "Semrush API",
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
