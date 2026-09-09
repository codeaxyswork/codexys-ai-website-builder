import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const adminCtx = await requireAdmin();
    if (!adminCtx) {
      return NextResponse.json({ error: "Unauthorized access denied." }, { status: 403 });
    }

    const supabase = await createClient();

    // Fetch profiles
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role, status, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    // Fetch subscriptions
    const { data: subs } = await supabase.from("subscriptions").select("user_id, plan_id, status");

    // Fetch user credits
    const { data: credits } = await supabase.from("user_credits").select("user_id, balance, monthly_used, lifetime_used");

    // Fetch website counts
    const { data: websites } = await supabase.from("websites").select("user_id, id");

    // Fetch media asset storage totals
    const { data: media } = await supabase.from("media_assets").select("user_id, file_size_bytes");

    const usersDetailed = (profiles || []).map((p) => {
      const sub = (subs || []).find((s) => s.user_id === p.id);
      const cred = (credits || []).find((c) => c.user_id === p.id);
      const userWebsites = (websites || []).filter((w) => w.user_id === p.id);
      const userMedia = (media || []).filter((m) => m.user_id === p.id);
      const storageBytes = userMedia.reduce((sum, m) => sum + (Number(m.file_size_bytes) || 0), 0);

      return {
        id: p.id,
        full_name: p.full_name || "User",
        role: p.role || "user",
        status: p.status || "active",
        plan_id: sub?.plan_id || "free",
        credits_balance: cred?.balance ?? 50,
        website_count: userWebsites.length,
        storage_bytes: storageBytes,
        created_at: p.created_at,
      };
    });

    return NextResponse.json({ users: usersDetailed });
  } catch (err: any) {
    console.error("GET Admin Users Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch users." }, { status: 500 });
  }
}
