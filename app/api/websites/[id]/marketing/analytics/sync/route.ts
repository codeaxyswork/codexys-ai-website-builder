import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/marketing/meta-client";
import { syncMetaCampaignInsights } from "@/lib/marketing/meta-insights";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await context.params;
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
      return NextResponse.json({ error: "Unauthorized access to analytics sync." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const datePreset = searchParams.get("preset") || "last_30d";

    const report = await syncMetaCampaignInsights(dbClient, websiteId, { datePreset });

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      report,
    });
  } catch (err: any) {
    console.error("POST Analytics Sync API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to sync campaign performance analytics." },
      { status: 500 }
    );
  }
}
