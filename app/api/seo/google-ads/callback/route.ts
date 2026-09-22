import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  verifyAndDecodeGoogleAdsState,
  exchangeCodeForGoogleAdsTokens,
  saveGoogleAdsCredentials,
} from "@/lib/google-ads-client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || "https://codexys-ai-website-builder.vercel.app";

  if (oauthError) {
    console.error("Google Ads OAuth Error Callback:", oauthError);
    return NextResponse.redirect(
      `${origin}/dashboard?error=${encodeURIComponent(`Google Ads authorization failed: ${oauthError}`)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${origin}/dashboard?error=${encodeURIComponent("Missing authorization code or state parameter.")}`
    );
  }

  try {
    // 1. Verify CSRF state token & timestamp expiration
    const payload = verifyAndDecodeGoogleAdsState(state);
    const { websiteId, userId } = payload;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id !== userId) {
      return NextResponse.redirect(
        `${origin}/dashboard?error=${encodeURIComponent("Customer identity mismatch or session expired.")}`
      );
    }

    // 2. Verify website ownership
    const { data: website } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (!website) {
      return NextResponse.redirect(
        `${origin}/dashboard?error=${encodeURIComponent("Website ownership verification failed.")}`
      );
    }

    // 3. Exchange authorization code for tokens
    const tokens = await exchangeCodeForGoogleAdsTokens(code, origin);

    // 4. Save AES-256-GCM encrypted tokens to google_ads_oauth_credentials
    await saveGoogleAdsCredentials(supabase, websiteId, user.id, tokens);

    // 5. Redirect back to SEO Integrations dashboard with success parameter
    return NextResponse.redirect(
      `${origin}/dashboard/websites/${websiteId}/seo?tab=integrations&google_ads=connected`
    );
  } catch (error: any) {
    console.error("API /api/seo/google-ads/callback Error:", error);
    return NextResponse.redirect(
      `${origin}/dashboard?error=${encodeURIComponent(error?.message || "Failed to complete Google Ads authorization.")}`
    );
  }
}
