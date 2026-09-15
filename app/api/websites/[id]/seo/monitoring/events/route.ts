import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await props.params;
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify website ownership
    const { data: website, error: siteError } = await supabase
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteError || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    // 3. Query events
    const { data: events, error: eventsErr } = await supabase
      .from("seo_monitoring_events")
      .select("*")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (eventsErr) {
      console.error("GET monitoring events error:", eventsErr);
      return NextResponse.json({ error: eventsErr.message || "Failed to fetch events." }, { status: 500 });
    }

    return NextResponse.json({ events: events || [] });
  } catch (err: any) {
    console.error("GET monitoring events error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await props.params;
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify website ownership
    const { data: website, error: siteError } = await supabase
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteError || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    const body = await req.json();
    const { eventIds, markAllRead } = body;

    if (markAllRead) {
      await supabase
        .from("seo_monitoring_events")
        .update({ is_read: true })
        .eq("website_id", websiteId)
        .eq("user_id", user.id);
    } else if (Array.isArray(eventIds) && eventIds.length > 0) {
      await supabase
        .from("seo_monitoring_events")
        .update({ is_read: true })
        .eq("website_id", websiteId)
        .eq("user_id", user.id)
        .in("id", eventIds);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("PUT monitoring events error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}
