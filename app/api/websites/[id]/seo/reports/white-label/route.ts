import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { saveWhiteLabelConfig } from "@/lib/seo-reports/engine";

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

    const { data: config } = await supabase
      .from("seo_white_label_settings")
      .select("*")
      .eq("website_id", websiteId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      whiteLabel: config || {
        agency_name: "Codeaxys Agency Suite",
        agency_logo_url: null,
        primary_color: "#7c3aed",
        custom_footer: "Powered by Codeaxys Enterprise SEO Intelligence Engine.",
        client_name: "Valued Client",
      },
    });
  } catch (err: any) {
    console.error("GET White Label Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch white label configuration." }, { status: 500 });
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

    const body = await req.json();

    const saved = await saveWhiteLabelConfig(supabase, websiteId, user.id, body);

    return NextResponse.json({
      success: true,
      whiteLabel: saved,
      message: "White label agency branding saved successfully.",
    });
  } catch (err: any) {
    console.error("POST White Label Save Error:", err);
    return NextResponse.json({ error: err.message || "Failed to save white label configuration." }, { status: 500 });
  }
}
