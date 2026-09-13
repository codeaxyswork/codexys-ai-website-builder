import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getGscAuthUrl } from "@/lib/gsc-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get("website_id");
    const autoRedirect = searchParams.get("redirect") === "1";

    if (!websiteId) {
      return NextResponse.json({ error: "website_id parameter is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify website ownership server-side
    const { data: website, error: siteErr } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteErr || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    // Determine application base URL
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    try {
      const authUrl = getGscAuthUrl(websiteId, user.id, appUrl);
      if (autoRedirect) {
        return NextResponse.redirect(authUrl);
      }
      return NextResponse.json({ auth_url: authUrl });
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message || "Failed to generate Google Search Console authentication URL." },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("GSC Connect Endpoint Error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error." }, { status: 500 });
  }
}
