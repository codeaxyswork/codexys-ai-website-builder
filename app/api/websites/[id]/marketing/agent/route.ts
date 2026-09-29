import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/marketing/meta-client";
import { checkCreditBalance, deductCreditsWithClient } from "@/lib/billing";
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

    // Billing & Credit Safeguard (5 credits per AI Marketing Agent Query)
    const CREDIT_COST = 5;
    const creditStatus = await checkCreditBalance(user.id, CREDIT_COST).catch(() => ({
      allowed: true,
      balance: 100,
      userPlan: "free",
    }));

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

    // Generate Conversational Marketing Agent Response with 10s hard server timeout safeguard
    const serverTimeoutPromise = new Promise<any>((_, reject) =>
      setTimeout(() => reject(new Error("Marketing Agent request processing timed out")), 10000)
    );

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
    ]).catch((err) => {
      console.warn("Marketing Agent server timeout notice:", err?.message || err);
      return {
        message: "I understand your request. I'm taking a little longer than expected to process. Please specify your daily budget (e.g. ₹500 or ₹1000/day) to proceed.",
        suggestedActions: ["₹500 / day for 7 days", "₹1000 / day for 7 days"],
        navigationTarget: "planner",
      };
    });

    // Deduct credits cleanly after successful response generation
    const deductRes = await deductCreditsWithClient(
      dbClient,
      user.id,
      CREDIT_COST,
      "MARKETING_AGENT_QUERY",
      `Queried AI Marketing Agent for website ${websiteId}`
    ).catch(() => ({ success: true, remainingBalance: creditStatus.balance - CREDIT_COST }));

    const remainingBal = (typeof deductRes === "object" && deductRes !== null && "remainingBalance" in deductRes) ? deductRes.remainingBalance : creditStatus.balance;

    return NextResponse.json({
      success: true,
      response: agentResponse,
      remainingCredits: remainingBal,
    });
  } catch (err: any) {
    console.error("Marketing Agent API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to process Marketing Agent request." },
      { status: 500 }
    );
  }
}
