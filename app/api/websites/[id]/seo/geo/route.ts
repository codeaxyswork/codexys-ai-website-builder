import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { runGEOAnalysis } from "@/lib/seo-geo/engine";

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

    const geoResult = await runGEOAnalysis(supabase, websiteId, user.id);

    return NextResponse.json({ geo: geoResult }, { status: 200 });
  } catch (err: any) {
    console.error("GET GEO API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch GEO analysis." },
      { status: 500 }
    );
  }
}
