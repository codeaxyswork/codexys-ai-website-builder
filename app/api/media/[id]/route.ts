import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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

    // 1. Verify media asset ownership
    const { data: asset, error: fetchError } = await supabase
      .from("media_assets")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !asset) {
      return NextResponse.json(
        { error: "Media asset not found or access denied." },
        { status: 404 }
      );
    }

    // 2. Delete file from Supabase Storage
    if (asset.storage_path) {
      const { error: storageError } = await supabase.storage
        .from("website-assets")
        .remove([asset.storage_path]);

      if (storageError) {
        console.warn("Storage deletion warning:", storageError);
      }
    }

    // 3. Delete database record
    const { error: dbDeleteError } = await supabase
      .from("media_assets")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (dbDeleteError) {
      return NextResponse.json({ error: dbDeleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Delete Media API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete media asset." },
      { status: 500 }
    );
  }
}
