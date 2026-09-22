export interface ColorPaletteItem {
  name: string;
  hex: string;
}

export interface SectionPlan {
  name: string;
  description: string;
}

export interface WebsitePlan {
  websiteType: string;
  brandIdentity: string;
  designDirection: string;
  colorPalette: ColorPaletteItem[];
  typographyDirection: string;
  layoutStrategy: string;
  sections: SectionPlan[];
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GenerationResponse {
  plan: WebsitePlan;
  files: GeneratedFile[];
  error?: string;
}

export interface UploadedImage {
  id: string;
  name: string;
  mimeType: string;
  base64: string;
  dataUrl: string;
  publicUrl?: string;
}

export interface EditRequest {
  files: GeneratedFile[];
  instruction: string;
  images?: UploadedImage[];
}

export const LANGUAGE_OPTIONS = [
  { code: "auto", label: "Auto Detect Language" },
  { code: "ml-IN", label: "Malayalam (മലയാളം)" },
  { code: "ta-IN", label: "Tamil (தமிழ்)" },
  { code: "hi-IN", label: "Hindi (हिंदी)" },
  { code: "en-US", label: "English (US)" },
  { code: "en-IN", label: "English (India)" },
  { code: "te-IN", label: "Telugu (తెలుగు)" },
  { code: "kn-IN", label: "Kannada (ಕನ್ನಡ)" },
  { code: "bn-IN", label: "Bengali (বাংলা)" },
  { code: "mr-IN", label: "Marathi (मराठी)" },
  { code: "gu-IN", label: "Gujarati (ગુજરાતી)" },
  { code: "pa-IN", label: "Punjabi (ਪੰਜਾਬੀ)" },
  { code: "ur-IN", label: "Urdu (اردو)" },
  { code: "ar-SA", label: "Arabic (العربية)" },
  { code: "es-ES", label: "Spanish (Español)" },
  { code: "fr-FR", label: "French (Français)" },
  { code: "de-DE", label: "German (Deutsch)" },
  { code: "zh-CN", label: "Chinese (Mandarin - 中文)" },
  { code: "ja-JP", label: "Japanese (日本語)" },
  { code: "ko-KR", label: "Korean (한국어)" },
  { code: "ru-RU", label: "Russian (Русский)" },
  { code: "pt-BR", label: "Portuguese (Português)" },
  { code: "it-IT", label: "Italian (Italiano)" },
  { code: "tr-TR", label: "Turkish (Türkçe)" },
];

export interface GoogleAdsCredentials {
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: number;
  scope: string | null;
  google_ads_customer_id: string | null;
}

export interface GoogleAdsCustomerAccount {
  id: string;
  resourceName: string;
  descriptiveName?: string;
  currencyCode?: string;
  timeZone?: string;
  isManagerAccount?: boolean;
}

export interface KeywordPlannerRequest {
  keywords?: string[];
  pageUrl?: string;
  locationId?: string;
  languageId?: string;
  includeAdultKeywords?: boolean;
}

export interface MonthlySearchMetricItem {
  year: number;
  month: string;
  monthlySearches: number;
}

export interface NormalizedKeywordItem {
  keyword: string;
  avgMonthlySearches: number;
  competition: "HIGH" | "MEDIUM" | "LOW" | "UNSPECIFIED";
  competitionIndex: number;
  lowTopOfPageBidMicros: number;
  highTopOfPageBidMicros: number;
  lowTopOfPageBidFormatted: string;
  highTopOfPageBidFormatted: string;
  monthlySearchMetrics: MonthlySearchMetricItem[];
  source: "google_ads_api" | "gsc_query" | "combined";
  fetchedAt: string;
}

export interface KeywordIntelligenceResponse {
  connected: boolean;
  selectedCustomerId: string | null;
  seedType: "keyword" | "url" | "keyword_url";
  seedValue: string;
  totalKeywords: number;
  keywords: NormalizedKeywordItem[];
  developerTokenStatus: "configured" | "missing" | "pending_approval";
  fetchedAt: string;
  cached: boolean;
  error?: string;
}


