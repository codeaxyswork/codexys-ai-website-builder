import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { GeneratedFile, WebsitePlan } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required to save websites." }, { status: 401 });
    }

    const body = await req.json();
    const { websiteId, prompt, plan, files } = body as {
      websiteId?: string;
      prompt?: string;
      plan?: WebsitePlan;
      files?: GeneratedFile[];
    };

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided for website save." },
        { status: 400 }
      );
    }

    const htmlContent = files.find((f) => f.path.endsWith("index.html"))?.content || "";
    const cssContent = files.find((f) => f.path.endsWith("styles.css"))?.content || "";
    const jsContent = files.find((f) => f.path.endsWith("script.js"))?.content || "";

    // Generate title from plan or prompt
    let title = plan?.brandIdentity || plan?.websiteType || "My AI Website";
    if (title.length > 60) {
      title = title.substring(0, 57) + "...";
    }
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    
    const uniqueSuffix = Math.random().toString(36).substring(2, 7);
    const cleanSlug = `${baseSlug || "site"}-${uniqueSuffix}`;

    let targetWebsiteId = websiteId;

    if (targetWebsiteId) {
      // Update existing website
      const { error: updateError } = await supabase
        .from("websites")
        .update({
          title,
          prompt: prompt || "",
          design_plan: plan || {},
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetWebsiteId)
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Error updating website:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Update page contents
      const { error: pageError } = await supabase
        .from("website_pages")
        .update({
          html_content: htmlContent,
          css_content: cssContent,
          js_content: jsContent,
          updated_at: new Date().toISOString(),
        })
        .eq("website_id", targetWebsiteId)
        .eq("user_id", user.id);

      if (pageError) {
        // If page row didn't exist for some reason, insert it
        await supabase.from("website_pages").insert({
          website_id: targetWebsiteId,
          user_id: user.id,
          path: "index.html",
          html_content: htmlContent,
          css_content: cssContent,
          js_content: jsContent,
        });
      }
    } else {
      // Create new website with unique slug
      const { data: newWebsite, error: createError } = await supabase
        .from("websites")
        .insert({
          user_id: user.id,
          title,
          slug: cleanSlug,
          prompt: prompt || "",
          design_plan: plan || {},
        })
        .select("id")
        .single();

      if (createError || !newWebsite) {
        console.error("Error creating website in /api/websites/save:", createError);
        return NextResponse.json({ error: createError?.message || "Failed to create website in database." }, { status: 500 });
      }

      targetWebsiteId = newWebsite.id;

      // Insert index page
      await supabase.from("website_pages").insert({
        website_id: targetWebsiteId,
        user_id: user.id,
        path: "index.html",
        html_content: htmlContent,
        css_content: cssContent,
        js_content: jsContent,
      });
    }

    return NextResponse.json({
      success: true,
      websiteId: targetWebsiteId,
      title,
      slug: cleanSlug,
    });
  } catch (err: any) {
    console.error("Save Website Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to save website." },
      { status: 500 }
    );
  }
}
