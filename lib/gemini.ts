import { GoogleGenAI } from "@google/genai";
import { GenerationResponse, GeneratedFile, WebsitePlan, UploadedImage } from "./types";
import { buildMultilingualSystemDirective } from "./multilingual";
import {
  logAITelemetry,
  classifyGeminiError,
  calculateBackoffWithJitter,
  withTimeout,
} from "./gemini-telemetry";

export const SUPPORTED_GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
] as const;

export function getCandidateModels(primaryModel?: string): string[] {
  const configured = (primaryModel || "gemini-3.8-flash").trim();
  return Array.from(
    new Set([
      configured,
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
    ])
  );
}

export class GeminiAPIError extends Error {
  statusCode: number;
  failureCategory: string;
  isCapacityOrRateLimit: boolean;

  constructor(message: string, statusCode = 500, failureCategory = "INTERNAL_ERROR") {
    super(message);
    this.name = "GeminiAPIError";
    this.statusCode = statusCode;
    this.failureCategory = failureCategory;
    this.isCapacityOrRateLimit = statusCode === 503 || statusCode === 429;
  }
}

export function getGeminiConfig() {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  const model = (process.env.GEMINI_MODEL || "gemini-3.8-flash").trim();

  const isDetected = Boolean(apiKey && apiKey !== "YOUR_GEMINI_API_KEY");
  console.log(`GEMINI API KEY DETECTED: ${isDetected ? "YES" : "NO"}`);

  if (!isDetected) {
    throw new Error(
      "GEMINI_API_KEY is not set or is empty. Please set a valid GEMINI_API_KEY in your environment variables."
    );
  }

  return { apiKey, model };
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

4. SEO & AEO FOUNDATION RULES:
   - "index.html" MUST use clean HTML5 semantic tags (<header>, <nav>, <main>, <section>, <article>, <footer>).
   - Use exactly ONE primary <h1> tag for the main page hero heading. Use <h2> and <h3> for sub-sections.
   - Include a clear, visible FAQ or Q&A section whenever relevant to the business topic to enable Answer Engine Optimization (AEO).
   - Provide descriptive, context-rich image alt attributes (e.g. alt="Luxury BMW sedan on display at Kozhikode showroom") tailored to the business and location. Do NOT leave alt text empty or generic (e.g., "image", "photo").
   - Include clear, direct answer summaries under section headings for optimal AI/Answer Engine readiness.

5. RESPONSE FORMAT (CRITICAL):
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
  images?: UploadedImage[],
  options?: { conversationLanguage?: string; websiteLanguage?: string }
): Promise<GenerationResponse> {
  const { apiKey, model } = getGeminiConfig();
  const ai = new GoogleGenAI({ apiKey });

  const langDirective = buildMultilingualSystemDirective(
    options?.conversationLanguage,
    options?.websiteLanguage
  );

  let promptText = `${SYSTEM_GENERATION_PROMPT}\n\n${langDirective}\n\nUSER PROMPT: "${userPrompt}"`;

  if (images && images.length > 0) {
    promptText += `\n\nUSER ATTACHED ASSETS / IMAGES (${images.length} files attached):\n`;
    images.forEach((img, idx) => {
      const assetUrl = img.publicUrl || img.dataUrl;
      promptText += `- Asset #${idx + 1}: name="${img.name}", url="${assetUrl}"\n`;
    });
    const targetUrl = images[0].publicUrl || images[0].dataUrl;
    promptText += `\nCRITICAL MULTIMODAL INSTRUCTION: The user has uploaded ${images.length} custom image asset(s) (logo, hero image, product photo). You MUST inspect these attached images and include them in the generated HTML code using their exact public URL (e.g., <img src="${targetUrl}" alt="${images[0].name}" />) in the header logo, hero banner, or gallery sections! Do NOT generate or echo Base64 data URLs into the HTML code.\n`;
  }

  promptText += `\nGenerate the complete website plan and source files using the specified markers now:`;

  const contentsPayload: any[] = [promptText];

  if (images && images.length > 0) {
    images.forEach((img) => {
      const b64Data = img.base64 || (img.dataUrl ? img.dataUrl.split(",")[1] : "");
      if (b64Data) {
        contentsPayload.push({
          inlineData: {
            mimeType: img.mimeType,
            data: b64Data,
          },
        });
      }
    });
  }

  console.log("==========================================");
  console.log("REAL GEMINI API REQUEST STARTED");
  console.log(`MODEL BEING USED: ${model}`);
  console.log(`ATTACHED IMAGES: ${images ? images.length : 0}`);
  console.log(`CONVERSATION LANG: ${options?.conversationLanguage || "auto"}`);
  console.log(`WEBSITE CONTENT LANG: ${options?.websiteLanguage || "auto"}`);
  console.log("REQUEST SENT TO GEMINI...");

  const candidateModels = getCandidateModels(model);
  let lastError: any = null;

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const currentModel = candidateModels[mIdx];
    const maxAttempts = mIdx === 0 ? 2 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const t0 = Date.now();
      try {
        console.log(`ATTEMPTING GEMINI MODEL: ${currentModel} (attempt ${attempt}/${maxAttempts})`);
        const response = await withTimeout(
          ai.models.generateContent({
            model: currentModel,
            contents: contentsPayload,
          }),
          45000,
          `Gemini model ${currentModel} timed out after 45s.`
        );

        const responseText = response.text;
        if (!responseText || responseText.trim() === "") {
          throw new Error("Gemini returned an empty response.");
        }

        const servedModel = response.modelVersion || currentModel;
        const latencyMs = Date.now() - t0;

        logAITelemetry({
          timestamp: new Date().toISOString(),
          operation: "generate_website",
          requestedModel: currentModel,
          servedModel,
          status: "SUCCESS",
          statusCode: 200,
          latencyMs,
          attempt,
          fallbackIndex: mIdx,
          promptTokenCount: response.usageMetadata?.promptTokenCount,
          candidatesTokenCount: response.usageMetadata?.candidatesTokenCount,
          totalTokenCount: response.usageMetadata?.totalTokenCount,
          promptLengthChars: promptText.length,
          responseLengthChars: responseText.length,
          hasImages: Boolean(images && images.length > 0),
        });

        console.log(`SUCCESSFUL RESPONSE RECEIVED FROM GEMINI (requested: ${currentModel}, served: ${servedModel})`);
        console.log(`RESPONSE LENGTH: ${responseText.length} characters (latency: ${latencyMs}ms)`);
        console.log("==========================================");

        return parseMarkerDelimitedResponse(responseText, userPrompt);
      } catch (error: any) {
        const latencyMs = Date.now() - t0;
        const classified = classifyGeminiError(error);
        lastError = error;

        logAITelemetry({
          timestamp: new Date().toISOString(),
          operation: "generate_website",
          requestedModel: currentModel,
          status: "FAILED",
          statusCode: classified.statusCode,
          failureCategory: classified.failureCategory,
          latencyMs,
          attempt,
          fallbackIndex: mIdx,
          promptLengthChars: promptText.length,
          hasImages: Boolean(images && images.length > 0),
        });

        console.warn(`Model ${currentModel} attempt ${attempt} failed (${classified.failureCategory}):`, error?.message || error);

        if (classified.isAuthError) {
          console.error(`Non-retryable authentication error with Gemini API: ${error?.message || error}`);
          const friendly = formatErrorMessage(error);
          throw new GeminiAPIError(friendly, 401, "AUTH_ERROR");
        }

        if (attempt < maxAttempts && classified.isTransient) {
          const delayMs = calculateBackoffWithJitter(attempt, 1000, 2500);
          console.log(`[Gemini Retry] Retrying model ${currentModel} in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else if (mIdx < candidateModels.length - 1 && classified.isTransient) {
          const delayMs = calculateBackoffWithJitter(1, 800, 1500);
          console.log(`[Gemini Fallback] Switching to next fallback model in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
  }

  console.error("All Gemini API models failed:", lastError);
  console.log("==========================================");
  const finalClassified = classifyGeminiError(lastError);
  throw new GeminiAPIError(
    formatErrorMessage(lastError),
    finalClassified.statusCode,
    finalClassified.failureCategory
  );
}

export async function editWebsite(
  currentFiles: GeneratedFile[],
  instruction: string,
  images?: UploadedImage[],
  options?: { conversationLanguage?: string; websiteLanguage?: string }
): Promise<GenerationResponse> {
  const { apiKey, model } = getGeminiConfig();
  const ai = new GoogleGenAI({ apiKey });

  const langDirective = buildMultilingualSystemDirective(
    options?.conversationLanguage,
    options?.websiteLanguage
  );

  const currentCodeSummary = currentFiles
    .map((f) => `--- FILE: ${f.path} ---\n${f.content}`)
    .join("\n\n");

  let promptText = `${SYSTEM_EDIT_PROMPT}\n\n${langDirective}\n\nCURRENT WEBSITE SOURCE CODE:\n${currentCodeSummary}\n\nUSER EDIT INSTRUCTION: "${instruction}"`;

  if (images && images.length > 0) {
    promptText += `\n\nNEW ATTACHED ASSETS (${images.length} images):\n`;
    images.forEach((img, idx) => {
      const assetUrl = img.publicUrl || img.dataUrl;
      promptText += `- Asset #${idx + 1}: name="${img.name}", url="${assetUrl}"\n`;
    });
    const targetUrl = images[0].publicUrl || images[0].dataUrl;
    promptText += `\nCRITICAL IMAGE REFINEMENT INSTRUCTION: The user has attached ${images.length} custom image asset(s). When the user asks to use, replace, add, or set an image (e.g. hero image, background, gallery photo, logo), you MUST update the HTML code (<img src="${targetUrl}"> or CSS background-image: url("${targetUrl}")) using the EXACT URL specified above: "${targetUrl}". Do NOT use Base64 strings, do NOT truncate the URL, and do NOT leave placeholder image links.\n`;
  }

  promptText += `\nReturn updated website plan and files using the marker format now:`;

  const contentsPayload: any[] = [promptText];

  if (images && images.length > 0) {
    images.forEach((img) => {
      const b64Data = img.base64 || (img.dataUrl ? img.dataUrl.split(",")[1] : "");
      if (b64Data) {
        contentsPayload.push({
          inlineData: {
            mimeType: img.mimeType,
            data: b64Data,
          },
        });
      }
    });
  }

  const candidateModels = getCandidateModels(model);
  let lastError: any = null;

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const currentModel = candidateModels[mIdx];
    const maxAttempts = mIdx === 0 ? 2 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const t0 = Date.now();
      try {
        let response: any;
        try {
          response = await withTimeout(
            ai.models.generateContent({
              model: currentModel,
              contents: contentsPayload,
            }),
            45000,
            `Gemini edit model ${currentModel} timed out after 45s.`
          );
        } catch (err: any) {
          if (
            err?.message?.includes("INVALID_ARGUMENT") ||
            err?.message?.includes("Unable to process input image")
          ) {
            console.warn(
              `Model ${currentModel} failed inlineData vision, retrying with HTTPS URL promptText directive...`
            );
            response = await withTimeout(
              ai.models.generateContent({
                model: currentModel,
                contents: [promptText],
              }),
              45000,
              `Gemini edit fallback model ${currentModel} timed out after 45s.`
            );
          } else {
            throw err;
          }
        }

        const responseText = response.text;
        if (!responseText || responseText.trim() === "") {
          throw new Error("Gemini returned an empty response for edit.");
        }

        const servedModel = response?.modelVersion || currentModel;
        const latencyMs = Date.now() - t0;

        logAITelemetry({
          timestamp: new Date().toISOString(),
          operation: "edit_website",
          requestedModel: currentModel,
          servedModel,
          status: "SUCCESS",
          statusCode: 200,
          latencyMs,
          attempt,
          fallbackIndex: mIdx,
          promptTokenCount: response.usageMetadata?.promptTokenCount,
          candidatesTokenCount: response.usageMetadata?.candidatesTokenCount,
          totalTokenCount: response.usageMetadata?.totalTokenCount,
          promptLengthChars: promptText.length,
          responseLengthChars: responseText.length,
          hasImages: Boolean(images && images.length > 0),
        });

        console.log(`SUCCESSFUL EDIT RESPONSE RECEIVED FROM GEMINI (requested: ${currentModel}, served: ${servedModel})`);
        console.log(`RESPONSE LENGTH: ${responseText.length} characters (latency: ${latencyMs}ms)`);
        console.log("==========================================");

        return parseMarkerDelimitedResponse(responseText, instruction);
      } catch (error: any) {
        const latencyMs = Date.now() - t0;
        const classified = classifyGeminiError(error);
        lastError = error;

        logAITelemetry({
          timestamp: new Date().toISOString(),
          operation: "edit_website",
          requestedModel: currentModel,
          status: "FAILED",
          statusCode: classified.statusCode,
          failureCategory: classified.failureCategory,
          latencyMs,
          attempt,
          fallbackIndex: mIdx,
          promptLengthChars: promptText.length,
          hasImages: Boolean(images && images.length > 0),
        });

        console.warn(`Edit model ${currentModel} attempt ${attempt} failed (${classified.failureCategory}):`, error?.message || error);

        if (classified.isAuthError) {
          console.error(`Non-retryable authentication error on edit with Gemini API: ${error?.message || error}`);
          const friendly = formatErrorMessage(error);
          throw new GeminiAPIError(friendly, 401, "AUTH_ERROR");
        }

        if (attempt < maxAttempts && classified.isTransient) {
          const delayMs = calculateBackoffWithJitter(attempt, 1000, 2500);
          console.log(`[Gemini Edit Retry] Retrying edit model ${currentModel} in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else if (mIdx < candidateModels.length - 1 && classified.isTransient) {
          const delayMs = calculateBackoffWithJitter(1, 800, 1500);
          console.log(`[Gemini Edit Fallback] Switching to next fallback model in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
  }

  const finalClassified = classifyGeminiError(lastError);
  throw new GeminiAPIError(
    formatErrorMessage(lastError),
    finalClassified.statusCode,
    finalClassified.failureCategory
  );
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
    brandIdentity: "My AI Website",
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
