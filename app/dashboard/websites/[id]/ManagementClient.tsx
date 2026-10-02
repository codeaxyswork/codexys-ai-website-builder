"use client";

import React, { useState, useEffect } from "react";
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
  ArrowRight,
  Monitor,
  Smartphone,
  FileText,
  Lock,
  Megaphone,
} from "lucide-react";

import { getWebsiteTrialStatus } from "@/lib/website-trial";
import { assemblePreviewDoc } from "@/lib/preview-helper";
import { WebsiteAgentChat } from "@/components/WebsiteAgentChat";

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
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

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

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
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

  const appDomain = (
    process.env.NEXT_PUBLIC_APP_DOMAIN ||
    process.env.APP_DOMAIN ||
    "codeaxys.com"
  ).trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");

  const activeSlug = publishedSlug || website.slug;
  const isLocalHost = origin.includes("localhost") || origin.includes("127.0.0.1");

  const publicUrl = activeSlug
    ? (isLocalHost ? `${origin}/site/${activeSlug}` : `https://${activeSlug}.${appDomain}`)
    : "";

  const customDomainUrl = website.custom_domain ? `https://${website.custom_domain}` : null;
  const activeLiveUrl = customDomainUrl || publicUrl;

  const plan = website.design_plan || {};
  const websiteType = plan.websiteType || "Custom AI Website";
  const seoScore = seoData?.seo_score;
  const trialInfo = getWebsiteTrialStatus(website.created_at, "free", isPublished);

  return (
    <div className="space-y-8">
      {/* SECTION 1: Top Hero Identity & SaaS Command Banner */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs hover:shadow-md transition-shadow duration-200 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
        <div className="space-y-3 max-w-3xl">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
              {websiteType}
            </span>

            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase border ${
                isPublished
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-amber-50 border-amber-200 text-amber-700"
              }`}
            >
              {isPublished ? "Published Live" : "Draft (Unpublished)"}
            </span>

            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase border ${
                trialInfo.badgeColor === "emerald"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : trialInfo.badgeColor === "amber"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-purple-50 border-purple-200 text-purple-700"
              }`}
            >
              {trialInfo.badgeLabel}
            </span>

            {typeof seoScore === "number" && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                SEO Score: <strong className="text-purple-600 font-mono">{seoScore}</strong>/100
              </span>
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-snug" title={website.title}>
            {website.title}
          </h2>

          <p className="text-sm font-medium text-slate-500 flex items-center gap-2 pt-0.5">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Updated {new Date(website.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-slate-400 text-xs">ID: {website.id.slice(0, 8)}...</span>
          </p>

          {trialInfo.isExpired && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 font-medium mt-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{trialInfo.message}</span>
              </div>
              <Link
                href="/pricing"
                className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold transition-all shrink-0 shadow-2xs"
              >
                Upgrade to Pro →
              </Link>
            </div>
          )}
        </div>

        {/* Primary Command Action Group */}
        <div className="flex items-center gap-3 flex-wrap w-full xl:w-auto shrink-0 pt-2 xl:pt-0">
          <Link
            href={website.design_plan?.websiteType === "migrated" || website.design_plan?.migration ? `/dashboard/websites/${website.id}/editor` : `/?id=${website.id}`}
            className="flex-1 xl:flex-none h-11 sm:h-12 px-5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-700 active:scale-[0.99] transition-all shadow-md shadow-purple-600/20 flex items-center justify-center gap-2"
          >
            <Wand2 className="w-4 h-4" />
            <span>Open Editor</span>
          </Link>

          <button
            onClick={handleTogglePublish}
            disabled={isPublishing}
            className={`flex-1 xl:flex-none h-11 sm:h-12 px-5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border shadow-xs ${
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

          {activeLiveUrl && (
            <a
              href={activeLiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-11 sm:h-12 px-4 rounded-xl border border-slate-200/90 bg-white hover:bg-purple-50 hover:border-purple-200 text-purple-700 text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <ExternalLink className="w-4 h-4" />
              <span>View Site</span>
            </a>
          )}

          <button
            onClick={() => setShowDeleteModal(true)}
            title="Delete Website"
            className="h-11 sm:h-12 px-3.5 rounded-xl border border-slate-200/90 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all flex items-center justify-center shadow-xs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SECTION 2: Grid Layout — Main Sandbox Workspace & Management Sidebar Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Column (8 cols): Interactive Preview Sandbox & AI Builder Shortcut */}
        <div className="xl:col-span-8 space-y-8">
          {/* Website Preview Container Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs hover:shadow-md transition-shadow duration-200 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    Website Live Sandbox Preview
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Real-time HTML & CSS render preview
                  </p>
                </div>
              </div>

              {/* Device Mode Switch & Address Bar Links */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setPreviewMode("desktop")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      previewMode === "desktop"
                        ? "bg-white text-purple-700 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Desktop</span>
                  </button>
                  <button
                    onClick={() => setPreviewMode("mobile")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      previewMode === "mobile"
                        ? "bg-white text-purple-700 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile</span>
                  </button>
                </div>

                {isPublished && activeLiveUrl && (
                  <button
                    onClick={() => handleCopyLink(activeLiveUrl)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-200 text-purple-700 text-xs font-bold transition-all"
                    title="Copy Live URL"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Browser Address Toolbar Mock */}
            <div className="bg-slate-100/90 rounded-xl px-4 py-2 border border-slate-200/80 flex items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2 overflow-hidden max-w-full min-w-0">
                <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-mono text-slate-700 truncate font-medium min-w-0">
                  {activeLiveUrl || `https://${website.slug}.codeaxys.com`}
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-400 shrink-0 uppercase tracking-wider">
                {isPublished ? "Live SSL" : "Preview Mode"}
              </span>
            </div>

            {/* Sandbox Iframe Wrapper */}
            <div
              className={`mx-auto rounded-xl border border-slate-200 overflow-hidden bg-white relative transition-all duration-300 shadow-inner ${
                previewMode === "mobile"
                  ? "w-full max-w-sm h-[580px]"
                  : "w-full h-[540px] sm:h-[600px]"
              }`}
            >
              {indexPage && indexPage.html_content ? (
                <iframe
                  srcDoc={assemblePreviewDoc(indexPage.html_content, indexPage.css_content, indexPage.js_content)}
                  title="Website Preview"
                  sandbox="allow-scripts allow-same-origin"
                  className="w-full h-full border-none pointer-events-auto bg-white"
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Globe className="w-8 h-8 text-slate-300" />
                  <p className="text-sm font-medium">No HTML preview generated yet</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Refinement Banner Card */}
          <div className="rounded-2xl border border-purple-200/90 bg-gradient-to-r from-purple-50/90 via-white to-purple-50/60 p-6 sm:p-8 shadow-xs hover:shadow-md transition-shadow duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">
                  Refine & Edit with Natural Language
                </h4>
              </div>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                Describe desired changes like "Make the hero section darker" or "Add a 3-column pricing grid". Codeaxys AI updates your design and page layout instantly.
              </p>
            </div>
            <Link
              href={website.design_plan?.websiteType === "migrated" || website.design_plan?.migration ? `/dashboard/websites/${website.id}/editor` : `/?id=${website.id}`}
              className="h-11 sm:h-12 px-6 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-700 active:scale-[0.99] transition-all shadow-md shadow-purple-600/20 shrink-0 flex items-center gap-2"
            >
              <Wand2 className="w-4 h-4" />
              <span>Open Editor</span>
            </Link>
          </div>
        </div>

        {/* Right Column (4 cols): Dedicated Module Shortcuts & Technical Details */}
        <div className="xl:col-span-4 space-y-6">
          {/* SEO Control Center Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs hover:shadow-md hover:border-purple-300 transition-all duration-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                  <Search className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  SEO Control Center
                </h3>
              </div>
              {typeof seoScore === "number" ? (
                <span className="text-xs font-black text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200 font-mono">
                  {seoScore}/100
                </span>
              ) : (
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                  Pending
                </span>
              )}
            </div>

            <p className="text-sm font-medium text-slate-600 leading-relaxed line-clamp-2">
              {seoData?.meta_description || "Manage meta titles, search descriptions, focus keywords, XML sitemap, and Google Search Console integration."}
            </p>

            <Link
              href={`/dashboard/websites/${website.id}/seo`}
              className="w-full h-10 px-4 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-between transition-all"
            >
              <span>Open SEO Optimizer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* AI Marketing Agent Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs hover:shadow-md hover:border-purple-300 transition-all duration-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                  <Megaphone className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  AI Marketing Agent
                </h3>
              </div>
              <span className="text-[10px] font-extrabold uppercase text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                Phase 1
              </span>
            </div>

            <p className="text-sm font-medium text-slate-600 leading-relaxed line-clamp-2">
              Connect Meta Ads & Google Ads accounts for AI paid campaign creation, lead management, and ad strategy.
            </p>

            <Link
              href={`/dashboard/websites/${website.id}/marketing`}
              className="w-full h-10 px-4 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-between transition-all"
            >
              <span>Open Marketing Agent</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Custom Domain Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs hover:shadow-md transition-all duration-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                  <Globe className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Custom Domain
                </h3>
              </div>
              <Link
                href={`/dashboard/websites/${website.id}/domain`}
                className="text-xs font-bold text-purple-600 hover:text-purple-700 transition-colors"
              >
                Configure &rarr;
              </Link>
            </div>

            {website.custom_domain ? (
              <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-purple-950">{website.custom_domain}</span>
                  {website.custom_domain_verified ? (
                    <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      Active & SSL Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      <AlertCircle className="w-3 h-3" />
                      Pending DNS
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-slate-600">
                  {website.custom_domain_verified
                    ? "Your custom domain is active and serving traffic."
                    : "Configure CNAME and A records with your registrar."}
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3 text-center">
                <p className="text-xs font-medium text-slate-500">No custom domain connected yet.</p>
                <Link
                  href={`/dashboard/websites/${website.id}/domain`}
                  className="inline-flex h-9 px-4 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 transition-all shadow-xs items-center justify-center"
                >
                  Connect Domain
                </Link>
              </div>
            )}
          </div>

          {/* Content & Blog Engine Card */}
          <div className="rounded-2xl border border-purple-200/80 bg-purple-50/40 p-6 sm:p-7 shadow-xs hover:shadow-md transition-all duration-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-purple-600" />
                </div>
                <h3 className="text-base font-bold text-purple-950">
                  Content & Blog Engine
                </h3>
              </div>
            </div>

            <p className="text-sm font-medium text-slate-600 leading-relaxed">
              Create, edit, and publish SEO-optimized blog posts generated automatically with Codeaxys AI.
            </p>

            <Link
              href={`/dashboard/websites/${website.id}/blog`}
              className="w-full h-10 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-between transition-all shadow-xs"
            >
              <span>Open Blog Manager</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Technical Specifications & Details Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <Sliders className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Project Specifications
              </h3>
            </div>

            <div className="space-y-2.5 text-xs font-medium text-slate-600">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Slug:</span>
                <span className="font-mono font-bold text-slate-900">{website.slug}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Created:</span>
                <span className="font-semibold text-slate-800">
                  {new Date(website.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Website ID:</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[11px] text-slate-500">{website.id.slice(0, 12)}...</span>
                  <button
                    onClick={() => handleCopyId(website.id)}
                    className="p-1 text-slate-400 hover:text-purple-600"
                    title="Copy full website ID"
                  >
                    {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0 text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-lg">Delete this website?</h3>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  This will permanently delete <strong className="text-slate-900">{website.title}</strong>, its pages and its migrated assets. This action cannot be undone.
                </p>
              </div>
            </div>

            {deleteError && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
                {deleteError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="h-11 px-5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-bold text-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-11 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-all flex items-center gap-2 shadow-md shadow-red-600/20 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
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

      {/* Floating Website AI Assistant Launcher & Panel */}
      <WebsiteAgentChat websiteId={website.id} />
    </div>
  );
}
