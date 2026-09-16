import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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
      .select("topic_coverage_score, topic_clusters, content_gaps, last_analyzed_at")
      .eq("website_id", websiteId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ topicalAuthority: existing });
    }

    const topicalResult = await runTopicalAuthorityAnalysis(supabase, websiteId, user.id);
    return NextResponse.json({ topicalAuthority: topicalResult });
  } catch (err: any) {
    console.error("GET Topical Authority Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch topical authority data" }, { status: 500 });
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

    const topicalResult = await runTopicalAuthorityAnalysis(supabase, websiteId, user.id);

    await supabase
      .from("website_aeo_analysis")
      .update({
        topic_coverage_score: topicalResult.topic_coverage_score,
        topic_clusters: topicalResult.topic_clusters,
        content_gaps: topicalResult.content_gaps,
        updated_at: new Date().toISOString(),
      })
      .eq("website_id", websiteId);

    return NextResponse.json({ success: true, topicalAuthority: topicalResult });
  } catch (err: any) {
    console.error("POST Topical Authority Error:", err);
    return NextResponse.json({ error: err.message || "Failed to update topical authority" }, { status: 500 });
  }
}
