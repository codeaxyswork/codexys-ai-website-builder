import { NextResponse } from "next/server";
import {
  verifyAndDecodeGscState,
  exchangeCodeForGscTokens,
  saveGscCredentials,
  createAdminClient,
} from "@/lib/gsc-client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const host = request.headers.get("host") || "codexys-ai-website-builder.vercel.app";
  const protocol = host.includes("localhost") ? "http" : "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  // Safely extract targetWebsiteId from state payload for error redirect fallback
  let targetWebsiteId: string | null = null;
  if (state && typeof state === "string" && state.includes(".")) {
    try {
      const [base64Payload] = state.split(".");
      const jsonStr = Buffer.from(base64Payload, "base64url").toString("utf8");
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed.websiteId === "string") {
        targetWebsiteId = parsed.websiteId;
      }
    } catch {
      // Ignore unparseable state for fallback
    }
  }

  const getErrorRedirectUrl = (errorMsg: string) => {
    if (targetWebsiteId) {
      return `${appUrl}/dashboard/websites/${targetWebsiteId}/seo?tab=integrations&gsc_error=${encodeURIComponent(errorMsg)}`;
    }
    return `${appUrl}/dashboard?gsc_error=${encodeURIComponent(errorMsg)}`;
  };

  // Handle Google OAuth cancellation or explicit errors
  if (errorParam) {
    console.warn("Google OAuth Authorization Error:", errorParam);
    const errorMsg =
      errorParam === "access_denied"
        ? "Google Search Console connection was cancelled or permission was not granted."
        : `Google OAuth error: ${errorParam}`;

    return NextResponse.redirect(getErrorRedirectUrl(errorMsg));
  }

  if (!code || !state) {
    return NextResponse.redirect(getErrorRedirectUrl("Missing authorization code or state parameter."));
  }

  try {
    // 1. Verify and decode HMAC-signed state token (CSRF & Expiration protection)
    const { websiteId, userId } = verifyAndDecodeGscState(state);
    targetWebsiteId = websiteId; // HMAC-verified websiteId!

    const successRedirectUrl = `${appUrl}/dashboard/websites/${websiteId}/seo?tab=integrations&gsc_connected=1&select_property=1`;

    // 2. Admin client for secure server-side verification and credential storage
    const dbClient = createAdminClient();

    // 3. Verify website existence & user ownership via server database
    const { data: website, error: siteErr } = await dbClient
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .single();

    if (siteErr || !website || website.user_id !== userId) {
      return NextResponse.redirect(
        `${appUrl}/dashboard/websites/${websiteId}/seo?tab=integrations&gsc_error=${encodeURIComponent("Website ownership verification failed.")}`
      );
    }

    // 4. Exchange authorization code for Google tokens
    const tokens = await exchangeCodeForGscTokens(code, appUrl);

    // 5. Store encrypted OAuth tokens in server-only gsc_oauth_credentials table
    await saveGscCredentials(dbClient, websiteId, userId, tokens);

    // 6. Fetch existing integration config to preserve selected property
    const { data: existingIntegration } = await dbClient
      .from("seo_integrations")
      .select("configuration")
      .eq("website_id", websiteId)
      .eq("provider", "google_search_console")
      .single();

    const existingConfig = existingIntegration?.configuration || {};

    // Safe client-readable configuration containing ZERO secrets/tokens
    const safeConfig = {
      selected_property: existingConfig.selected_property || null,
      property_type: existingConfig.property_type || null,
      property_verified: !!existingConfig.property_verified,
    };

    // 7. Upsert GSC integration metadata in seo_integrations
    const { error: upsertErr } = await dbClient
      .from("seo_integrations")
      .upsert(
        {
          website_id: websiteId,
          user_id: userId,
          provider: "google_search_console",
          status: safeConfig.selected_property ? "connected" : "property_selection_required",
          configuration: safeConfig,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "website_id,provider" }
      );

    if (upsertErr) {
      console.error("Failed to save GSC integration metadata:", upsertErr);
      return NextResponse.redirect(
        `${appUrl}/dashboard/websites/${websiteId}/seo?tab=integrations&gsc_error=${encodeURIComponent("Failed to store Search Console integration status.")}`
      );
    }

    // Redirect to website SEO integrations tab with success & open property selector trigger
    return NextResponse.redirect(successRedirectUrl);
  } catch (err: any) {
    console.error("GSC Callback Handler Error:", err);
    return NextResponse.redirect(
      getErrorRedirectUrl(err?.message || "Google Search Console OAuth callback failed.")
    );
  }
}
