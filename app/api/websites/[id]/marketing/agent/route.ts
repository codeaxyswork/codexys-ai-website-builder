import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/marketing/meta-client";
import { checkCreditBalance, deductCreditsWithClient, refundCredits } from "@/lib/billing";
import { checkRateLimit } from "@/lib/rate-limit";
import { CREDIT_COSTS } from "@/lib/constants";
import { generateMarketingAgentReply, MarketingAgentChatMessage } from "@/lib/marketing/marketing-agent-ai";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

    // Validate website existence & user ownership
    const { data: website, error: webErr } = await dbClient
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ error: "Website not found." }, { status: 404 });
    }

    if (website.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied to this website." }, { status: 403 });
    }

    // Rate limiting: 20 queries per minute per user
    const rl = checkRateLimit(`marketing-agent:${user.id}`, { limit: 20, windowMs: 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many marketing agent requests. Please slow down.", code: "RATE_LIMITED" },
        { status: 429 }
      );
    }

    // Billing & Credit Safeguard
    const CREDIT_COST = CREDIT_COSTS.MARKETING_AGENT;
    const creditStatus = await checkCreditBalance(user.id, CREDIT_COST);

    if (!creditStatus.allowed) {
      return NextResponse.json(
        {
          error: `Insufficient AI credits. You need ${CREDIT_COST} AI credits to query the Marketing Agent.`,
          code: "INSUFFICIENT_CREDITS",
          remainingCredits: creditStatus.balance,
        },
        { status: 402 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const userPrompt = body.prompt || body.userMessage || "";
    const history: MarketingAgentChatMessage[] = body.history || [];
    const conversationLanguage = body.conversationLanguage || "auto";

    if (!userPrompt || typeof userPrompt !== "string" || !userPrompt.trim()) {
      return NextResponse.json({ error: "Please provide a valid marketing query." }, { status: 400 });
    }

    const opId =
      req.headers.get("x-request-id") ||
      req.headers.get("idempotency-key") ||
      body?.requestId ||
      crypto.randomUUID();
    const deductAction = `marketing_agent:${opId}`;
    const refundAction = `refund:${deductAction}`;

    // Deduct credits upfront atomically
    const deducted = await deductCreditsWithClient(
      dbClient,
      user.id,
      CREDIT_COST,
      deductAction,
      websiteId
    );

    if (!deducted) {
      return NextResponse.json(
        {
          error: "Unable to deduct AI credits. Insufficient balance or concurrent request in progress.",
          code: "INSUFFICIENT_CREDITS",
          remainingCredits: creditStatus.balance,
        },
        { status: 402 }
      );
    }

    // Generate Conversational Marketing Agent Response with 10s hard server timeout safeguard
    const serverTimeoutPromise = new Promise<any>((_, reject) =>
      setTimeout(() => reject(new Error("Marketing Agent request processing timed out")), 10000)
    );

    try {
      const agentResponse = await Promise.race([
        generateMarketingAgentReply(
          dbClient,
          websiteId,
          user.id,
          userPrompt.trim(),
          history,
          conversationLanguage
        ),
        serverTimeoutPromise,
      ]);

      return NextResponse.json({
        success: true,
        response: agentResponse,
        remainingCredits: Math.max(0, creditStatus.balance - CREDIT_COST),
      });
    } catch (err: any) {
      console.warn("Marketing Agent failed or timed out, processing refund:", err?.message || err);
      await refundCredits(
        user.id,
        CREDIT_COST,
        refundAction,
        websiteId
      );

      return NextResponse.json(
        {
          error: err?.message || "Marketing Agent request failed. Your credits have been refunded.",
          code: "AGENT_EXECUTION_FAILED",
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Marketing Agent API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to process Marketing Agent request." },
      { status: 500 }
    );
  }
}
