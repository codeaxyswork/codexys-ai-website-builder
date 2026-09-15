import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getWebsiteThirdPartyIntegrations, submitIntegrationRequest } from "@/lib/seo-integrations/framework";

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

    // 3. Fetch third-party integrations & supported providers
    const { connectedIntegrations, supportedProviders } = await getWebsiteThirdPartyIntegrations(
      supabase,
      websiteId,
      user.id
    );

    return NextResponse.json({
      integrations: connectedIntegrations,
      supportedProviders,
    });
  } catch (err: any) {
    console.error("GET integrations error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}

export async function POST(
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
    const result = await submitIntegrationRequest(supabase, user.id, websiteId, body);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("POST request integration error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}
