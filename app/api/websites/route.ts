import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { deriveWebsiteTitle } from "@/lib/website-title-helper";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: rawWebsites, error } = await supabase
      .from("websites")
      .select("id, title, slug, prompt, design_plan, is_published, published_slug, custom_domain, custom_domain_verified, custom_domain_status, created_at, updated_at, website_seo(seo_score)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Fetch websites error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const websites = (rawWebsites || []).map((w) => {
      const derived = deriveWebsiteTitle(w.design_plan, null, w.prompt);
      const isTitleClean = w.title && w.title.length <= 45 && !w.title.toLowerCase().includes("see i don't") && !w.title.toLowerCase().includes("create a");
      return {
        ...w,
        title: isTitleClean ? w.title : derived,
      };
    });

    return NextResponse.json({ websites });
  } catch (err: any) {
    console.error("Get Websites API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch websites." },
      { status: 500 }
    );
  }
}
