import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyAndDecodeGscState, exchangeCodeForGscTokens, saveGscCredentials } from "@/lib/gsc-client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const host = request.headers.get("host") || "codexys-ai-website-builder.vercel.app";
  const protocol = host.includes("localhost") ? "http" : "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  // Handle Google OAuth cancellation or explicit errors
  if (errorParam) {
    console.warn("Google OAuth Authorization Error:", errorParam);
    const errorMsg = errorParam === "access_denied"
      ? "Google Search Console connection was cancelled or permission was not granted."
      : `Google OAuth error: ${errorParam}`;

    return NextResponse.redirect(
      `${appUrl}/dashboard?gsc_error=${encodeURIComponent(errorMsg)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/dashboard?gsc_error=${encodeURIComponent("Missing authorization code or state parameter.")}`
    );
  }

  try {
    // 1. Verify and decode state token (CSRF & Expiration protection)
    const { websiteId, userId } = verifyAndDecodeGscState(state);
    const redirectTarget = `${appUrl}/dashboard/websites/${websiteId}/seo`;

    // 2. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id !== userId) {
      return NextResponse.redirect(
        `${redirectTarget}?tab=integrations&gsc_error=${encodeURIComponent("User session mismatch during OAuth callback.")}`
      );
    }

    // 3. Verify website ownership
    const { data: website, error: siteErr } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteErr || !website) {
      return NextResponse.redirect(
        `${redirectTarget}?tab=integrations&gsc_error=${encodeURIComponent("Website ownership verification failed.")}`
      );
    }

    // 4. Exchange code for tokens
    const tokens = await exchangeCodeForGscTokens(code, appUrl);

    // 5. Store encrypted OAuth tokens in server-only gsc_oauth_credentials table
    await saveGscCredentials(supabase, websiteId, user.id, tokens);

    // 6. Fetch existing integration config to preserve selected property
    const { data: existingIntegration } = await supabase
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
    const { error: upsertErr } = await supabase
      .from("seo_integrations")
      .upsert(
        {
          website_id: websiteId,
          user_id: user.id,
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
        `${redirectTarget}?tab=integrations&gsc_error=${encodeURIComponent("Failed to store Search Console integration status.")}`
      );
    }

    // Redirect to SEO integrations tab with success & open property selector trigger
    return NextResponse.redirect(
      `${redirectTarget}?tab=integrations&gsc_connected=1&select_property=1`
    );
  } catch (err: any) {
    console.error("GSC Callback Handler Error:", err);
    return NextResponse.redirect(
      `${appUrl}/dashboard?gsc_error=${encodeURIComponent(err?.message || "Google Search Console OAuth callback failed.")}`
    );
  }
}
