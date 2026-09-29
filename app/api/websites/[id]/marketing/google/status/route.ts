import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { data: website, error: siteErr } = await supabase
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .single();

    if (siteErr || !website || website.user_id !== user.id) {
      return NextResponse.json({ error: "Website not found or access denied" }, { status: 403 });
    }

    const { data: executions, error: execErr } = await supabase
      .from("marketing_campaign_executions")
      .select("*")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false });

    if (execErr) {
      return NextResponse.json({ error: execErr.message }, { status: 500 });
    }

    const googleExecutions = (executions || []).filter((e) => {
      const snap = e.approval_snapshot || {};
      return snap.strategy?.channel === "GOOGLE_SEARCH_ADS" || Boolean(snap.selectedCustomerId);
    });

    return NextResponse.json({
      executions: googleExecutions,
    });
  } catch (err: any) {
    console.error("Google Status API Route Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to retrieve Google campaign status." },
      { status: 500 }
    );
  }
}
