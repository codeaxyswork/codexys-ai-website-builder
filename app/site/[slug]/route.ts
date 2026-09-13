import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { assemblePublishedWebsite } from "@/lib/site-renderer";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();

    // 1. Fetch published website by published_slug OR custom_domain
    const cleanSlug = slug.toLowerCase().trim().replace(/\/+$/, "");
    const rootDomainSlug = cleanSlug.startsWith("www.") ? cleanSlug.slice(4) : cleanSlug;

    const { data: website, error: websiteErr } = await supabase
      .from("websites")
      .select("id, title, published_slug, custom_domain, is_published, design_plan")
      .or(`published_slug.eq.${cleanSlug},custom_domain.eq.${cleanSlug},custom_domain.eq.${rootDomainSlug}`)
      .eq("is_published", true)
      .single();

    if (websiteErr || !website || !website.is_published) {
      return new Response(render404HTML("Website Not Found or Unpublished"), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // 2. Fetch SEO settings
    const { data: seoSettings } = await supabase
      .from("website_seo")
      .select("*")
      .eq("website_id", website.id)
      .single();

    // 3. Fetch page files
    const { data: pages } = await supabase
      .from("website_pages")
      .select("html_content, css_content, js_content")
      .eq("website_id", website.id);

    const mainPage = pages && pages.length > 0 ? pages[0] : null;

    if (!mainPage || !mainPage.html_content) {
      return new Response(render404HTML("Website Page Content Empty"), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // 4. Assemble production HTML
    const renderedDoc = assemblePublishedWebsite({
      htmlContent: mainPage.html_content,
      cssContent: mainPage.css_content,
      jsContent: mainPage.js_content,
      seoSettings: seoSettings || null,
      websiteTitle: website.title,
    });

    return new Response(renderedDoc, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (err: any) {
    console.error("Public Site Render Route Error:", err);
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
  <title>404 - Page Not Found</title>
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
