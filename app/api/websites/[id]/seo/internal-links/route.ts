import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { analyzeInternalLinks } from "@/lib/internal-linking-engine";

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
      .select("id, user_id, title, pages, html_content")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteError || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    // 3. Fetch cached internal links analysis
    const { data: linkRow } = await supabase
      .from("website_internal_links")
      .select("*")
      .eq("website_id", websiteId)
      .single();

    if (linkRow) {
      return NextResponse.json({
        internal_link_score: linkRow.internal_link_score,
        summary: linkRow.summary,
        link_graph: linkRow.link_graph,
        opportunities: linkRow.opportunities,
        last_analyzed_at: linkRow.last_analyzed_at,
      });
    }

    // If no row exists yet, run initial analysis
    return await computeAndStoreInternalLinks(supabase, website, user.id);
  } catch (err: any) {
    console.error("GET internal-links error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}

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
      .select("id, user_id, title, pages, html_content")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteError || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    return await computeAndStoreInternalLinks(supabase, website, user.id);
  } catch (err: any) {
    console.error("POST internal-links error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}

async function computeAndStoreInternalLinks(supabase: any, website: any, userId: string) {
  const websiteId = website.id;

  // 1. Fetch website pages from website_pages table
  const { data: pageRows } = await supabase
    .from("website_pages")
    .select("path, html_content, seo_title, focus_keywords")
    .eq("website_id", websiteId);

  let pagesList: Array<{ path: string; htmlContent: string; title?: string | null; focus_keywords?: string[] | null }> = [];

  if (pageRows && pageRows.length > 0) {
    pagesList = pageRows.map((p: any) => ({
      path: p.path,
      htmlContent: p.html_content || "",
      title: p.seo_title || p.path,
      focus_keywords: p.focus_keywords || [],
    }));
  } else if (website.pages && Array.isArray(website.pages) && website.pages.length > 0) {
    pagesList = website.pages.map((p: any) => ({
      path: p.path || p.name || "index.html",
      htmlContent: p.htmlContent || p.html || website.html_content || "",
      title: p.title || p.name || p.path,
    }));
  } else {
    pagesList = [
      {
        path: "index.html",
        htmlContent: website.html_content || "<html><head><title>Home</title></head><body><h1>Welcome</h1></body></html>",
        title: website.title || "Home",
      },
    ];
  }

  // 2. Fetch published blog posts ONLY
  const { data: blogRows } = await supabase
    .from("blog_posts")
    .select("title, slug, content, excerpt, category, tags, focus_keyword, status")
    .eq("website_id", websiteId)
    .eq("status", "published");

  const publishedBlogs = (blogRows || []).map((b: any) => ({
    title: b.title,
    slug: b.slug,
    content: b.content,
    excerpt: b.excerpt,
    category: b.category,
    tags: b.tags,
    focus_keyword: b.focus_keyword,
    status: b.status,
  }));

  // 3. Run pure deterministic analysis (0 AI credits)
  const analysisResult = analyzeInternalLinks(pagesList, publishedBlogs);

  // 4. Upsert analysis into website_internal_links table
  const upsertPayload = {
    website_id: websiteId,
    internal_link_score: analysisResult.internal_link_score,
    summary: analysisResult.summary,
    link_graph: analysisResult.link_graph,
    opportunities: analysisResult.opportunities,
    last_analyzed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await supabase
    .from("website_internal_links")
    .upsert(upsertPayload, { onConflict: "website_id" });

  if (upsertErr) {
    console.error("Failed to store internal link analysis:", upsertErr);
  }

  return NextResponse.json(analysisResult);
}
