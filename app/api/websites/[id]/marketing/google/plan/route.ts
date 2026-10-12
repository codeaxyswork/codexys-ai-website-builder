import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateGoogleSearchPlan } from "@/lib/marketing/google-strategy";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // Rate Limiting (10 requests per minute per user)
    const rl = checkRateLimit(`google_plan_${user.id}`, { limit: 10, windowMs: 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many campaign planning requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const { data: website, error: siteErr } = await supabase
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .single();

    if (siteErr || !website || website.user_id !== user.id) {
      return NextResponse.json({ error: "Website not found or access denied" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const userGoal = body.userGoal || body.goal;
    const missingInputs = body.missingInputs;

    if (!userGoal || typeof userGoal !== "string" || !userGoal.trim()) {
      return NextResponse.json(
        { error: "Please provide a valid campaign goal." },
        { status: 400 }
      );
    }

    const result = await generateGoogleSearchPlan(
      supabase,
      websiteId,
      user.id,
      userGoal.trim(),
      missingInputs
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Google Plan API Route Error:", err);
    const isCreditError = err?.message?.toLowerCase().includes("insufficient ai credits");
    return NextResponse.json(
      {
        error: err?.message || "Failed to generate Google Search campaign plan.",
        code: isCreditError ? "INSUFFICIENT_CREDITS" : "PLAN_ERROR",
      },
      { status: isCreditError ? 402 : 500 }
    );
  }
}
