import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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

    // Verify ownership
    const { data: website, error: websiteErr } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (websiteErr || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 404 }
      );
    }

    const { data: integrations } = await supabase
      .from("seo_integrations")
      .select("id, provider, status, configuration, connected_at, last_synced_at")
      .eq("website_id", websiteId);

    // Sanitize any potential secret fields in configuration before sending to client
    const safeIntegrations = (integrations || []).map((item) => {
      const config = { ...(item.configuration || {}) };
      delete config.client_secret;
      delete config.access_token;
      delete config.refresh_token;
      delete config.api_key;
      return {
        ...item,
        configuration: config,
      };
    });

    return NextResponse.json({ integrations: safeIntegrations });
  } catch (err: any) {
    console.error("GET SEO Integrations Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch integrations." },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    // Verify ownership
    const { data: website, error: websiteErr } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (websiteErr || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { provider, status, configuration } = body;

    if (!provider) {
      return NextResponse.json(
        { error: "Provider is required." },
        { status: 400 }
      );
    }

    const allowedProviders = [
      "google_analytics",
      "google_tag_manager",
      "google_search_console",
      "semrush",
      "ahrefs",
    ];

    if (!allowedProviders.includes(provider)) {
      return NextResponse.json(
        { error: "Invalid provider specified." },
        { status: 400 }
      );
    }

    const payload = {
      website_id: websiteId,
      user_id: user.id,
      provider,
      status: status || "disconnected",
      configuration: configuration || {},
      connected_at: status === "connected" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: upsertErr } = await supabase
      .from("seo_integrations")
      .upsert(payload, { onConflict: "website_id,provider" })
      .select()
      .single();

    if (upsertErr) {
      console.error("Upsert Integration Error:", upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      integration: updated,
      message: `${provider} integration updated.`,
    });
  } catch (err: any) {
    console.error("PUT SEO Integrations Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to update integration." },
      { status: 500 }
    );
  }
}
