import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { executeSEOAnalysis } from "@/lib/seo-job-processor";
import { renderBlogPostHTML } from "@/lib/blog-renderer";

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

    // 1. Verify Website Ownership
    const { data: website, error: webErr } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    // 2. Fetch Blog Posts
    const { data: posts, error: postsErr } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("website_id", websiteId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (postsErr) {
      // If table doesn't exist yet in Supabase cache, return empty array safely
      return NextResponse.json({ posts: [] });
    }

    return NextResponse.json({ posts: posts || [] });
  } catch (err: any) {
    console.error("GET Blog Posts Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch blog posts." }, { status: 500 });
  }
}

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

    // 1. Verify Website Ownership
    const { data: website, error: webErr } = await supabase
      .from("websites")
      .select("id, title, published_slug, is_published")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    // 2. Parse Request Body
    const body = await request.json();
    const title = (body.title || "").trim();
    let rawSlug = (body.slug || "").trim();

    if (!title) {
      return NextResponse.json({ error: "Blog post title is required." }, { status: 400 });
    }

    if (!rawSlug) {
      rawSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    } else {
      rawSlug = rawSlug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    }

    const cleanSlug = rawSlug || `post-${Date.now()}`;
    const status = body.status === "published" ? "published" : "draft";

    const postPayload = {
      website_id: websiteId,
      user_id: user.id,
      title,
      slug: cleanSlug,
      excerpt: (body.excerpt || "").trim(),
      content: (body.content || "").trim(),
      status,
      featured_image: body.featured_image || null,
      author: (body.author || "Admin").trim(),
      category: (body.category || "General").trim(),
      tags: Array.isArray(body.tags) ? body.tags : [],
      seo_title: (body.seo_title || title).trim(),
      meta_description: (body.meta_description || body.excerpt || "").trim(),
      focus_keyword: (body.focus_keyword || "").trim(),
      canonical_url: body.canonical_url || null,
      og_title: (body.og_title || body.seo_title || title).trim(),
      og_description: (body.og_description || body.meta_description || "").trim(),
      og_image: body.og_image || body.featured_image || null,
      robots_config: body.robots_config || "index, follow",
      published_at: status === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    // 3. Insert Blog Post
    const { data: newPost, error: insertErr } = await supabase
      .from("blog_posts")
      .insert(postPayload)
      .select()
      .single();

    if (insertErr) {
      console.error("Insert Blog Post Error:", insertErr);
      return NextResponse.json({ error: insertErr.message || "Failed to create blog post." }, { status: 500 });
    }

    // 4. Sync with website_pages and re-analyze SEO if published
    if (status === "published") {
      const blogHTML = renderBlogPostHTML({
        post: newPost,
        websiteTitle: website.title,
        publishedSlug: website.published_slug,
      });

      const pagePath = `blog/${cleanSlug}`;

      await supabase.from("website_pages").upsert({
        website_id: websiteId,
        user_id: user.id,
        path: pagePath,
        html_content: blogHTML,
        css_content: "/* Blog Post Styles */",
        js_content: "// Blog Post Scripts",
        updated_at: new Date().toISOString(),
      }, { onConflict: "website_id, path" });

      // Trigger SEO re-analysis for published site
      try {
        await executeSEOAnalysis(supabase, websiteId, user.id, "blog_published");
      } catch (seoErr) {
        console.warn("SEO re-analysis trigger warning:", seoErr);
      }
    }

    return NextResponse.json({ success: true, post: newPost });
  } catch (err: any) {
    console.error("POST Create Blog Post Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to create blog post." }, { status: 500 });
  }
}
