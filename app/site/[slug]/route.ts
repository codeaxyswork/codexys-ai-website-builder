import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { assemblePublishedWebsite } from "@/lib/site-renderer";
import { getCachedSiteData, setCachedSiteData } from "@/lib/site-cache";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const t0 = performance.now();
  try {
    const { slug } = await params;
    const cleanSlug = slug.toLowerCase().trim().replace(/\/+$/, "");

    // 0. Instant Memory Cache Check (0ms response time on repeat views)
    const cacheKey = `homepage_${cleanSlug}`;
    const cachedHtml = getCachedSiteData<string>(cacheKey);
    if (cachedHtml) {
      const dur = (performance.now() - t0).toFixed(1);
      console.log(`[PUBLIC_SITE_CACHE_HIT] slug=${slug} total=${dur}ms`);
      return new Response(cachedHtml, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "SAMEORIGIN",
          "Server-Timing": `total;dur=${dur}, cache;dur=0`,
        },
      });
    }

    const supabase = createAdminClient();

    // 1. Fetch website lookup by published_slug OR slug OR custom_domain
    const rootDomainSlug = cleanSlug.startsWith("www.") ? cleanSlug.slice(4) : cleanSlug;

    const tWebStart = performance.now();
    const { data: website, error: websiteErr } = await supabase
      .from("websites")
      .select("id, title, published_slug, slug, custom_domain, is_published, design_plan")
      .or(`published_slug.eq.${cleanSlug},slug.eq.${cleanSlug},custom_domain.eq.${cleanSlug},custom_domain.eq.${rootDomainSlug}`)
      .single();
    const tWebEnd = performance.now();

    if (websiteErr || !website || !website.is_published) {
      return new Response(render404HTML("Website Not Found"), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // 2. Fetch SEO settings & active homepage page in parallel (LOAD ONLY 1 PAGE, NOT ALL 20)
    const tDataStart = performance.now();
    const [seoRes, pageRes] = await Promise.all([
      supabase
        .from("website_seo")
        .select("*")
        .eq("website_id", website.id)
        .maybeSingle(),
      supabase
        .from("website_pages")
        .select("html_content, css_content, js_content, path")
        .eq("website_id", website.id)
        .in("path", ["index.html", "/", "index.htm"])
        .limit(1)
        .maybeSingle(),
    ]);
    const tDataEnd = performance.now();

    let mainPage = pageRes.data;

    // Fallback if index.html isn't named strictly "index.html"
    if (!mainPage || !mainPage.html_content) {
      const { data: fallbackPage } = await supabase
        .from("website_pages")
        .select("html_content, css_content, js_content, path")
        .eq("website_id", website.id)
        .limit(1)
        .maybeSingle();
      mainPage = fallbackPage;
    }

    if (!mainPage || !mainPage.html_content) {
      return new Response(render404HTML("Website Page Content Empty"), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // 3. Assemble production HTML with runtime link localizer safeguard
    const tAssembleStart = performance.now();
    const publicPrefix = `/site/${website.published_slug || cleanSlug}`;

    let sanitizedHtml = mainPage.html_content || "";
    // Runtime safeguard: Ensure zero live WordPress domain links or root-relative links escape into client browser
    sanitizedHtml = sanitizedHtml.replace(/href=["']https?:\/\/(?:www\.)?mnc?conline\.com\/?["']/gi, `href="${publicPrefix}/"`);
    sanitizedHtml = sanitizedHtml.replace(/href=["']https?:\/\/(?:www\.)?mnc?conline\.com\/([^"']+)["']/gi, (match: string, pathGroup: string) => {
      const cleanPathGroup = pathGroup.startsWith("/") ? pathGroup.slice(1) : pathGroup;
      return `href="${publicPrefix}/${cleanPathGroup}"`;
    });
    // If website specifies another source domain, replace it as well
    const extraDomain = website?.design_plan?.migration?.domain || website?.design_plan?.migration?.originalUrl;
    if (extraDomain) {
      try {
        const cleanDomain = extraDomain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").trim().toLowerCase();
        if (cleanDomain && cleanDomain !== "mncconline.com" && cleanDomain !== "mnconline.com") {
          const escDom = cleanDomain.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
          sanitizedHtml = sanitizedHtml.replace(new RegExp(`href=["']https?:\\/\\/(?:www\\.)?${escDom}\\/?([^"']*)["']`, "gi"), (m: string, pGroup: string) => {
            const cPath = (pGroup || "").startsWith("/") ? pGroup.slice(1) : (pGroup || "");
            return `href="${publicPrefix}/${cPath}"`;
          });
        }
      } catch {}
    }
    sanitizedHtml = sanitizedHtml.replace(/href=["']\/((?!site\/|api\/|_next\/|wp-content\/|wp-includes\/|#|javascript:)[^"']*)["']/gi, (match: string, pathGroup: string) => {
      if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/i.test(pathGroup)) return match;
      const cleanPathGroup = pathGroup.startsWith("/") ? pathGroup.slice(1) : pathGroup;
      return `href="${publicPrefix}/${cleanPathGroup}"`;
    });
    sanitizedHtml = sanitizedHtml.replace(new RegExp(`${publicPrefix.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}/+`, "g"), `${publicPrefix}/`);

    const migrationDomain = website?.design_plan?.migration?.domain || website?.design_plan?.migration?.originalUrl || null;

    const renderedDoc = assemblePublishedWebsite({
      htmlContent: sanitizedHtml,
      cssContent: mainPage.css_content,
      jsContent: mainPage.js_content,
      seoSettings: seoRes.data || null,
      websiteTitle: website.title,
      migrationDomain,
      slug: website.published_slug || cleanSlug,
    });
    const tAssembleEnd = performance.now();

    const totalDur = (performance.now() - t0).toFixed(1);
    const webDur = (tWebEnd - tWebStart).toFixed(1);
    const dataDur = (tDataEnd - tDataStart).toFixed(1);
    const assembleDur = (tAssembleEnd - tAssembleStart).toFixed(1);

    // Store rendered document in memory cache for instant future loads
    setCachedSiteData(cacheKey, renderedDoc, 300000);
    setCachedSiteData(`website_${website.id}`, website, 300000);

    console.log(`[PUBLIC_SITE_METRICS] slug=${slug} total=${totalDur}ms webLookup=${webDur}ms pageFetch=${dataDur}ms assemble=${assembleDur}ms`);

    return new Response(renderedDoc, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Server-Timing": `total;dur=${totalDur}, web;dur=${webDur}, db;dur=${dataDur}, assemble;dur=${assembleDur}`,
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
