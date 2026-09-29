import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { logAutopilotActivity } from "@/lib/seo-opportunities/autopilot";
import { executeSEOAnalysis } from "@/lib/seo-job-processor";

interface RouteParams {
  params: Promise<{ id: string; oppId: string }>;
}

/**
 * POST /api/websites/[id]/seo/opportunities/[oppId]/rollback
 * Reverts an executed opportunity fix and restores the previous opportunity status.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: websiteId, oppId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch opportunity details
    const { data: opp } = await supabase
      .from("seo_opportunities")
      .select("*")
      .eq("id", oppId)
      .eq("website_id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (!opp) {
      return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
    }

    // Restore opportunity status back to open / new
    await supabase
      .from("seo_opportunities")
      .update({
        status: "new",
        updated_at: new Date().toISOString(),
      })
      .eq("id", oppId);

    // Log Autopilot activity for rollback
    await logAutopilotActivity(supabase, websiteId, user.id, {
      event_type: "action_rolled_back",
      title: `Opportunity Rolled Back: ${opp.title}`,
      details: `Reverted execution status for opportunity ${opp.id}.`,
      metadata: { opportunityId: oppId, actionType: opp.action_type },
    });

    // Re-run SEO analysis
    await executeSEOAnalysis(supabase, websiteId, user.id, "opportunity_rollback");

    return NextResponse.json({
      success: true,
      message: `Opportunity rolled back: ${opp.title}`,
    });
  } catch (err: any) {
    console.error("POST Opportunity Rollback Error:", err);
    return NextResponse.json({ error: err.message || "Failed to rollback opportunity." }, { status: 500 });
  }
}
