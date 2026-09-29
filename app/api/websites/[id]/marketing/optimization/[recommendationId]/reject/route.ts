import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/marketing/meta-client";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; recommendationId: string }> }
) {
  try {
    const { id: websiteId, recommendationId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

    // Validate website existence & ownership
    const { data: website, error: webErr } = await dbClient
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    if (user && website.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized access to optimization rejection." }, { status: 403 });
    }

    // Update recommendation status to rejected
    const { data: rec, error: updateErr } = await dbClient
      .from("marketing_optimization_recommendations")
      .update({
        status: "rejected",
        invalidated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", recommendationId)
      .eq("website_id", websiteId)
      .select("*")
      .single();

    if (updateErr || !rec) {
      return NextResponse.json({ error: "Optimization recommendation not found or already updated." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      recommendation: rec,
    });
  } catch (err: any) {
    console.error("POST Reject Optimization API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to reject optimization recommendation." },
      { status: 500 }
    );
  }
}
