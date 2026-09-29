import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  try {
    const { id: websiteId, reportId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: reportRow } = await supabase
      .from("seo_reports")
      .select("*")
      .eq("id", reportId)
      .eq("website_id", websiteId)
      .single();

    if (!reportRow) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      report: reportRow.report_data || reportRow,
    });
  } catch (err: any) {
    console.error("GET Single SEO Report Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch report details." }, { status: 500 });
  }
}
