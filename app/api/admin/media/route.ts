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

    const { data: media, error } = await supabase
      .from("media_assets")
      .select("id, user_id, website_id, file_name, file_size_bytes, mime_type, public_url, created_at, profiles(full_name)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedMedia = (media || []).map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      owner_name: m.profiles?.full_name || "User",
      website_id: m.website_id,
      file_name: m.file_name,
      file_size_bytes: Number(m.file_size_bytes) || 0,
      mime_type: m.mime_type,
      public_url: m.public_url,
      created_at: m.created_at,
    }));

    const totalStorageBytes = formattedMedia.reduce((sum, m) => sum + m.file_size_bytes, 0);

    return NextResponse.json({
      totalStorageBytes,
      totalFiles: formattedMedia.length,
      media: formattedMedia,
    });
  } catch (err: any) {
    console.error("GET Admin Media Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch media assets." }, { status: 500 });
  }
}
