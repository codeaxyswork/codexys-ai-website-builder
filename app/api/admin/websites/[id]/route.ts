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

    const { id: websiteId } = await params;
    const supabase = await createClient();

    const { data: website } = await supabase
      .from("websites")
      .select("id, title, user_id")
      .eq("id", websiteId)
      .single();

    if (!website) {
      return NextResponse.json({ error: "Website not found." }, { status: 404 });
    }

    const { error: delErr } = await supabase.from("websites").delete().eq("id", websiteId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    await logAdminAction({
      adminId: adminCtx.user.id,
      actionType: "WEBSITE_DELETED",
      targetUserId: website.user_id,
      targetWebsiteId: websiteId,
      details: { websiteTitle: website.title },
    });

    return NextResponse.json({ success: true, message: "Website deleted by admin." });
  } catch (err: any) {
    console.error("DELETE Admin Website Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to delete website." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCtx = await requireAdmin();
    if (!adminCtx) {
      return NextResponse.json({ error: "Unauthorized access denied." }, { status: 403 });
    }

    const { id: websiteId } = await params;
    const supabase = await createClient();

    const { data: updated, error: unpubErr } = await supabase
      .from("websites")
      .update({ is_published: false, updated_at: new Date().toISOString() })
      .eq("id", websiteId)
      .select("id, title, user_id")
      .single();

    if (unpubErr) {
      return NextResponse.json({ error: unpubErr.message }, { status: 500 });
    }

    await logAdminAction({
      adminId: adminCtx.user.id,
      actionType: "WEBSITE_UNPUBLISHED",
      targetUserId: updated.user_id,
      targetWebsiteId: websiteId,
      details: { websiteTitle: updated.title },
    });

    return NextResponse.json({ success: true, message: "Website unpublished by admin." });
  } catch (err: any) {
    console.error("POST Admin Unpublish Website Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to unpublish website." }, { status: 500 });
  }
}
