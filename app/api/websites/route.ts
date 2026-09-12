import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: websites, error } = await supabase
      .from("websites")
      .select("id, title, slug, prompt, design_plan, is_published, published_slug, custom_domain, custom_domain_verified, custom_domain_status, created_at, updated_at, website_seo(seo_score)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Fetch websites error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ websites: websites || [] });
  } catch (err: any) {
    console.error("Get Websites API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch websites." },
      { status: 500 }
    );
  }
}
