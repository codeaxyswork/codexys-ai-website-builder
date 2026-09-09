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

