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
} from "lucide-react";

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
}

export function DashboardWebsiteList({ initialWebsites }: DashboardWebsiteListProps) {
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
    <div className="space-y-4 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            My Websites ({websites.length})
          </h2>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Website</span>
        </Link>
      </div>

      {/* FULL-WIDTH LONG HORIZONTAL WEBSITE CARDS STACK */}
      <div className="flex flex-col gap-5 w-full">
        {websites.map((site) => {
          const plan = site.design_plan;
          const websiteType = plan?.websiteType || "Custom Website";
          const layoutStrategy = plan?.layoutStrategy || site.prompt || "Responsive Standalone SaaS Website";
          const seoScore = site.website_seo?.seo_score;

          return (
            <div
              key={site.id}
              className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:shadow-md transition-all flex flex-col gap-5 group relative overflow-hidden"
            >
              {/* TOP ROW: Icon + Category + Status Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0 shadow-2xs">
                    <Globe className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-bold uppercase tracking-wider">
                        {websiteType}
                      </span>
                      {plan?.colorPalette && Array.isArray(plan.colorPalette) && (
                        <div className="hidden sm:flex items-center gap-1">
                          {plan.colorPalette.slice(0, 4).map((col: any, idx: number) => (
                            <span
                              key={idx}
                              className="w-3 h-3 rounded-full border border-slate-200 shrink-0"
                              style={{ backgroundColor: col.hex }}
                              title={`${col.name}: ${col.hex}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {typeof seoScore === "number" ? (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                      <span>SEO:</span>
                      <span className="text-purple-800 font-black">{seoScore}/100</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                      SEO Not Analyzed
                    </span>
                  )}

                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-extrabold uppercase border ${
                      site.is_published
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-amber-50 border-amber-200 text-amber-700"
                    }`}
                  >
                    {site.is_published ? "Published" : "Draft"}
                  </span>
                </div>
              </div>

              {/* SECOND AREA: Title, Description, and Custom Domain / URL Preview */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl tracking-tight group-hover:text-purple-600 transition-colors">
                    {site.title}
                  </h3>

                  {site.is_published && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-purple-700 shrink-0 max-w-full overflow-hidden">
                      <span className="truncate" title={site.custom_domain || `/site/${site.published_slug}`}>
                        {site.custom_domain ? `🌐 ${site.custom_domain}` : `/site/${site.published_slug}`}
                      </span>
                      <button
                        onClick={() => {
                          const linkToCopy = site.custom_domain
                            ? `https://${site.custom_domain}`
                            : `${window.location.origin}/site/${site.published_slug}`;
                          navigator.clipboard.writeText(linkToCopy);
                          setCopiedId(site.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="text-slate-400 hover:text-purple-700 transition-colors shrink-0"
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

                <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                  {layoutStrategy}
                </p>
              </div>

              {/* THIRD AREA: Compact Metadata Row inside ONE unified card */}
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 sm:p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 items-center text-xs">
                {/* Pages */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-600">
                    <FileText className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                      Pages
                    </span>
                    <span className="font-bold text-slate-800 text-xs">
                      {site.pagesCount ?? 1}
                    </span>
                  </div>
                </div>

                {/* AI Usage */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-600">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                      AI Usage
                    </span>
                    <span className="font-bold text-slate-800 text-xs">
                      {site.aiCreditsUsed ?? 0} credits
                    </span>
                  </div>
                </div>

                {/* Refinement Count */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-600">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                      Refinement
                    </span>
                    <span className="font-bold text-slate-800 text-xs">
                      {site.refinementCount ?? 0}
                    </span>
                  </div>
                </div>

                {/* Media Storage */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-600">
                    <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                      Media Storage
                    </span>
                    <span className="font-bold text-slate-800 text-xs">
                      {formatMediaStorage(site.storageBytes)}
                    </span>
                  </div>
                </div>

                {/* Last Updated */}
                <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-600">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                      Last Updated
                    </span>
                    <span className="font-semibold text-slate-700 text-xs">
                      {formatDate(site.updated_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* BOTTOM ACTION AREA */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Primary Action: Refine */}
                  <Link
                    href={`/?id=${site.id}`}
                    className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
                    title="Refine website with AI"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Refine</span>
                  </Link>

                  {/* SEO Action */}
                  <Link
                    href={`/dashboard/websites/${site.id}/seo`}
                    className="py-2 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-all"
                  >
                    <span>SEO</span>
                  </Link>

                  {/* Domain Action */}
                  <Link
                    href={`/dashboard/websites/${site.id}/domain`}
                    className="py-2 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-all"
                    title="Domain & Host Settings"
                  >
                    <span>Domain</span>
                  </Link>
                </div>

                <div className="flex items-center gap-2">
                  {site.is_published && site.published_slug && (
                    <a
                      href={`/site/${site.published_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 rounded-xl border border-slate-200 bg-white text-purple-600 hover:bg-purple-50 hover:border-purple-200 text-xs font-semibold flex items-center gap-1 transition-all"
                      title="View Live Website"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Live Site</span>
                    </a>
                  )}

                  <button
                    onClick={() => handleTogglePublish(site)}
                    disabled={actionLoadingId === site.id}
                    title={site.is_published ? "Unpublish Website" : "Publish Website"}
                    className="py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:text-purple-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
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

                  <button
                    onClick={() => setDeleteTargetId(site.id)}
                    title="Delete Website"
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
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
                <h3 className="font-bold text-slate-900 text-sm">Delete Saved Website?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-slate-800">{targetWebsite?.title}</strong>? This action cannot be undone.
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
                className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
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
