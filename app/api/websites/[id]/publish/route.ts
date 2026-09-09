import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Verify website ownership & existence
    const { data: website, error: fetchError } = await supabase
      .from("websites")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 404 }
      );
    }

    // 2. Verify page content exists
    const { data: pages } = await supabase
      .from("website_pages")
      .select("html_content")
      .eq("website_id", id)
      .eq("user_id", user.id);

    const hasHtml = pages && pages.some((p) => p.html_content && p.html_content.trim().length > 0);
    if (!hasHtml) {
      return NextResponse.json(
        { error: "Website must have valid page content before publishing." },
        { status: 400 }
      );
    }

    // 3. Generate unique published_slug
    let uniqueSlug = website.published_slug;

    if (!uniqueSlug) {
      const baseSlug = (website.title || "custom-website")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "website";

      uniqueSlug = baseSlug;
      let counter = 1;
      let isUnique = false;

      while (!isUnique && counter < 100) {
        const checkSlug = counter === 1 ? baseSlug : `${baseSlug}-${counter}`;
        const { data: existing } = await supabase
          .from("websites")
          .select("id")
          .eq("published_slug", checkSlug)
          .single();

        if (!existing || existing.id === id) {
          uniqueSlug = checkSlug;
          isUnique = true;
        } else {
          counter++;
        }
      }
    }

    // 4. Update website publishing status
    const { error: updateError } = await supabase
      .from("websites")
      .update({
        is_published: true,
        published_slug: uniqueSlug,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      slug: uniqueSlug,
      publicUrl: `/site/${uniqueSlug}`,
    });
  } catch (err: any) {
    console.error("Publish Website API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to publish website." },
      { status: 500 }
    );
  }
}
