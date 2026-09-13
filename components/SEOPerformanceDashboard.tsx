"use client";

import React, { useState } from "react";

export interface GscPerformanceData {
  connected: boolean;
  status: string;
  gsc_property: string | null;
  property_verified: boolean;
  last_synced_at: string | null;
  totals: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  } | null;
  daily_trends: Array<{
    date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  queries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  pages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

interface SEOPerformanceDashboardProps {
  websiteId: string;
  performance: GscPerformanceData | null;
  loading: boolean;
  onConnect: () => void;
  onSync: () => Promise<void>;
  isSyncing: boolean;
  syncError: string | null;
  onOpenPropertySelector: () => void;
}

export function SEOPerformanceDashboard({
  performance,
  loading,
  onConnect,
  onSync,
  isSyncing,
  syncError,
  onOpenPropertySelector,
}: SEOPerformanceDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<"queries" | "pages">("queries");

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
        <div className="inline-flex items-center gap-3 text-slate-600 font-medium">
          <svg className="animate-spin h-6 w-6 text-purple-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading Google Search Console performance data...
        </div>
      </div>
    );
  }

  // 1. DISCONNECTED / NOT CONNECTED STATE
  if (!performance || !performance.connected || !performance.gsc_property) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 shadow-xs">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-md">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-slate-900">Google Search Console Integration</h3>
            <p className="text-slate-600 text-sm mt-2 leading-relaxed">
              Connect your Google Search Console account to track real organic search queries, total clicks, search impressions, CTR, and keyword rankings directly inside Codeaxys.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onConnect}
              className="w-full sm:w-auto px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
              </svg>
              Connect Google Search Console
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left pt-6 border-t border-slate-100">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs font-bold text-slate-900 block mb-1">Real Search Queries</span>
              <span className="text-xs text-slate-500">See exact keywords users type in Google to find your site.</span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs font-bold text-slate-900 block mb-1">Organic Clicks & CTR</span>
              <span className="text-xs text-slate-500">Monitor click-through rates and impression volumes.</span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs font-bold text-slate-900 block mb-1">Zero Cost (0 Credits)</span>
              <span className="text-xs text-slate-500">GSC synchronization is 100% free and costs 0 AI credits.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totals = performance.totals || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const dailyTrends = performance.daily_trends || [];
  const maxClicks = Math.max(...dailyTrends.map((d) => d.clicks), 1);
  const maxImpressions = Math.max(...dailyTrends.map((d) => d.impressions), 1);

  return (
    <div className="space-y-8">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-slate-900">Google Search Console Performance</h3>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Connected
            </span>
            {performance.property_verified ? (
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold rounded-full">
                Website Verified
              </span>
            ) : (
              <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold rounded-full">
                Property Selected
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span>Property: <strong className="text-slate-700 font-mono">{performance.gsc_property}</strong></span>
            {performance.last_synced_at && (
              <span>• Last synced: {new Date(performance.last_synced_at).toLocaleString()}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onOpenPropertySelector}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
          >
            Change Property
          </button>
          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-2"
          >
            {isSyncing ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </>
            )}
          </button>
        </div>
      </div>

      {syncError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium">
          {syncError}
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Clicks */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Clicks</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
            {totals.clicks.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-1">Last 28 Days</div>
        </div>

        {/* Total Impressions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Impressions</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
            {totals.impressions.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-1">Last 28 Days</div>
        </div>

        {/* Average CTR */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average CTR</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 mt-2">
            {totals.ctr.toFixed(2)}%
          </div>
          <div className="text-xs text-slate-400 mt-1">Click-Through Rate</div>
        </div>

        {/* Average Position */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Position</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-indigo-600 mt-2">
            {totals.position > 0 ? totals.position.toFixed(1) : "—"}
          </div>
          <div className="text-xs text-slate-400 mt-1">Google Rank Position</div>
        </div>
      </div>

      {/* Trend Visualization Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h4 className="text-base font-bold text-slate-900 mb-4 flex items-center justify-between">
          <span>Search Performance Trends (Last 28 Days)</span>
          <span className="text-xs text-slate-500 font-normal">Real Google Search Analytics</span>
        </h4>

        {dailyTrends.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <p className="text-xs text-slate-600">No cached trend data yet for this property.</p>
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg"
            >
              Sync Search Console Data
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-44 w-full flex items-end gap-1.5 pt-4 pb-2 px-1 border-b border-slate-100 overflow-x-auto">
              {dailyTrends.map((item, idx) => {
                const clickHeightPct = Math.max(10, Math.round((item.clicks / maxClicks) * 100));
                return (
                  <div
                    key={idx}
                    className="flex-1 min-w-[12px] flex flex-col items-center group relative cursor-pointer"
                  >
                    {/* Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 bg-slate-900 text-white text-[10px] rounded p-2 shadow-lg z-20 pointer-events-none whitespace-nowrap">
                      <div className="font-bold">{item.date}</div>
                      <div>Clicks: {item.clicks}</div>
                      <div>Impressions: {item.impressions}</div>
                      <div>CTR: {item.ctr.toFixed(1)}%</div>
                    </div>
                    {/* Bar */}
                    <div
                      style={{ height: `${clickHeightPct}%` }}
                      className="w-full bg-purple-500 hover:bg-purple-600 rounded-t transition-all"
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>{dailyTrends[0]?.date}</span>
              <span>{dailyTrends[Math.floor(dailyTrends.length / 2)]?.date}</span>
              <span>{dailyTrends[dailyTrends.length - 1]?.date}</span>
            </div>
          </div>
        )}
      </div>

      {/* Top Queries / Top Pages Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveSubTab("queries")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeSubTab === "queries"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              Top Queries ({performance.queries.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("pages")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeSubTab === "pages"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              Top Pages ({performance.pages.length})
            </button>
          </div>
        </div>

        {activeSubTab === "queries" && (
          <div>
            {performance.queries.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No Search Console query data synced yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="py-3 px-4">Query</th>
                      <th className="py-3 px-4 text-right">Clicks</th>
                      <th className="py-3 px-4 text-right">Impressions</th>
                      <th className="py-3 px-4 text-right">CTR</th>
                      <th className="py-3 px-4 text-right">Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {performance.queries.map((q, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-semibold text-slate-900 font-mono">{q.query}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900">{q.clicks.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-slate-600">{q.impressions.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-medium text-purple-600">{q.ctr.toFixed(2)}%</td>
                        <td className="py-3 px-4 text-right">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono font-semibold rounded">
                            #{q.position.toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeSubTab === "pages" && (
          <div>
            {performance.pages.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No Search Console page data synced yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="py-3 px-4">Page URL</th>
                      <th className="py-3 px-4 text-right">Clicks</th>
                      <th className="py-3 px-4 text-right">Impressions</th>
                      <th className="py-3 px-4 text-right">CTR</th>
                      <th className="py-3 px-4 text-right">Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {performance.pages.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium text-slate-900 font-mono truncate max-w-xs">{p.page}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900">{p.clicks.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-slate-600">{p.impressions.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-medium text-purple-600">{p.ctr.toFixed(2)}%</td>
                        <td className="py-3 px-4 text-right">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono font-semibold rounded">
                            #{p.position.toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
