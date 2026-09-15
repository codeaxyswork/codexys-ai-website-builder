import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { analyzeLocalSEO, LocalBusinessProfile } from "@/lib/local-seo-engine";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await props.params;
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify website ownership
    const { data: website, error: siteError } = await supabase
      .from("websites")
      .select("id, user_id, title")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteError || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    // 3. Fetch Local SEO record
    const { data: localRow } = await supabase
      .from("website_local_seo")
      .select("*")
      .eq("website_id", websiteId)
      .maybeSingle();

    if (!localRow) {
      // Default empty profile
      return NextResponse.json({
        profile: {
          business_name: website.title || "",
          business_type: "LocalBusiness",
        },
        local_seo_score: 0,
        analysis_result: null,
      });
    }

    const { id, website_id, local_seo_score, analysis_result, last_analyzed_at, created_at, updated_at, ...profileFields } = localRow;

    return NextResponse.json({
      profile: profileFields,
      local_seo_score,
      analysis_result,
      last_analyzed_at,
    });
  } catch (err: any) {
    console.error("GET local SEO error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await props.params;
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify website ownership
    const { data: website, error: siteError } = await supabase
      .from("websites")
      .select("id, user_id, title, html_content")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteError || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    const profileData: LocalBusinessProfile = await req.json();

    // 3. Fetch website pages for deterministic NAP/keyword audit
    const { data: pageRows } = await supabase
      .from("website_pages")
      .select("path, html_content, seo_title, focus_keywords")
      .eq("website_id", websiteId);

    const pagesList = (pageRows || []).map((p: any) => ({
      path: p.path,
      htmlContent: p.html_content || "",
      title: p.seo_title || p.path,
      focus_keywords: p.focus_keywords || [],
    }));

    if (pagesList.length === 0) {
      pagesList.push({
        path: "index.html",
        htmlContent: website.html_content || "",
        title: website.title,
        focus_keywords: [],
      });
    }

    // 4. Run deterministic analysis (0 AI credits)
    const analysis = analyzeLocalSEO(profileData, pagesList);

    // 5. Upsert payload into website_local_seo table
    const upsertPayload = {
      website_id: websiteId,
      ...profileData,
      local_seo_score: analysis.local_seo_score,
      analysis_result: analysis,
      last_analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: updatedRow, error: upsertErr } = await supabase
      .from("website_local_seo")
      .upsert(upsertPayload, { onConflict: "website_id" })
      .select()
      .single();

    if (upsertErr) {
      console.error("Upsert local SEO error:", upsertErr);
      return NextResponse.json({ error: upsertErr.message || "Failed to save Local SEO settings." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile: profileData,
      local_seo_score: analysis.local_seo_score,
      analysis_result: analysis,
    });
  } catch (err: any) {
    console.error("PUT local SEO error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}
