// Centralized Credit Costs & SaaS System Constants

export const CREDIT_COSTS = {
  INITIAL_GENERATION: 10,
  AI_EDIT: 5,
  FULL_REGENERATION: 15,
} as const;

export const FILE_LIMITS = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  ALLOWED_MIME_TYPES: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/svg+xml",
  ],
} as const;

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  INSUFFICIENT_CREDITS: "INSUFFICIENT_CREDITS",
  WEBSITE_LIMIT_REACHED: "WEBSITE_LIMIT_REACHED",
  STORAGE_LIMIT_REACHED: "STORAGE_LIMIT_REACHED",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  GEMINI_GENERATION_FAILED: "GEMINI_GENERATION_FAILED",
  DATABASE_SAVE_FAILED: "DATABASE_SAVE_FAILED",
} as const;

export interface PlanConfig {
  id: string;
  name: string;
  price: number;
  currency: string;
  monthlyCredits: number;
  maxWebsites: number;
  storageLimitBytes: number;
  storageLimitFormatted: string;
  popular?: boolean;
  features: string[];
}

export const PLANS: Record<string, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    currency: "INR",
    monthlyCredits: 50,
    maxWebsites: 1,
    storageLimitBytes: 104857600, // 100 MB
    storageLimitFormatted: "100 MB",
    features: [
      "50 AI Credits",
      "1 Website Limit",
      "100 MB Storage Quota",
      "Basic SEO Management",
      "XML Sitemap & Robots.txt",
      "Live Public Website Route",
      "No Custom Domain",
      "No AI SEO Generator",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 999,
    currency: "INR",
    monthlyCredits: 500,
    maxWebsites: 10,
    storageLimitBytes: 5368709120, // 5 GB
    storageLimitFormatted: "5 GB",
    popular: true,
    features: [
      "500 AI Credits / month",
      "10 Websites Limit",
      "5 GB Storage Quota",
      "Advanced SEO & AI SEO Suggestions",
      "Structured JSON-LD Schema Markup",
      "Google Analytics (GA4) & GTM Support",
      "Custom Domain Connection (yourbrand.com)",
      "Priority AI Generation Pipeline",
    ],
  },
  agency: {
    id: "agency",
    name: "Agency",
    price: 2999,
    currency: "INR",
    monthlyCredits: 2000,
    maxWebsites: 50,
    storageLimitBytes: 21474836480, // 20 GB
    storageLimitFormatted: "20 GB",
    features: [
      "2,000 AI Credits / month",
      "50 Client Websites Limit",
      "20 GB Storage Quota",
      "Everything in Pro Plan",
      "Advanced SEO Platform Integrations",
      "SEMrush Architecture Ready",
      "Ahrefs Architecture Ready",
      "Search Console Architecture Ready",
      "Multiple Client Website Management",
      "Dedicated Agency Architecture",
    ],
  },
};

