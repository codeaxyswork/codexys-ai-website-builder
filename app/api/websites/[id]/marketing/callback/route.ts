import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  verifyAndDecodeMetaState,
  exchangeCodeForMetaTokens,
  exchangeForLongLivedMetaToken,
  fetchMetaUserProfile,
  saveMetaConnection,
  fetchMetaAdAccounts,
  fetchMetaPages,
  persistDiscoveredMetaAssets,
} from "@/lib/marketing/meta-client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqUrl = req.url;
  const urlObj = new URL(reqUrl);
  const origin = urlObj.origin;

  const { id: websiteId } = await params;
  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");
  const errorReason = urlObj.searchParams.get("error_reason") || urlObj.searchParams.get("error");
  const errorDescription = urlObj.searchParams.get("error_description");

  const redirectError = (msg: string) => {
    return NextResponse.redirect(
      `${origin}/dashboard/websites/${websiteId}/marketing?error=${encodeURIComponent(msg)}`
    );
  };

  if (errorReason || errorDescription) {
    console.error("Meta OAuth Callback Error from Meta:", errorReason, errorDescription);
    return redirectError(errorDescription || errorReason || "Meta authorization was cancelled or denied.");
  }

  if (!code || !state) {
    return redirectError("Missing authorization code or state parameter from Meta.");
  }

  try {
    // 1. Verify CSRF State & Decode Website ID / User ID
    const decodedState = verifyAndDecodeMetaState(state);

    if (decodedState.websiteId !== websiteId) {
      return redirectError("OAuth state websiteId mismatch. Connection denied.");
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id !== decodedState.userId) {
      return redirectError("User session mismatch or unauthenticated.");
    }

    // 2. Verify website ownership
    const { data: website, error: webErr } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (webErr || !website) {
      return redirectError("Website not found or unauthorized access.");
    }

    // 3. Exchange code for short-lived token
    const tokenRes = await exchangeCodeForMetaTokens(code, websiteId, origin);

    // 4. Upgrade to long-lived Meta token (~60 days)
    const longLivedRes = await exchangeForLongLivedMetaToken(tokenRes.access_token);
    const finalAccessToken = longLivedRes.access_token || tokenRes.access_token;
    const finalExpiresIn = longLivedRes.expires_in || tokenRes.expires_in || 5184000;

    // 5. Fetch Meta User Profile
    const userProfile = await fetchMetaUserProfile(finalAccessToken);

    // 6. Securely vault encrypted credentials in marketing_connections
    await saveMetaConnection(
      supabase,
      websiteId,
      user.id,
      {
        access_token: finalAccessToken,
        expires_in: finalExpiresIn,
      },
      userProfile
    );

    console.log(`[META_OAUTH] Successfully connected Meta account "${userProfile.name}" (${userProfile.id}) for website ${websiteId}`);

    // 7. Auto-discover Meta assets immediately following successful connection
    try {
      const adAccounts = await fetchMetaAdAccounts(finalAccessToken);
      let pages: any[] = [];
      let instagramAccounts: any[] = [];
      try {
        const pageRes = await fetchMetaPages(finalAccessToken);
        pages = pageRes.pages;
        instagramAccounts = pageRes.instagramAccounts;
      } catch (pErr: any) {
        console.warn(`[META_OAUTH] Pages auto-discovery warning for website ${websiteId}:`, pErr?.message);
      }

      await persistDiscoveredMetaAssets(
        supabase,
        websiteId,
        user.id,
        adAccounts,
        pages,
        instagramAccounts
      );
      console.log(`[META_OAUTH] Successfully auto-discovered ${adAccounts.length} ad accounts for website ${websiteId}`);
    } catch (discErr: any) {
      console.error(`[META_OAUTH] Asset auto-discovery failed during callback for website ${websiteId} (OAuth connection remains valid):`, discErr?.message);
    }

    return NextResponse.redirect(
      `${origin}/dashboard/websites/${websiteId}/marketing?connected=true`
    );
  } catch (err: any) {
    console.error("Meta OAuth Callback Exception:", err);
    return redirectError(err?.message || "Failed to complete Meta authorization.");
  }
}
