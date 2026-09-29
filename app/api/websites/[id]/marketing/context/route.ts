import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { buildMarketingBusinessContext } from "@/lib/marketing/business-context";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;

    if (!websiteId) {
      return NextResponse.json({ error: "websiteId is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    // Server-side website ownership validation
    const { data: website, error: webErr } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (webErr || !website) {
      return NextResponse.json(
        { error: "Website not found or unauthorized access." },
        { status: 403 }
      );
    }

    // Build read-only normalized business context from existing DB tables
    const context = await buildMarketingBusinessContext(supabase, websiteId);

    return NextResponse.json({
      success: true,
      data: context,
    });
  } catch (error: any) {
    console.error("API /api/websites/[id]/marketing/context GET Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to build Marketing Business Context." },
      { status: 500 }
    );
  }
}
