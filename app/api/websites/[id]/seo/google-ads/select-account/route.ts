import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  loadGoogleAdsCredentials,
  refreshGoogleAdsAccessToken,
  saveGoogleAdsCredentials,
  verifyCustomerAccountAccess,
  updateSelectedGoogleAdsCustomer,
} from "@/lib/google-ads-client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const body = await req.json();
    const { customerId } = body;

    if (!websiteId || !customerId || typeof customerId !== "string") {
      return NextResponse.json(
        { error: "websiteId and valid customerId string are required." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    // Verify website ownership
    const { data: website, error: webErr } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (webErr || !website) {
      return NextResponse.json(
        { error: "Website not found or unauthorized access." },
        { status: 403 }
      );
    }

    // Load credentials
    let creds = await loadGoogleAdsCredentials(supabase, websiteId);
    if (!creds || !creds.refresh_token) {
      return NextResponse.json(
        { error: "Google Ads is not connected. Please connect Google Ads first." },
        { status: 400 }
      );
    }

    // Refresh access token if expired
    let accessToken = creds.access_token;
    if (!accessToken || (creds.token_expires_at && Date.now() >= creds.token_expires_at - 60000)) {
      const refreshed = await refreshGoogleAdsAccessToken(creds.refresh_token);
      accessToken = refreshed.access_token;
      await saveGoogleAdsCredentials(supabase, websiteId, user.id, {
        access_token: refreshed.access_token,
        expires_in: refreshed.expires_in,
      });
    }

    // Server-side verify that supplied customerId belongs to authorized Google account
    const isAccessible = await verifyCustomerAccountAccess(accessToken, customerId);
    if (!isAccessible) {
      return NextResponse.json(
        { error: "The selected Google Ads Customer ID is not accessible by your authorized account." },
        { status: 403 }
      );
    }

    const cleanCustomerId = customerId.replace(/-/g, "").trim();

    // Persist selected customer ID in database
    await updateSelectedGoogleAdsCustomer(supabase, websiteId, cleanCustomerId);

    return NextResponse.json({
      success: true,
      websiteId,
      selectedCustomerId: cleanCustomerId,
      message: "Google Ads Customer Account selected successfully.",
    });
  } catch (error: any) {
    console.error("API /api/websites/[id]/seo/google-ads/select-account Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to select Google Ads customer account." },
      { status: 500 }
    );
  }
}
