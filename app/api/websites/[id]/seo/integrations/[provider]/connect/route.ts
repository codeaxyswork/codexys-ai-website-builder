import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { connectThirdPartyProvider } from "@/lib/seo-integrations/framework";
import { getUserUsage } from "@/lib/billing";
import { canUseFeature } from "@/lib/features";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string; provider: string }> }
) {
  try {
    const { id: websiteId, provider: providerId } = await props.params;
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Server-side Agency entitlement check
    const usage = await getUserUsage(user.id, supabase);
    const planId = (usage?.plan?.id || "free").toLowerCase().trim();
    if (!canUseFeature(planId, "advanced_integrations")) {
      return NextResponse.json(
        {
          error: "Third-party SEO integrations require an active Agency subscription plan.",
          code: "UPGRADE_REQUIRED",
          requiredTier: "agency",
        },
        { status: 403 }
      );
    }

    // 3. Verify website ownership
    const { data: website, error: siteError } = await supabase
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteError || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    const credentials = await req.json();
    const result = await connectThirdPartyProvider(
      supabase,
      websiteId,
      user.id,
      providerId,
      credentials
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error(`POST connect provider (${err.message}) error:`, err);
    return NextResponse.json({ error: err.message || "Failed to connect provider." }, { status: 500 });
  }
}
