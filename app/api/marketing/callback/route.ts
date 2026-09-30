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

export async function GET(req: NextRequest) {
  const reqUrl = req.url;
  const urlObj = new URL(reqUrl);
  const origin = urlObj.origin;

  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");
  const errorReason = urlObj.searchParams.get("error_reason") || urlObj.searchParams.get("error");
  const errorDescription = urlObj.searchParams.get("error_description");

  let fallbackWebsiteId = "";

  const redirectError = (msg: string, websiteId?: string) => {
    const targetId = websiteId || fallbackWebsiteId;
    const dest = targetId
      ? `${origin}/dashboard/websites/${targetId}/marketing?error=${encodeURIComponent(msg)}`
      : `${origin}/dashboard?error=${encodeURIComponent(msg)}`;
    return NextResponse.redirect(dest);
  };

  if (errorReason || errorDescription) {
    console.error("Meta OAuth Callback Error from Meta:", errorReason, errorDescription);
    return redirectError(errorDescription || errorReason || "Meta authorization was cancelled or denied.");
  }

  if (!code || !state) {
    return redirectError("Missing authorization code or state parameter from Meta.");
  }

  try {
    // 1. Verify CSRF State & Decode HMAC-signed Website ID & User ID
    const decodedState = verifyAndDecodeMetaState(state);
    const websiteId = decodedState.websiteId;
    const stateUserId = decodedState.userId;
    fallbackWebsiteId = websiteId;

    if (!websiteId || !stateUserId) {
      return redirectError("Invalid OAuth state payload. Missing websiteId or userId.");
    }

    // 2. Authenticate user session
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id !== stateUserId) {
      return redirectError("User session mismatch or unauthenticated.", websiteId);
    }

    // 3. Verify website ownership
    const { data: website, error: webErr } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (webErr || !website) {
      return redirectError("Website not found or unauthorized access.", websiteId);
    }

    // 4. Exchange code for short-lived token using static redirect_uri
    const tokenRes = await exchangeCodeForMetaTokens(code, websiteId, origin);

    // 5. Upgrade to long-lived Meta token (~60 days)
    const longLivedRes = await exchangeForLongLivedMetaToken(tokenRes.access_token);
    const finalAccessToken = longLivedRes.access_token || tokenRes.access_token;
    const finalExpiresIn = longLivedRes.expires_in || tokenRes.expires_in || 5184000;

    // 6. Fetch Meta User Profile
    const userProfile = await fetchMetaUserProfile(finalAccessToken);

    // 7. Securely vault encrypted credentials in marketing_connections
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

    // 8. Auto-discover Meta assets immediately following successful connection
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
