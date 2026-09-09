import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { GeneratedFile } from "@/lib/types";

export async function GET(
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

    const { data: website, error: webError } = await supabase
      .from("websites")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (webError || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 404 }
      );
    }

    const { data: pages } = await supabase
      .from("website_pages")
      .select("*")
      .eq("website_id", id)
      .eq("user_id", user.id);

    const mainPage = pages && pages.length > 0 ? pages[0] : null;

    const files: GeneratedFile[] = [
      { path: "index.html", content: mainPage?.html_content || "" },
      { path: "styles.css", content: mainPage?.css_content || "" },
      { path: "script.js", content: mainPage?.js_content || "" },
    ];

    return NextResponse.json({
      website,
      plan: website.design_plan,
      prompt: website.prompt,
      files,
    });
  } catch (err: any) {
    console.error("Get Website Detail Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch website detail." },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const { error: deleteError } = await supabase
      .from("websites")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Delete Website Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete website." },
      { status: 500 }
    );
  }
}
