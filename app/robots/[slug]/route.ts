import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { checkWebsitePublicVisibility } from "@/lib/lifecycle/website-lifecycle-engine";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const cleanSlug = slug.replace(/\.txt$/i, "").toLowerCase().trim();
    const supabase = await createClient();

    const { data: website } = await supabase
      .from("websites")
      .select("id, user_id, title, published_slug, is_published, created_at")
      .or(`published_slug.eq.${cleanSlug},slug.eq.${cleanSlug}`)
      .eq("is_published", true)
      .single();

    if (!website || !website.is_published) {
      return new NextResponse("User-agent: *\nDisallow: /", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Lifecycle & Suspension Gate: If website is suspended/expired, return safe non-indexable robots response
    const visibility = await checkWebsitePublicVisibility(website, supabase);
    if (!visibility.isPubliclyVisible) {
      return new NextResponse("User-agent: *\nDisallow: /\n", {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    const { data: seo } = await supabase
      .from("website_seo")
      .select("robots_index")
      .eq("website_id", website.id)
      .single();

    const host = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const baseUrl = `${protocol}://${host}`;

    let robotsTxt = "";

    if (seo && seo.robots_index === false) {
      robotsTxt = `User-agent: *\nDisallow: /\n`;
    } else {
      robotsTxt = `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap/${website.published_slug}.xml\n`;
    }

    return new NextResponse(robotsTxt, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (err: any) {
    console.error("Robots Route Error:", err);
    return new NextResponse("User-agent: *\nDisallow: /", { status: 500 });
  }
}
