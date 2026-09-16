import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { runOpportunityScan } from "@/lib/seo-opportunities/engine";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/websites/[id]/seo/opportunities
 * Returns open & active opportunities, summary counts (Critical/High/Medium/Low), and filters.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check website ownership
    const { data: website } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (!website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");

    let query = supabase
      .from("seo_opportunities")
      .select("*")
      .eq("website_id", websiteId)
      .order("priority_score", { ascending: false });

    if (category) {
      query = query.eq("category", category);
    }

    if (status) {
      query = query.eq("status", status);
    } else {
      // Default: exclude dismissed unless explicitly requested
      query = query.neq("status", "dismissed");
    }

    const { data: opportunities, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate Summary Counts
    const allOpps = opportunities || [];
    const summary = {
      total: allOpps.length,
      critical: allOpps.filter((o) => o.priority === "Critical").length,
      high: allOpps.filter((o) => o.priority === "High").length,
      medium: allOpps.filter((o) => o.priority === "Medium").length,
      low: allOpps.filter((o) => o.priority === "Low").length,
    };

    return NextResponse.json({
      success: true,
      summary,
      opportunities: allOpps,
    });
  } catch (err: any) {
    console.error("GET Opportunities Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch opportunities." }, { status: 500 });
  }
}

/**
 * POST /api/websites/[id]/seo/opportunities
 * Triggers a manual opportunity scan cycle across website audit, GSC, blog, links, local SEO & integrations.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check website ownership
    const { data: website } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (!website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    const scanResult = await runOpportunityScan(supabase, websiteId, user.id);

    return NextResponse.json({
      success: true,
      scanResult,
    });
  } catch (err: any) {
    console.error("POST Opportunities Scan Error:", err);
    return NextResponse.json({ error: err.message || "Failed to run opportunity scan." }, { status: 500 });
  }
}
