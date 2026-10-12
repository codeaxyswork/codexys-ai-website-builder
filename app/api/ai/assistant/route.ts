import { NextRequest, NextResponse } from "next/server";
import { generateAssistantReply, AssistantChatMessage } from "@/lib/assistant-gemini";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/utils/supabase/server";
import { checkCreditBalance, deductCredits, refundCredits } from "@/lib/billing";
import { CREDIT_COSTS, ERROR_CODES } from "@/lib/constants";
import { isUserSuspended } from "@/lib/admin-auth";

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
          error: "Authentication required to use AI Assistant. Please log in first.",
          code: ERROR_CODES.UNAUTHORIZED,
        },
        { status: 401 }
      );
    }

    // 2. Check for Account Suspension
    if (await isUserSuspended(user.id)) {
      return NextResponse.json(
        { error: "Your account has been suspended by an administrator." },
        { status: 403 }
      );
    }

    // 3. Rate Limiting per User and IP
    const ip = req.headers.get("x-forwarded-for") || "client-ip";
    const userRl = checkRateLimit(`assistant_user_${user.id}`, { limit: 15, windowMs: 60 * 1000 });
    const ipRl = checkRateLimit(`assistant_ip_${ip}`, { limit: 25, windowMs: 60 * 1000 });

    if (!userRl.success || !ipRl.success) {
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

    // 4. Server-Side Credit Check (1 Credit per Assistant Query)
    const creditCost = CREDIT_COSTS.ASSISTANT_CHAT;
    const creditCheck = await checkCreditBalance(user.id, creditCost);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: `Insufficient AI credits. You need ${creditCost} credit to use the AI Assistant (Balance: ${creditCheck.balance}).`,
          code: ERROR_CODES.INSUFFICIENT_CREDITS,
          remainingCredits: creditCheck.balance,
        },
        { status: 402 }
      );
    }

    const opId =
      req.headers.get("x-request-id") ||
      req.headers.get("idempotency-key") ||
      body?.requestId ||
      crypto.randomUUID();
    const deductAction = `ai_assistant_chat:${opId}`;
    const refundAction = `refund:${deductAction}`;

    // 5. Atomic Upfront Credit Deduction to Prevent Concurrent Overspending
    const deductSuccess = await deductCredits(user.id, creditCost, deductAction);
    if (!deductSuccess) {
      return NextResponse.json(
        {
          error: "Credit deduction failed. Insufficient credit balance.",
          code: ERROR_CODES.INSUFFICIENT_CREDITS,
        },
        { status: 402 }
      );
    }

    // 6. Invoke Gemini Assistant with Failure Refund Protection
    let result;
    try {
      result = await generateAssistantReply(
        history as AssistantChatMessage[],
        userMessage.trim(),
        conversationLanguage
      );

      if (!result || !result.text || result.text.includes("Service Unavailable")) {
        // LLM failed to produce valid reply: Refund deducted credit
        await refundCredits(user.id, creditCost, refundAction);
        return NextResponse.json(
          { error: "AI Assistant is temporarily unavailable. Your credit has been refunded. Please try again shortly." },
          { status: 503 }
        );
      }
    } catch (genErr: any) {
      // Refund deducted credit on generation exception
      await refundCredits(user.id, creditCost, refundAction);
      throw genErr;
    }

    return NextResponse.json({
      success: true,
      text: result.text,
      suggestedPrompt: result.suggestedPrompt || null,
      creditsDeducted: creditCost,
      remainingCredits: Math.max(0, creditCheck.balance - creditCost),
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
