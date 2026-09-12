import { NextRequest, NextResponse } from "next/server";
import { generateWebsite } from "@/lib/gemini";
import { createClient } from "@/utils/supabase/server";
import { checkWebsiteLimit, checkCreditBalance, deductCredits } from "@/lib/billing";
import { isUserSuspended } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { CREDIT_COSTS, ERROR_CODES } from "@/lib/constants";
import { GeneratedFile, WebsitePlan } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "client-ip";
    const rl = checkRateLimit(`gen_${ip}`, { limit: 10, windowMs: 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many website generation requests. Please wait a minute before trying again." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { prompt, images, websiteId } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return NextResponse.json(
        { error: "Please provide a valid website prompt description." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // STRICT AUTHENTICATION REQUIREMENT
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to generate websites. Please log in first." },
        { status: 401 }
      );
    }

    if (await isUserSuspended(user.id)) {
      return NextResponse.json(
        { error: "Your account has been suspended by an administrator." },
        { status: 403 }
      );
    }

    // 1. Check website limit if generating a new website
    if (!websiteId) {
      const webLimit = await checkWebsiteLimit(user.id);
      if (!webLimit.allowed) {
        return NextResponse.json(
          {
            error: ERROR_CODES.WEBSITE_LIMIT_REACHED,
            message: `Your current plan allows a maximum of ${webLimit.limit} website(s). Upgrade your plan to create more websites.`,
          },
          { status: 403 }
        );
      }
    }

    // 2. Check AI credit balance
    const creditCheck = await checkCreditBalance(
      user.id,
      CREDIT_COSTS.INITIAL_GENERATION
    );
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: ERROR_CODES.INSUFFICIENT_CREDITS,
          message: `You need ${CREDIT_COSTS.INITIAL_GENERATION} AI credits to generate a website. You currently have ${creditCheck.balance} credits remaining.`,
        },
        { status: 402 }
      );
    }

    // 3. Execute existing Gemini website generation (lib/gemini.ts UNTOUCHED)
    const result = await generateWebsite(prompt.trim(), images);

    // 4. If user is authenticated and Gemini generation succeeded: save & deduct credits
    let savedWebsiteId = websiteId;
    if (user && result && result.files && result.files.length > 0) {
      savedWebsiteId = await saveGeneratedWebsiteToDb(
        supabase,
        user.id,
        websiteId,
        prompt.trim(),
        result.plan,
        result.files
      );

      // Deduct credits atomically (0 credits deducted if Gemini failed above)
      await deductCredits(
        user.id,
        CREDIT_COSTS.INITIAL_GENERATION,
        "initial_generation",
        savedWebsiteId
      );
    }

    return NextResponse.json(
      {
        ...result,
        websiteId: savedWebsiteId || undefined,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("API /api/generate Error:", error);
    const errorMessage = error?.message || "An unexpected error occurred during generation.";
    const isConfigError = errorMessage.includes("GEMINI_API_KEY");
    const status = isConfigError ? 400 : 500;

    return NextResponse.json({ error: errorMessage }, { status: status });
  }
}

async function saveGeneratedWebsiteToDb(
  supabase: any,
  userId: string,
  existingWebsiteId: string | undefined,
  promptText: string,
  plan: WebsitePlan,
  files: GeneratedFile[]
): Promise<string> {
  try {
    let title = plan?.brandIdentity || plan?.websiteType || "My AI Website";
    if (title.length > 60) title = title.substring(0, 57) + "...";
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    
    const uniqueSuffix = Math.random().toString(36).substring(2, 7);
    const cleanSlug = `${baseSlug || "site"}-${uniqueSuffix}`;

    const htmlContent = files.find((f) => f.path.endsWith("index.html"))?.content || "";
    const cssContent = files.find((f) => f.path.endsWith("styles.css"))?.content || "";
    const jsContent = files.find((f) => f.path.endsWith("script.js"))?.content || "";

    let targetId = existingWebsiteId;

    if (targetId) {
      const { error: updateError } = await supabase
        .from("websites")
        .update({
          title,
          prompt: promptText,
          design_plan: plan || {},
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetId)
        .eq("user_id", userId);

      if (updateError) {
        console.error("Error updating website in saveGeneratedWebsiteToDb:", updateError);
      }

      const { error: pageUpdateError } = await supabase
        .from("website_pages")
        .update({
          html_content: htmlContent,
          css_content: cssContent,
          js_content: jsContent,
          updated_at: new Date().toISOString(),
        })
        .eq("website_id", targetId)
        .eq("user_id", userId);

      if (pageUpdateError) {
        // Fallback: insert page row if missing
        await supabase.from("website_pages").insert({
          website_id: targetId,
          user_id: userId,
          path: "index.html",
          html_content: htmlContent,
          css_content: cssContent,
          js_content: jsContent,
        });
      }
    } else {
      const { data: newWeb, error: createError } = await supabase
        .from("websites")
        .insert({
          user_id: userId,
          title,
          slug: cleanSlug,
          prompt: promptText,
          design_plan: plan || {},
        })
        .select("id")
        .single();

      if (createError) {
        console.error("Error inserting new website in saveGeneratedWebsiteToDb:", createError);
      }

      if (newWeb) {
        targetId = newWeb.id;
        const { error: pageInsertError } = await supabase.from("website_pages").insert({
          website_id: targetId,
          user_id: userId,
          path: "index.html",
          html_content: htmlContent,
          css_content: cssContent,
          js_content: jsContent,
        });
        if (pageInsertError) {
          console.error("Error inserting website_pages in saveGeneratedWebsiteToDb:", pageInsertError);
        }
      }
    }

    return targetId || "";
  } catch (e) {
    console.error("Save on generation failed:", e);
    return existingWebsiteId || "";
  }
}
