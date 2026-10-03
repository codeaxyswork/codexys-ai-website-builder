import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getHistoricalVisibilityLogs } from "@/lib/ai-visibility";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;

    // 1. Authentication Check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized access. Please log in." },
        { status: 401 }
      );
    }

    // 2. Website Ownership Check (Tenant Isolation)
    const { data: website, error: websiteErr } = await supabase
      .from("websites")
      .select("id, user_id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (websiteErr || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 403 }
      );
    }

    // 3. Query Historical Logs via Persistence Layer
    const historySummary = await getHistoricalVisibilityLogs(supabase, websiteId, 50);

    return NextResponse.json({
      success: true,
      history: historySummary,
    });
  } catch (err: any) {
    console.error("AI Visibility History API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to retrieve AI visibility history." },
      { status: 500 }
    );
  }
}
