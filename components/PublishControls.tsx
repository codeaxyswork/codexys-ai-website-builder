"use client";

import React, { useState } from "react";
import { Globe, ExternalLink, Copy, Check, Loader2, Send, Lock } from "lucide-react";

interface PublishControlsProps {
  websiteId: string | null;
  isPublished: boolean;
  publishedSlug: string | null;
  onStatusChange?: (published: boolean, slug: string | null) => void;
}

export function PublishControls({
  websiteId,
  isPublished: initialPublished,
  publishedSlug: initialSlug,
  onStatusChange,
}: PublishControlsProps) {
  const [isPublished, setIsPublished] = useState(initialPublished);
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async () => {
    if (!websiteId || loading) return;
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

      setIsPublished(true);
      setSlug(data.slug);
      if (onStatusChange) onStatusChange(true, data.slug);
    } catch (err: any) {
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

      setIsPublished(false);
      if (onStatusChange) onStatusChange(false, slug);
    } catch (err: any) {
      console.error("Unpublish error:", err);
      setError("An error occurred while unpublishing.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!slug) return;
    const fullUrl = `${window.location.origin}/site/${slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!websiteId) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
        <Lock className="w-3.5 h-3.5 text-slate-400" />
        <span>Save website to enable public publishing</span>
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
            {isPublished && slug && (
              <span className="text-[10px] font-mono text-purple-700 block truncate max-w-[160px]">
                /site/{slug}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isPublished ? (
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
          ) : (
            <>
              <a
                href={`/site/${slug}`}
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
