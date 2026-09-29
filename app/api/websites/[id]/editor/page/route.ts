import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid website ID." }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const pageId = searchParams.get("pageId");
    const path = searchParams.get("path");

    if (!pageId && !path) {
      return NextResponse.json({ error: "pageId or path parameter is required." }, { status: 400 });
    }

    const userClient = await createClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Verify ownership
    let { data: website } = await userClient
      .from("websites")
      .select("id, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!website) {
      const adminDb = createAdminClient();
      const { data: adminWeb } = await adminDb
        .from("websites")
        .select("id, user_id")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      website = adminWeb;
    }

    if (!website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    // 2. Fetch specific page content
    let query = userClient
      .from("website_pages")
      .select("id, website_id, user_id, path, html_content, css_content, js_content, created_at")
      .eq("website_id", id);

    if (pageId) {
      query = query.eq("id", pageId);
    } else if (path) {
      query = query.eq("path", path);
    }

    let { data: page, error: pageErr } = await query.maybeSingle();

    if (pageErr || !page) {
      const adminDb = createAdminClient();
      let adminQuery = adminDb
        .from("website_pages")
        .select("id, website_id, user_id, path, html_content, css_content, js_content, created_at")
        .eq("website_id", id);

      if (pageId) {
        adminQuery = adminQuery.eq("id", pageId);
      } else if (path) {
        adminQuery = adminQuery.eq("path", path);
      }
      const { data: adminPage } = await adminQuery.maybeSingle();
      page = adminPage;
    }

    if (!page) {
      return NextResponse.json({ error: "Page content not found." }, { status: 404 });
    }

    return NextResponse.json({ page });
  } catch (err: any) {
    console.error("Editor Page Content Fetch Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch page content." },
      { status: 500 }
    );
  }
}
