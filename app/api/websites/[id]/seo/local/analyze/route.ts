import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { analyzeLocalSEO } from "@/lib/local-seo-engine";

export async function POST(
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

    // 3. Fetch Local SEO profile
    const { data: localRow } = await supabase
      .from("website_local_seo")
      .select("*")
      .eq("website_id", websiteId)
      .maybeSingle();

    const profileData = localRow || { business_name: website.title, business_type: "LocalBusiness" };

    // 4. Fetch website pages
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

    // 5. Run deterministic analysis (0 AI credits)
    const analysis = analyzeLocalSEO(profileData, pagesList);

    // 6. Update database record
    await supabase
      .from("website_local_seo")
      .upsert(
        {
          website_id: websiteId,
          local_seo_score: analysis.local_seo_score,
          analysis_result: analysis,
          last_analyzed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "website_id" }
      );

    return NextResponse.json(analysis);
  } catch (err: any) {
    console.error("POST analyze local SEO error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}
