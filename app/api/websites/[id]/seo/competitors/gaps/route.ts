import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { CompetitorGapItem } from "@/lib/seo-competitors/types";

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

    const { data: analyses } = await supabase
      .from("competitor_analyses")
      .select("content_gaps, data_source, created_at")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false });

    const allGaps: CompetitorGapItem[] = [];
    (analyses || []).forEach((a: any) => {
      if (Array.isArray(a.content_gaps)) {
        allGaps.push(...a.content_gaps);
      }
    });

    return NextResponse.json({ gaps: allGaps });
  } catch (err: any) {
    console.error("GET competitor gaps error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch competitor gaps" }, { status: 500 });
  }
}
