import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/marketing/meta-client";
import { persistWebsiteLead } from "@/lib/marketing/lead-engine";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await context.params;

    if (!websiteId || websiteId.length < 10) {
      return NextResponse.json({ error: "Invalid website ID." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    // Prevent client injection of trusted server fields
    delete body.user_id;
    delete body.website_id;
    delete body.status;
    delete body.source;

    const dbClient = createAdminClient();
    const lead = await persistWebsiteLead(dbClient, websiteId, body);

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      message: "Lead submission received successfully.",
    }, { status: 201 });
  } catch (err: any) {
    console.error("POST Website Lead Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to process lead submission." }, { status: 500 });
  }
}
