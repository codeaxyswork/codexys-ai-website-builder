import { SEOIntegrationAdapter, SEOProviderConfig, SEOConnectionCredential } from "../types";

export const otherProviderConfig: SEOProviderConfig = {
  id: "other",
  name: "Other / Request Integration",
  description: "Don't see your favorite SEO platform? Request a custom integration adapter for Screaming Frog, Sitebulb, SE Ranking, DataForSEO, or Majestic.",
  websiteUrl: "",
  authType: "api_key",
  capabilities: ["custom_request"],
  credentialFields: [
    {
      key: "toolName",
      label: "SEO Tool / Platform Name",
      type: "text",
      placeholder: "e.g. Screaming Frog, SE Ranking, Majestic",
      required: true,
    },
    {
      key: "toolWebsite",
      label: "Platform Website URL",
      type: "text",
      placeholder: "https://example.com",
      required: false,
    },
    {
      key: "apiDocsUrl",
      label: "API Documentation URL (Optional)",
      type: "text",
      placeholder: "https://example.com/api-docs",
      required: false,
    },
    {
      key: "message",
      label: "Use Case / Request Details",
      type: "text",
      placeholder: "Tell us which metrics or data you want imported into Codeaxys...",
      required: false,
    },
  ],
  billingDisclaimer: "Integration requests help our product team prioritize future provider adapters. No API charges or credentials are processed for feature requests.",
};

export const otherAdapter: SEOIntegrationAdapter = {
  config: otherProviderConfig,

  maskCredential(): string {
    return "Feature Request";
  },

  async testConnection() {
    return {
      success: true,
      message: "Integration request recorded.",
    };
  },
};
