import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/utils/supabase/server";
import { assemblePublishedWebsite } from "@/lib/site-renderer";
import { getCachedSiteData, setCachedSiteData } from "@/lib/site-cache";
import { getWebsitePublicUrl } from "@/lib/domain-resolver";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; subpath: string[] }> }
): Promise<Response> {
  const t0 = performance.now();
  try {
    const { slug, subpath } = await params;
    const pathSegments = subpath || [];
    const pathStr = pathSegments.join("/");
    const cleanSlug = slug.toLowerCase().trim().replace(/\/+$/, "");

    // 0. Instant Memory Cache Check (0ms response time on repeat views)
    const cacheKey = `subpage_${cleanSlug}_${pathStr.toLowerCase().trim().replace(/^\/+|\/+$/g, "")}`;
    const cachedHtml = getCachedSiteData<string>(cacheKey);
    if (cachedHtml) {
      const dur = (performance.now() - t0).toFixed(1);
      console.log(`[PUBLIC_SUBPAGE_CACHE_HIT] slug=${slug} subpath=${pathStr} total=${dur}ms`);
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
    // Fast-fail non-migrated static assets (CSS, JS, images, fonts) in 0.1ms to prevent server queue saturation
    const isStaticAsset = /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|map)$/i.test(pathStr) || pathStr.includes("wp-content/") || pathStr.includes("wp-includes/");
    if (isStaticAsset) {
      return new Response("", {
        status: 404,
        headers: {
          "Content-Type": pathStr.endsWith(".css") ? "text/css" : pathStr.endsWith(".js") ? "application/javascript" : "text/plain",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    const supabase = createAdminClient();

    // 2. Fetch website lookup by published_slug OR slug OR custom_domain
    const rootDomainSlug = cleanSlug.startsWith("www.") ? cleanSlug.slice(4) : cleanSlug;

    const tWebStart = performance.now();
    const { data: website, error: websiteErr } = await supabase
      .from("websites")
      .select("id, user_id, title, published_slug, slug, custom_domain, custom_domain_verified, custom_domain_status, www_domain_configured, is_published, design_plan")
      .or(`published_slug.eq.${cleanSlug},slug.eq.${cleanSlug},custom_domain.eq.${cleanSlug},custom_domain.eq.${rootDomainSlug}`)
      .maybeSingle();
    const tWebEnd = performance.now();

    if (websiteErr || !website) {
      return new Response(render404HTML("Website Not Found"), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Security Check: If website is unpublished draft, allow access ONLY to authenticated owner OR when preview parameter is present
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

    const hostHeader = (request.headers.get("host") || "").split(":")[0].toLowerCase().trim();

    // WWW Redirection Safeguard: When www is enabled, redirect www.example.com/subpath -> example.com/subpath (308 Permanent)
    if (website.custom_domain && website.www_domain_configured !== false) {
      const cleanCustom = website.custom_domain.toLowerCase().trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
      const cleanWww = `www.${cleanCustom}`;
      if (hostHeader === cleanWww) {
        let redirectTarget = `https://${cleanCustom}/${pathStr}`;
        try {
          const urlObj = new URL(request.url);
          if (urlObj.search) {
            redirectTarget += urlObj.search;
          }
        } catch {}
        return NextResponse.redirect(redirectTarget, 308);
      }
    }

    // Direct platform route safeguard: Redirect /site/{slug}/{subpath} to canonical subdomain / custom domain
    // only when visited directly on the main app host (e.g. codeaxys.com), preventing redirect loops during middleware rewrite.
    const appDomain = (
      process.env.APP_DOMAIN ||
      process.env.NEXT_PUBLIC_APP_DOMAIN ||
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.NEXT_PUBLIC_VERCEL_URL ||
      "codeaxys.com"
    ).toLowerCase().trim();

    const isMainPlatformHost = hostHeader === appDomain || hostHeader === "codeaxys.com" || hostHeader === "www.codeaxys.com";

    if (isMainPlatformHost && website.is_published) {
      const canonicalUrl = getWebsitePublicUrl(website, { subpath: pathStr });
      if (canonicalUrl && !canonicalUrl.includes("/site/")) {
        return NextResponse.redirect(canonicalUrl, 301);
      }
    }

    // 2.5 Special file handling (llms.txt & google site verification)
    const lowerFile = (pathSegments[0] || "").toLowerCase().trim();
    if (pathSegments.length === 1 && (lowerFile === "llms.txt" || lowerFile === "llms")) {
      const { generateAIWebsiteManifest } = await import("@/lib/seo-manifest");
      const baseUrl = getWebsitePublicUrl(website);
      const manifestText = await generateAIWebsiteManifest(supabase, website.id, { baseUrl });
      if (manifestText) {
        return new Response(manifestText, {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=86400" },
        });
      }
    } else if (pathSegments.length === 1 && lowerFile.startsWith("google") && lowerFile.endsWith(".html")) {
      const { data: seo } = await supabase.from("website_seo").select("google_site_verification_token").eq("website_id", website.id).single();
      const tokenFromFilename = lowerFile.slice(6, -5).trim();
      const configuredToken = (seo?.google_site_verification_token || "").trim();
      if (configuredToken && (configuredToken === tokenFromFilename || configuredToken.includes(tokenFromFilename) || tokenFromFilename.includes(configuredToken))) {
        return new Response(`google-site-verification: ${pathSegments[0]}`, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=86400" },
        });
      }
    }

    // 3. Build candidate path matches
    const cleanSubpath = pathStr.toLowerCase().trim().replace(/^\/+|\/+$/g, "");
    const bareSubpath = cleanSubpath.endsWith(".html") ? cleanSubpath.slice(0, -5) : cleanSubpath;

    const candidatePaths = Array.from(
      new Set([
        pathStr,
        cleanSubpath,
        `${cleanSubpath}/`,
        `${cleanSubpath}.html`,
        `${cleanSubpath}/index.html`,
        `/${cleanSubpath}`,
        `/${cleanSubpath}/`,
        `/${cleanSubpath}.html`,
        `/${cleanSubpath}/index.html`,
        bareSubpath,
        `${bareSubpath}/`,
        `${bareSubpath}.html`,
        `/${bareSubpath}`,
      ])
    );

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
        .in("path", candidatePaths)
        .limit(1)
        .maybeSingle(),
    ]);
    const tDataEnd = performance.now();

    let targetPage = pageRes.data;

    // Fallback: search all page paths for website to match normalized slug if not found by direct path candidates
    if (!targetPage || !targetPage.html_content) {
      const { data: allPageMeta } = await supabase
        .from("website_pages")
        .select("id, path, html_content, css_content, js_content")
        .eq("website_id", website.id);

      if (allPageMeta && allPageMeta.length > 0) {
        const { normalizePageSlug } = await import("@/lib/migration/link-localizer");
        const matched = allPageMeta.find((p) => {
          const norm = normalizePageSlug(p.path);
          return norm === bareSubpath || norm === cleanSubpath;
        });
        if (matched) {
          targetPage = matched;
        }
      }
    }

    if (!targetPage || !targetPage.html_content) {
      return new Response(render404HTML(`Page '${pathStr}' Not Found`), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // 4. Assemble production HTML with runtime link localizer safeguard
    const tAssembleStart = performance.now();
    const publicPrefix = `/site/${website.published_slug || cleanSlug}`;

    let sanitizedHtml = targetPage.html_content || "";
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
          sanitizedHtml = sanitizedHtml.replace(new RegExp(`href=["']https?:\\/\\/(?:www\.)?${escDom}\\/?([^"']*)["']`, "gi"), (m: string, pGroup: string) => {
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
      cssContent: targetPage.css_content,
      jsContent: targetPage.js_content,
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

    // Store rendered subpage document in memory cache for instant future loads
    setCachedSiteData(cacheKey, renderedDoc, 300000);

    console.log(`[PUBLIC_SUBPAGE_METRICS] slug=${slug} subpath=${pathStr} total=${totalDur}ms webLookup=${webDur}ms pageFetch=${dataDur}ms assemble=${assembleDur}ms`);

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
    console.error("Public Subpage Render Route Error:", err);
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
