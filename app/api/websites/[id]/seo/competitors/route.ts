import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { normalizeCompetitorDomain, isValidDomain } from "@/lib/seo-competitors/crawler";

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

    const { data: competitors, error } = await supabase
      .from("seo_competitors")
      .select("*")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ competitors: competitors || [] });
  } catch (err: any) {
    console.error("GET competitors error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch competitors" }, { status: 500 });
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

    const body = await request.json();
    const rawDomain = body.domain;
    const name = body.name || null;

    const normalizedDomain = normalizeCompetitorDomain(rawDomain);
    if (!isValidDomain(normalizedDomain)) {
      return NextResponse.json(
        { error: "Invalid domain format. Example: competitor.com" },
        { status: 400 }
      );
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from("seo_competitors")
      .select("id")
      .eq("website_id", websiteId)
      .eq("domain", normalizedDomain)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Competitor domain is already tracked for this website." },
        { status: 400 }
      );
    }

    const { data: inserted, error } = await supabase
      .from("seo_competitors")
      .insert({
        website_id: websiteId,
        user_id: user.id,
        domain: normalizedDomain,
        name: name || normalizedDomain,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ competitor: inserted }, { status: 201 });
  } catch (err: any) {
    console.error("POST competitor error:", err);
    return NextResponse.json({ error: err.message || "Failed to add competitor" }, { status: 500 });
  }
}
