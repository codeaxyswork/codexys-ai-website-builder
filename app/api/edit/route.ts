import { NextRequest, NextResponse } from "next/server";
import { editWebsite } from "@/lib/gemini";
import { GeneratedFile, WebsitePlan } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";
import { checkCreditBalance, deductCredits, refundCredits } from "@/lib/billing";
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

    // User rate limit: 15 edits per minute
    const userRl = checkRateLimit(`edit_user_${user.id}`, { limit: 15, windowMs: 60 * 1000 });
    if (!userRl.success) {
      return NextResponse.json(
        { error: "Too many edit requests. Please slow down." },
        { status: 429 }
      );
    }

    // Verify website ownership upfront if websiteId is provided
    if (websiteId) {
      const { data: websiteCheck, error: webErr } = await supabase
        .from("websites")
        .select("id, user_id")
        .eq("id", websiteId)
        .single();

      if (webErr || !websiteCheck || websiteCheck.user_id !== user.id) {
        return NextResponse.json(
          { error: "Website not found or unauthorized access." },
          { status: 403 }
        );
      }
    }

    // Check balance upfront
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

    const opId =
      req.headers.get("x-request-id") ||
      req.headers.get("idempotency-key") ||
      body?.requestId ||
      crypto.randomUUID();
    const deductAction = `ai_edit:${opId}`;
    const refundAction = `refund:${deductAction}`;

    // Deduct credits upfront atomically
    const deducted = await deductCredits(user.id, CREDIT_COSTS.AI_EDIT, deductAction, websiteId);
    if (!deducted) {
      return NextResponse.json(
        {
          error: ERROR_CODES.INSUFFICIENT_CREDITS,
          message: `You need ${CREDIT_COSTS.AI_EDIT} AI credits to edit your website. Insufficient balance or concurrent request in progress.`,
        },
        { status: 402 }
      );
    }

    // Call existing Gemini AI edit with refund safeguard
    let result;
    try {
      result = await editWebsite(files as GeneratedFile[], instruction.trim(), images, {
        conversationLanguage,
        websiteLanguage,
      });

      if (!result || !result.files || result.files.length === 0) {
        throw new Error("AI edit produced empty website files.");
      }
    } catch (editErr: any) {
      console.warn("Website edit failed, refunding credits:", editErr?.message || editErr);
      await refundCredits(user.id, CREDIT_COSTS.AI_EDIT, refundAction, websiteId);
      throw editErr;
    }

    // Save edited website to DB
    if (user && result && result.files && result.files.length > 0) {
      if (websiteId) {
        await saveEditedWebsiteToDb(supabase, user.id, websiteId, result.plan, result.files);
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("API /api/edit Error:", error);
    const errorMessage = error?.message || "An unexpected error occurred during edit.";
    const isConfigError = errorMessage.includes("GEMINI_API_KEY");
    const isCapacityOr503 =
      error?.statusCode === 503 ||
      error?.status === 503 ||
      errorMessage.includes("503") ||
      errorMessage.includes("high demand") ||
      errorMessage.includes("UNAVAILABLE");

    const status = isConfigError ? 400 : isCapacityOr503 ? 503 : (error?.statusCode || error?.status || 500);
    const headers: Record<string, string> = {};
    if (status === 503) {
      headers["Retry-After"] = "5";
    }

    return NextResponse.json({ error: errorMessage }, { status, headers });
  }
}

async function saveEditedWebsiteToDb(
  supabase: any,
  userId: string,
  websiteId: string,
  plan: WebsitePlan,
  files: GeneratedFile[]
) {
  const htmlContent = files.find((f) => f.path.endsWith("index.html"))?.content || "";
  const cssContent = files.find((f) => f.path.endsWith("styles.css"))?.content || "";
  const jsContent = files.find((f) => f.path.endsWith("script.js"))?.content || "";

  const { error: webError } = await supabase
    .from("websites")
    .update({
      design_plan: plan || {},
      updated_at: new Date().toISOString(),
    })
    .eq("id", websiteId)
    .eq("user_id", userId);

  if (webError) {
    console.error("Save website edit metadata failed:", webError);
    throw new Error(`Failed to update website record: ${webError.message}`);
  }

  const { error: pageError } = await supabase
    .from("website_pages")
    .update({
      html_content: htmlContent,
      css_content: cssContent,
      js_content: jsContent,
      updated_at: new Date().toISOString(),
    })
    .eq("website_id", websiteId)
    .eq("user_id", userId);

  if (pageError) {
    console.error("Save website_pages edit failed:", pageError);
    // Fallback: Insert index.html page row if missing
    const { error: insertError } = await supabase.from("website_pages").insert({
      website_id: websiteId,
      user_id: userId,
      path: "index.html",
      html_content: htmlContent,
      css_content: cssContent,
      js_content: jsContent,
    });
    if (insertError) {
      throw new Error(`Failed to update website page content: ${insertError.message}`);
    }
  }

  // Non-blocking SEO dirty state & job enqueue
  try {
    const { enqueueSEOJob } = await import("@/lib/seo-job-processor");
    enqueueSEOJob(supabase, {
      websiteId,
      userId,
      triggerType: "website_refinement",
      idempotencyKey: `refine_${websiteId}_${Date.now()}`,
    }).catch((err) => console.error("Non-blocking SEO job enqueue warning:", err));
  } catch (e) {
    console.error("Failed to enqueue SEO refinement job:", e);
  }
}
