import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { logAutopilotActivity } from "@/lib/seo-opportunities/autopilot";

interface RouteParams {
  params: Promise<{ id: string; oppId: string }>;
}

/**
 * POST /api/websites/[id]/seo/opportunities/[oppId]/fix
 * Executes safe deterministic fix or prepares action payload for AI Fix integration.
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

    // Execute structured action based on action_type
    let executionResult: Record<string, any> = { executed: true };

    if (opp.action_type === "ai_fix_meta") {
      // Mark opportunity as completed or in_progress for AI Fix refinement
      executionResult = {
        redirectUrl: `/dashboard/websites/${websiteId}/seo?tab=overview`,
        action: "ai_fix_meta",
        field: opp.action_payload?.field || "seo_title",
      };
    } else if (opp.action_type === "create_blog_post") {
      executionResult = {
        redirectUrl: `/dashboard/websites/${websiteId}/blog`,
        action: "create_blog_post",
      };
    } else if (opp.action_type === "update_local_profile" || opp.action_type === "update_local_schema") {
      executionResult = {
        redirectUrl: `/dashboard/websites/${websiteId}/seo?tab=local-seo`,
        action: opp.action_type,
      };
    } else if (opp.action_type === "apply_internal_link") {
      executionResult = {
        redirectUrl: `/dashboard/websites/${websiteId}/seo?tab=internal-links`,
        action: "apply_internal_link",
      };
    }

    // Update opportunity status to completed
    await supabase
      .from("seo_opportunities")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", oppId);

    // Log Autopilot execution activity
    await logAutopilotActivity(supabase, websiteId, user.id, {
      event_type: "action_executed",
      title: `Opportunity Executed: ${opp.title}`,
      details: `Action "${opp.recommended_action}" marked completed.`,
      metadata: { opportunityId: oppId, actionType: opp.action_type },
    });

    return NextResponse.json({
      success: true,
      message: `Action executed for opportunity: ${opp.title}`,
      executionResult,
    });
  } catch (err: any) {
    console.error("POST Opportunity Fix Error:", err);
    return NextResponse.json({ error: err.message || "Failed to execute opportunity fix." }, { status: 500 });
  }
}
