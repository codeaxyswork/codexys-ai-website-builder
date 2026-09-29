import React from "react";
import { notFound, redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { MigratedEditorClient } from "@/components/migrated-editor/MigratedEditorClient";

interface MigratedEditorPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function MigratedEditorPage({ params }: MigratedEditorPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch website details, page metadata list, and initial page content in parallel
  const [websiteRes, pagesMetaRes, initialPageRes] = await Promise.all([
    supabase
      .from("websites")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("website_pages")
      .select("id, website_id, user_id, path, created_at")
      .eq("website_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("website_pages")
      .select("id, website_id, user_id, path, html_content, css_content, js_content, created_at")
      .eq("website_id", id)
      .or("path.eq.index.html,path.eq./")
      .limit(1)
      .maybeSingle(),
  ]);

  const website = websiteRes.data;
  if (!website) {
    notFound();
  }

  let pagesMeta = pagesMetaRes.data || [];
  if (!pagesMeta || pagesMeta.length === 0) {
    const adminDb = createAdminClient();
    const fallbackPagesRes = await adminDb
      .from("website_pages")
      .select("id, website_id, user_id, path, created_at")
      .eq("website_id", id)
      .order("created_at", { ascending: true });
    pagesMeta = fallbackPagesRes.data || [];
  }

  let initialPage = initialPageRes.data;
  if (!initialPage && pagesMeta.length > 0) {
    const firstPageId = pagesMeta[0].id;
    const adminDb = createAdminClient();
    const { data: firstPageData } = await adminDb
      .from("website_pages")
      .select("id, website_id, user_id, path, html_content, css_content, js_content, created_at")
      .eq("id", firstPageId)
      .maybeSingle();
    initialPage = firstPageData || null;
  }

  // Populate pages array with initial page full content, and metadata placeholders for secondary pages
  const pages = pagesMeta.map((p) => {
    if (initialPage && p.id === initialPage.id) {
      return initialPage;
    }
    return p;
  });

  return <MigratedEditorClient website={website} initialIndexPage={initialPage} initialPages={pages} />;
}
