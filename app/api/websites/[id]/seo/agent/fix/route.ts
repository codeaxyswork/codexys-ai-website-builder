import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getUserUsage } from "@/lib/billing";
import { canUseFeature } from "@/lib/features";
import { executeSEOAnalysis } from "@/lib/seo-job-processor";
import { StructuredSEOFix } from "@/lib/seo-agent";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    // 1. Authenticate User
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Check Plan Permissions
    const usage = await getUserUsage(user.id);
    const planId = usage?.plan?.id || "free";

    if (!canUseFeature(planId, "ai_seo")) {
      return NextResponse.json(
        {
          error: "Applying AI SEO fixes requires a Pro or Agency subscription plan.",
          code: "UPGRADE_REQUIRED",
        },
        { status: 403 }
      );
    }

    // 3. Verify Website Ownership
    const { data: website, error: websiteErr } = await supabase
      .from("websites")
      .select("id, title")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (websiteErr || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 404 }
      );
    }

    // Parse Request Payload
    const body = await request.json();
    const proposedFix: StructuredSEOFix | null = body.proposedFix || null;

    if (!proposedFix || !proposedFix.issueType || !proposedFix.recommendedValue) {
      return NextResponse.json(
        { error: "Invalid or missing proposed SEO fix payload." },
        { status: 400 }
      );
    }

    // 4. Fetch Current SEO Record to record old score
    const { data: currentSeo } = await supabase
      .from("website_seo")
      .select("*")
      .eq("website_id", websiteId)
      .maybeSingle();

    const oldScore = currentSeo?.seo_score ?? 0;

    // 5. Execute Approved Fix (Metadata vs Page Content)
    const issueType = proposedFix.issueType;
    const recValue = proposedFix.recommendedValue.trim();

    if (
      ["seo_title", "meta_description", "focus_keywords", "og_title", "og_description", "canonical_url", "robots_config"].includes(issueType)
    ) {
      const updateData: Record<string, any> = {
        website_id: websiteId,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };

      if (issueType === "seo_title") {
        updateData.seo_title = recValue;
      } else if (issueType === "meta_description") {
        updateData.meta_description = recValue;
      } else if (issueType === "focus_keywords") {
        const keywordsArray = recValue.includes(",")
          ? recValue.split(",").map((k) => k.trim()).filter(Boolean)
          : [recValue];
        updateData.focus_keywords = keywordsArray;
      } else if (issueType === "og_title") {
        updateData.og_title = recValue;
      } else if (issueType === "og_description") {
        updateData.og_description = recValue;
      } else if (issueType === "canonical_url") {
        updateData.canonical_url = recValue;
      } else if (issueType === "robots_config") {
        if (recValue.toLowerCase().includes("noindex")) {
          updateData.robots_index = false;
        } else {
          updateData.robots_index = true;
          updateData.robots_follow = true;
        }
      }

      const { error: upsertErr } = await supabase
        .from("website_seo")
        .upsert(updateData, { onConflict: "website_id" });

      if (upsertErr) {
        console.error("Failed to apply SEO metadata fix:", upsertErr);
        throw new Error(`Failed to apply SEO metadata fix: ${upsertErr.message}`);
      }
    } else if (["alt_text", "heading_structure"].includes(issueType)) {
      // Page HTML level fix
      const targetPath = proposedFix.pagePath || "index.html";
      const { data: pageRow } = await supabase
        .from("website_pages")
        .select("id, html_content")
        .eq("website_id", websiteId)
        .eq("path", targetPath)
        .maybeSingle();

      if (pageRow?.id && pageRow.html_content) {
        let updatedHtml = pageRow.html_content;

        if (issueType === "alt_text" && proposedFix.currentValue) {
          // Add/update alt attribute
          updatedHtml = updatedHtml.replace(/<img\s+([^>]*?)>/gi, (match: string) => {
            if (!match.includes('alt="') && !match.includes("alt='")) {
              return match.replace("<img ", `<img alt="${recValue}" `);
            }
            return match;
          });
        }

        await supabase
          .from("website_pages")
          .update({
            html_content: updatedHtml,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pageRow.id);
      }
    }

    // 6. Execute Re-Analysis Engine (recalculating score, updating page SEO, logging history)
    const reAnalysisResult = await executeSEOAnalysis(supabase, websiteId, user.id, "ai_fix");
    const newScore = reAnalysisResult.seo_score;

    return NextResponse.json({
      success: true,
      oldScore,
      newScore,
      message: `SEO fix applied successfully. Your SEO score changed from ${oldScore} to ${newScore}.`,
      seo: reAnalysisResult.aggregate_analysis,
    });
  } catch (err: any) {
    console.error("POST SEO Agent Fix Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to apply SEO fix." },
      { status: 500 }
    );
  }
}
