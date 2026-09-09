import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { analyzeWebsiteSEO } from "@/lib/seo-analyzer";

export async function GET(
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
      .select("id, title, prompt")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (websiteErr || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 404 }
      );
    }

    // Fetch SEO settings
    let { data: seoData, error: seoErr } = await supabase
      .from("website_seo")
      .select("*")
      .eq("website_id", websiteId)
      .single();

    if (!seoData) {
      // Auto-create default SEO record
      const defaultSeo = {
        website_id: websiteId,
        user_id: user.id,
        seo_title: website.title,
        meta_description: `Official website for ${website.title}.`,
        focus_keywords: [],
        robots_index: true,
        robots_follow: true,
        schema_markup: {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: website.title,
        },
      };

      const { data: createdSeo } = await supabase
        .from("website_seo")
        .insert(defaultSeo)
        .select()
        .single();

      seoData = createdSeo || defaultSeo;
    }

    // Fetch integration statuses
    const { data: integrations } = await supabase
      .from("seo_integrations")
      .select("provider, status, connected_at, last_synced_at")
      .eq("website_id", websiteId);

    return NextResponse.json({
      seo: seoData,
      integrations: integrations || [],
    });
  } catch (err: any) {
    console.error("GET SEO API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch SEO settings." },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    const body = await request.json();

    // Fetch index page for live html scoring
    const { data: indexPage } = await supabase
      .from("website_pages")
      .select("html_content")
      .eq("website_id", websiteId)
      .eq("path", "index.html")
      .single();

    const htmlContent = indexPage?.html_content || "";

    // Run deterministic analysis
    const analysisResult = analyzeWebsiteSEO(htmlContent, body);

    const seoPayload = {
      website_id: websiteId,
      user_id: user.id,
      seo_title: body.seo_title || null,
      meta_description: body.meta_description || null,
      focus_keywords: Array.isArray(body.focus_keywords) ? body.focus_keywords : [],
      canonical_url: body.canonical_url || null,
      robots_index: body.robots_index !== false,
      robots_follow: body.robots_follow !== false,
      og_title: body.og_title || null,
      og_description: body.og_description || null,
      og_image_url: body.og_image_url || null,
      twitter_card: body.twitter_card || "summary_large_image",
      twitter_title: body.twitter_title || null,
      twitter_description: body.twitter_description || null,
      twitter_image_url: body.twitter_image_url || null,
      schema_markup: body.schema_markup || {},
      google_analytics_id: body.google_analytics_id || null,
      google_tag_manager_id: body.google_tag_manager_id || null,
      seo_score: analysisResult.seo_score,
      seo_analysis: analysisResult.analysis,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedSeo, error: upsertErr } = await supabase
      .from("website_seo")
      .upsert(seoPayload, { onConflict: "website_id" })
      .select()
      .single();

    if (upsertErr) {
      console.error("Upsert SEO Error:", upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      seo: updatedSeo,
      analysis: analysisResult,
      message: "SEO settings saved successfully.",
    });
  } catch (err: any) {
    console.error("PUT SEO API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to update SEO settings." },
      { status: 500 }
    );
  }
}
