import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  queryGscSearchAnalytics,
  refreshGscAccessToken,
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
      .select("id, title")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteErr || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    // Fetch active GSC integration metadata
    const { data: integration } = await supabase
      .from("seo_integrations")
      .select("id, configuration, status")
      .eq("website_id", websiteId)
      .eq("provider", "google_search_console")
      .single();

    if (!integration || !integration.configuration) {
      return NextResponse.json(
        { error: "Google Search Console is not connected for this website." },
        { status: 400 }
      );
    }

    const config = integration.configuration;
    const selectedProperty = config.selected_property;

    if (!selectedProperty) {
      return NextResponse.json(
        { error: "No Search Console property has been selected for this website." },
        { status: 400 }
      );
    }

    // Load server-only OAuth credentials
    const creds = await loadGscCredentials(supabase, websiteId);
    let accessToken = creds.access_token;
    const refreshToken = creds.refresh_token;
    const expiresAt = creds.token_expires_at;

    // Refresh access token if needed
    if ((!accessToken || Date.now() >= expiresAt - 60000) && refreshToken) {
      try {
        const refreshed = await refreshGscAccessToken(refreshToken);
        accessToken = refreshed.access_token;
        await saveGscCredentials(supabase, websiteId, user.id, {
          access_token: refreshed.access_token,
          expires_in: refreshed.expires_in,
        });
      } catch (refErr: any) {
        return NextResponse.json(
          { error: "Google Search Console authorization expired. Please reconnect." },
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

    // Determine 28-day date window
    const now = new Date();
    const endDate = new Date(now.setDate(now.getDate() - 1)).toISOString().split("T")[0];
    const startDateObj = new Date();
    startDateObj.setDate(startDateObj.getDate() - 28);
    const startDate = startDateObj.toISOString().split("T")[0];

    const recordsToUpsert: any[] = [];
    const syncedAt = new Date().toISOString();

    // 1. Fetch Daily Date Aggregate Totals
    const dateRows = await queryGscSearchAnalytics(accessToken, selectedProperty, {
      startDate,
      endDate,
      dimensions: ["date"],
      rowLimit: 100,
    });

    for (const row of dateRows) {
      const dateVal = row.keys?.[0] || startDate;
      recordsToUpsert.push({
        website_id: websiteId,
        user_id: user.id,
        gsc_property: selectedProperty,
        date: dateVal,
        dimension_type: "overall",
        dimension_value: "total",
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
        synced_at: syncedAt,
      });
    }

    // 2. Fetch Top Queries
    const queryRows = await queryGscSearchAnalytics(accessToken, selectedProperty, {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: 100,
    });

    for (const row of queryRows) {
      const queryVal = row.keys?.[0] || "";
      if (!queryVal) continue;
      recordsToUpsert.push({
        website_id: websiteId,
        user_id: user.id,
        gsc_property: selectedProperty,
        date: endDate,
        dimension_type: "query",
        dimension_value: queryVal,
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
        synced_at: syncedAt,
      });
    }

    // 3. Fetch Top Pages
    const pageRows = await queryGscSearchAnalytics(accessToken, selectedProperty, {
      startDate,
      endDate,
      dimensions: ["page"],
      rowLimit: 100,
    });

    for (const row of pageRows) {
      const pageVal = row.keys?.[0] || "";
      if (!pageVal) continue;
      recordsToUpsert.push({
        website_id: websiteId,
        user_id: user.id,
        gsc_property: selectedProperty,
        date: endDate,
        dimension_type: "page",
        dimension_value: pageVal,
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
        synced_at: syncedAt,
      });
    }

    // 4. Upsert records into cached table in batches of 50
    if (recordsToUpsert.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < recordsToUpsert.length; i += BATCH_SIZE) {
        const batch = recordsToUpsert.slice(i, i + BATCH_SIZE);
        const { error: upsertErr } = await supabase
          .from("gsc_search_analytics")
          .upsert(batch, {
            onConflict: "website_id,gsc_property,date,dimension_type,dimension_value",
          });

        if (upsertErr) {
          console.error("Failed to batch upsert GSC analytics cache:", upsertErr);
        }
      }
    }

    // 5. Update last_synced_at timestamp on seo_integrations
    await supabase
      .from("seo_integrations")
      .update({
        last_synced_at: syncedAt,
        status: "connected",
        updated_at: syncedAt,
      })
      .eq("website_id", websiteId)
      .eq("provider", "google_search_console");

    return NextResponse.json({
      message: "Search Console data synchronized successfully.",
      synced_at: syncedAt,
      stats: {
        date_records: dateRows.length,
        query_records: queryRows.length,
        page_records: pageRows.length,
        total_cached_rows: recordsToUpsert.length,
      },
    });
  } catch (err: any) {
    console.error("GSC Sync Error:", err);
    return NextResponse.json(
      { error: err?.message || "Search Console data could not be synced right now. Please try again." },
      { status: 500 }
    );
  }
}
