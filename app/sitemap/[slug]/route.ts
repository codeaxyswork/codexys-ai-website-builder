import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getWebsitePageUrl } from "@/lib/domain-resolver";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const cleanSlug = slug.replace(/\.xml$/i, "").toLowerCase().trim();
    const supabase = await createClient();

    // Fetch published website by published_slug or slug
    const { data: website } = await supabase
      .from("websites")
      .select("id, published_slug, slug, custom_domain, is_published, updated_at")
      .or(`published_slug.eq.${cleanSlug},slug.eq.${cleanSlug}`)
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

    // Fetch published blog posts
    const { data: publishedPosts } = await supabase
      .from("blog_posts")
      .select("slug, updated_at")
      .eq("website_id", website.id)
      .eq("status", "published");

    const lastMod = website.updated_at
      ? new Date(website.updated_at).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    const pageEntries = (pages && pages.length > 0 ? pages : [{ path: "index.html", updated_at: website.updated_at }])
      .map((p) => {
        const canonicalLoc = getWebsitePageUrl(website, p.path);
        const pMod = p.updated_at
          ? new Date(p.updated_at).toISOString().split("T")[0]
          : lastMod;
        const isHome = !p.path || p.path === "/" || p.path.toLowerCase().startsWith("index");
        return `  <url>
    <loc>${canonicalLoc}</loc>
    <lastmod>${pMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${isHome ? "1.0" : "0.8"}</priority>
  </url>`;
      })
      .join("\n");

    const blogEntries = (publishedPosts || []).map((b) => {
      const blogLoc = getWebsitePageUrl(website, `/blog/${b.slug}`);
      const bMod = b.updated_at
        ? new Date(b.updated_at).toISOString().split("T")[0]
        : lastMod;
      return `  <url>
    <loc>${blogLoc}</loc>
    <lastmod>${bMod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pageEntries}
${blogEntries}
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
