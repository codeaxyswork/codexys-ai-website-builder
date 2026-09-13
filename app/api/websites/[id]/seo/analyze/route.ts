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

    // Execute multi-page Cheerio SEO analysis (0 credits, deterministic)
    const result = await executeSEOAnalysis(supabase, websiteId, user.id, "manual");

    // Return backward-compatible structure + multi-page details
    const indexPage = result.pages.find((p) => p.path === "index.html") || result.pages[0];

    return NextResponse.json({
      seo_score: result.seo_score,
      analysis: result.aggregate_analysis,
      recommendations: result.recommendations,
      image_stats: indexPage?.image_stats || { total: 0, with_alt: 0, missing_alt: 0 },
      issue_counts: result.issue_counts,
      site_links_summary: result.site_links_summary,
      pages: result.pages,
      analysis_version: result.analysis_version,
    });
  } catch (err: any) {
    console.error("POST SEO Analyze API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to analyze website SEO." },
      { status: 500 }
    );
  }
}

