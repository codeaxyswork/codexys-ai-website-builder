import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: assets, error } = await supabase
      .from("media_assets")
      .select("id, file_name, file_size_bytes, mime_type, storage_path, public_url, created_at, website_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch media assets error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assets: assets || [] });
  } catch (err: any) {
    console.error("Get Media API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch media assets." },
      { status: 500 }
    );
  }
}
