import { NextRequest, NextResponse } from "next/server";
import { generateAssistantReply, AssistantChatMessage } from "@/lib/assistant-gemini";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "client-ip";
    const rl = checkRateLimit(`assistant_${ip}`, { limit: 20, windowMs: 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many assistant requests. Please wait a moment before sending another message." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { history = [], userMessage, conversationLanguage } = body;

    if (!userMessage || typeof userMessage !== "string" || userMessage.trim() === "") {
      return NextResponse.json(
        { error: "Please provide a valid message." },
        { status: 400 }
      );
    }

    const result = await generateAssistantReply(
      history as AssistantChatMessage[],
      userMessage.trim(),
      conversationLanguage
    );

    return NextResponse.json({
      success: true,
      text: result.text,
      suggestedPrompt: result.suggestedPrompt || null,
    });
  } catch (err: any) {
    console.error("API /api/ai/assistant Error:", err);
    return NextResponse.json(
      {
        error: "Failed to process message.",
        details: err?.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}
