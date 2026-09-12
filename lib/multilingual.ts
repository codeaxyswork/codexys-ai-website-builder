export interface SupportedLanguage {
  code: string;
  label: string;
  englishName: string;
  nativeName: string;
  sttLocale: string;
  hasTextAI: boolean;
  hasVoiceSTT: boolean;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  {
    code: "auto",
    label: "Auto Detect Language",
    englishName: "Auto Detect",
    nativeName: "Auto Detect",
    sttLocale: "",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "en",
    label: "English",
    englishName: "English",
    nativeName: "English",
    sttLocale: "en-US",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "ml",
    label: "Malayalam (മലയാളം)",
    englishName: "Malayalam",
    nativeName: "മലയാളം",
    sttLocale: "ml-IN",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "hi",
    label: "Hindi (हिंदी)",
    englishName: "Hindi",
    nativeName: "हिंदी",
    sttLocale: "hi-IN",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "ta",
    label: "Tamil (தமிழ்)",
    englishName: "Tamil",
    nativeName: "தமிழ்",
    sttLocale: "ta-IN",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "te",
    label: "Telugu (తెలుగు)",
    englishName: "Telugu",
    nativeName: "తెలుగు",
    sttLocale: "te-IN",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "kn",
    label: "Kannada (ಕನ್ನಡ)",
    englishName: "Kannada",
    nativeName: "ಕನ್ನಡ",
    sttLocale: "kn-IN",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "bn",
    label: "Bengali (বাংলা)",
    englishName: "Bengali",
    nativeName: "বাংলা",
    sttLocale: "bn-IN",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "mr",
    label: "Marathi (मराठी)",
    englishName: "Marathi",
    nativeName: "मराठी",
    sttLocale: "mr-IN",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "gu",
    label: "Gujarati (ગુજરાતી)",
    englishName: "Gujarati",
    nativeName: "ગુજરાતી",
    sttLocale: "gu-IN",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "pa",
    label: "Punjabi (ਪੰਜਾਬੀ)",
    englishName: "Punjabi",
    nativeName: "ਪੰਜਾਬੀ",
    sttLocale: "pa-IN",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "ur",
    label: "Urdu (اردو)",
    englishName: "Urdu",
    nativeName: "اردو",
    sttLocale: "ur-IN",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "ar",
    label: "Arabic (العربية)",
    englishName: "Arabic",
    nativeName: "العربية",
    sttLocale: "ar-SA",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "es",
    label: "Spanish (Español)",
    englishName: "Spanish",
    nativeName: "Español",
    sttLocale: "es-ES",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "fr",
    label: "French (Français)",
    englishName: "French",
    nativeName: "Français",
    sttLocale: "fr-FR",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "de",
    label: "German (Deutsch)",
    englishName: "German",
    nativeName: "Deutsch",
    sttLocale: "de-DE",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "zh",
    label: "Chinese (Mandarin - 中文)",
    englishName: "Chinese",
    nativeName: "中文",
    sttLocale: "zh-CN",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "ja",
    label: "Japanese (日本語)",
    englishName: "Japanese",
    nativeName: "日本語",
    sttLocale: "ja-JP",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "ko",
    label: "Korean (한국어)",
    englishName: "Korean",
    nativeName: "한국어",
    sttLocale: "ko-KR",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "ru",
    label: "Russian (Русский)",
    englishName: "Russian",
    nativeName: "Русский",
    sttLocale: "ru-RU",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "pt",
    label: "Portuguese (Português)",
    englishName: "Portuguese",
    nativeName: "Português",
    sttLocale: "pt-BR",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "it",
    label: "Italian (Italiano)",
    englishName: "Italian",
    nativeName: "Italiano",
    sttLocale: "it-IT",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
  {
    code: "tr",
    label: "Turkish (Türkçe)",
    englishName: "Turkish",
    nativeName: "Türkçe",
    sttLocale: "tr-TR",
    hasTextAI: true,
    hasVoiceSTT: true,
  },
];

export function getLanguageConfig(code: string): SupportedLanguage {
  if (!code || code === "auto") {
    return SUPPORTED_LANGUAGES[0];
  }
  const cleanCode = code.split("-")[0].toLowerCase();
  const match = SUPPORTED_LANGUAGES.find(
    (l) => l.code === cleanCode || l.sttLocale.toLowerCase() === code.toLowerCase()
  );
  return match || SUPPORTED_LANGUAGES[0];
}

/**
 * Builds explicit multilingual normalization directives to pass to Gemini system prompts.
 * Separate Conversation Language vs Website Content Language rules.
 */
export function buildMultilingualSystemDirective(
  conversationLangCode?: string,
  websiteLangExplicit?: string
): string {
  const convLang = getLanguageConfig(conversationLangCode || "auto");
  const isAuto = convLang.code === "auto";

  let directive = `
==================================================
MULTILINGUAL AI & TWO-LAYER LANGUAGE ENGINE DIRECTIVES
==================================================
1. TWO SEPARATE LANGUAGE CONCEPTS:
   A. Conversation Language: The language used to chat with the customer.
   B. Website Content Language: The language used to write the HTML headings, copy, buttons, and text inside index.html.

   - Current Selected Conversation Language Preference: ${
     isAuto ? "Auto Detect from user message" : `${convLang.englishName} (${convLang.nativeName})`
   }
   - Requested Website Content Language: ${
     websiteLangExplicit ? websiteLangExplicit : "Determined by user prompt intent / fallback to user language or clean professional language"
   }

2. TWO-LAYER LANGUAGE EXECUTION RULES:
   - IF the user requests website content in a specific language (e.g., "Website content English-ൽ വേണം", "Create content in Malayalam", "Website content in Hindi"):
     * WRITE ALL index.html headings, copy, section text, and buttons strictly in the requested Website Content Language.
     * RESPOND to the customer in their preferred Conversation Language (${
       isAuto ? "detected from their prompt" : convLang.englishName
     }).
   - IF NO explicit website content language is specified:
     * If customer writes in native script or selected language (e.g., Malayalam, Hindi, Tamil), write index.html copy in that language (or high quality multilingual copy if appropriate).
     * If customer writes in English or requests English, write index.html copy in English.

3. INTERNAL INTENT NORMALIZATION & MIXED LANGUAGE SUPPORT:
   - Analyze user prompt regardless of script, grammar, or code-switching:
     * Manglish (e.g. "oru bakery website venam, gallery um menu um venam") -> Intent: Bakery website with gallery and menu sections.
     * Hinglish (e.g. "ek restaurant site chahiye menu card ke saath") -> Intent: Restaurant website with menu card section.
     * Mixed Script (e.g. "Header ഒന്ന് modern ആക്കണം and make the button green") -> Intent: Refine header to modern style, change button color to green.
   - Map user's raw intent into clean HTML, CSS, and JS website source code.
   - Do NOT display internal English prompt translations or internal JSON state to the user.
`;

  return directive.trim();
}
