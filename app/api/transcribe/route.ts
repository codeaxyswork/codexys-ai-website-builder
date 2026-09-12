import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit } from "@/lib/rate-limit";
import { getLanguageConfig } from "@/lib/multilingual";

const ALLOWED_MIME_TYPES = [
  "audio/webm",
  "audio/wav",
  "audio/mp3",
  "audio/mpeg",
  "audio/ogg",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mp4",
];

export async function POST(req: NextRequest) {
  try {
    // 1. IP Rate Limiting for Public Chatbot Voice Input (15 requests per minute per IP)
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "client-ip";
    const rl = checkRateLimit(`transcribe_${ip}`, { limit: 15, windowMs: 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: "Too many transcription requests. Please wait a minute before trying again." },
        { status: 429 }
      );
    }

    // 2. Extract FormData (audio + language)
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e) {
      return NextResponse.json(
        { success: false, error: "Invalid form data or missing audio payload." },
        { status: 400 }
      );
    }
    const audioFile = formData.get("audio") as Blob | File | null;
    const languageCode = (formData.get("language") as string | null) || "auto";

    if (!audioFile || audioFile.size === 0) {
      return NextResponse.json(
        { success: false, error: "No valid audio recording received." },
        { status: 400 }
      );
    }

    // Max 15MB file size validation
    if (audioFile.size > 15 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Audio recording size exceeds 15MB limit." },
        { status: 400 }
      );
    }

    // 3. Detect & Validate MIME Type
    let mimeType = audioFile.type || "audio/webm";
    if (mimeType.includes(";")) {
      mimeType = mimeType.split(";")[0].trim();
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType) && !mimeType.startsWith("audio/")) {
      return NextResponse.json(
        { success: false, error: "Unsupported audio format." },
        { status: 400 }
      );
    }

    // 4. Convert Audio Blob to Base64 (Transient in-memory processing)
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const base64Audio = audioBuffer.toString("base64");

    // 5. Retrieve Server-side Gemini API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "" || apiKey === "YOUR_GEMINI_API_KEY") {
      return NextResponse.json(
        { success: false, error: "Gemini API Key is not configured on server." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // 6. Build Language & Custom Terminology Directive
    const langCfg = getLanguageConfig(languageCode);
    const langContext =
      langCfg && langCfg.code !== "auto"
        ? `The user's preferred conversation language is ${langCfg.englishName} (${langCfg.nativeName}, STT Locale: ${langCfg.sttLocale}).`
        : "Detect the spoken language automatically.";

    const systemPrompt = `You are an expert verbatim speech-to-text audio transcription engine for Codeaxys AI Website Builder.

TRANSCRIPTION DIRECTIVES (CRITICAL):
1. PRODUCE VERBATIM TRANSCRIPTION ONLY.
   - Do NOT summarize.
   - Do NOT rewrite or rephrase.
   - Do NOT convert the user's spoken words into a generated website prompt.
   - Do NOT interpret, answer, or reply to the user's speech.
   - Transcribe EXACTLY what the user spoke.

2. LANGUAGE & CODE-SWITCHING PRESERVATION:
   - ${langContext}
   - Preserve native scripts accurately (Malayalam / മലയാളം, Hindi / हिंदी, Tamil / தமிழ், etc.).
   - Preserve Manglish (Romanized Malayalam script) and Hinglish as spoken.
   - Preserve mixed language code-switching (e.g., "എനിക്ക് ഒരു 5 page modern website വേണം with WhatsApp button and contact form").

3. DOMAIN VOCABULARY & TECHNICAL TERMS:
   Recognize and preserve domain terminology accurately:
   Codeaxys, website, landing page, five page website, multi page website, WhatsApp, contact form, hero section, navbar, navigation, footer, portfolio, testimonial, pricing, services, SEO, Google Maps, CTA, button, contact, about us, gallery, blog, responsive, mobile, desktop.

4. RESPONSE FORMAT:
   Return ONLY the raw transcription text string. Do NOT include markdown code blocks, JSON formatting, quotes, or conversational prefix/suffix text. If the audio contains silence or no speech, respond with an empty string.`;

    // 7. Candidate Gemini Transcription Models
    const candidateModels = [
      "gemini-3.5-transcribe",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-2.5-flash",
    ];

    let transcriptText = "";
    let lastError: any = null;

    for (const currentModel of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Audio,
              },
            },
            systemPrompt,
          ],
        });

        const text = response.text ? response.text.trim() : "";
        transcriptText = text
          .replace(/^```[a-z]*\n?/i, "")
          .replace(/\n?```$/i, "")
          .replace(/^["']|["']$/g, "")
          .trim();

        break;
      } catch (err: any) {
        console.warn(`[Transcribe Endpoint] Model ${currentModel} failed:`, err?.message || err);
        lastError = err;
      }
    }

    if (transcriptText === "" && lastError) {
      console.error("[Transcribe Endpoint] All candidate models failed:", lastError);
      return NextResponse.json(
        { success: false, error: "AI transcription engine failed to process audio." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transcript: transcriptText,
    });
  } catch (error: any) {
    console.error("[Transcribe Route Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error during transcription." },
      { status: 500 }
    );
  }
}
