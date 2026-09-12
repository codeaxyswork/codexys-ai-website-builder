import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
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

  // Fetch website details owned by authenticated user
  const { data: website } = await supabase
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
      updated_at,
      website_seo (
        seo_score,
        meta_title,
        meta_description,
        keywords
      )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!website) {
    notFound();
  }

  // Fetch website page content for live preview snippet
  const { data: indexPage } = await supabase
    .from("website_pages")
    .select("html_content, css_content, js_content")
    .eq("website_id", website.id)
    .eq("path", "index.html")
    .maybeSingle();

  const plan = website.design_plan || {};
  const seoData = Array.isArray(website.website_seo) ? website.website_seo[0] : website.website_seo;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Top SaaS Header */}
      <header className="h-16 border-b border-slate-200 bg-white/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-purple-600" />
            <h1 className="font-bold text-slate-900 text-sm truncate max-w-[200px] sm:max-w-md">
              {website.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/?id=${website.id}`}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Refine with AI</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 pt-8 space-y-8">
        {/* Interactive Client Component Header & Status Banner */}
        <WebsiteManagementClient website={website} indexPage={indexPage} seoData={seoData} />
      </main>
    </div>
  );
}
