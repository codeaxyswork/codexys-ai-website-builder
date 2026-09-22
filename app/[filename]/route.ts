import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const lowerFile = filename.toLowerCase().trim();

    const isLlmsTxt = lowerFile === "llms.txt" || lowerFile === "llms";
    const isGoogleVerification = lowerFile.startsWith("google") && lowerFile.endsWith(".html");

    if (!isLlmsTxt && !isGoogleVerification) {
      return new Response("Not Found", { status: 404 });
    }

    const host = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const supabase = await createClient();

    if (isLlmsTxt) {
      const rootDomain = host.startsWith("www.") ? host.slice(4) : host;
      const { data: website } = await supabase
        .from("websites")
        .select("id, published_slug, custom_domain, is_published")
        .or(`custom_domain.eq.${host},custom_domain.eq.${rootDomain}`)
        .eq("is_published", true)
        .maybeSingle();

      if (!website || !website.is_published) {
        return new Response("Not Found", { status: 404 });
      }

      const { generateAIWebsiteManifest } = await import("@/lib/seo-manifest");
      const baseUrl = `${protocol}://${host}`;
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

    const tokenFromFilename = filename.slice(6, -5).trim(); // strip "google" and ".html"

    // Query website_seo for matching verification token
    const { data: seo } = await supabase
      .from("website_seo")
      .select("google_site_verification_token")
      .or(`google_site_verification_token.eq.${tokenFromFilename},google_site_verification_token.eq.${filename}`)
      .limit(1)
      .maybeSingle();

    if (!seo) {
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
