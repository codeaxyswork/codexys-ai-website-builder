import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();

    // Fetch published website by published_slug
    const { data: website } = await supabase
      .from("websites")
      .select("id, published_slug, is_published, updated_at")
      .eq("published_slug", slug)
      .eq("is_published", true)
      .single();

    if (!website || !website.is_published) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Fetch website pages
    const { data: pages } = await supabase
      .from("website_pages")
      .select("path, updated_at")
      .eq("website_id", website.id);

    const host = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const baseUrl = `${protocol}://${host}`;

    const lastMod = website.updated_at
      ? new Date(website.updated_at).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    const pageEntries = (pages && pages.length > 0 ? pages : [{ path: "index.html", updated_at: website.updated_at }])
      .map((p) => {
        const pagePath = p.path === "index.html" ? "" : `/${p.path}`;
        const pMod = p.updated_at
          ? new Date(p.updated_at).toISOString().split("T")[0]
          : lastMod;
        return `  <url>
    <loc>${baseUrl}/site/${website.published_slug}${pagePath}</loc>
    <lastmod>${pMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${p.path === "index.html" ? "1.0" : "0.8"}</priority>
  </url>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pageEntries}
</urlset>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (err: any) {
    console.error("Sitemap Route Error:", err);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
