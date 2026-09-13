import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const lowerFile = filename.toLowerCase().trim();

    // Only handle google*.html verification files
    if (!lowerFile.startsWith("google") || !lowerFile.endsWith(".html")) {
      return new Response("Not Found", { status: 404 });
    }

    const tokenFromFilename = filename.slice(6, -5).trim(); // strip "google" and ".html"
    const supabase = await createClient();

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
