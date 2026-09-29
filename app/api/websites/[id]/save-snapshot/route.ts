import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/utils/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid website ID." }, { status: 400 });
    }

    const userClient = await createClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { pageId, path: pagePath, htmlContent, cssContent, jsContent } = body as {
      pageId?: string;
      path?: string;
      htmlContent?: string;
      cssContent?: string;
      jsContent?: string;
    };

    if (!htmlContent) {
      return NextResponse.json({ error: "No HTML content provided for save." }, { status: 400 });
    }

    // 1. Verify ownership using authenticated userClient
    let { data: website, error: webErr } = await userClient
      .from("websites")
      .select("id, user_id, title")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (webErr || !website) {
      const adminDb = createAdminClient();
      const { data: adminWeb } = await adminDb
        .from("websites")
        .select("id, user_id, title")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminWeb) {
        website = adminWeb;
      }
    }

    if (!website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    // 2. Update website_pages targeting pageId or path
    let updateQuery = userClient
      .from("website_pages")
      .update({
        html_content: htmlContent,
        css_content: cssContent || "",
        js_content: jsContent || "",
        updated_at: new Date().toISOString(),
      })
      .eq("website_id", id)
      .eq("user_id", user.id);

    if (pageId) {
      updateQuery = updateQuery.eq("id", pageId);
    } else if (pagePath) {
      updateQuery = updateQuery.eq("path", pagePath);
    }

    const { data: updatedPages, error: updateError } = await updateQuery.select("id");

    if (updateError || !updatedPages || updatedPages.length === 0) {
      console.warn("User client website_pages update yielded 0 rows, attempting fallback");
      const adminDb = createAdminClient();
      let adminQuery = adminDb
        .from("website_pages")
        .update({
          html_content: htmlContent,
          css_content: cssContent || "",
          js_content: jsContent || "",
          updated_at: new Date().toISOString(),
        })
        .eq("website_id", id);

      if (pageId) {
        adminQuery = adminQuery.eq("id", pageId);
      } else if (pagePath) {
        adminQuery = adminQuery.eq("path", pagePath);
      }

      const { data: adminUpdated, error: adminUpdateErr } = await adminQuery.select("id");

      if (adminUpdateErr || !adminUpdated || adminUpdated.length === 0) {
        await userClient.from("website_pages").insert({
          website_id: id,
          user_id: user.id,
          path: pagePath || "index.html",
          html_content: htmlContent,
          css_content: cssContent || "",
          js_content: jsContent || "",
        });
      }
    }

    // 3. Update websites updated_at timestamp
    await userClient.from("websites").update({ updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);

    // 4. Invalidate Next.js cache & in-memory site cache
    try {
      const { invalidateCachedSiteData } = await import("@/lib/site-cache");
      invalidateCachedSiteData(id);
      revalidatePath("/dashboard");
      revalidatePath(`/dashboard/websites/${id}`);
      revalidatePath(`/dashboard/websites/${id}/editor`);
      revalidatePath("/site", "layout");
    } catch {}

    return NextResponse.json({
      success: true,
      websiteId: id,
      message: `Migrated snapshot for '${website.title}' saved successfully.`,
    });
  } catch (err: any) {
    console.error("Save Migrated Snapshot API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to save migrated snapshot." },
      { status: 500 }
    );
  }
}
