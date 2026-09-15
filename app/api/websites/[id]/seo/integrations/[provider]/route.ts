import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { disconnectThirdPartyProvider } from "@/lib/seo-integrations/framework";

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string; provider: string }> }
) {
  const { id: websiteId, provider: providerId } = await props.params;
  try {
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

    const result = await disconnectThirdPartyProvider(
      supabase,
      websiteId,
      user.id,
      providerId
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error(`DELETE disconnect provider (${providerId}) error:`, err);
    return NextResponse.json({ error: err.message || "Failed to disconnect provider." }, { status: 500 });
  }
}
