import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchGscProperties, refreshGscAccessToken, loadGscCredentials, saveGscCredentials } from "@/lib/gsc-client";
import { getWebsitePublicUrl } from "@/lib/domain-resolver";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
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
      .select("id, title, slug, published_slug, custom_domain, is_published")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteErr || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    // Load server-only OAuth credentials
    const creds = await loadGscCredentials(supabase, websiteId);

    if (!creds.access_token && !creds.refresh_token) {
      return NextResponse.json(
        { error: "Google Search Console is not connected for this website." },
        { status: 400 }
      );
    }

    let accessToken = creds.access_token;
    const refreshToken = creds.refresh_token;
    const expiresAt = creds.token_expires_at;

    // Refresh access token if expired (or within 60s of expiring)
    if ((!accessToken || Date.now() >= expiresAt - 60000) && refreshToken) {
      try {
        const refreshed = await refreshGscAccessToken(refreshToken);
        accessToken = refreshed.access_token;
        await saveGscCredentials(supabase, websiteId, user.id, {
          access_token: refreshed.access_token,
          expires_in: refreshed.expires_in,
        });
      } catch (refErr: any) {
        console.error("Failed to refresh GSC access token:", refErr);
        return NextResponse.json(
          { error: "Search Console authorization has expired. Please reconnect." },
          { status: 401 }
        );
      }
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing Search Console access token. Please reconnect your account." },
        { status: 401 }
      );
    }

    // Construct dynamic candidate URLs for fallback sites.get probe
    const canonicalPublicUrl = getWebsitePublicUrl(website);
    const fallbackCandidateUrls: string[] = [];

    if (canonicalPublicUrl) {
      fallbackCandidateUrls.push(`${canonicalPublicUrl}/`);
      fallbackCandidateUrls.push(canonicalPublicUrl);
      try {
        const u = new URL(canonicalPublicUrl);
        fallbackCandidateUrls.push(`sc-domain:${u.hostname}`);
      } catch (e) {}
    }

    // Call Google Search Console API for properties (with fallback candidate URLs for sites.get)
    const { properties, debug } = await fetchGscProperties(accessToken, fallbackCandidateUrls);
    console.log("GSC PROPERTIES PROBE DEBUG RESULTS:", JSON.stringify(debug, null, 2));

    return NextResponse.json({
      properties,
      debug,
      website: {
        id: website.id,
        title: website.title,
        slug: website.slug,
        custom_domain: website.custom_domain,
      },
    });
  } catch (err: any) {
    console.error("GET GSC Properties Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch Search Console properties." },
      { status: 500 }
    );
  }
}
