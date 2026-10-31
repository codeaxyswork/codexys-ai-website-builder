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

    interface RawWebsiteRecord {
      id: string;
      title?: string | null;
      slug: string;
      prompt?: string | null;
      design_plan?: unknown;
      is_published?: boolean | null;
      published_slug?: string | null;
      custom_domain?: string | null;
      custom_domain_verified?: boolean | null;
      custom_domain_status?: string | null;
      created_at: string;
      updated_at: string;
      website_seo?: unknown;
      [key: string]: unknown;
    }

    const websites = (rawWebsites || []).map((w: RawWebsiteRecord) => {
      const derived = deriveWebsiteTitle(w.design_plan as any, null, w.prompt || undefined);
      const titleStr = typeof w.title === "string" ? w.title : "";
      const isTitleClean = titleStr && titleStr.length <= 45 && !titleStr.toLowerCase().includes("see i don't") && !titleStr.toLowerCase().includes("create a");
      return {
        ...w,
        title: isTitleClean ? titleStr : derived,
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
