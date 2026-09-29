import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateSEOReport } from "@/lib/seo-reports/engine";

export async function GET(
  req: NextRequest,
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

    // Fetch generated reports for website
    const { data: reports } = await supabase
      .from("seo_reports")
      .select("*")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false });

    // Fetch white label config
    const { data: whiteLabel } = await supabase
      .from("seo_white_label_settings")
      .select("*")
      .eq("website_id", websiteId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      reports: reports?.map((r) => r.report_data || r) || [],
      whiteLabel: whiteLabel || null,
    });
  } catch (err: any) {
    console.error("GET SEO Reports Error:", err);
    return NextResponse.json({ error: err.message || "Failed to load SEO reports." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
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

    const body = await req.json().catch(() => ({}));
    const reportType = body.report_type || "weekly";

    const report = await generateSEOReport(supabase, websiteId, user.id, reportType);

    return NextResponse.json({
      success: true,
      report,
      message: `Generated new ${reportType} SEO report successfully.`,
    });
  } catch (err: any) {
    console.error("POST SEO Report Generation Error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate SEO report." }, { status: 500 });
  }
}
