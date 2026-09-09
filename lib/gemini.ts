import { GoogleGenAI } from "@google/genai";
import { GenerationResponse, GeneratedFile, WebsitePlan, UploadedImage } from "./types";

export function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";

  const isDetected = Boolean(apiKey && apiKey.trim() !== "" && apiKey !== "YOUR_GEMINI_API_KEY");
  console.log(`GEMINI API KEY DETECTED: ${isDetected ? "YES" : "NO"}`);

  if (!apiKey || apiKey.trim() === "" || apiKey === "YOUR_GEMINI_API_KEY") {
    throw new Error(
      "GEMINI_API_KEY is not set or is empty. Please set a valid GEMINI_API_KEY in your .env.local file."
    );
  }

  return { apiKey: apiKey.trim(), model: model.trim() };
}

const SYSTEM_GENERATION_PROMPT = `
You are a world-class principal web designer and front-end developer.
Your task is to analyze a user prompt and generate a COMPLETE, HIGHLY CUSTOM, STANDALONE WEBSITE (HTML, CSS, JS).

CRITICAL ARCHITECTURE RULES:
1. NO FIXED TEMPLATES OR REUSED LAYOUTS.
   - A luxury car showroom must have a dark, metallic, cinematic luxury aesthetic with high-contrast grids and sleek car showcases.
   - A kids martial arts academy must have vibrant colors (orange/red/yellow/bright blue), playful cards, energetic badge icons, and schedule tables.
   - A luxury dental clinic must have a serene, minimal, clean aesthetic with subtle cyan/teal/beige tones, ample white space, and elegant typography.
   - Every prompt MUST produce a distinctly different website structure, color palette, visual theme, and CSS architecture.

2. HIGH VISUAL QUALITY & REAL IMAGES:
   - Use high quality, realistic Unsplash image URLs (e.g. https://images.unsplash.com/photo-... with appropriate photo IDs and query parameters like ?auto=format&fit=crop&w=1200&q=80) tailored directly to the website topic.
   - Do NOT use generic placeholder boxes or empty gray boxes.

3. FILES TO GENERATE:
   You must return exactly 3 code files and a design plan:
   - "index.html": Standalone HTML5 code. Must include Google Fonts links, link to styles.css, semantically structured elements, responsive containers, icons (using FontAwesome CDN or inline SVG), real copy, and script tag linking script.js before </body>.
   - "styles.css": Complete custom CSS tailored strictly to this brand's visual identity. Includes custom CSS variables, typography, flex/grid layouts, hover transitions, animations, responsive breakpoints (@media max-width: 768px).
   - "script.js": Interactive JavaScript for client-side functionality (e.g. mobile navbar toggle, modal popups, tab switching, form submission interactive toasts, counter animations, smooth scroll).

4. RESPONSE FORMAT (CRITICAL):
   Output your response using the EXACT text markers below. Do NOT escape HTML, CSS, or JS characters.

===PLAN_START===
{
  "websiteType": "string",
  "brandIdentity": "string",
  "designDirection": "string",
  "colorPalette": [
    { "name": "Primary", "hex": "#111827" },
    { "name": "Accent", "hex": "#D97706" }
  ],
  "typographyDirection": "string",
  "layoutStrategy": "string",
  "sections": [
    { "name": "Section Name", "description": "Description of layout and content" }
  ]
}
===PLAN_END===

===HTML_START===
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Title</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <!-- Full Custom HTML Structure -->
  <script src="script.js"></script>
</body>
</html>
===HTML_END===

===CSS_START===
/* Complete Custom CSS */
===CSS_END===

===JS_START===
// Complete Interactive JavaScript
===JS_END===
`;

const SYSTEM_EDIT_PROMPT = `
You are a principal web developer updating an existing generated website based on user refinement instructions.

CRITICAL INSTRUCTIONS:
1. Examine the user's edit instruction alongside the current index.html, styles.css, and script.js files.
2. Update the HTML, CSS, or JS files as requested while preserving the overall quality, standalone structure, and theme.
3. Return the updated design plan and all 3 updated files (index.html, styles.css, script.js) using the exact same ===PLAN_START===, ===HTML_START===, ===CSS_START===, and ===JS_START=== markers format as initial generation.
`;

export async function generateWebsite(
  userPrompt: string,
  images?: UploadedImage[]
): Promise<GenerationResponse> {
  const { apiKey, model } = getGeminiConfig();
  const ai = new GoogleGenAI({ apiKey });

  let promptText = `${SYSTEM_GENERATION_PROMPT}\n\nUSER PROMPT: "${userPrompt}"`;

  if (images && images.length > 0) {
    promptText += `\n\nUSER ATTACHED ASSETS / IMAGES (${images.length} files attached):\n`;
    images.forEach((img, idx) => {
      promptText += `- Asset #${idx + 1}: name="${img.name}", mime="${img.mimeType}"\n`;
    });
    promptText += `\nCRITICAL MULTIMODAL INSTRUCTION: The user has uploaded ${images.length} custom image asset(s) (logo, hero image, product photo). You MUST inspect these attached images and include them in the generated HTML code using their exact data URL (e.g., <img src="${images[0].dataUrl}" alt="${images[0].name}" />) in the header logo, hero banner, or gallery sections!\n`;
  }

  promptText += `\nGenerate the complete website plan and source files using the specified markers now:`;

  const contentsPayload: any[] = [promptText];

  if (images && images.length > 0) {
    images.forEach((img) => {
      contentsPayload.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64,
        },
      });
    });
  }

  console.log("==========================================");
  console.log("REAL GEMINI API REQUEST STARTED");
  console.log(`MODEL BEING USED: ${model}`);
  console.log(`ATTACHED IMAGES: ${images ? images.length : 0}`);
  console.log("REQUEST SENT TO GEMINI...");

  const candidateModels = Array.from(new Set([model, "gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash"]));
  let lastError: any = null;

  for (const currentModel of candidateModels) {
    try {
      console.log(`ATTEMPTING GEMINI MODEL: ${currentModel}`);
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: contentsPayload,
      });

      const responseText = response.text;
      if (!responseText || responseText.trim() === "") {
        throw new Error("Gemini returned an empty response.");
      }

      console.log(`SUCCESSFUL RESPONSE RECEIVED FROM GEMINI (${currentModel})`);
      console.log(`RESPONSE LENGTH: ${responseText.length} characters`);
      console.log("==========================================");

      return parseMarkerDelimitedResponse(responseText, userPrompt);
    } catch (error: any) {
      console.warn(`Model ${currentModel} failed:`, error?.message || error);
      lastError = error;
    }
  }

  console.error("All Gemini API models failed:", lastError);
  console.log("==========================================");
  throw new Error(formatErrorMessage(lastError));
}

export async function editWebsite(
  currentFiles: GeneratedFile[],
  instruction: string,
  images?: UploadedImage[]
): Promise<GenerationResponse> {
  const { apiKey, model } = getGeminiConfig();
  const ai = new GoogleGenAI({ apiKey });

  const currentCodeSummary = currentFiles
    .map((f) => `--- FILE: ${f.path} ---\n${f.content}`)
    .join("\n\n");

  let promptText = `${SYSTEM_EDIT_PROMPT}\n\nCURRENT WEBSITE SOURCE CODE:\n${currentCodeSummary}\n\nUSER EDIT INSTRUCTION: "${instruction}"`;

  if (images && images.length > 0) {
    promptText += `\n\nNEW ATTACHED ASSETS (${images.length} images):\n`;
    images.forEach((img) => {
      promptText += `- Image name="${img.name}", dataUrl="${img.dataUrl.substring(0, 40)}..."\n`;
    });
    promptText += `\nIncorporate these uploaded images into the updated index.html code using exact src="${images[0].dataUrl}".\n`;
  }

  promptText += `\nReturn updated website plan and files using the marker format now:`;

  const contentsPayload: any[] = [promptText];

  if (images && images.length > 0) {
    images.forEach((img) => {
      contentsPayload.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64,
        },
      });
    });
  }

  const candidateModels = Array.from(new Set([model, "gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash"]));
  let lastError: any = null;

  for (const currentModel of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: contentsPayload,
      });

      const responseText = response.text;
      if (!responseText || responseText.trim() === "") {
        throw new Error("Gemini returned an empty response for edit.");
      }

      return parseMarkerDelimitedResponse(responseText, instruction);
    } catch (error: any) {
      console.warn(`Edit model ${currentModel} failed:`, error?.message || error);
      lastError = error;
    }
  }

  throw new Error(formatErrorMessage(lastError));
}

function formatErrorMessage(error: any): string {
  let rawMsg = error?.message || String(error || "Failed to communicate with AI Engine.");
  
  try {
    const parsed = JSON.parse(rawMsg);
    if (parsed?.error?.message) {
      rawMsg = parsed.error.message;
    }
  } catch (e) {
    // rawMsg is not JSON string
  }

  if (rawMsg.includes("503") || rawMsg.includes("high demand") || rawMsg.includes("UNAVAILABLE")) {
    return "The AI engine is currently experiencing high demand. Please wait a moment and click Generate Website again.";
  }
  if (rawMsg.includes("429") || rawMsg.includes("Quota exceeded")) {
    return "AI Engine rate limit exceeded. Please wait a moment and try again.";
  }
  
  return rawMsg;
}

/**
 * Safely extracts Plan, HTML, CSS, and JS using marker boundaries or fallback code blocks.
 * Eliminates JSON parsing syntax errors on uncontrolled AI code.
 */
function parseMarkerDelimitedResponse(text: string, originalPrompt: string): GenerationResponse {
  // 1. Extract HTML
  let htmlContent = extractBlock(text, "===HTML_START===", "===HTML_END===");
  if (!htmlContent) {
    htmlContent = extractMarkdownCodeBlock(text, "html");
  }

  // 2. Extract CSS
  let cssContent = extractBlock(text, "===CSS_START===", "===CSS_END===");
  if (!cssContent) {
    cssContent = extractMarkdownCodeBlock(text, "css");
  }

  // 3. Extract JS
  let jsContent = extractBlock(text, "===JS_START===", "===JS_END===");
  if (!jsContent) {
    jsContent = extractMarkdownCodeBlock(text, "javascript") || extractMarkdownCodeBlock(text, "js");
  }

  // Fallback: If no HTML marker was found, check if whole text is HTML or contains <html> tag
  if (!htmlContent && text.includes("<html")) {
    const startIdx = text.indexOf("<html");
    const endIdx = text.lastIndexOf("</html>");
    if (startIdx !== -1 && endIdx !== -1) {
      htmlContent = text.substring(startIdx, endIdx + 7);
    }
  }

  if (!htmlContent || htmlContent.trim() === "") {
    throw new Error(
      "AI Engine response did not contain valid HTML website code. Please try again."
    );
  }

  // 4. Extract Plan JSON
  let plan: WebsitePlan = {
    websiteType: "Custom Website",
    brandIdentity: originalPrompt,
    designDirection: "Bespoke visual architecture",
    colorPalette: [
      { name: "Primary", hex: "#0f172a" },
      { name: "Accent", hex: "#6366f1" },
    ],
    typographyDirection: "Modern Sans-serif",
    layoutStrategy: "Responsive dynamic layout",
    sections: [
      { name: "Hero Section", description: "Primary banner and navigation" },
      { name: "Main Content", description: "Showcase grid and details" },
      { name: "Footer", description: "Links and footer info" },
    ],
  };

  const planText = extractBlock(text, "===PLAN_START===", "===PLAN_END===");
  if (planText) {
    try {
      const cleanedPlanText = planText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const parsedPlan = JSON.parse(cleanedPlanText);
      if (parsedPlan && typeof parsedPlan === "object") {
        plan = { ...plan, ...parsedPlan };
      }
    } catch (e) {
      console.warn("Could not parse plan JSON safely, using derived plan metadata:", e);
    }
  }

  const files: GeneratedFile[] = [
    { path: "index.html", content: htmlContent.trim() },
    { path: "styles.css", content: (cssContent || "/* Styles included */").trim() },
    { path: "script.js", content: (jsContent || "// Interactive scripts").trim() },
  ];

  return { plan, files };
}

function extractBlock(text: string, startMarker: string, endMarker: string): string | null {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return null;

  const contentStart = startIdx + startMarker.length;
  const endIdx = text.indexOf(endMarker, contentStart);

  if (endIdx === -1) {
    return text.substring(contentStart).trim();
  }

  return text.substring(contentStart, endIdx).trim();
}

function extractMarkdownCodeBlock(text: string, lang: string): string | null {
  const regex = new RegExp(`\`\`\`${lang}\\s*([\\s\\S]*?)\\s*\`\`\``, "i");
  const match = text.match(regex);
  return match && match[1] ? match[1].trim() : null;
}
