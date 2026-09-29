import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { GeneratedFile } from "@/lib/types";
import { deriveWebsiteTitle } from "@/lib/website-title-helper";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: website, error: webError } = await supabase
      .from("websites")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (webError || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 404 }
      );
    }

    const { data: pages } = await supabase
      .from("website_pages")
      .select("*")
      .eq("website_id", id)
      .eq("user_id", user.id);

    const mainPage = pages && pages.length > 0 ? pages[0] : null;

    const files: GeneratedFile[] = [
      { path: "index.html", content: mainPage?.html_content || "" },
      { path: "styles.css", content: mainPage?.css_content || "" },
      { path: "script.js", content: mainPage?.js_content || "" },
    ];

    const derivedTitle = deriveWebsiteTitle(website.design_plan, files, website.prompt);
    const isTitleClean = website.title && website.title.length <= 45 && !website.title.toLowerCase().includes("see i don't") && !website.title.toLowerCase().includes("create a");
    const cleanWebsite = {
      ...website,
      title: isTitleClean ? website.title : derivedTitle,
    };

    return NextResponse.json({
      website: cleanWebsite,
      plan: website.design_plan,
      prompt: website.prompt,
      files,
    });
  } catch (err: any) {
    console.error("Get Website Detail Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch website detail." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid website ID." }, { status: 400 });
    }

    const userClient = await createClient();

    // 1. Authenticate user
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify ownership & website existence
    const { data: website, error: fetchError } = await userClient
      .from("websites")
      .select("id, user_id, title")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 404 }
      );
    }

    const dbClient = createAdminClient();

    // 3. Storage Cleanup for this website's exclusive objects in 'website-assets'
    try {
      const storagePathsToDelete = new Set<string>();

      // A. Query media_assets table for storage_path belonging exclusively to website & user
      const { data: mediaRows } = await dbClient
        .from("media_assets")
        .select("storage_path")
        .eq("website_id", id)
        .eq("user_id", user.id);

      if (mediaRows && mediaRows.length > 0) {
        mediaRows.forEach((r: any) => {
          if (r.storage_path) storagePathsToDelete.add(r.storage_path);
        });
      }

      // B. List all storage objects in bucket 'website-assets' under prefix `${user.id}/${id}/`
      const websiteStoragePrefix = `${user.id}/${id}`;
      const { data: storageList } = await dbClient.storage
        .from("website-assets")
        .list(websiteStoragePrefix, { limit: 1000 });

      if (storageList && storageList.length > 0) {
        storageList.forEach((fileObj: any) => {
          if (fileObj.name) {
            storagePathsToDelete.add(`${websiteStoragePrefix}/${fileObj.name}`);
          }
        });
      }

      if (storagePathsToDelete.size > 0) {
        const pathArray = Array.from(storagePathsToDelete);
        const { error: storageDeleteErr } = await dbClient.storage
          .from("website-assets")
          .remove(pathArray);

        if (storageDeleteErr) {
          console.warn(`[STORAGE CLEANUP WARN] Failed to remove some storage objects for website ${id}:`, storageDeleteErr.message);
        } else {
          console.log(`[STORAGE CLEANUP] Removed ${pathArray.length} storage objects for website ${id}`);
        }
      }
    } catch (storageErr: any) {
      console.warn(`[STORAGE CLEANUP ERROR] Non-fatal storage cleanup issue for website ${id}:`, storageErr?.message);
    }

    // 4. Delete child records explicitly in dependency order
    const childTables = [
      "technical_crawl_issues", "technical_crawl_runs", "competitor_analyses",
      "seo_competitors", "content_refresh_runs", "content_revisions",
      "content_briefs", "seo_unified_scores", "website_aeo_analysis",
      "seo_autopilot_activity", "seo_autopilot_settings", "seo_opportunities",
      "website_third_party_seo_integrations", "seo_monitoring_events",
      "website_monitoring_schedules", "website_local_seo", "website_internal_links",
      "blog_posts", "gsc_search_analytics", "gsc_oauth_credentials",
      "seo_integrations", "seo_analysis_jobs", "seo_analysis_history",
      "website_page_seo", "website_seo", "media_assets", "website_pages",
      "ai_credit_transactions"
    ];

    for (const table of childTables) {
      await dbClient.from(table).delete().eq("website_id", id);
      await userClient.from(table).delete().eq("website_id", id);
    }

    // 5. Delete website parent row with explicit count verification
    let parentDeleted = false;

    // Attempt A: Delete using userClient (authenticated JWT session matching RLS auth.uid() = user_id)
    const { data: userDeletedRows } = await userClient
      .from("websites")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");

    if (userDeletedRows && userDeletedRows.length > 0) {
      parentDeleted = true;
    }

    // Attempt B: If userClient did not return deleted row, attempt with dbClient
    if (!parentDeleted) {
      const { data: adminDeletedRows } = await dbClient
        .from("websites")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id");

      if (adminDeletedRows && adminDeletedRows.length > 0) {
        parentDeleted = true;
      }
    }

    // 6. HARD PERSISTENCE VERIFICATION: Verify row NO LONGER EXISTS in database
    const { data: checkRow } = await dbClient
      .from("websites")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (checkRow) {
      // Row still exists! Check with userClient as secondary verification
      const { data: checkUserRow } = await userClient
        .from("websites")
        .select("id")
        .eq("id", id)
        .maybeSingle();

      if (checkUserRow) {
        console.error(`[DELETE HARD PERSISTENCE FAILURE] Website ${id} deletion failed: Row still exists in DB!`);
        return NextResponse.json(
          { error: "Failed to delete website from database. Deletion was not persistent." },
          { status: 500 }
        );
      }
    }

    // 7. Revalidate Next.js cache routes
    try {
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/websites");
      revalidatePath(`/dashboard/websites/${id}`);
    } catch (cacheErr) {
      console.warn("[CACHE REVALIDATE WARN]:", cacheErr);
    }

    return NextResponse.json({
      success: true,
      deletedWebsiteId: id,
      message: `Website '${website.title}' and all associated pages, media, and assets deleted successfully.`,
    });
  } catch (err: any) {
    console.error("Delete Website Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete website." },
      { status: 500 }
    );
  }
}
