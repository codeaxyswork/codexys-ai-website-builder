import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Wand2, ShieldCheck, ArrowRight, LayoutDashboard, Image as ImageIcon } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { DashboardWebsiteList, WebsiteItem } from "@/components/DashboardWebsiteList";
import { DashboardUsageCards } from "@/components/DashboardUsageCards";
import { getUserUsage } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // Fetch user's saved websites with publishing, domain, and SEO fields
  const { data: dbWebsites } = await supabase
    .from("websites")
    .select(`
      id,
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
        seo_score
      )
    `)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  // Fetch website-specific aggregated metrics (AI Credits, Refinements, Pages count, Media storage)
  const websiteIds = (dbWebsites || []).map((w: any) => w.id);

  let transMap: Record<string, { credits: number; refinements: number }> = {};
  let pagesMap: Record<string, number> = {};
  let storageMap: Record<string, number> = {};

  if (websiteIds.length > 0) {
    const [transRes, pagesRes, mediaRes] = await Promise.all([
      supabase
        .from("ai_credit_transactions")
        .select("website_id, credits_used, action_type")
        .in("website_id", websiteIds),
      supabase
        .from("website_pages")
        .select("website_id, id")
        .in("website_id", websiteIds),
      supabase
        .from("media_assets")
        .select("website_id, file_size_bytes")
        .in("website_id", websiteIds),
    ]);

    (transRes.data || []).forEach((t: any) => {
      if (!t.website_id) return;
      if (!transMap[t.website_id]) {
        transMap[t.website_id] = { credits: 0, refinements: 0 };
      }
      transMap[t.website_id].credits += Number(t.credits_used) || 0;
      if (t.action_type === "ai_edit" || t.action_type === "refinement") {
        transMap[t.website_id].refinements += 1;
      }
    });

    (pagesRes.data || []).forEach((p: any) => {
      if (!p.website_id) return;
      pagesMap[p.website_id] = (pagesMap[p.website_id] || 0) + 1;
    });

    (mediaRes.data || []).forEach((m: any) => {
      if (!m.website_id) return;
      storageMap[m.website_id] = (storageMap[m.website_id] || 0) + (Number(m.file_size_bytes) || 0);
    });
  }

  // Fetch usage metrics (credits, plan, storage, limits)
  const usageData = (await getUserUsage(user.id)) || {
    plan: { id: "free", name: "Free", allow_custom_domain: false, allow_advanced_seo: false },
    credits: { balance: 50, monthlyUsed: 0, lifetimeUsed: 0, limit: 50, monthlyOperations: 0 },
    websites: { used: dbWebsites?.length || 0, limit: 1 },
    storage: { usedBytes: 0, limitBytes: 104857600 },
  };

  const userName =
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "User";

  const websites: WebsiteItem[] = (dbWebsites || []).map((w: any) => ({
    id: w.id,
    title: w.title,
    slug: w.slug,
    prompt: w.prompt,
    design_plan: w.design_plan,
    is_published: w.is_published,
    published_slug: w.published_slug,
    custom_domain: w.custom_domain,
    custom_domain_verified: w.custom_domain_verified,
    custom_domain_status: w.custom_domain_status,
    published_at: w.published_at,
    created_at: w.created_at,
    updated_at: w.updated_at,
    website_seo: Array.isArray(w.website_seo) ? w.website_seo[0] : w.website_seo,
    pagesCount: pagesMap[w.id] || 1,
    aiCreditsUsed: transMap[w.id]?.credits || 0,
    refinementCount: transMap[w.id]?.refinements || 0,
    storageBytes: storageMap[w.id] || 0,
  }));

  return (
    <div className="min-h-screen w-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
      {/* Light Header Bar */}
      <header className="h-16 border-b border-slate-200 bg-white px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <img src="/logo.png" alt="codeaxys logo" className="h-8 w-auto object-contain" />
          </Link>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-medium">
            <LayoutDashboard className="w-3.5 h-3.5 text-purple-600" />
            <span>Dashboard</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/media"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-all shadow-2xs"
          >
            <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">Media Library</span>
          </Link>

          <Link
            href="/dashboard/billing"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-xs font-semibold text-purple-700 transition-all shadow-2xs"
          >
            <span className="text-xs">💳</span>
            <span className="hidden sm:inline">Billing</span>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Launch AI Generator</span>
          </Link>

          <LogoutButton />
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 flex flex-col gap-6">
        {/* Welcome Banner */}
        <div className="relative rounded-2xl border border-purple-200/80 bg-gradient-to-r from-purple-50/80 via-white to-purple-50/40 p-6 sm:p-8 shadow-sm overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl pointer-events-none -z-10" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-3">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Authenticated Session Active</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Welcome back, {userName}!
              </h1>
              <p className="text-slate-600 text-xs sm:text-sm mt-1 max-w-xl">
                Track your AI credits balance, publish standalone websites, and manage custom media assets.
              </p>
            </div>

            <Link
              href="/"
              className="px-5 py-3 rounded-xl font-semibold text-xs text-white bg-purple-600 hover:bg-purple-700 transition-all shadow-md shadow-purple-600/20 flex items-center gap-2 shrink-0 active:scale-95"
            >
              <span>Create New Website</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* AI Credits, Storage, Website Limits & Plan Cards */}
        <DashboardUsageCards usage={usageData} />

        {/* My Saved Websites Grid Section */}
        <div className="mt-2">
          <DashboardWebsiteList initialWebsites={websites} />
        </div>
      </main>
    </div>
  );
}
