import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(
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

    const body = await req.json();
    const { opportunityId, sourcePath, destinationPath, suggestedAnchor } = body || {};

    if (!sourcePath || !destinationPath || !suggestedAnchor) {
      return NextResponse.json({ error: "Missing required internal link parameters." }, { status: 400 });
    }

    const targetUrl = destinationPath.startsWith("/") ? destinationPath : `/${destinationPath}`;
    const linkHtml = `<a href="${targetUrl}">${escapeHTML(suggestedAnchor)}</a>`;

    // Case A: Source is a blog article
    if (sourcePath.startsWith("blog/")) {
      const slug = sourcePath.replace(/^blog\//, "");
      const { data: blog, error: blogErr } = await supabase
        .from("blog_posts")
        .select("id, content")
        .eq("website_id", websiteId)
        .eq("slug", slug)
        .single();

      if (!blogErr && blog) {
        let updatedContent = blog.content || "";
        const keywordRegex = new RegExp(`\\b(${escapeRegExp(suggestedAnchor)})\\b`, "i");

        if (keywordRegex.test(updatedContent) && !updatedContent.includes(targetUrl)) {
          updatedContent = updatedContent.replace(keywordRegex, `<a href="${targetUrl}">$1</a>`);
        } else if (!updatedContent.includes(targetUrl)) {
          updatedContent += `\n<p className="mt-4 text-sm font-medium">Related reading: ${linkHtml}</p>`;
        }

        await supabase
          .from("blog_posts")
          .update({ content: updatedContent, updated_at: new Date().toISOString() })
          .eq("id", blog.id);
      }
    } else {
      // Case B: Source is a standard website page
      const cleanPath = sourcePath === "index.html" || sourcePath === "" ? "index.html" : sourcePath;
      const { data: pageRow } = await supabase
        .from("website_pages")
        .select("id, html_content")
        .eq("website_id", websiteId)
        .eq("path", cleanPath)
        .maybeSingle();

      if (pageRow) {
        let updatedHtml = pageRow.html_content || "";
        const keywordRegex = new RegExp(`\\b(${escapeRegExp(suggestedAnchor)})\\b`, "i");

        if (keywordRegex.test(updatedHtml) && !updatedHtml.includes(targetUrl)) {
          updatedHtml = updatedHtml.replace(keywordRegex, `<a href="${targetUrl}">$1</a>`);
        } else if (!updatedHtml.includes(targetUrl)) {
          if (updatedHtml.includes("</body>")) {
            updatedHtml = updatedHtml.replace(
              "</body>",
              `<div class="container mx-auto my-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm"><p>Explore more: ${linkHtml}</p></div></body>`
            );
          } else {
            updatedHtml += `<p>Explore more: ${linkHtml}</p>`;
          }
        }

        await supabase
          .from("website_pages")
          .update({ html_content: updatedHtml, updated_at: new Date().toISOString() })
          .eq("id", pageRow.id);
      }
    }

    // Remove applied opportunity from website_internal_links table
    const { data: linkRow } = await supabase
      .from("website_internal_links")
      .select("opportunities")
      .eq("website_id", websiteId)
      .maybeSingle();

    if (linkRow && Array.isArray(linkRow.opportunities)) {
      const remaining = linkRow.opportunities.filter((o: any) => o.id !== opportunityId);
      await supabase
        .from("website_internal_links")
        .update({ opportunities: remaining, updated_at: new Date().toISOString() })
        .eq("website_id", websiteId);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully applied internal link fix: ${sourcePath} → ${destinationPath}`,
    });
  } catch (err: any) {
    console.error("Apply internal-link fix error:", err);
    return NextResponse.json({ error: err.message || "Failed to apply internal link fix." }, { status: 500 });
  }
}

function escapeHTML(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
