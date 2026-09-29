import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { executeSEOAnalysis } from "@/lib/seo-job-processor";

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

    // 2. Verify Website Ownership
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

    const body = await request.json().catch(() => ({}));
    const fixId = body.fixId;
    const field = body.field || "seo_title";
    const originalValue = body.originalValue;

    // Fetch previous SEO record
    const { data: currentSeo } = await supabase
      .from("website_seo")
      .select("*")
      .eq("website_id", websiteId)
      .maybeSingle();

    const oldScore = currentSeo?.seo_score ?? 0;

    // If fixId specified, fetch from history table if available
    let targetField = field;
    let restoreValue = originalValue;

    if (fixId) {
      const { data: fixRecord } = await supabase
        .from("seo_change_history")
        .select("*")
        .eq("id", fixId)
        .eq("website_id", websiteId)
        .maybeSingle();

      if (fixRecord) {
        targetField = fixRecord.issue_type || field;
        restoreValue = fixRecord.original_value;
      }
    }

    // Revert metadata or page HTML
    if (
      ["seo_title", "meta_description", "focus_keywords", "og_title", "og_description", "canonical_url"].includes(targetField)
    ) {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (targetField === "seo_title") {
        updateData.seo_title = restoreValue || "";
      } else if (targetField === "meta_description") {
        updateData.meta_description = restoreValue || "";
      } else if (targetField === "focus_keywords") {
        updateData.focus_keywords = Array.isArray(restoreValue)
          ? restoreValue
          : typeof restoreValue === "string"
          ? restoreValue.split(",").map((k: string) => k.trim())
          : [];
      } else if (targetField === "og_title") {
        updateData.og_title = restoreValue || "";
      } else if (targetField === "og_description") {
        updateData.og_description = restoreValue || "";
      } else if (targetField === "canonical_url") {
        updateData.canonical_url = restoreValue || "";
      }

      await supabase
        .from("website_seo")
        .update(updateData)
        .eq("website_id", websiteId);
    }

    // Mark fix record as rolled_back if logged
    if (fixId) {
      await supabase
        .from("seo_change_history")
        .update({ status: "rolled_back", updated_at: new Date().toISOString() })
        .eq("id", fixId);
    }

    // Log rollback event into monitoring history
    await supabase.from("seo_monitoring_events").insert({
      website_id: websiteId,
      user_id: user.id,
      event_type: "seo_rollback",
      severity: "info",
      title: `SEO Rollback Executed for ${targetField}`,
      message: `Reverted ${targetField} back to previous state.`,
      created_at: new Date().toISOString(),
    });

    // Re-execute SEO analysis engine
    const reAnalysisResult = await executeSEOAnalysis(supabase, websiteId, user.id, "rollback");
    const newScore = reAnalysisResult.seo_score;

    return NextResponse.json({
      success: true,
      oldScore,
      newScore,
      message: `SEO Rollback completed for ${targetField}. SEO score is now ${newScore}.`,
      seo: reAnalysisResult.aggregate_analysis,
    });
  } catch (err: any) {
    console.error("POST SEO Agent Rollback Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to execute SEO rollback." },
      { status: 500 }
    );
  }
}
