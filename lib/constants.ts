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
  starter: {
    id: "starter",
    name: "Starter",
    price: 299,
    currency: "INR",
    monthlyCredits: 100,
    maxWebsites: 1,
    storageLimitBytes: 2147483648, // 2 GB
    storageLimitFormatted: "2 GB",
    features: [
      "1 Website",
      "100 AI Credits / Month",
      "2 GB Storage Quota",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 599,
    currency: "INR",
    monthlyCredits: 200,
    maxWebsites: 3,
    storageLimitBytes: 10737418240, // 10 GB
    storageLimitFormatted: "10 GB",
    popular: true,
    features: [
      "3 Websites",
      "200 AI Credits / Month",
      "10 GB Storage Quota",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    price: 999,
    currency: "INR",
    monthlyCredits: 400,
    maxWebsites: 6,
    storageLimitBytes: 32212254720, // 30 GB
    storageLimitFormatted: "30 GB",
    features: [
      "6 Websites",
      "400 AI Credits / Month",
      "30 GB Storage Quota",
    ],
  },
  agency: {
    id: "agency",
    name: "Agency",
    price: 1999,
    currency: "INR",
    monthlyCredits: 800,
    maxWebsites: 15,
    storageLimitBytes: 107374182400, // 100 GB
    storageLimitFormatted: "100 GB",
    features: [
      "15 Websites",
      "800 AI Credits / Month",
      "100 GB Storage Quota",
    ],
  },
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
      "1 Website",
      "50 AI Credits / Month",
      "100 MB Storage Quota",
    ],
  },
};


