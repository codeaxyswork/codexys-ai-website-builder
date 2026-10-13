import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { GeneratedFile } from "@/lib/types";
import { deriveWebsiteTitle } from "@/lib/website-title-helper";
import { deleteProjectUniversally } from "@/lib/projects/project-deletion-service";

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
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to fetch website detail.";
    console.error("Get Website Detail Error:", err);
    return NextResponse.json(
      { error: errorMsg },
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

    const dbClient = createAdminClient();

    // 2. Delegate to Universal Project Deletion Service
    const report = await deleteProjectUniversally({
      websiteId: id,
      userId: user.id,
      userClient,
      dbClient,
    });

    if (!report.cleanupCompleted) {
      if (report.errors.some((e) => e.includes("Ownership verification failed") || e.includes("Website not found"))) {
        return NextResponse.json(
          { error: "Website not found or access denied." },
          { status: 404 }
        );
      }

      console.error(`[UNIVERSAL_DELETE_FAILURE] Website ${id}:`, report.errors, report.remainingOrphanedResources);
      return NextResponse.json(
        {
          error: "Failed to delete website completely. Required resources remain or storage error occurred.",
          details: report.errors,
          orphanedResources: report.remainingOrphanedResources,
          report,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedWebsiteId: id,
      message: `Website '${report.websiteTitle}' and all associated pages, media, and assets deleted successfully.`,
      report,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to delete website.";
    console.error("Delete Website Error:", err);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
