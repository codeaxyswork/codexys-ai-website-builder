import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  loadGoogleAdsCredentials,
  refreshGoogleAdsAccessToken,
  saveGoogleAdsCredentials,
  fetchAccessibleGoogleAdsCustomers,
  checkDeveloperTokenStatus,
} from "@/lib/google-ads-client";
import { getUserUsage } from "@/lib/billing";
import { canUseFeature } from "@/lib/features";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;

    if (!websiteId) {
      return NextResponse.json({ error: "Website ID is required." }, { status: 400 });
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

    // Verify entitlement / feature access (e.g., advanced_integrations or basic_seo)
    const usage = await getUserUsage(user.id);
    const planId = usage?.plan?.id || "free";
    const allowed = canUseFeature(planId, "basic_seo") || canUseFeature(planId, "advanced_integrations");
    if (!allowed) {
      return NextResponse.json(
        { error: "Google Ads integration requires an active subscription plan." },
        { status: 403 }
      );
    }

    // Load credentials
    let creds = await loadGoogleAdsCredentials(supabase, websiteId);
    if (!creds || !creds.refresh_token) {
      return NextResponse.json(
        { error: "Google Ads is not connected. Please connect Google Ads first.", connected: false },
        { status: 400 }
      );
    }

    // Auto-refresh access token if expired
    let accessToken = creds.access_token;
    if (!accessToken || (creds.token_expires_at && Date.now() >= creds.token_expires_at - 60000)) {
      const refreshed = await refreshGoogleAdsAccessToken(creds.refresh_token);
      accessToken = refreshed.access_token;
      await saveGoogleAdsCredentials(supabase, websiteId, user.id, {
        access_token: refreshed.access_token,
        expires_in: refreshed.expires_in,
      });
    }

    const devTokenStatus = checkDeveloperTokenStatus();
    let customers: any[] = [];
    let fetchError: string | null = null;

    try {
      customers = await fetchAccessibleGoogleAdsCustomers(accessToken);
    } catch (err: any) {
      console.warn("fetchAccessibleGoogleAdsCustomers warning:", err?.message || err);
      fetchError = err?.message || "Failed to fetch accessible Google Ads customer accounts.";
    }

    return NextResponse.json({
      connected: true,
      selectedCustomerId: creds.google_ads_customer_id || null,
      developerTokenStatus: devTokenStatus.status,
      customers,
      error: fetchError || undefined,
    });
  } catch (error: any) {
    console.error("API /api/websites/[id]/seo/google-ads/customers Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to retrieve Google Ads customer accounts." },
      { status: 500 }
    );
  }
}
