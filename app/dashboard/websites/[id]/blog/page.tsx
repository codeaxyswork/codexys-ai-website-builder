import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ArrowLeft, Globe, Newspaper } from "lucide-react";
import { BlogEngineClient } from "@/components/BlogEngineClient";

interface BlogDashboardPageProps {
  params: Promise<{ id: string }>;
}

export default async function BlogDashboardPage({ params }: BlogDashboardPageProps) {
  const { id: websiteId } = await params;
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
    .select("id, user_id, title, slug, is_published, published_slug, custom_domain")
    .eq("id", websiteId)
    .eq("user_id", user.id)
    .single();

  if (!website) {
    notFound();
  }

  // Fetch initial blog posts
  const { data: initialPosts } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("website_id", websiteId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch User Credits for AI blog generation
  const { data: userCredit } = await supabase
    .from("user_credits")
    .select("balance")
    .eq("user_id", user.id)
    .maybeSingle();

  const userCredits = userCredit?.balance ?? 50;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 flex flex-col">
      {/* SaaS Navigation Header */}
      <header className="h-16 border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
          <Link
            href={`/dashboard/websites/${website.id}`}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200/90 bg-slate-50 hover:bg-slate-100 text-xs sm:text-sm font-bold text-slate-700 transition-all shadow-2xs shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Website Hub</span>
          </Link>

          <div className="h-4 w-px bg-slate-200 shrink-0" />

          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
              <Newspaper className="w-4 h-4 text-purple-600" />
            </div>
            <h1 className="font-bold text-slate-900 text-sm sm:text-base truncate max-w-[180px] sm:max-w-md">
              {website.title} — Content & Blog Engine
            </h1>
          </div>
        </div>

        {/* Quick Navigation Tabs & Primary Module Links */}
        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 mr-2">
            <Link
              href={`/dashboard/websites/${website.id}`}
              className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold text-xs transition-all"
            >
              Overview
            </Link>
            <Link
              href={`/dashboard/websites/${website.id}/seo`}
              className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold text-xs transition-all"
            >
              SEO Control Center
            </Link>
            <span className="px-3.5 py-1.5 rounded-lg bg-white text-purple-700 font-extrabold text-xs shadow-2xs">
              Blog Engine
            </span>
            <Link
              href={`/dashboard/websites/${website.id}/domain`}
              className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold text-xs transition-all"
            >
              Domain
            </Link>
          </nav>

          <Link
            href={`/dashboard/websites/${website.id}/seo?tab=content-studio`}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-bold transition-all shadow-sm shrink-0"
          >
            <span>Open SEO Content Studio 🚀</span>
          </Link>
        </div>
      </header>

      {/* Main Full-Screen Content Canvas */}
      <main className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        <BlogEngineClient
          website={website}
          initialPosts={initialPosts || []}
          userCredits={userCredits}
        />
      </main>
    </div>
  );
}
