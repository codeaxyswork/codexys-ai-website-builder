import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getMetaAuthUrl } from "@/lib/marketing/meta-client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;

    if (!websiteId) {
      return NextResponse.json({ error: "websiteId is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    // Verify website ownership
    const { data: website, error: webErr } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (webErr || !website) {
      return NextResponse.json(
        { error: "Website not found or unauthorized access." },
        { status: 403 }
      );
    }

    const reqUrl = req.url;
    const origin = new URL(reqUrl).origin;

    const authUrl = getMetaAuthUrl(websiteId, user.id, origin);

    console.log("[META_OAUTH_CONNECT_ROUTE] Dispatching OAuth authorization URL to client:", {
      websiteId,
      userId: user.id,
      authUrl,
    });

    return NextResponse.json({
      success: true,
      websiteId,
      authUrl,
    });
  } catch (error: any) {
    const isMissingClientId = error?.message?.includes("META_CLIENT_ID") || error?.message?.includes("META_APP_ID");
    console.warn("Meta OAuth Diagnostic:", {
      source: "meta-connect",
      reason: isMissingClientId ? "missing_meta_client_id" : "auth_url_generation_failed",
    });
    return NextResponse.json(
      { error: error?.message || "Failed to initiate Meta OAuth connection." },
      { status: 500 }
    );
  }
}
