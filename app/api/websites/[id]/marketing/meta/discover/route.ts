import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  loadMetaConnection,
  fetchMetaAdAccounts,
  fetchMetaPages,
  persistDiscoveredMetaAssets,
  getWebsiteMetaAssets,
} from "@/lib/marketing/meta-client";

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

    // Server-side website ownership validation
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

    // Load encrypted connection server-side
    const connection = await loadMetaConnection(supabase, websiteId);

    if (!connection || connection.status !== "connected" || !connection.access_token) {
      return NextResponse.json(
        {
          error: "Meta account is not connected. Please connect Meta Ads first.",
          reauthRequired: true,
        },
        { status: 400 }
      );
    }

    if (connection.token_expires_at > 0 && Date.now() >= connection.token_expires_at) {
      return NextResponse.json(
        {
          error: "Meta authorization token has expired. Please reconnect your Meta account.",
          reauthRequired: true,
        },
        { status: 401 }
      );
    }

    // Execute server-side Meta Graph API calls using decrypted access token
    let adAccounts: any[] = [];
    let pages: any[] = [];
    let instagramAccounts: any[] = [];
    let adAccountsError: string | null = null;
    let pagesError: string | null = null;

    try {
      adAccounts = await fetchMetaAdAccounts(connection.access_token);
    } catch (err: any) {
      console.error("Ad accounts discovery error:", err.message);
      adAccountsError = err.message || "Failed to fetch Meta Ad Accounts.";
    }

    try {
      const pageRes = await fetchMetaPages(connection.access_token);
      pages = pageRes.pages;
      instagramAccounts = pageRes.instagramAccounts;
    } catch (err: any) {
      console.error("Pages discovery error:", err.message);
      pagesError = err.message || "Failed to fetch Facebook Pages.";
    }

    // Persist discovered assets into DB safely under user_id + website_id
    await persistDiscoveredMetaAssets(
      supabase,
      websiteId,
      user.id,
      adAccounts,
      pages,
      instagramAccounts
    );

    // Retrieve refreshed asset selections
    const assetData = await getWebsiteMetaAssets(supabase, websiteId);

    return NextResponse.json({
      success: true,
      message: "Meta assets discovered and synced successfully.",
      data: assetData,
      warnings: {
        adAccountsError,
        pagesError,
      },
    });
  } catch (error: any) {
    console.error("API /api/websites/[id]/marketing/meta/discover POST Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to discover Meta assets." },
      { status: 500 }
    );
  }
}
