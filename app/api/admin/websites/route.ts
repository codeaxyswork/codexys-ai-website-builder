import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const adminCtx = await requireAdmin();
    if (!adminCtx) {
      return NextResponse.json({ error: "Unauthorized access denied." }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();

    const [websitesRes, profilesRes] = await Promise.all([
      supabaseAdmin
        .from("websites")
        .select("id, title, slug, prompt, is_published, published_slug, created_at, updated_at, user_id")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("profiles")
        .select("id, full_name"),
    ]);

    if (websitesRes.error) {
      return NextResponse.json({ error: websitesRes.error.message }, { status: 500 });
    }

    const profileMap = new Map<string, string>();
    (profilesRes.data || []).forEach((p: any) => {
      profileMap.set(p.id, p.full_name || "User");
    });

    const formattedWebsites = (websitesRes.data || []).map((w: any) => ({
      id: w.id,
      title: w.title,
      slug: w.slug,
      prompt: w.prompt,
      is_published: Boolean(w.is_published),
      published_slug: w.published_slug,
      created_at: w.created_at,
      updated_at: w.updated_at,
      user_id: w.user_id,
      owner_name: profileMap.get(w.user_id) || "User",
    }));

    return NextResponse.json({ websites: formattedWebsites });
  } catch (err: any) {
    console.error("GET Admin Websites Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch websites." }, { status: 500 });
  }
}
