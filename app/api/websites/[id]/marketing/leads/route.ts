import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/marketing/meta-client";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await context.params;
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

    // 2. Validate website ownership
    const { data: website, error: siteError } = await dbClient
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteError || !website) {
      return NextResponse.json({ error: "Website not found or ownership validation failed." }, { status: 404 });
    }

    // 3. Parse query filters
    const { searchParams } = new URL(req.url);
    const sourceFilter = searchParams.get("source");
    const statusFilter = searchParams.get("status");

    let query = dbClient
      .from("marketing_leads")
      .select("*")
      .eq("website_id", websiteId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (sourceFilter && sourceFilter !== "all") {
      query = query.eq("source", sourceFilter);
    }

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data: leads, error: leadsErr } = await query;

    if (leadsErr) {
      console.error("Failed to fetch marketing_leads:", leadsErr);
      return NextResponse.json({ error: "Failed to retrieve lead inbox records." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      leads: leads || [],
    });
  } catch (err: any) {
    console.error("GET Marketing Leads Error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error fetching leads." }, { status: 500 });
  }
}
