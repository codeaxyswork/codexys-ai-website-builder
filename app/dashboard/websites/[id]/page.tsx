import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import {
  Globe,
  Wand2,
  Send,
  Search,
  Sliders,
  ExternalLink,
  ArrowLeft,
  Clock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  PlusCircle,
} from "lucide-react";
import { WebsiteManagementClient } from "./ManagementClient";

interface WebsiteManagementPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function WebsiteManagementPage({ params }: WebsiteManagementPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch website details, SEO settings, and live preview page in parallel
  const [websiteRes, seoRes, pageRes] = await Promise.all([
    supabase
      .from("websites")
      .select(`
        id,
        user_id,
        title,
        slug,
        prompt,
        design_plan,
        is_published,
        published_slug,
        custom_domain,
        custom_domain_verified,
        custom_domain_status,
        published_at,
        created_at,
        updated_at
      `)
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("website_seo")
      .select("seo_score, seo_title, meta_description, focus_keywords")
      .eq("website_id", id)
      .maybeSingle(),
    supabase
      .from("website_pages")
      .select("html_content, css_content, js_content")
      .eq("website_id", id)
      .limit(1)
      .maybeSingle(),
  ]);

  const website = websiteRes.data;
  if (!website) {
    notFound();
  }

  const seoData = seoRes.data;
  let indexPage = pageRes.data;

  if (!indexPage) {
    const adminDb = createAdminClient();
    const fallbackPageRes = await adminDb
      .from("website_pages")
      .select("html_content, css_content, js_content")
      .eq("website_id", id)
      .limit(1)
      .maybeSingle();
    indexPage = fallbackPageRes.data;
  }

  const plan = website.design_plan || {};

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Top SaaS Header & Sub-Navigation */}
      <header className="h-16 border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200/90 bg-slate-50 hover:bg-slate-100 text-xs sm:text-sm font-bold text-slate-700 transition-all shadow-2xs shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>All Websites</span>
          </Link>

          <div className="h-4 w-px bg-slate-200 shrink-0" />

          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-purple-600" />
            </div>
            <h1 className="font-bold text-slate-900 text-sm sm:text-base truncate max-w-[180px] sm:max-w-md">
              {website.title}
            </h1>
          </div>
        </div>

        {/* Quick Module Navigation & Primary CTA */}
        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 mr-2">
            <span className="px-3.5 py-1.5 rounded-lg bg-white text-purple-700 font-extrabold text-xs shadow-2xs">
              Overview
            </span>
            <Link
              href={`/dashboard/websites/${website.id}/seo`}
              className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold text-xs transition-all"
            >
              SEO Control Center
            </Link>
            <Link
              href={`/dashboard/websites/${website.id}/blog`}
              className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold text-xs transition-all"
            >
              Blog Engine
            </Link>
            <Link
              href={`/dashboard/websites/${website.id}/domain`}
              className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold text-xs transition-all"
            >
              Domain
            </Link>
          </nav>

          <Link
            href={plan?.websiteType === "migrated" || plan?.migration ? `/dashboard/websites/${website.id}/editor` : `/?id=${website.id}`}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition-all shadow-md shadow-purple-600/20 active:scale-95 shrink-0"
          >
            <Wand2 className="w-4 h-4" />
            <span className="hidden sm:inline">{plan?.websiteType === "migrated" || plan?.migration ? "Open Editor" : "Refine with AI"}</span>
            <span className="sm:hidden">{plan?.websiteType === "migrated" || plan?.migration ? "Editor" : "Refine"}</span>
          </Link>
        </div>
      </header>

      {/* Main Full-Screen Workspace Container */}
      <main className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Interactive Client Component Header & Status Workspace */}
        <WebsiteManagementClient website={website} indexPage={indexPage} seoData={seoData} />
      </main>
    </div>
  );
}
