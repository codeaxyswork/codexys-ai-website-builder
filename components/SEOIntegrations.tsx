"use client";

import React from "react";

export interface IntegrationItem {
  id?: string;
  provider: string;
  status: string;
  configuration?: Record<string, any>;
  connected_at?: string | null;
  last_synced_at?: string | null;
}

interface SEOIntegrationsProps {
  integrations: IntegrationItem[];
  gaId: string;
  gtmId: string;
  onUpdateGaId: (val: string) => void;
  onUpdateGtmId: (val: string) => void;
  onSaveIntegration: (provider: string, status: string, config: any) => Promise<void>;
  canUseIntegrations: boolean;
  websiteId?: string;
  onOpenPropertySelector?: () => void;
}

export function SEOIntegrations({
  integrations,
  gaId,
  gtmId,
  onUpdateGaId,
  onUpdateGtmId,
  onSaveIntegration,
  websiteId,
}: SEOIntegrationsProps) {
  const gscItem = integrations.find((i) => i.provider === "google_search_console");
  const gscStatus = gscItem?.status || "disconnected";
  const gscConfig = gscItem?.configuration || {};
  const selectedProperty = gscConfig.selected_property || null;

  const handleConnectGsc = () => {
    if (!websiteId) return;
    window.location.href = `/api/seo/gsc/connect?website_id=${websiteId}&redirect=1`;
  };

  const handleDisconnectGsc = async () => {
    if (confirm("Are you sure you want to disconnect Google Search Console?")) {
      await onSaveIntegration("google_search_console", "disconnected", {});
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. GOOGLE ANALYTICS & TAG MANAGER */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Google Analytics & Tracking Tags
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Tracking scripts are automatically injected into published site pages.
            </p>
          </div>

          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              gaId || gtmId
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-50 text-slate-500 border-slate-200"
            }`}
          >
            {gaId || gtmId ? "Tags Active" : "Not Configured"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* GA4 */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                Google Analytics 4 (GA4)
              </span>
              <span className="text-[11px] font-mono text-slate-400">Measurement ID</span>
            </div>
            <div>
              <input
                type="text"
                value={gaId}
                onChange={(e) => onUpdateGaId(e.target.value)}
                placeholder="G-XXXXXXXXXX"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <p className="text-xs text-slate-500">
              Format: <code className="bg-white px-1 py-0.5 rounded border border-slate-200">G-XXXXXXXXXX</code>
            </p>
          </div>

          {/* GTM */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                Google Tag Manager (GTM)
              </span>
              <span className="text-[11px] font-mono text-slate-400">Container ID</span>
            </div>
            <div>
              <input
                type="text"
                value={gtmId}
                onChange={(e) => onUpdateGtmId(e.target.value)}
                placeholder="GTM-XXXXXXX"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <p className="text-xs text-slate-500">
              Format: <code className="bg-white px-1 py-0.5 rounded border border-slate-200">GTM-XXXXXXX</code>
            </p>
          </div>
        </div>
      </div>

      {/* 2. EXTERNAL SEO PLATFORMS & SEARCH CONSOLE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          SEO Platform Integrations & Search Console
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Google Search Console */}
          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-slate-900 text-sm">Google Search Console</span>
                {gscStatus === "connected" ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                    Connected
                  </span>
                ) : gscStatus === "property_selection_required" ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                    Select Property
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                    Disconnected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                Real Search Analytics, clicks, impressions, CTR, and search query position tracking.
              </p>

              {selectedProperty && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 truncate mb-2">
                  {selectedProperty}
                </div>
              )}
            </div>

            {gscStatus === "connected" ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleDisconnectGsc}
                  className="w-full py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition-all"
                >
                  Disconnect Account
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectGsc}
                className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-all"
              >
                Connect Search Console
              </button>
            )}
          </div>

          {/* Google Ads */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-slate-900 text-sm">Google Ads</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-200 text-slate-500 rounded-full">
                  Available
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Ad conversion tracking and PPC keyword query insights integration.
              </p>
            </div>
            <button
              disabled
              className="w-full py-2 px-3 bg-slate-200 text-slate-400 text-xs font-semibold rounded-lg cursor-not-allowed"
            >
              Not Connected
            </button>
          </div>

          {/* SEMrush */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-slate-900 text-sm">SEMrush</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-200 text-slate-500 rounded-full">
                  Available
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Keyword rankings, competitor domain analytics, and backlink audit integration.
              </p>
            </div>
            <button
              disabled
              className="w-full py-2 px-3 bg-slate-200 text-slate-400 text-xs font-semibold rounded-lg cursor-not-allowed"
            >
              Not Connected
            </button>
          </div>

          {/* Ahrefs */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-slate-900 text-sm">Ahrefs</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-200 text-slate-500 rounded-full">
                  Available
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Domain rating metrics, backlink profile tracking, and site health audits.
              </p>
            </div>
            <button
              disabled
              className="w-full py-2 px-3 bg-slate-200 text-slate-400 text-xs font-semibold rounded-lg cursor-not-allowed"
            >
              Not Connected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
