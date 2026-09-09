import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { analyzeWebsiteSEO } from "@/lib/seo-analyzer";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const { data: website, error: websiteErr } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (websiteErr || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 404 }
      );
    }

    // Load website page content
    const { data: indexPage } = await supabase
      .from("website_pages")
      .select("html_content")
      .eq("website_id", websiteId)
      .eq("path", "index.html")
      .single();

    const htmlContent = indexPage?.html_content || "";

    // Load SEO settings
    const { data: seoSettings } = await supabase
      .from("website_seo")
      .select("*")
      .eq("website_id", websiteId)
      .single();

    // Perform analysis
    const result = analyzeWebsiteSEO(htmlContent, seoSettings || {});

    // Save into history table
    await supabase.from("seo_analysis_history").insert({
      website_id: websiteId,
      user_id: user.id,
      seo_score: result.seo_score,
      analysis: result.analysis,
      recommendations: result.recommendations,
    });

    // Update current website_seo score and analysis
    if (seoSettings) {
      await supabase
        .from("website_seo")
        .update({
          seo_score: result.seo_score,
          seo_analysis: result.analysis,
          updated_at: new Date().toISOString(),
        })
        .eq("website_id", websiteId);
    }

    return NextResponse.json({
      seo_score: result.seo_score,
      analysis: result.analysis,
      recommendations: result.recommendations,
      image_stats: result.image_stats,
    });
  } catch (err: any) {
    console.error("POST SEO Analyze API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to analyze website SEO." },
      { status: 500 }
    );
  }
}
