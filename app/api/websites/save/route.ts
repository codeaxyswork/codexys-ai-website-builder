import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server";
import { GeneratedFile, WebsitePlan } from "../../../../lib/types";
import { deriveWebsiteTitle } from "../../../../lib/website-title-helper";

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

    const htmlFiles = files.filter((f) => f.path.endsWith(".html") || f.path.endsWith(".htm"));
    const primaryCss =
      files.find((f) => f.path.endsWith("styles.css"))?.content ||
      files.find((f) => f.path.endsWith("style.css"))?.content ||
      files.find((f) => f.path.endsWith(".css"))?.content ||
      "";
    const primaryJs =
      files.find((f) => f.path.endsWith("script.js"))?.content ||
      files.find((f) => f.path.endsWith("main.js"))?.content ||
      files.find((f) => f.path.endsWith(".js"))?.content ||
      "";

    // Embed full file manifest in design_plan for lossless multi-page & asset recovery
    const fullPlan = {
      ...(plan || {}),
      _raw_files: files,
    };

    // Generate clean website title
    let title = deriveWebsiteTitle(plan, files, prompt);
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
      // 1. Validate ownership before updating
      const { data: existingWebsite, error: checkError } = await supabase
        .from("websites")
        .select("id, user_id")
        .eq("id", targetWebsiteId)
        .maybeSingle();

      if (checkError || !existingWebsite) {
        return NextResponse.json({ error: "Website not found." }, { status: 404 });
      }

      if (existingWebsite.user_id !== user.id) {
        return NextResponse.json({ error: "Unauthorized access to website." }, { status: 403 });
      }

      // 2. Update existing website metadata and full plan
      const { error: updateError } = await supabase
        .from("websites")
        .update({
          title,
          prompt: prompt || "",
          design_plan: fullPlan,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetWebsiteId)
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Error updating website:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // 3. Upsert all HTML pages in website_pages
      for (const pageFile of htmlFiles) {
        const { data: existingPage } = await supabase
          .from("website_pages")
          .select("id")
          .eq("website_id", targetWebsiteId)
          .eq("path", pageFile.path)
          .maybeSingle();

        if (existingPage) {
          await supabase
            .from("website_pages")
            .update({
              html_content: pageFile.content,
              css_content: primaryCss,
              js_content: primaryJs,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingPage.id);
        } else {
          await supabase.from("website_pages").insert({
            website_id: targetWebsiteId,
            user_id: user.id,
            path: pageFile.path,
            html_content: pageFile.content,
            css_content: primaryCss,
            js_content: primaryJs,
          });
        }
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
          design_plan: fullPlan,
        })
        .select("id")
        .single();

      if (createError || !newWebsite) {
        console.error("Error creating website in /api/websites/save:", createError);
        return NextResponse.json({ error: createError?.message || "Failed to create website in database." }, { status: 500 });
      }

      targetWebsiteId = newWebsite.id;

      // Insert all pages in website_pages
      const pagesToInsert = htmlFiles.map((hf) => ({
        website_id: targetWebsiteId,
        user_id: user.id,
        path: hf.path,
        html_content: hf.content,
        css_content: primaryCss,
        js_content: primaryJs,
      }));

      if (pagesToInsert.length > 0) {
        await supabase.from("website_pages").insert(pagesToInsert);
      }
    }

    return NextResponse.json({
      success: true,
      websiteId: targetWebsiteId,
      title,
      slug: cleanSlug,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to save website.";
    console.error("Save Website Error:", err);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
