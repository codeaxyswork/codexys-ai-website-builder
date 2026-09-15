import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateLocalBusinessSchema } from "@/lib/local-seo-engine";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await props.params;
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify website ownership
    const { data: website, error: siteError } = await supabase
      .from("websites")
      .select("id, user_id, title")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (siteError || !website) {
      return NextResponse.json({ error: "Website not found or access denied." }, { status: 404 });
    }

    // 3. Fetch Local SEO profile
    const { data: localRow } = await supabase
      .from("website_local_seo")
      .select("*")
      .eq("website_id", websiteId)
      .maybeSingle();

    if (!localRow) {
      return NextResponse.json({
        schema: null,
        message: "No Local Business profile configured yet.",
      });
    }

    const schemaObj = generateLocalBusinessSchema(localRow);

    return NextResponse.json({
      schema: schemaObj,
      formatted_json: schemaObj ? JSON.stringify(schemaObj, null, 2) : null,
    });
  } catch (err: any) {
    console.error("GET local schema error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}
