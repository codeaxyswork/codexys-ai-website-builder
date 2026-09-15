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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-200 bg-white/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/websites/${website.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Website Dashboard</span>
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-purple-600" />
            <h1 className="font-bold text-slate-900 text-sm truncate max-w-[200px] sm:max-w-md">
              {website.title} — Content & Blog Engine
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/websites/${website.id}/seo`}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all"
          >
            SEO Dashboard &rarr;
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 pt-8 space-y-8">
        <BlogEngineClient
          website={website}
          initialPosts={initialPosts || []}
          userCredits={userCredits}
        />
      </main>
    </div>
  );
}
