import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { testThirdPartyConnection } from "@/lib/seo-integrations/framework";

export async function POST(
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

    const testResult = await testThirdPartyConnection(
      supabase,
      websiteId,
      user.id,
      providerId
    );

    return NextResponse.json(testResult);
  } catch (err: any) {
    console.error(`POST test connection (${providerId}) error:`, err);
    return NextResponse.json({ error: err.message || "Failed to test connection." }, { status: 500 });
  }
}
