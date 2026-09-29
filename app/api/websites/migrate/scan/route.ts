import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { scanSourceWebsite, validateAndSanitizeUrl } from "@/lib/migration/scanner";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required to perform website migration scan." }, { status: 401 });
    }

    const body = await req.json();
    const { url } = body as { url?: string };

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Website URL is required for migration scan." }, { status: 400 });
    }

    // SSRF & URL Validation
    const urlCheck = await validateAndSanitizeUrl(url);
    if (!urlCheck.valid || !urlCheck.normalizedUrl) {
      return NextResponse.json({ error: urlCheck.error || "Invalid or disallowed URL provided." }, { status: 400 });
    }

    // Execute server-side scan & discovery (0 AI credits)
    const scan = await scanSourceWebsite(urlCheck.normalizedUrl);

    return NextResponse.json({
      success: true,
      scan,
    });
  } catch (err: any) {
    console.error("Migration Scan API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to complete website discovery scan." },
      { status: 500 }
    );
  }
}
