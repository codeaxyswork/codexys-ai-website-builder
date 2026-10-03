import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateAIWebsiteManifest } from "@/lib/seo-manifest";
import { getWebsitePublicUrl } from "@/lib/domain-resolver";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const cleanSlug = slug.replace(/\.txt$/i, "").toLowerCase().trim();
    const supabase = await createClient();

    // Query published website by published_slug or slug
    const { data: website } = await supabase
      .from("websites")
      .select("id, published_slug, slug, custom_domain, is_published")
      .or(`published_slug.eq.${cleanSlug},slug.eq.${cleanSlug}`)
      .eq("is_published", true)
      .maybeSingle();

    if (!website || !website.is_published) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const baseUrl = getWebsitePublicUrl(website);

    const manifestText = await generateAIWebsiteManifest(supabase, website.id, { baseUrl });

    if (!manifestText) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return new NextResponse(manifestText, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (err: any) {
    console.error("LLMS Route Error:", err);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
