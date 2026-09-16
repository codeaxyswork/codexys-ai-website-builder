import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { runAEOAnalysis } from "@/lib/seo-aeo/engine";
import { runTopicalAuthorityAnalysis } from "@/lib/seo-aeo/topical-authority";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
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

    const { data: existing } = await supabase
      .from("website_aeo_analysis")
      .select("*")
      .eq("website_id", websiteId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ analysis: existing });
    }

    // Run initial scan if none exists
    const aeoResult = await runAEOAnalysis(supabase, websiteId, user.id);
    const topicalResult = await runTopicalAuthorityAnalysis(supabase, websiteId, user.id);

    const mergedPayload = {
      ...aeoResult,
      topic_coverage_score: topicalResult.topic_coverage_score,
      topic_clusters: topicalResult.topic_clusters,
      content_gaps: topicalResult.content_gaps,
    };

    await supabase.from("website_aeo_analysis").upsert(mergedPayload);

    return NextResponse.json({ analysis: mergedPayload });
  } catch (err: any) {
    console.error("GET AEO Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch AEO data" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
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

    const aeoResult = await runAEOAnalysis(supabase, websiteId, user.id);
    const topicalResult = await runTopicalAuthorityAnalysis(supabase, websiteId, user.id);

    const mergedPayload = {
      ...aeoResult,
      topic_coverage_score: topicalResult.topic_coverage_score,
      topic_clusters: topicalResult.topic_clusters,
      content_gaps: topicalResult.content_gaps,
    };

    await supabase.from("website_aeo_analysis").upsert(mergedPayload);

    return NextResponse.json({ success: true, analysis: mergedPayload });
  } catch (err: any) {
    console.error("POST AEO Error:", err);
    return NextResponse.json({ error: err.message || "Failed to run AEO scan" }, { status: 500 });
  }
}
