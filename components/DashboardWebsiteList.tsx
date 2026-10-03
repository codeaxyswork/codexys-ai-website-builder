"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Globe,
  Edit3,
  Trash2,
  ExternalLink,
  Plus,
  Clock,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  Send,
  Eye,
  FileText,
  Sparkles,
  RefreshCw,
  HardDrive,
  Target,
  LayoutDashboard,
} from "lucide-react";
import { getWebsiteTrialStatus } from "@/lib/website-trial";
import { getWebsitePublicUrl } from "@/lib/domain-resolver";

export interface WebsiteItem {
  id: string;
  title: string;
  slug: string;
  prompt?: string;
  design_plan?: any;
  is_published?: boolean;
  published_slug?: string | null;
  custom_domain?: string | null;
  custom_domain_verified?: boolean;
  custom_domain_status?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  website_seo?: {
    seo_score?: number;
  } | null;
  pagesCount?: number;
  aiCreditsUsed?: number;
  refinementCount?: number;
  storageBytes?: number;
}

interface DashboardWebsiteListProps {
  initialWebsites: WebsiteItem[];
  userPlan?: string;
}

export function DashboardWebsiteList({ initialWebsites, userPlan = "free" }: DashboardWebsiteListProps) {
  const [websites, setWebsites] = useState<WebsiteItem[]>(initialWebsites);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const router = useRouter();

  const handleConfirmDelete = async () => {
    if (!deleteTargetId || isDeleting) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/websites/${deleteTargetId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setDeleteError(data.error || "Failed to delete website.");
        setIsDeleting(false);
        return;
      }

      setWebsites((prev) => prev.filter((w) => w.id !== deleteTargetId));
      setDeleteTargetId(null);
      router.refresh();
    } catch (err: any) {
      console.error("Delete website error:", err);
      setDeleteError("An error occurred while deleting website.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTogglePublish = async (site: WebsiteItem) => {
    if (actionLoadingId) return;
    setActionLoadingId(site.id);

    try {
      const endpoint = site.is_published
        ? `/api/websites/${site.id}/unpublish`
        : `/api/websites/${site.id}/publish`;

      const response = await fetch(endpoint, { method: "POST" });
      const data = await response.json();

      if (response.ok && data.success) {
        setWebsites((prev) =>
          prev.map((w) => {
            if (w.id === site.id) {
              return {
                ...w,
                is_published: !site.is_published,
                published_slug: data.slug || w.published_slug,
              };
            }
            return w;
          })
        );
        router.refresh();
      }
    } catch (e) {
      console.error("Publish toggle error:", e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return dateStr;
    }
  };

  const formatMediaStorage = (bytes: number | undefined) => {
    if (!bytes || bytes === 0) return "0 MB";
    const kb = bytes / 1024;
    if (kb < 1000) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1000) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  if (websites.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 text-center flex flex-col items-center justify-center shadow-xs w-full">
        <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center mb-4">
          <Globe className="w-8 h-8 text-purple-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-1">
          No Saved Websites Yet
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
          Describe your business or idea, and Codexys AI Engine will generate a standalone HTML, CSS, and JS website instantly.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-purple-600 hover:bg-purple-700 active:scale-95 transition-all shadow-md shadow-purple-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Create Your First Website</span>
        </Link>
      </div>
    );
  }

  const targetWebsite = websites.find((w) => w.id === deleteTargetId);

  return (
    <div id="my-websites" className="space-y-4 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            My Websites ({websites.length})
          </h2>
        </div>
      </div>

      {/* FULL-WIDTH LONG HORIZONTAL WEBSITE CARDS STACK */}
      <div className="flex flex-col gap-5 w-full">
        {websites.map((site) => {
          const plan = site.design_plan;
          const websiteType = plan?.websiteType || "Custom Website";
          const layoutStrategy = plan?.layoutStrategy || site.prompt || "Responsive Standalone SaaS Website";
          const seoScore = site.website_seo?.seo_score;
          const trialInfo = getWebsiteTrialStatus(site.created_at, userPlan, site.is_published);

          return (
            <div
              key={site.id}
              className="w-full rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-md hover:shadow-lg transition-all flex flex-col gap-6 relative overflow-hidden group"
            >
              {/* 1. TOP HEADER: Website Icon, Identity, Title, Badges & Monospace URL */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                    <Globe className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-bold uppercase tracking-wider">
                        {websiteType}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          site.is_published
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                        }`}
                      >
                        {site.is_published ? "Published" : "Draft"}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          trialInfo.badgeColor === "emerald"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : trialInfo.badgeColor === "amber"
                            ? "bg-amber-50 border-amber-200 text-amber-800"
                            : "bg-purple-50 border-purple-200 text-purple-700"
                        }`}
                      >
                        {trialInfo.badgeLabel}
                      </span>
                      {typeof seoScore === "number" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                          <span>SEO:</span>
                          <span className="text-purple-800 font-black">{seoScore}/100</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          SEO Not Analyzed
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight group-hover:text-purple-600 transition-colors">
                      {site.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed max-w-2xl">
                      {layoutStrategy}
                    </p>
                  </div>
                </div>

                {/* URL Box */}
                {site.is_published && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-purple-700 shrink-0 max-w-full overflow-hidden self-start md:self-center">
                    <span className="truncate max-w-xs font-semibold" title={getWebsitePublicUrl(site)}>
                      {site.custom_domain ? `🌐 ${site.custom_domain}` : (site.published_slug || site.slug ? `${site.published_slug || site.slug}.codeaxys.com` : "")}
                    </span>
                    <button
                      onClick={() => {
                        const linkToCopy = getWebsitePublicUrl(site);
                        navigator.clipboard.writeText(linkToCopy);
                        setCopiedId(site.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="text-slate-400 hover:text-purple-700 transition-colors shrink-0 p-1 rounded-md hover:bg-slate-200/60 cursor-pointer"
                      title="Copy Public Link"
                    >
                      {copiedId === site.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* 2. PRIMARY WEBSITE CONTROL CENTER PANELS GRID */}
              <div className="bg-slate-50/60 border border-slate-200/90 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse"></span>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Website Control Center
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">
                    Primary Workspace Capabilities
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 1. Website Dashboard Workspace */}
                  <Link
                    href={`/dashboard/websites/${site.id}`}
                    className="group/panel bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                        <LayoutDashboard className="w-4.5 h-4.5 text-purple-400" />
                      </div>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        Main Hub
                      </span>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm group-hover/panel:text-purple-700 transition-colors">
                        Website Dashboard
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                        Full website management & analytics workspace
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-800 group-hover/panel:text-purple-700">
                      <span>Open Workspace</span>
                      <span>&rarr;</span>
                    </div>
                  </Link>

                  {/* 2. Refine with AI / Visual Editor */}
                  <Link
                    href={site.design_plan?.websiteType === "migrated" || site.design_plan?.migration ? `/dashboard/websites/${site.id}/editor` : `/?id=${site.id}`}
                    className="group/panel bg-white hover:bg-purple-50/70 border border-purple-200/90 hover:border-purple-300 rounded-xl p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center">
                        <Sparkles className="w-4.5 h-4.5" />
                      </div>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                        {site.design_plan?.websiteType === "migrated" || site.design_plan?.migration ? "Visual Editor" : "AI Generator"}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm group-hover/panel:text-purple-700 transition-colors">
                        {site.design_plan?.websiteType === "migrated" || site.design_plan?.migration ? "Open Visual Editor" : "Refine with AI"}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                        {site.design_plan?.websiteType === "migrated" || site.design_plan?.migration ? "Visual DOM & style editor for migrated snapshot" : "Instant natural language design & page editing"}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-purple-100 flex items-center justify-between text-xs font-bold text-purple-700 group-hover/panel:text-purple-900">
                      <span>{site.design_plan?.websiteType === "migrated" || site.design_plan?.migration ? "Open Editor" : "Edit with AI"}</span>
                      <span>&rarr;</span>
                    </div>
                  </Link>

                  {/* 3. SEO (KILLER FEATURE CARD) */}
                  <Link
                    href={`/dashboard/websites/${site.id}/seo`}
                    className="group/panel bg-white hover:bg-purple-50/50 border border-slate-200 hover:border-purple-300 rounded-xl p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-2xs">
                        <Target className="w-4.5 h-4.5" />
                      </div>
                      {typeof seoScore === "number" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                          SEO {seoScore}/100
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          Not Analyzed
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-extrabold text-slate-900 text-sm group-hover/panel:text-purple-700 transition-colors">
                          SEO Optimization
                        </h4>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded">
                          Killer
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                        Command Center, rankings & organic performance
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-700 group-hover/panel:text-purple-800">
                      <span>Open SEO</span>
                      <span>&rarr;</span>
                    </div>
                  </Link>

                  {/* 4. Connect Domain / Manage Domain */}
                  <Link
                    href={`/dashboard/websites/${site.id}/domain`}
                    className="group/panel bg-white hover:bg-indigo-50/70 border border-indigo-200/90 hover:border-indigo-300 rounded-xl p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                        <Globe className="w-4.5 h-4.5" />
                      </div>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                        {site.custom_domain ? "Connected" : "Custom Host"}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm group-hover/panel:text-indigo-900 transition-colors">
                        {site.custom_domain ? "Manage Domain" : "Connect Domain"}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-tight truncate">
                        {site.custom_domain ? site.custom_domain : "Connect custom domain & SSL"}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-indigo-100 flex items-center justify-between text-xs font-bold text-indigo-700 group-hover/panel:text-indigo-900">
                      <span>{site.custom_domain ? "Manage Domain &rarr;" : "Connect Domain &rarr;"}</span>
                    </div>
                  </Link>
                </div>
              </div>

              {/* 3. METRICS / INFORMATION ROW */}
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 sm:p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 items-center text-xs shadow-2xs">
                {/* Pages */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-purple-600">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none mb-0.5">
                      Pages
                    </span>
                    <span className="font-bold text-slate-900 text-xs">
                      {site.pagesCount ?? 1}
                    </span>
                  </div>
                </div>

                {/* AI Usage */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-amber-500">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none mb-0.5">
                      AI Usage
                    </span>
                    <span className="font-bold text-slate-900 text-xs">
                      {site.aiCreditsUsed ?? 0} credits
                    </span>
                  </div>
                </div>

                {/* Refinement */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-indigo-600">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none mb-0.5">
                      Refinement
                    </span>
                    <span className="font-bold text-slate-900 text-xs">
                      {site.refinementCount ?? 0}
                    </span>
                  </div>
                </div>

                {/* Media Storage */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-emerald-600">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none mb-0.5">
                      Media Storage
                    </span>
                    <span className="font-bold text-slate-900 text-xs">
                      {formatMediaStorage(site.storageBytes)}
                    </span>
                  </div>
                </div>

                {/* Last Updated */}
                <div className="flex items-center gap-2.5 col-span-2 sm:col-span-1">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-500">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none mb-0.5">
                      Last Updated
                    </span>
                    <span className="font-semibold text-slate-700 text-xs">
                      {formatDate(site.updated_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. SECONDARY & UTILITY ACTIONS BAR */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 text-xs">
                <span className="text-slate-400 font-bold uppercase text-[10px]">
                  Other Website Actions
                </span>

                <div className="flex items-center gap-2 flex-wrap">
                  {(site.published_slug || site.slug) && (
                    <a
                      href={getWebsitePublicUrl(site)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3.5 rounded-xl border border-slate-200 bg-white text-purple-700 hover:bg-purple-50 hover:border-purple-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                      title="View Live Published Website"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
                      <span>Live Site</span>
                    </a>
                  )}

                  <button
                    onClick={() => handleTogglePublish(site)}
                    disabled={actionLoadingId === site.id}
                    title={site.is_published ? "Unpublish Website" : "Publish Website"}
                    className="py-2 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:text-purple-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    {actionLoadingId === site.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                    ) : site.is_published ? (
                      <>
                        <Globe className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Unpublish</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 text-slate-400" />
                        <span>Publish</span>
                      </>
                    )}
                  </button>

                  <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

                  <button
                    onClick={() => setDeleteTargetId(site.id)}
                    title="Delete Website"
                    className="py-2 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 text-xs font-semibold transition-all shrink-0 cursor-pointer shadow-2xs flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Delete this website?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  This will permanently delete <strong className="text-slate-800">{targetWebsite?.title || "this website"}</strong>, its pages and its migrated assets. This action cannot be undone.
                </p>
              </div>
            </div>

            {deleteError && (
              <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                {deleteError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setDeleteTargetId(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Permanently</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
