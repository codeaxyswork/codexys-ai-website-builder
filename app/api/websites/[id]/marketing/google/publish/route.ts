import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { publishGoogleCampaign, GooglePublisherApprovalSnapshot } from "@/lib/marketing/google-publisher";
import { loadGoogleAdsCredentials } from "@/lib/google-ads-client";

export async function POST(
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

    const body = await req.json().catch(() => ({}));
    const { draftId, approvalSnapshot } = body;

    if (!draftId || !approvalSnapshot) {
      return NextResponse.json(
        { error: "Missing required draftId or approvalSnapshot for Google publishing." },
        { status: 400 }
      );
    }

    // Verify Google Ads connection exists
    const googleCreds = await loadGoogleAdsCredentials(supabase, websiteId);
    if (!googleCreds.access_token && !googleCreds.refresh_token) {
      return NextResponse.json(
        { error: "Google Ads connection is missing or expired. Please connect Google Ads first." },
        { status: 400 }
      );
    }

    const snapshot: GooglePublisherApprovalSnapshot = {
      ...approvalSnapshot,
      draftId,
      websiteId,
      userId: user.id,
      selectedCustomerId: approvalSnapshot.selectedCustomerId || googleCreds.google_ads_customer_id || "",
      approvedAt: approvalSnapshot.approvedAt || new Date().toISOString(),
    };

    const result = await publishGoogleCampaign(
      supabase,
      websiteId,
      user.id,
      draftId,
      snapshot
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Google Publish API Route Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to publish Google Search campaign." },
      { status: 500 }
    );
  }
}
