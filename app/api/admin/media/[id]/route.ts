import { NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";
import { createClient } from "@/utils/supabase/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCtx = await requireAdmin();
    if (!adminCtx) {
      return NextResponse.json({ error: "Unauthorized access denied." }, { status: 403 });
    }

    const { id: mediaId } = await params;
    const supabase = await createClient();

    const { data: media } = await supabase
      .from("media_assets")
      .select("id, user_id, storage_path, file_name")
      .eq("id", mediaId)
      .single();

    if (!media) {
      return NextResponse.json({ error: "Media asset not found." }, { status: 404 });
    }

    // 1. Remove file from Supabase Storage bucket
    if (media.storage_path) {
      const { error: storageErr } = await supabase.storage
        .from("media-library")
        .remove([media.storage_path]);
      if (storageErr) {
        console.error("Storage File Delete Error:", storageErr);
      }
    }

    // 2. Remove database metadata
    const { error: dbErr } = await supabase.from("media_assets").delete().eq("id", mediaId);
    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    await logAdminAction({
      adminId: adminCtx.user.id,
      actionType: "MEDIA_DELETED",
      targetUserId: media.user_id,
      details: { fileName: media.file_name, storagePath: media.storage_path },
    });

    return NextResponse.json({ success: true, message: "Media file deleted by admin." });
  } catch (err: any) {
    console.error("DELETE Admin Media Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to delete media asset." }, { status: 500 });
  }
}
