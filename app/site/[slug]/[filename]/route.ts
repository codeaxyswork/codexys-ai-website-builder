import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; filename: string }> }
) {
  try {
    const { slug, filename } = await params;
    const lowerFile = filename.toLowerCase().trim();

    const isLlmsTxt = lowerFile === "llms.txt" || lowerFile === "llms";
    const isGoogleVerification = lowerFile.startsWith("google") && lowerFile.endsWith(".html");

    if (!isLlmsTxt && !isGoogleVerification) {
      return new Response("Not Found", { status: 404 });
    }

    const cleanSlug = slug.toLowerCase().trim().replace(/\/+$/, "");
    const rootDomainSlug = cleanSlug.startsWith("www.") ? cleanSlug.slice(4) : cleanSlug;
    const supabase = await createClient();

    const { data: website } = await supabase
      .from("websites")
      .select("id, published_slug, custom_domain, is_published")
      .or(`published_slug.eq.${cleanSlug},slug.eq.${cleanSlug},custom_domain.eq.${cleanSlug},custom_domain.eq.${rootDomainSlug}`)
      .eq("is_published", true)
      .single();

    if (!website || !website.is_published) {
      return new Response("Not Found", { status: 404 });
    }

    if (isLlmsTxt) {
      const { generateAIWebsiteManifest } = await import("@/lib/seo-manifest");
      const host = request.headers.get("host") || "localhost:3000";
      const protocol = request.headers.get("x-forwarded-proto") || "https";
      const baseUrl = website.custom_domain ? `${protocol}://${website.custom_domain}` : `${protocol}://${host}/site/${website.published_slug}`;

      const manifestText = await generateAIWebsiteManifest(supabase, website.id, { baseUrl });
      if (!manifestText) {
        return new Response("Not Found", { status: 404 });
      }

      return new Response(manifestText, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
      });
    }

    const { data: seo } = await supabase
      .from("website_seo")
      .select("google_site_verification_token")
      .eq("website_id", website.id)
      .single();

    const tokenFromFilename = filename.slice(6, -5).trim(); // strip "google" and ".html"
    const configuredToken = (seo?.google_site_verification_token || "").trim();

    if (
      !configuredToken ||
      (configuredToken !== tokenFromFilename && !configuredToken.includes(tokenFromFilename) && !tokenFromFilename.includes(configuredToken))
    ) {
      return new Response("Not Found", { status: 404 });
    }

    return new Response(`google-site-verification: ${filename}`, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (err) {
    return new Response("Not Found", { status: 404 });
  }
}
