import { SEOIntegrationAdapter, SEOProviderConfig, SEOConnectionCredential } from "../types";
import { maskRawCredential } from "../encryption";

export const mozProviderConfig: SEOProviderConfig = {
  id: "moz",
  name: "Moz",
  description: "Connect your Moz API credentials (Access ID + Secret Key or API Token) to bring Domain Authority (DA) and Spam Score metrics into Codeaxys.",
  websiteUrl: "https://moz.com",
  authType: "access_secret",
  capabilities: ["domain", "links"],
  credentialFields: [
    {
      key: "accessId",
      label: "Moz Access ID",
      type: "text",
      placeholder: "moz-access-id-...",
      required: true,
      helpText: "Enter your Moz API Access ID.",
    },
    {
      key: "secretKey",
      label: "Moz Secret Key / Token",
      type: "password",
      placeholder: "••••••••••••••••",
      required: true,
      helpText: "Enter your Moz API Secret Key.",
    },
  ],
  billingDisclaimer: "Your Moz API subscription and usage are billed directly by Moz under your own account. Codeaxys does not provide or pay for Moz API usage.",
  documentationUrl: "https://moz.com/products/api",
};

export const mozAdapter: SEOIntegrationAdapter = {
  config: mozProviderConfig,

  maskCredential(credentials: SEOConnectionCredential): string {
    return maskRawCredential(credentials.secretKey || credentials.apiKey || credentials.accessId);
  },

  validateCredentials(credentials: SEOConnectionCredential) {
    const accessId = (credentials.accessId || "").trim();
    const secretKey = (credentials.secretKey || credentials.apiKey || "").trim();

    if (!accessId || !secretKey) {
      return { valid: false, error: "Both Moz Access ID and Secret Key are required." };
    }
    return { valid: true };
  },

  async testConnection(credentials: SEOConnectionCredential) {
    const validation = this.validateCredentials!(credentials);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error || "Both Moz Access ID and Secret Key are required.",
      };
    }

    // Mock bypass for automated integration tests
    if (credentials._mock || process.env.MOCK_PROVIDERS === "true") {
      return {
        success: true,
        accountName: "Moz Account (Mock)",
        projectName: "Mozscape API",
        message: "Connection successful.",
      };
    }

    const accessId = (credentials.accessId || "").trim();
    const secretKey = (credentials.secretKey || credentials.apiKey || "").trim();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const authHeader = `Basic ${Buffer.from(`${accessId}:${secretKey}`).toString("base64")}`;
      const res = await fetch("https://lsapi.seomoz.com/v2/url_metrics", {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ targets: ["moz.com"] }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        return {
          success: true,
          accountName: "Moz Connected Account",
          projectName: "Mozscape API",
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
