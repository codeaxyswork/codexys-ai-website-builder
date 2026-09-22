import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getGoogleAdsAuthUrl } from "@/lib/google-ads-client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const websiteId = searchParams.get("website_id");
    const redirectDirect = searchParams.get("redirect") === "1";

    if (!websiteId) {
      return NextResponse.json(
        { error: "website_id parameter is required." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to connect Google Ads." },
        { status: 401 }
      );
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

    const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || "https://codexys-ai-website-builder.vercel.app";
    const authUrl = getGoogleAdsAuthUrl(websiteId, user.id, origin);

    if (redirectDirect) {
      return NextResponse.redirect(authUrl);
    }

    return NextResponse.json({ url: authUrl });
  } catch (error: any) {
    console.error("API /api/seo/google-ads/connect Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate Google Ads OAuth authorization URL." },
      { status: 500 }
    );
  }
}
