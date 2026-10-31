"use client";

import React, { useState } from "react";
import { ExternalLink, Copy, Check, Loader2, Send, Lock } from "lucide-react";
import { getWebsitePublicUrl, getWebsitePreviewUrl } from "@/lib/domain-resolver";
import { SaveState } from "./SaveStatus";
import { GeneratedFile } from "@/lib/types";
import { validateWebsiteBeforePublish } from "@/lib/publish-validator";

interface PublishControlsProps {
  websiteId: string | null;
  isPublished: boolean;
  publishedSlug: string | null;
  customDomain?: string | null;
  customDomainVerified?: boolean | null;
  customDomainStatus?: string | null;
  saveState?: SaveState;
  files?: GeneratedFile[];
  compact?: boolean;
  onStatusChange?: (published: boolean, slug: string | null) => void;
}

export function PublishControls({
  websiteId,
  isPublished: initialPublished,
  publishedSlug: initialSlug,
  customDomain,
  customDomainVerified,
  customDomainStatus,
  saveState,
  files,
  compact = false,
  onStatusChange,
}: PublishControlsProps) {
  const [publishedOverride, setPublishedOverride] = useState<boolean | null>(null);
  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const isPublished = publishedOverride ?? initialPublished;
  const slug = slugOverride ?? initialSlug;

  const handlePublish = async () => {
    if (!websiteId || loading) return;

    if (files && files.length > 0) {
      const val = validateWebsiteBeforePublish(files, saveState || "idle", websiteId);
      if (!val.canPublish) {
        setError(val.errors[0] || "Cannot publish website in current state.");
        return;
      }
      if (val.warnings.length > 0) {
        setWarnings(val.warnings);
      } else {
        setWarnings([]);
      }
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/websites/${websiteId}/publish`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setError(data.error || "Failed to publish website.");
        setLoading(false);
        return;
      }

      setPublishedOverride(true);
      setSlugOverride(data.slug);
      if (data.publicUrl) setPublishedUrl(data.publicUrl);
      if (onStatusChange) onStatusChange(true, data.slug);
    } catch (err: unknown) {
      console.error("Publish error:", err);
      setError("An error occurred while publishing.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!websiteId || loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/websites/${websiteId}/unpublish`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setError(data.error || "Failed to unpublish website.");
        setLoading(false);
        return;
      }

      setPublishedOverride(false);
      setPublishedUrl(null);
      if (onStatusChange) onStatusChange(false, slug);
    } catch (err: unknown) {
      console.error("Unpublish error:", err);
      setError("An error occurred while unpublishing.");
    } finally {
      setLoading(false);
    }
  };

  const canonicalUrl =
    publishedUrl ||
    getWebsitePublicUrl({
      published_slug: slug,
      custom_domain: customDomain,
      custom_domain_verified: customDomainVerified,
      custom_domain_status: customDomainStatus,
      is_published: isPublished,
    });

  const handleCopyLink = () => {
    if (!canonicalUrl) return;
    navigator.clipboard.writeText(canonicalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!websiteId) {
    if (compact) {
      return (
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-400">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>Draft</span>
        </span>
      );
    }
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
        <Lock className="w-3.5 h-3.5 text-slate-400" />
        <span>Save website to enable public publishing</span>
      </div>
    );
  }

  const previewUrl = getWebsitePreviewUrl({ published_slug: slug, slug });

  // Compact Mode (Header Toolbar)
  if (compact) {
    if (isPublished) {
      return (
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Live</span>
          </span>
          <a
            href={canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="View Live Published Site"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden md:inline">View Live</span>
          </a>
          <button
            onClick={handleCopyLink}
            title="Copy Public Link"
            className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-purple-600" />}
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5">
        {error && (
          <span className="hidden xl:inline text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200 truncate max-w-[200px]" title={error}>
            {error}
          </span>
        )}
        <button
          onClick={handlePublish}
          disabled={loading || saveState === "saving" || saveState === "retrying"}
          title="Publish your website live to the world"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>Publish</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="text-[11px] text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
          {error}
        </p>
      )}

      {warnings.length > 0 && !error && (
        <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 space-y-0.5">
          {warnings.map((w, idx) => (
            <p key={idx}>{w}</p>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isPublished ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          <div>
            <span className="text-xs font-bold text-slate-900 block">
              Status: {isPublished ? "Published" : "Draft"}
            </span>
            {slug && (
              <span className="text-[10px] font-mono text-purple-700 block truncate max-w-[160px]" title={canonicalUrl}>
                {slug}.codeaxys.com
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isPublished ? (
            <div className="flex items-center gap-1.5">
              {slug && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold transition-all"
                  title="Preview Draft Website"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </a>
              )}
              <button
                onClick={handlePublish}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Publish</span>
              </button>
            </div>
          ) : (
            <>
              <a
                href={canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-semibold transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">View</span>
              </a>

              <button
                onClick={handleCopyLink}
                title="Copy Public Link"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-purple-600" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>

              <button
                onClick={handleUnpublish}
                disabled={loading}
                className="px-2 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 text-xs font-medium transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Unpublish"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
