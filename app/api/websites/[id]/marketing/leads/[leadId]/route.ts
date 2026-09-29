import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/marketing/meta-client";
import { sanitizeText } from "@/lib/marketing/lead-engine";

const ALLOWED_STATUSES = ["new", "contacted", "qualified", "follow_up", "converted", "lost"];

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; leadId: string }> }
) {
  try {
    const { id: websiteId, leadId } = await context.params;
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

    // 3. Fetch lead record
    const { data: lead, error: leadErr } = await dbClient
      .from("marketing_leads")
      .select("*")
      .eq("id", leadId)
      .eq("website_id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (leadErr || !lead) {
      return NextResponse.json({ error: "Lead record not found or unauthorized." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) {
      if (!ALLOWED_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(", ")}` }, { status: 400 });
      }
      updatePayload.status = body.status;

      if (body.status === "contacted" && !lead.last_contacted_at) {
        updatePayload.last_contacted_at = new Date().toISOString();
      } else if (body.status === "converted" && !lead.converted_at) {
        updatePayload.converted_at = new Date().toISOString();
      }
    }

    if (body.notes !== undefined) {
      updatePayload.notes = sanitizeText(body.notes);
    }

    const { data: updatedLead, error: updateErr } = await dbClient
      .from("marketing_leads")
      .update(updatePayload)
      .eq("id", leadId)
      .select("*")
      .single();

    if (updateErr) {
      console.error("Failed to update lead status/notes:", updateErr);
      return NextResponse.json({ error: "Failed to update lead record." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      lead: updatedLead,
    });
  } catch (err: any) {
    console.error("PATCH Lead Error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error updating lead." }, { status: 500 });
  }
}
