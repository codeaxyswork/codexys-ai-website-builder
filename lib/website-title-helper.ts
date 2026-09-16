import { GeneratedFile, WebsitePlan } from "./types";

/**
 * Derives a clean, concise website/business name for websites.title.
 * Ensures raw generation prompts, voice transcriptions, or prompt command phrases
 * are never stored or displayed as the website title.
 */
export function deriveWebsiteTitle(
  plan?: WebsitePlan | null,
  files?: GeneratedFile[] | null,
  promptText?: string
): string {
  // 1. Check plan.brandIdentity if present, concise, and not a prompt command
  let brandName = plan?.brandIdentity?.trim() || "";
  if (brandName && !isPromptLike(brandName, promptText) && brandName.length <= 50) {
    return brandName;
  }

  // 2. Extract concise brand name from index.html <title> tag
  if (files && Array.isArray(files)) {
    const htmlFile = files.find((f) => f.path.endsWith("index.html"));
    if (htmlFile && htmlFile.content) {
      const match = htmlFile.content.match(/<title\b[^>]*>(.*?)<\/title>/i);
      if (match && match[1]) {
        const rawTitle = match[1].trim();
        // Clean common tagline separators: "Velocity Motors - Luxury Cars" -> "Velocity Motors"
        const cleanTitle = rawTitle.split(/[-|–—:]/)[0].trim();
        if (
          cleanTitle &&
          cleanTitle.length >= 2 &&
          cleanTitle.length <= 50 &&
          !isPromptLike(cleanTitle, promptText)
        ) {
          return cleanTitle;
        }
      }
    }
  }

  // 3. Fallback to brandName if non-empty and reasonable length
  if (brandName && brandName.length >= 2 && brandName.length <= 50 && !isPromptLike(brandName, promptText)) {
    return brandName;
  }

  // 4. Try plan.websiteType (e.g. "Luxury Car Showroom", "Fitness Gym")
  let websiteType = plan?.websiteType?.trim() || "";
  if (websiteType && websiteType.length >= 2 && websiteType.length <= 50 && !isPromptLike(websiteType, promptText)) {
    return websiteType;
  }

  // 5. Short prompt fallback if prompt itself is short (e.g. "Velocity Motors")
  if (promptText && promptText.trim().length <= 30 && !isPromptLike(promptText.trim(), promptText)) {
    return promptText.trim();
  }

  return "My AI Website";
}

function isPromptLike(str: string, originalPrompt?: string): boolean {
  if (!str) return true;
  const s = str.toLowerCase().trim();

  // If string length > 45 chars, it's likely a prompt sentence or transcript
  if (s.length > 45) return true;

  // If string matches start of original prompt
  if (originalPrompt && originalPrompt.length > 20) {
    const origStart = originalPrompt.toLowerCase().trim().substring(0, 18);
    if (s.includes(origStart)) return true;
  }

  // Known prompt/transcript indicator phrases
  const promptPhrases = [
    "create a",
    "build a",
    "make a",
    "generate a",
    "i want",
    "see i don't",
    "first of all",
    "dont want",
    "don't want",
    "please make",
    "can you",
    "website for",
    "design a",
    "develop a",
    "kind of a",
    "kind of",
    "user prompt",
    "prompt:",
    "malayalam",
    "english",
  ];

  return promptPhrases.some((phrase) => s.includes(phrase));
}
