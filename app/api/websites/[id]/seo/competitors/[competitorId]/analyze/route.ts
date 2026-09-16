import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { runCompetitorGapAnalysis } from "@/lib/seo-competitors/gap-engine";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; competitorId: string }> }
) {
  try {
    const { id: websiteId, competitorId } = await params;
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: competitor } = await supabase
      .from("seo_competitors")
      .select("id, domain")
      .eq("id", competitorId)
      .eq("website_id", websiteId)
      .single();

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    }

    // Set status to analyzing
    await supabase
      .from("seo_competitors")
      .update({ status: "analyzing" })
      .eq("id", competitorId);

    const analysis = await runCompetitorGapAnalysis(
      supabase,
      websiteId,
      user.id,
      competitorId,
      competitor.domain
    );

    return NextResponse.json({ success: true, analysis });
  } catch (err: any) {
    console.error("POST analyze competitor error:", err);
    return NextResponse.json({ error: err.message || "Failed to analyze competitor" }, { status: 500 });
  }
}
