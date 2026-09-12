import { NextRequest, NextResponse } from "next/server";
import { editWebsite } from "@/lib/gemini";
import { GeneratedFile, WebsitePlan } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";
import { checkCreditBalance, deductCredits } from "@/lib/billing";
import { isUserSuspended } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { CREDIT_COSTS, ERROR_CODES } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "client-ip";
    const rl = checkRateLimit(`edit_${ip}`, { limit: 15, windowMs: 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many edit requests. Please wait a minute before trying again." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { files, instruction, images, websiteId, conversationLanguage, websiteLanguage } = body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "No existing generated files provided for edit." },
        { status: 400 }
      );
    }

    if (!instruction || typeof instruction !== "string" || instruction.trim() === "") {
      return NextResponse.json(
        { error: "Please provide a valid refinement or edit instruction." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to edit websites. Please log in first." },
        { status: 401 }
      );
    }

    if (await isUserSuspended(user.id)) {
      return NextResponse.json(
        { error: "Your account has been suspended by an administrator." },
        { status: 403 }
      );
    }

    const creditCheck = await checkCreditBalance(user.id, CREDIT_COSTS.AI_EDIT);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: ERROR_CODES.INSUFFICIENT_CREDITS,
          message: `You need ${CREDIT_COSTS.AI_EDIT} AI credits to edit your website. You currently have ${creditCheck.balance} credits remaining.`,
        },
        { status: 402 }
      );
    }

    // 2. Call existing Gemini AI edit (lib/gemini.ts UNTOUCHED)
    const result = await editWebsite(files as GeneratedFile[], instruction.trim(), images, {
      conversationLanguage,
      websiteLanguage,
    });

    // 3. If user is authenticated and Gemini edit succeeded: save & deduct credits
    if (user && result && result.files && result.files.length > 0) {
      if (websiteId) {
        await saveEditedWebsiteToDb(supabase, user.id, websiteId, result.plan, result.files);
      }
      // Deduct 5 credits atomically (0 credits deducted if Gemini failed above)
      await deductCredits(user.id, CREDIT_COSTS.AI_EDIT, "ai_edit", websiteId);
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("API /api/edit Error:", error);
    const errorMessage = error?.message || "An unexpected error occurred during edit.";
    const isConfigError = errorMessage.includes("GEMINI_API_KEY");
    const status = isConfigError ? 400 : 500;

    return NextResponse.json({ error: errorMessage }, { status: status });
  }
}

async function saveEditedWebsiteToDb(
  supabase: any,
  userId: string,
  websiteId: string,
  plan: WebsitePlan,
  files: GeneratedFile[]
) {
  try {
    const htmlContent = files.find((f) => f.path.endsWith("index.html"))?.content || "";
    const cssContent = files.find((f) => f.path.endsWith("styles.css"))?.content || "";
    const jsContent = files.find((f) => f.path.endsWith("script.js"))?.content || "";

    await supabase
      .from("websites")
      .update({
        design_plan: plan || {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", websiteId)
      .eq("user_id", userId);

    await supabase
      .from("website_pages")
      .update({
        html_content: htmlContent,
        css_content: cssContent,
        js_content: jsContent,
        updated_at: new Date().toISOString(),
      })
      .eq("website_id", websiteId)
      .eq("user_id", userId);
  } catch (e) {
    console.error("Save edit failed:", e);
  }
}
