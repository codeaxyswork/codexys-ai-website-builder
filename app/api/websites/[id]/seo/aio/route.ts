import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { runAIOAnalysisEngine } from "@/lib/seo-aio/engine";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await runAIOAnalysisEngine(supabase, websiteId, user.id);

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    console.error("GET AIO API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch AIO analysis." },
      { status: 500 }
    );
  }
}
