import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const adminCtx = await requireAdmin();
    if (!adminCtx) {
      return NextResponse.json({ error: "Unauthorized access denied." }, { status: 403 });
    }

    const supabase = await createClient();

    const { data: websites, error } = await supabase
      .from("websites")
      .select("id, title, slug, prompt, is_published, published_slug, created_at, updated_at, user_id, profiles(full_name)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedWebsites = (websites || []).map((w: any) => ({
      id: w.id,
      title: w.title,
      slug: w.slug,
      prompt: w.prompt,
      is_published: Boolean(w.is_published),
      published_slug: w.published_slug,
      created_at: w.created_at,
      updated_at: w.updated_at,
      user_id: w.user_id,
      owner_name: w.profiles?.full_name || "User",
    }));

    return NextResponse.json({ websites: formattedWebsites });
  } catch (err: any) {
    console.error("GET Admin Websites Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch websites." }, { status: 500 });
  }
}
