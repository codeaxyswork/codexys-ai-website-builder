import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { executeSEOAnalysis } from "@/lib/seo-job-processor";
import { renderBlogPostHTML } from "@/lib/blog-renderer";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  try {
    const { id: websiteId, postId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: post, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("id", postId)
      .eq("website_id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (error || !post) {
      return NextResponse.json({ error: "Blog post not found." }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (err: any) {
    console.error("GET Single Blog Post Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch blog post." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  try {
    const { id: websiteId, postId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch Existing Post & Website
    const { data: existingPost, error: postErr } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("id", postId)
      .eq("website_id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (postErr || !existingPost) {
      return NextResponse.json({ error: "Blog post not found." }, { status: 404 });
    }

    const { data: website } = await supabase
      .from("websites")
      .select("id, title, published_slug")
      .eq("id", websiteId)
      .single();

    // 2. Parse Request Body
    const body = await request.json();
    const title = (body.title || existingPost.title).trim();
    let rawSlug = (body.slug || existingPost.slug).trim();
    rawSlug = rawSlug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    const cleanSlug = rawSlug || existingPost.slug;

    const newStatus = body.status === "published" ? "published" : "draft";

    const updatePayload = {
      title,
      slug: cleanSlug,
      excerpt: (body.excerpt ?? existingPost.excerpt ?? "").trim(),
      content: (body.content ?? existingPost.content ?? "").trim(),
      status: newStatus,
      featured_image: body.featured_image ?? existingPost.featured_image,
      author: (body.author || existingPost.author || "Admin").trim(),
      category: (body.category || existingPost.category || "General").trim(),
      tags: Array.isArray(body.tags) ? body.tags : existingPost.tags || [],
      seo_title: (body.seo_title ?? existingPost.seo_title ?? title).trim(),
      meta_description: (body.meta_description ?? existingPost.meta_description ?? "").trim(),
      focus_keyword: (body.focus_keyword ?? existingPost.focus_keyword ?? "").trim(),
      canonical_url: body.canonical_url ?? existingPost.canonical_url,
      og_title: (body.og_title ?? existingPost.og_title ?? title).trim(),
      og_description: (body.og_description ?? existingPost.og_description ?? "").trim(),
      og_image: body.og_image ?? existingPost.og_image ?? body.featured_image ?? null,
      robots_config: body.robots_config || existingPost.robots_config || "index, follow",
      published_at: newStatus === "published" ? (existingPost.published_at || new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    };

    // 3. Update Database Record
    const { data: updatedPost, error: updateErr } = await supabase
      .from("blog_posts")
      .update(updatePayload)
      .eq("id", postId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateErr) {
      console.error("Update Blog Post Error:", updateErr);
      return NextResponse.json({ error: updateErr.message || "Failed to update blog post." }, { status: 500 });
    }

    const oldPagePath = `blog/${existingPost.slug}`;
    const newPagePath = `blog/${cleanSlug}`;

    // If slug changed, delete old page path from website_pages
    if (existingPost.slug !== cleanSlug) {
      await supabase
        .from("website_pages")
        .delete()
        .eq("website_id", websiteId)
        .eq("path", oldPagePath);
    }

    // 4. Handle Page Sync & SEO Re-Analysis
    if (newStatus === "published") {
      const blogHTML = renderBlogPostHTML({
        post: updatedPost,
        websiteTitle: website?.title || "Website",
        publishedSlug: website?.published_slug,
      });

      await supabase.from("website_pages").upsert({
        website_id: websiteId,
        user_id: user.id,
        path: newPagePath,
        html_content: blogHTML,
        css_content: "/* Blog Post Styles */",
        js_content: "// Blog Post Scripts",
        updated_at: new Date().toISOString(),
      }, { onConflict: "website_id, path" });

      try {
        await executeSEOAnalysis(supabase, websiteId, user.id, "blog_published");
      } catch (seoErr) {
        console.warn("SEO re-analysis warning:", seoErr);
      }
    } else {
      // Draft state: remove page from website_pages if present
      await supabase
        .from("website_pages")
        .delete()
        .eq("website_id", websiteId)
        .eq("path", newPagePath);

      try {
        await executeSEOAnalysis(supabase, websiteId, user.id, "blog_unpublished");
      } catch (seoErr) {
        console.warn("SEO re-analysis warning:", seoErr);
      }
    }

    return NextResponse.json({ success: true, post: updatedPost });
  } catch (err: any) {
    console.error("PUT Update Blog Post Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to update blog post." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  try {
    const { id: websiteId, postId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch Post to get slug & confirm ownership
    const { data: post, error: fetchErr } = await supabase
      .from("blog_posts")
      .select("id, slug")
      .eq("id", postId)
      .eq("website_id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !post) {
      return NextResponse.json({ error: "Blog post not found or access denied." }, { status: 404 });
    }

    // 2. Remove page from website_pages if present
    const pagePath = `blog/${post.slug}`;
    await supabase
      .from("website_pages")
      .delete()
      .eq("website_id", websiteId)
      .eq("path", pagePath);

    // 3. Delete Post from blog_posts
    const { error: deleteErr } = await supabase
      .from("blog_posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", user.id);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // Re-run SEO analysis
    try {
      await executeSEOAnalysis(supabase, websiteId, user.id, "blog_deleted");
    } catch (seoErr) {
      console.warn("SEO re-analysis warning:", seoErr);
    }

    return NextResponse.json({ success: true, message: "Blog post deleted successfully." });
  } catch (err: any) {
    console.error("DELETE Blog Post Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to delete blog post." }, { status: 500 });
  }
}
