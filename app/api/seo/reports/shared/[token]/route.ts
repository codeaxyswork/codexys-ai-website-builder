import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/seo/reports/shared/[token]
 * Public Client View Access endpoint.
 * Allows clients to view white-labeled SEO reports via a secure shared token without login.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim().replace(/^["'\s]+|["'\s]+$/g, "");

    if (!supabaseUrl || !supabaseUrl.startsWith("http") || !anonKey || anonKey.length < 10) {
      console.error("[Shared Report Route Error] Missing or invalid Supabase public configuration. Failing closed.");
      return NextResponse.json(
        { error: "Configuration error: Supabase service is not properly configured." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, anonKey);

    const { data: reportRow, error } = await supabase
      .from("seo_reports")
      .select("*")
      .eq("share_token", token)
      .maybeSingle();

    if (error || !reportRow) {
      return NextResponse.json({ error: "Report link is invalid or expired." }, { status: 404 });
    }

    const reportData = reportRow.report_data || reportRow;

    return NextResponse.json({
      success: true,
      report: reportData,
    });
  } catch (err: any) {
    console.error("GET Shared Client Report Error:", err);
    return NextResponse.json({ error: "Failed to load shared report." }, { status: 500 });
  }
}
