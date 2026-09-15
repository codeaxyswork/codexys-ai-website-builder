"use client";

import React, { useState, useEffect } from "react";
import { InternalLinkAnalysisResult, InternalLinkOpportunity } from "@/lib/internal-linking-engine";

interface InternalLinkingDashboardProps {
  websiteId: string;
}

export function InternalLinkingDashboard({ websiteId }: InternalLinkingDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [data, setData] = useState<InternalLinkAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchInternalLinks();
  }, [websiteId]);

  const fetchInternalLinks = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetch(`/api/websites/${websiteId}/seo/internal-links`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to load internal link analysis.");
      }
      const resData = await res.json();
      setData(resData);
    } catch (err: any) {
      console.error("Fetch internal links error:", err);
      setErrorMessage(err.message || "Failed to load internal link analysis.");
    } finally {
      setLoading(false);
    }
  };

  const handleReAnalyze = async () => {
    try {
      setIsAnalyzing(true);
      setErrorMessage(null);
      const res = await fetch(`/api/websites/${websiteId}/seo/internal-links`, {
        method: "POST",
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to run internal link analysis.");
      }
      const resData = await res.json();
      setData(resData);
    } catch (err: any) {
      console.error("Re-analyze error:", err);
      setErrorMessage(err.message || "Re-analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyFix = async (opp: InternalLinkOpportunity) => {
    try {
      setApplyingId(opp.id);
      setErrorMessage(null);
      setSuccessMsg(null);

      const res = await fetch(`/api/websites/${websiteId}/seo/internal-links/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: opp.id,
          sourcePath: opp.sourcePath,
          destinationPath: opp.destinationPath,
          suggestedAnchor: opp.suggestedAnchor,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to apply fix.");
      }

      setSuccessMsg(`Successfully applied internal link: ${opp.sourcePath} → ${opp.destinationPath}`);
      setTimeout(() => setSuccessMsg(null), 4000);

      // Re-fetch data to reflect updated state
      await handleReAnalyze();
    } catch (err: any) {
      console.error("Apply fix error:", err);
      setErrorMessage(err.message || "Failed to apply internal link fix.");
    } finally {
      setApplyingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
        <div className="inline-flex items-center gap-3 text-slate-600 font-medium text-sm">
          <svg className="animate-spin h-5 w-5 text-purple-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Analyzing Website & Blog Internal Link Structure...
        </div>
      </div>
    );
  }

  const score = data?.internal_link_score ?? 0;
  const summary = data?.summary || {
    total_pages: 0,
    total_published_blogs: 0,
    total_internal_links: 0,
    total_external_links: 0,
    broken_links_count: 0,
    orphan_pages_count: 0,
    weakly_linked_count: 0,
  };

  const opportunities = data?.opportunities || [];
  const nodesMap = data?.link_graph?.nodes || {};
  const nodeList = Object.values(nodesMap);

  const getScoreBadge = (s: number) => {
    if (s >= 80) return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">Optimal ({s}/100)</span>;
    if (s >= 60) return <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">Needs Improvement ({s}/100)</span>;
    return <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-full">Critical ({s}/100)</span>;
  };

  return (
    <div className="space-y-8">
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex justify-between items-center">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold text-rose-600">×</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex justify-between items-center">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold text-emerald-600">×</button>
        </div>
      )}

      {/* 1. Header & Health Scorecard */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900">Internal Linking Health</h2>
            {getScoreBadge(score)}
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Deterministic graph analysis of internal link distribution across website pages and published blog articles. High internal connectivity passes search authority and prevents orphaned content.
          </p>
          <div className="text-[11px] text-slate-400">
            Last analyzed: {data?.last_analyzed_at ? new Date(data.last_analyzed_at).toLocaleString() : "Just now"} • Deterministic Engine (0 AI Credits)
          </div>
        </div>

        <button
          type="button"
          onClick={handleReAnalyze}
          disabled={isAnalyzing}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all shadow-xs shrink-0 disabled:opacity-50"
        >
          {isAnalyzing ? "Analyzing Graph..." : "Re-Analyze Link Graph"}
        </button>
      </div>

      {/* 2. Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Internal Links</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{summary.total_internal_links}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Across {summary.total_pages + summary.total_published_blogs} total pages & articles</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Orphan Pages</span>
          <div className="text-2xl font-black text-amber-600 mt-1">{summary.orphan_pages_count}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">0 inbound internal links</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Weakly Linked</span>
          <div className="text-2xl font-black text-blue-600 mt-1">{summary.weakly_linked_count}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Only 1 inbound link</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Broken Links</span>
          <div className="text-2xl font-black text-rose-600 mt-1">{summary.broken_links_count}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Links to non-existent paths</span>
        </div>
      </div>

      {/* 3. Recommended Internal Linking Opportunities */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recommended Internal Link Opportunities ({opportunities.length})</h3>
            <p className="text-xs text-slate-500 mt-0.5">Prioritized recommendations to pass SEO authority and fix orphaned content.</p>
          </div>
        </div>

        {opportunities.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
            ✓ Excellent link coverage! No critical internal linking gaps detected.
          </div>
        ) : (
          <div className="space-y-4">
            {opportunities.map((opp) => (
              <div key={opp.id} className="p-5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-purple-200 transition-all">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    {opp.type === "orphan_fix" && (
                      <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase rounded-md border border-amber-200">
                        Orphan Fix
                      </span>
                    )}
                    {opp.type === "blog_to_page" && (
                      <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold uppercase rounded-md border border-purple-200">
                        Blog → Page
                      </span>
                    )}
                    {opp.type === "page_to_blog" && (
                      <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold uppercase rounded-md border border-blue-200">
                        Page → Blog
                      </span>
                    )}
                    {opp.type === "weak_coverage" && (
                      <span className="px-2.5 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold uppercase rounded-md">
                        Weak Coverage
                      </span>
                    )}
                    <span className="text-xs font-mono font-bold text-slate-900">{opp.sourcePath}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-xs font-mono font-bold text-purple-700">{opp.destinationPath}</span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">{opp.reason}</p>

                  <div className="text-[11px] text-slate-500 font-medium">
                    Suggested Anchor: <span className="px-2 py-0.5 bg-white border border-slate-200 font-mono font-bold text-slate-900 rounded">{opp.suggestedAnchor}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleApplyFix(opp)}
                  disabled={applyingId === opp.id}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-all shrink-0 disabled:opacity-50"
                >
                  {applyingId === opp.id ? "Applying Fix..." : "Apply Fix"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Internal Link Graph Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
          Page & Article Internal Link Audit ({nodeList.length} Items)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <th className="py-3 px-4">Path</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-center">Inbound Links</th>
                <th className="py-3 px-4 text-center">Outbound Links</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nodeList.map((node) => (
                <tr key={node.path} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                    {node.path}
                    <span className="text-[11px] font-sans text-slate-400 block font-normal">{node.title}</span>
                  </td>
                  <td className="py-3 px-4 capitalize font-semibold text-slate-600">
                    {node.type === "blog" ? (
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-bold">
                        Blog Post
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                        Website Page
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-slate-900">{node.inDegree}</td>
                  <td className="py-3 px-4 text-center text-slate-600">{node.outDegree}</td>
                  <td className="py-3 px-4 text-center">
                    {node.isOrphan ? (
                      <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                        Orphaned
                      </span>
                    ) : node.isWeaklyLinked ? (
                      <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full">
                        Weakly Linked
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                        Optimal
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
