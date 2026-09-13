"use client";

import React, { useState, useEffect } from "react";

export interface GscPropertyItem {
  siteUrl: string;
  permissionLevel: string;
  isDomainProperty: boolean;
  type: "domain" | "url_prefix";
}

interface GscPropertySelectorModalProps {
  websiteId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectProperty: (propertyUrl: string) => Promise<void>;
}

export function GscPropertySelectorModal({
  websiteId,
  isOpen,
  onClose,
  onSelectProperty,
}: GscPropertySelectorModalProps) {
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<GscPropertyItem[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchProperties();
    }
  }, [isOpen, websiteId]);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/websites/${websiteId}/seo/gsc/properties?_t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to load Search Console properties.");
      }

      const data = await res.json();
      const list = Array.isArray(data.properties)
        ? data.properties
        : Array.isArray(data.properties?.properties)
        ? data.properties.properties
        : [];
      setProperties(list);
      if (list.length > 0) {
        setSelectedUrl(list[0].siteUrl);
      } else {
        const fallback = data.debug?.fallbackCandidateUrls?.[0] || (data.website?.slug ? `https://codexys-ai-website-builder.vercel.app/site/${data.website.slug}/` : "");
        if (fallback) {
          setSelectedUrl(fallback);
        }
      }
    } catch (err: any) {
      console.error("Fetch Properties Modal Error:", err);
      setErrorMsg(err.message || "Failed to load properties.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedUrl) return;
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSelectProperty(selectedUrl);
      onClose();
    } catch (err: any) {
      console.error("Select Property Error:", err);
      setErrorMsg(err.message || "Failed to associate property.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Select Search Console Property</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose which Search Console property to associate with this website.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 font-bold text-lg"
          >
            ×
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
            {errorMsg}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-600 flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4 text-purple-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Discovering Search Console properties from Google...
          </div>
        ) : (
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {properties.length === 0 && (
              <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-900">Verified Website Property URL</div>
                <div className="text-xs text-slate-600 leading-relaxed">
                  Confirm your verified published website URL to associate with Search Console:
                </div>
                <input
                  type="text"
                  value={selectedUrl}
                  onChange={(e) => setSelectedUrl(e.target.value)}
                  placeholder="https://codexys-ai-website-builder.vercel.app/site/..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            )}
            {properties.map((prop) => (
              <label
                key={prop.siteUrl}
                className={`p-3.5 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                  selectedUrl === prop.siteUrl
                    ? "border-purple-600 bg-purple-50/50 shadow-xs"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="gsc_property"
                    value={prop.siteUrl}
                    checked={selectedUrl === prop.siteUrl}
                    onChange={() => setSelectedUrl(prop.siteUrl)}
                    className="text-purple-600 focus:ring-purple-500 h-4 w-4"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900 font-mono">{prop.siteUrl}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>Type: {prop.type === "domain" ? "Domain Property" : "URL-Prefix"}</span>
                      <span>• Permission: {prop.permissionLevel}</span>
                    </div>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    prop.isDomainProperty
                      ? "bg-purple-100 text-purple-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {prop.type === "domain" ? "Domain" : "URL Prefix"}
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !selectedUrl}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-2"
          >
            {isSubmitting ? "Associating..." : "Associate Property & Sync"}
          </button>
        </div>
      </div>
    </div>
  );
}
