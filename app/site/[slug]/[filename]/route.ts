import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; filename: string }> }
) {
  try {
    const { slug, filename } = await params;
    const lowerFile = filename.toLowerCase().trim();

    // Only handle google*.html verification files
    if (!lowerFile.startsWith("google") || !lowerFile.endsWith(".html")) {
      return new Response("Not Found", { status: 404 });
    }

    const cleanSlug = slug.toLowerCase().trim().replace(/\/+$/, "");
    const supabase = await createClient();

    const { data: website } = await supabase
      .from("websites")
      .select("id")
      .or(`published_slug.eq.${cleanSlug},slug.eq.${cleanSlug}`)
      .eq("is_published", true)
      .single();

    if (!website) {
      return new Response("Not Found", { status: 404 });
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
