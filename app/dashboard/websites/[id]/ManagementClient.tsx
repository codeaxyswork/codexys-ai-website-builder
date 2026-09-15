"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Globe,
  Wand2,
  Send,
  Search,
  Sliders,
  ExternalLink,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Loader2,
  Trash2,
  AlertTriangle,
  Eye,
  ShieldCheck,
} from "lucide-react";

interface ManagementClientProps {
  website: any;
  indexPage: any;
  seoData: any;
}

export function WebsiteManagementClient({ website, indexPage, seoData }: ManagementClientProps) {
  const [isPublished, setIsPublished] = useState<boolean>(Boolean(website.is_published));
  const [publishedSlug, setPublishedSlug] = useState<string | null>(website.published_slug || null);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();

  const handleTogglePublish = async () => {
    if (isPublishing) return;
    setIsPublishing(true);

    try {
      const endpoint = isPublished
        ? `/api/websites/${website.id}/unpublish`
        : `/api/websites/${website.id}/publish`;

      const response = await fetch(endpoint, { method: "POST" });
      const data = await response.json();

      if (response.ok && data.success) {
        setIsPublished(!isPublished);
        if (data.slug) setPublishedSlug(data.slug);
        router.refresh();
      }
    } catch (e) {
      console.error("Publish toggle error:", e);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/websites/${website.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (response.ok && data.success) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setDeleteError(data.error || "Failed to delete website.");
        setIsDeleting(false);
      }
    } catch (e) {
      setDeleteError("An error occurred while deleting.");
      setIsDeleting(false);
    }
  };

  const publicUrl = publishedSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/site/${publishedSlug}`
    : "";

  const customDomainUrl = website.custom_domain ? `https://${website.custom_domain}` : null;
  const activeLiveUrl = customDomainUrl || publicUrl;

  const plan = website.design_plan || {};
  const websiteType = plan.websiteType || "Custom AI Website";
  const seoScore = seoData?.seo_score;

  return (
    <div className="space-y-8">
      {/* Top Banner Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
              {websiteType}
            </span>

            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase border ${
                isPublished
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-amber-50 border-amber-200 text-amber-700"
              }`}
            >
              {isPublished ? "Published Live" : "Draft (Unpublished)"}
            </span>

            {typeof seoScore === "number" && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                SEO Score: {seoScore}/100
              </span>
            )}
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {website.title}
          </h2>

          <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated {new Date(website.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          <Link
            href={`/?id=${website.id}`}
            className="flex-1 md:flex-none py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-700 active:scale-95 transition-all shadow-md shadow-purple-600/20 flex items-center justify-center gap-2"
          >
            <Wand2 className="w-4 h-4" />
            <span>Refine with AI</span>
          </Link>

          <button
            onClick={handleTogglePublish}
            disabled={isPublishing}
            className={`flex-1 md:flex-none py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border shadow-xs ${
              isPublished
                ? "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-emerald-600/20"
            }`}
          >
            {isPublishing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isPublished ? (
              <>
                <Globe className="w-4 h-4 text-emerald-600" />
                <span>Unpublish</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Publish Website</span>
              </>
            )}
          </button>

          {isPublished && activeLiveUrl && (
            <a
              href={activeLiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-200 text-purple-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              <span>View Site</span>
            </a>
          )}

          <button
            onClick={() => setShowDeleteModal(true)}
            title="Delete Website"
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Features Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Overview & Live Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Website Preview Box */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Eye className="w-4 h-4 text-purple-600" />
                <span>Website Preview</span>
              </h3>
              {isPublished && activeLiveUrl && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-mono truncate max-w-[180px] sm:max-w-xs">{activeLiveUrl}</span>
                  <button
                    onClick={() => handleCopyLink(activeLiveUrl)}
                    className="p-1 rounded bg-slate-100 hover:bg-purple-100 text-purple-700 text-xs transition-colors"
                    title="Copy Live URL"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>

            {/* Sandbox Iframe Preview */}
            <div className="w-full h-96 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 relative">
              {indexPage ? (
                <iframe
                  srcDoc={`<!DOCTYPE html><html><head><style>${indexPage.css_content || ""}</style></head><body>${indexPage.html_content || ""}<script>${indexPage.js_content || ""}</script></body></html>`}
                  title="Website Preview"
                  className="w-full h-full border-none pointer-events-auto"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No preview available
                </div>
              )}
            </div>
          </div>

          {/* AI Refinement Banner */}
          <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50/80 via-white to-purple-50/50 p-6 shadow-xs flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Refine & Edit with Natural Language</span>
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed max-w-lg">
                Describe desired changes like "Make the hero darker" or "Add testimonials grid". Codexys AI updates your design instantly.
              </p>
            </div>
            <Link
              href={`/?id=${website.id}`}
              className="py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-purple-600 hover:bg-purple-700 transition-all shadow-sm shrink-0"
            >
              Open AI Refiner
            </Link>
          </div>
        </div>

        {/* Right Column (1 col): Management Shortcuts */}
        <div className="space-y-6">
          {/* Custom Domain Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-600" />
                <span>Custom Domain</span>
              </h3>
              <Link
                href={`/dashboard/websites/${website.id}/domain`}
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 underline"
              >
                Manage
              </Link>
            </div>

            {website.custom_domain ? (
              <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-purple-900">{website.custom_domain}</span>
                  {website.custom_domain_verified ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      Active & SSL Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      <AlertCircle className="w-3 h-3" />
                      Pending DNS Setup
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  {website.custom_domain_verified
                    ? "Your custom domain is active and serving traffic."
                    : "Configure CNAME and A records with your domain registrar."}
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-center">
                <p className="text-xs text-slate-500">No custom domain connected yet.</p>
                <Link
                  href={`/dashboard/websites/${website.id}/domain`}
                  className="inline-block py-2 px-3 rounded-xl bg-purple-600 text-white font-semibold text-xs hover:bg-purple-700 transition-all shadow-xs"
                >
                  Connect Domain
                </Link>
              </div>
            )}
          </div>

          {/* SEO Settings Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Search className="w-4 h-4 text-purple-600" />
                <span>SEO Settings</span>
              </h3>
              <Link
                href={`/dashboard/websites/${website.id}/seo`}
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 underline"
              >
                Configure
              </Link>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">Search Metadata</span>
                {typeof seoScore === "number" ? (
                  <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    Score: {seoScore}/100
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">Not Analyzed</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-2">
                {seoData?.meta_description || "Configure title, meta description, keywords, Open Graph, and JSON-LD schema."}
              </p>
              <Link
                href={`/dashboard/websites/${website.id}/seo`}
                className="inline-block pt-1 text-xs font-bold text-purple-600 hover:underline"
              >
                Open SEO Optimizer &rarr;
              </Link>
            </div>
          </div>

          {/* Content & Blog Engine Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-600" />
                <span>Content & Blog Engine</span>
              </h3>
              <Link
                href={`/dashboard/websites/${website.id}/blog`}
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 underline"
              >
                Manage
              </Link>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-2">
              <span className="text-xs font-semibold text-slate-900 block">SEO Article Engine</span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Create, edit, and publish SEO-optimized blog posts generated with Codeaxys SEO AI.
              </p>
              <Link
                href={`/dashboard/websites/${website.id}/blog`}
                className="inline-block pt-1 text-xs font-bold text-purple-600 hover:underline"
              >
                Open Blog Manager &rarr;
              </Link>
            </div>
          </div>

          {/* Technical Info Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-purple-600" />
              <span>Project Details</span>
            </h3>

            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>Slug:</span>
                <span className="font-mono text-slate-900">{website.slug}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>Created:</span>
                <span>{new Date(website.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span>Website ID:</span>
                <span className="font-mono text-[10px] text-slate-500 truncate max-w-[120px]">{website.id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Delete Website?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-slate-800">{website.title}</strong>? This action cannot be undone.
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
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
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
