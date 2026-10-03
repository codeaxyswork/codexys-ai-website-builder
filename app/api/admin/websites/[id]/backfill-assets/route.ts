import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { runExistingMigrationAssetBackfill } from "@/lib/migration/backfill-engine";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCtx = await requireAdmin();
    if (!adminCtx) {
      return NextResponse.json({ error: "Unauthorized access denied." }, { status: 403 });
    }

    const { id: websiteId } = await params;
    if (!websiteId) {
      return NextResponse.json({ error: "Website ID parameter is required." }, { status: 400 });
    }

    const result = await runExistingMigrationAssetBackfill(websiteId);

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error(`POST /api/admin/websites/[id]/backfill-assets error:`, err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to execute migration asset backfill." },
      { status: 500 }
    );
  }
}
