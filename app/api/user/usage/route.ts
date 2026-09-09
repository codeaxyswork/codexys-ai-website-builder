import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getUserUsage } from "@/lib/billing";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const usage = await getUserUsage(user.id);

    if (!usage) {
      return NextResponse.json(
        { error: "Failed to fetch user usage metrics." },
        { status: 500 }
      );
    }

    return NextResponse.json(usage);
  } catch (err: any) {
    console.error("Get Usage API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
