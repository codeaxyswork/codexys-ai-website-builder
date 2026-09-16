import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

interface RouteParams {
  params: Promise<{ id: string; oppId: string }>;
}

/**
 * PATCH /api/websites/[id]/seo/opportunities/[oppId]
 * Updates opportunity status (viewed, in_progress, completed, dismissed).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: websiteId, oppId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { status } = body;

    const validStatuses = ["new", "viewed", "in_progress", "completed", "dismissed"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
    }

    const { data: opportunity, error } = await supabase
      .from("seo_opportunities")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", oppId)
      .eq("website_id", websiteId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !opportunity) {
      return NextResponse.json({ error: error?.message || "Opportunity not found or update failed." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      opportunity,
    });
  } catch (err: any) {
    console.error("PATCH Opportunity Status Error:", err);
    return NextResponse.json({ error: err.message || "Failed to update opportunity status." }, { status: 500 });
  }
}
