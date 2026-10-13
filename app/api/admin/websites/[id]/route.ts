import { NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { deleteProjectUniversally } from "@/lib/projects/project-deletion-service";

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
    const dbClient = createAdminClient();

    const report = await deleteProjectUniversally({
      websiteId,
      userId: adminCtx.user.id,
      isAdmin: true,
      dbClient,
    });

    if (!report.cleanupCompleted) {
      if (report.errors.some((e) => e.includes("Website not found"))) {
        return NextResponse.json({ error: "Website not found." }, { status: 404 });
      }

      console.error(`[ADMIN_DELETE_FAILURE] Website ${websiteId}:`, report.errors);
      return NextResponse.json(
        {
          error: "Admin deletion encountered partial failures.",
          details: report.errors,
          orphanedResources: report.remainingOrphanedResources,
          report,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Website deleted by admin.", report });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to delete website.";
    console.error("DELETE Admin Website Error:", err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
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
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to unpublish website.";
    console.error("POST Admin Unpublish Website Error:", err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
