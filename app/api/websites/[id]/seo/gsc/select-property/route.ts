import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  fetchGscProperties,
  refreshGscAccessToken,
  checkDomainCompatibility,
  loadGscCredentials,
  saveGscCredentials,
} from "@/lib/gsc-client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify website ownership
    const { data: website, error: siteErr } = await supabase
      .from("websites")
      .select("id, title, slug, published_slug, custom_domain")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteErr || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    const body = await request.json();
    const { property_url } = body;

    if (!property_url || typeof property_url !== "string") {
      return NextResponse.json({ error: "property_url parameter is required." }, { status: 400 });
    }

    // Load server-only credentials
    const creds = await loadGscCredentials(supabase, websiteId);
    let accessToken = creds.access_token;
    const refreshToken = creds.refresh_token;
    const expiresAt = creds.token_expires_at;

    if ((!accessToken || Date.now() >= expiresAt - 60000) && refreshToken) {
      const refreshed = await refreshGscAccessToken(refreshToken);
      accessToken = refreshed.access_token;
      await saveGscCredentials(supabase, websiteId, user.id, {
        access_token: refreshed.access_token,
        expires_in: refreshed.expires_in,
      });
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing Search Console access token. Please reconnect your account." },
        { status: 401 }
      );
    }

    // Validate that property_url came from user's authenticated Google account
    const candidateUrls = [property_url.trim()];
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://codexys-ai-website-builder.vercel.app").replace(/\/$/, "");
    const publishedSlug = website.published_slug || website.slug;
    if (publishedSlug) {
      candidateUrls.push(`${baseUrl}/site/${publishedSlug}/`);
      candidateUrls.push(`${baseUrl}/site/${publishedSlug}`);
    }

    const properties = await fetchGscProperties(accessToken, candidateUrls);
    const matchedProperty = properties.find((p) => p.siteUrl === property_url);

    if (!matchedProperty) {
      return NextResponse.json(
        { error: "The selected property was not found in your Google Search Console account." },
        { status: 400 }
      );
    }

    // Check domain compatibility (e.g. codexys.com vs sc-domain:codexys.com)
    const isDomainMatch = checkDomainCompatibility(
      website.custom_domain || website.slug,
      property_url
    );

    // Safe client-readable configuration containing ZERO secrets or tokens
    const safeConfig = {
      selected_property: property_url,
      property_type: matchedProperty.type,
      permission_level: matchedProperty.permissionLevel,
      property_verified: isDomainMatch,
    };

    const { error: updateErr } = await supabase
      .from("seo_integrations")
      .update({
        status: "connected",
        configuration: safeConfig,
        updated_at: new Date().toISOString(),
      })
      .eq("website_id", websiteId)
      .eq("provider", "google_search_console");

    if (updateErr) {
      console.error("Failed to save property association:", updateErr);
      return NextResponse.json(
        { error: "Failed to associate property with website." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: isDomainMatch
        ? "Search Console property verified and connected."
        : "Search Console property selected.",
      selected_property: property_url,
      property_verified: isDomainMatch,
      status: "connected",
    });
  } catch (err: any) {
    console.error("Select GSC Property Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to select property." },
      { status: 500 }
    );
  }
}
