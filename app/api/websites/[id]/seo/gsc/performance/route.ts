import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteErr || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    // Check GSC integration status
    const { data: integration } = await supabase
      .from("seo_integrations")
      .select("id, status, configuration, last_synced_at, connected_at")
      .eq("website_id", websiteId)
      .eq("provider", "google_search_console")
      .single();

    if (!integration || integration.status !== "connected" || !integration.configuration?.selected_property) {
      return NextResponse.json({
        connected: false,
        status: integration?.status || "disconnected",
        gsc_property: integration?.configuration?.selected_property || null,
        property_verified: integration?.configuration?.property_verified || false,
        last_synced_at: integration?.last_synced_at || null,
        totals: null,
        daily_trends: [],
        queries: [],
        pages: [],
      });
    }

    const config = integration.configuration;
    const selectedProperty = config.selected_property;

    // Fetch cached analytics rows
    const { data: analyticsRows, error: analyticsErr } = await supabase
      .from("gsc_search_analytics")
      .select("gsc_property, date, dimension_type, dimension_value, clicks, impressions, ctr, position, synced_at")
      .eq("website_id", websiteId)
      .order("date", { ascending: true });

    if (analyticsErr) {
      console.error("Failed to query gsc_search_analytics:", analyticsErr);
      return NextResponse.json(
        { error: "Failed to load cached performance analytics." },
        { status: 500 }
      );
    }

    const rows = analyticsRows || [];

    // Separate dimensions
    const dailyTrendRows = rows.filter((r) => r.dimension_type === "overall");
    const queryRows = rows.filter((r) => r.dimension_type === "query");
    const pageRows = rows.filter((r) => r.dimension_type === "page");

    // Aggregate totals across daily trends
    let totalClicks = 0;
    let totalImpressions = 0;
    let weightedPositionSum = 0;

    const dailyTrends = dailyTrendRows.map((r) => {
      totalClicks += Number(r.clicks) || 0;
      totalImpressions += Number(r.impressions) || 0;
      weightedPositionSum += (Number(r.position) || 0) * (Number(r.impressions) || 1);

      return {
        date: r.date,
        clicks: Number(r.clicks) || 0,
        impressions: Number(r.impressions) || 0,
        ctr: Number(r.ctr) || 0,
        position: Number(r.position) || 0,
      };
    });

    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgPosition = totalImpressions > 0 ? weightedPositionSum / totalImpressions : 0;

    const formattedQueries = queryRows
      .map((r) => ({
        query: r.dimension_value,
        clicks: Number(r.clicks) || 0,
        impressions: Number(r.impressions) || 0,
        ctr: Number(r.ctr) || 0,
        position: Number(r.position) || 0,
      }))
      .sort((a, b) => b.clicks - a.clicks);

    const formattedPages = pageRows
      .map((r) => ({
        page: r.dimension_value,
        clicks: Number(r.clicks) || 0,
        impressions: Number(r.impressions) || 0,
        ctr: Number(r.ctr) || 0,
        position: Number(r.position) || 0,
      }))
      .sort((a, b) => b.clicks - a.clicks);

    return NextResponse.json({
      connected: true,
      status: "connected",
      gsc_property: selectedProperty,
      property_verified: !!config.property_verified,
      last_synced_at: integration.last_synced_at || null,
      totals: {
        clicks: totalClicks,
        impressions: totalImpressions,
        ctr: Number(avgCtr.toFixed(2)),
        position: Number(avgPosition.toFixed(1)),
      },
      daily_trends: dailyTrends,
      queries: formattedQueries,
      pages: formattedPages,
    });
  } catch (err: any) {
    console.error("GET Performance Analytics Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch performance data." },
      { status: 500 }
    );
  }
}
