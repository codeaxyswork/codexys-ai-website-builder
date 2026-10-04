import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/utils/supabase/server";
import { renderBlogPostHTML } from "@/lib/blog-renderer";
import { assemblePublishedWebsite } from "@/lib/site-renderer";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; postSlug: string }> }
) {
  try {
    const { slug, postSlug } = await params;
    const cleanSlug = slug.toLowerCase().trim().replace(/\/+$/, "");
    const cleanPostSlug = postSlug.toLowerCase().trim().replace(/\/+$/, "");
    const rootDomainSlug = cleanSlug.startsWith("www.") ? cleanSlug.slice(4) : cleanSlug;

    const supabase = createAdminClient();

    // 1. Fetch website by published_slug OR custom_domain
    const { data: website, error: webErr } = await supabase
      .from("websites")
      .select("id, user_id, title, published_slug, custom_domain, is_published, design_plan")
      .or(`published_slug.eq.${cleanSlug},custom_domain.eq.${cleanSlug},custom_domain.eq.${rootDomainSlug}`)
      .maybeSingle();

    if (webErr || !website) {
      return new Response(render404HTML("Website Not Found"), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Security & Preview Check: If website is unpublished draft, allow access ONLY to authenticated owner OR when preview parameter is present
    if (!website.is_published) {
      let isOwner = false;
      let isPreview = false;
      try {
        const urlObj = new URL(request.url);
        isPreview = urlObj.searchParams.get("preview") === "true" || urlObj.searchParams.get("preview") === "1";
      } catch {}

      try {
        const authSupabase = await createClient();
        const { data: authData } = await authSupabase.auth.getUser();
        if (authData?.user?.id && authData.user.id === website.user_id) {
          isOwner = true;
        }
      } catch {
        // Non-owner
      }

      if (!isOwner && !isPreview) {
        return new Response(render404HTML("Website Not Found"), {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
    }

    // 2. Fetch blog post from blog_posts table
    const { data: post } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("website_id", website.id)
      .eq("slug", cleanPostSlug)
      .eq("status", "published")
      .maybeSingle();

    if (post) {
      const htmlDoc = renderBlogPostHTML({
        post,
        websiteTitle: website.title,
        publishedSlug: website.published_slug,
      });

      return new Response(htmlDoc, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "SAMEORIGIN",
        },
      });
    }

    // 3. Fallback: Search migrated website_pages table for blog path candidates
    const candidatePaths = [
      `blog/${cleanPostSlug}.html`,
      `blog/${cleanPostSlug}`,
      `/blog/${cleanPostSlug}.html`,
      `/blog/${cleanPostSlug}`,
    ];

    const { data: page } = await supabase
      .from("website_pages")
      .select("html_content, css_content, js_content, path")
      .eq("website_id", website.id)
      .in("path", candidatePaths)
      .limit(1)
      .maybeSingle();

    if (page && page.html_content) {
      const { data: seo } = await supabase
        .from("website_seo")
        .select("*")
        .eq("website_id", website.id)
        .maybeSingle();

      const migrationDomain = website?.design_plan?.migration?.domain || website?.design_plan?.migration?.originalUrl || null;

      const renderedDoc = assemblePublishedWebsite({
        htmlContent: page.html_content,
        cssContent: page.css_content,
        jsContent: page.js_content,
        seoSettings: seo || null,
        websiteTitle: website.title,
        migrationDomain,
        slug: website.published_slug || cleanSlug,
      });

      return new Response(renderedDoc, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "SAMEORIGIN",
        },
      });
    }

    return new Response(render404HTML("Blog Article Not Found"), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err: any) {
    console.error("Public Blog Post Render Route Error:", err);
    return new Response(render404HTML("Internal Server Error"), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

function render404HTML(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Article Not Found</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: white; border: 1px solid #e2e8f0; padding: 2.5rem; border-radius: 1rem; text-align: center; max-width: 400px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    h1 { font-size: 3rem; margin: 0 0 0.5rem 0; color: #9333ea; font-weight: 800; }
    p { font-size: 0.95rem; color: #64748b; margin-bottom: 1.5rem; }
    a { display: inline-block; background: #9333ea; color: white; text-decoration: none; padding: 0.6rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>404</h1>
    <p>${message}</p>
    <a href="/">Return to AI Website Builder</a>
  </div>
</body>
</html>`;
}

