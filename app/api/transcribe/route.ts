import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit } from "@/lib/rate-limit";
import { getLanguageConfig } from "@/lib/multilingual";
import { createClient } from "@/utils/supabase/server";
import { checkCreditBalance, deductCredits, refundCredits } from "@/lib/billing";
import { CREDIT_COSTS, ERROR_CODES } from "@/lib/constants";
import { isUserSuspended } from "@/lib/admin-auth";

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
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // 1. Enforce Server-Side Authentication
    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required for audio transcription. Please log in first.",
          code: ERROR_CODES.UNAUTHORIZED,
        },
        { status: 401 }
      );
    }

    // 2. Check for Account Suspension
    if (await isUserSuspended(user.id)) {
      return NextResponse.json(
        { success: false, error: "Your account has been suspended by an administrator." },
        { status: 403 }
      );
    }

    // 3. User & IP Rate Limiting (10 requests per minute per user, 15 per IP)
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "client-ip";
    const userRl = checkRateLimit(`transcribe_user_${user.id}`, { limit: 10, windowMs: 60 * 1000 });
    const ipRl = checkRateLimit(`transcribe_ip_${ip}`, { limit: 15, windowMs: 60 * 1000 });

    if (!userRl.success || !ipRl.success) {
      return NextResponse.json(
        { success: false, error: "Too many transcription requests. Please wait a minute before trying again." },
        { status: 429 }
      );
    }

    // 4. Extract FormData (audio + language)
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

    // Max 5MB file size validation (avoids abusive payloads while comfortably fitting 60s voice prompts)
    if (audioFile.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Audio recording size exceeds 5MB limit." },
        { status: 400 }
      );
    }

    // 5. Detect & Validate MIME Type
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

    // 6. Server-Side Credit Check (1 Credit per Audio Transcription)
    const creditCost = CREDIT_COSTS.AUDIO_TRANSCRIBE;
    const creditCheck = await checkCreditBalance(user.id, creditCost);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient AI credits. Audio transcription requires ${creditCost} credit (Balance: ${creditCheck.balance}).`,
          code: ERROR_CODES.INSUFFICIENT_CREDITS,
          remainingCredits: creditCheck.balance,
        },
        { status: 402 }
      );
    }

    const opId =
      req.headers.get("x-request-id") ||
      req.headers.get("idempotency-key") ||
      crypto.randomUUID();
    const deductAction = `audio_transcribe:${opId}`;
    const refundAction = `refund:${deductAction}`;

    // 7. Atomic Upfront Credit Deduction to Prevent Concurrent Overspending
    const deductSuccess = await deductCredits(user.id, creditCost, deductAction);
    if (!deductSuccess) {
      return NextResponse.json(
        {
          success: false,
          error: "Credit deduction failed. Insufficient credit balance.",
          code: ERROR_CODES.INSUFFICIENT_CREDITS,
        },
        { status: 402 }
      );
    }

    // 8. Convert Audio Blob to Base64 (Transient in-memory processing)
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const base64Audio = audioBuffer.toString("base64");

    // 9. Retrieve Server-side Gemini API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "" || apiKey === "YOUR_GEMINI_API_KEY") {
      await refundCredits(user.id, creditCost, refundAction);
      return NextResponse.json(
        { success: false, error: "Gemini API Key is not configured on server." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // 10. Build Language & Custom Terminology Directive
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

    // 11. Candidate Gemini Transcription Models
    const candidateModels = [
      "gemini-3.5-transcribe",
      "gemini-3.8-flash",
      "gemini-3.6-flash",
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

        const servedModel = response.modelVersion || currentModel;
        console.log(`[Transcribe Endpoint] Successfully transcribed (requested: ${currentModel}, served: ${servedModel})`);

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
        const errMsg = err?.message || String(err || "");
        if (errMsg.includes("API key") || errMsg.includes("UNAUTHENTICATED") || errMsg.includes("401") || errMsg.includes("403")) {
          console.error(`[Transcribe Endpoint] Non-retryable authentication error on ${currentModel}: ${errMsg}`);
          break;
        }
        if (errMsg.includes("429") || errMsg.includes("503") || errMsg.includes("Quota") || errMsg.includes("UNAVAILABLE")) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    if (transcriptText === "" && lastError) {
      console.error("[Transcribe Endpoint] All candidate models failed:", lastError);
      // Refund on failure
      await refundCredits(user.id, creditCost, refundAction);
      return NextResponse.json(
        { success: false, error: "AI transcription engine failed to process audio. Your credit has been refunded." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transcript: transcriptText,
      creditsDeducted: creditCost,
      remainingCredits: Math.max(0, creditCheck.balance - creditCost),
    });
  } catch (error: any) {
    console.error("[Transcribe Route Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error during transcription." },
      { status: 500 }
    );
  }
}
