"use client";

import React from "react";
import { SEOAnalysisResult } from "@/lib/seo-analyzer";
import { GscPerformanceData } from "@/components/SEOPerformanceDashboard";

export interface SEOOverviewDashboardProps {
  websiteId: string;
  seoScore: number;
  analysis: SEOAnalysisResult["analysis"] | null;
  imageStats: SEOAnalysisResult["image_stats"] | null;
  pagesSeo: any[];
  history: any[];
  gscPerformance: GscPerformanceData | null;
  loadingPerformance: boolean;
  isDirty: boolean;
  analysisStatus: string | null;
  lastAnalyzedAt: string | null;
  onAnalyze: () => Promise<void>;
  isAnalyzing: boolean;
  onNavigateTab: (tabId: string) => void;
  onConnectGsc: () => void;
  onSyncGsc: () => Promise<void>;
  isSyncingGsc: boolean;
  gscSyncError: string | null;
}

export function SEOOverviewDashboard({
  websiteId,
  seoScore,
  analysis,
  imageStats,
  pagesSeo = [],
  history = [],
  gscPerformance,
  loadingPerformance,
  isDirty,
  analysisStatus,
  lastAnalyzedAt,
  onAnalyze,
  isAnalyzing,
  onNavigateTab,
  onConnectGsc,
  onSyncGsc,
  isSyncingGsc,
  gscSyncError,
}: SEOOverviewDashboardProps) {
  // Score color helper
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (score >= 50) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-rose-600 bg-rose-50 border-rose-200";
  };

  const getScoreRingColor = (score: number) => {
    if (score >= 80) return "#10b981";
    if (score >= 50) return "#f59e0b";
    return "#f43f5e";
  };

  // Compute issue counts from analysis or page-level audits
  let criticalCount = 0;
  let warningCount = 0;
  let opportunityCount = 0;
  let passedCount = 0;

  if (analysis) {
    Object.values(analysis).forEach((item: any) => {
      const pct = (item.score / item.max) * 100;
      if (pct === 100) passedCount++;
      else if (pct >= 60) warningCount++;
      else criticalCount++;
    });
    // Opportunity items
    if (analysis.open_graph?.score < analysis.open_graph?.max) opportunityCount++;
    if (analysis.schema?.score < analysis.schema?.max) opportunityCount++;
  }

  // Calculate Category Sub-scores deterministically from analysis
  const computeCategoryScores = () => {
    if (!analysis) return null;
    const a = analysis;

    // 1. Organic / On-page: Title (20) + Description (15) + Headings (15) = 50 max
    const organicEarned = (a.title?.score || 0) + (a.description?.score || 0) + (a.headings?.score || 0);
    const organicScore = Math.round((organicEarned / 50) * 100);

    // 2. Technical SEO: Technical (10) + Canonical (5) + Robots (5) = 20 max
    const techEarned = (a.technical?.score || 0) + (a.canonical?.score || 0) + (a.robots?.score || 0);
    const techScore = Math.round((techEarned / 20) * 100);

    // 3. Content & Schema: Schema (10) + Images (10) = 20 max
    const contentEarned = (a.schema?.score || 0) + (a.images?.score || 0);
    const contentScore = Math.round((contentEarned / 20) * 100);

    // 4. OpenGraph & Social: OpenGraph (10) = 10 max
    const ogEarned = a.open_graph?.score || 0;
    const ogScore = Math.round((ogEarned / 10) * 100);

    return [
      { name: "Organic & On-Page SEO", score: organicScore, max: 100, tab: "organic", desc: "Title tags, meta descriptions, and heading structure" },
      { name: "Technical SEO & Indexing", score: techScore, max: 100, tab: "technical", desc: "Crawlability, canonical tags, and robots directives" },
      { name: "Content & Structured Data", score: contentScore, max: 100, tab: "settings", desc: "Schema.org markup and image alt attribute audits" },
      { name: "Open Graph & Social Sharing", score: ogScore, max: 100, tab: "settings", desc: "Social preview titles, descriptions, and media" },
    ];
  };

  const categories = computeCategoryScores();

  // Page Health Summary
  const totalPagesCount = pagesSeo.length;
  const healthyPagesCount = pagesSeo.filter((p) => (p.seo_score || 0) >= 80).length;
  const criticalPagesCount = pagesSeo.filter((p) => (p.critical_issues_count || 0) > 0).length;
  const orphanedPagesCount = pagesSeo.filter((p) => p.is_orphaned).length;

  // Priority Issues extraction
  const buildPriorityIssues = () => {
    const issues: Array<{
      severity: "critical" | "warning" | "opportunity";
      title: string;
      details: string;
      path?: string;
      tabDestination: string;
      actionLabel: string;
    }> = [];

    if (!analysis) return issues;

    const ISSUE_CONFIG: Record<
      string,
      {
        title: string;
        tabDestination: string;
        actionLabel: string;
        defaultCriticalDetails: string;
        defaultWarningDetails: string;
      }
    > = {
      title: {
        title: "SEO Title Tag Optimization",
        tabDestination: "settings",
        actionLabel: "Fix in SEO Settings",
        defaultCriticalDetails: "The page title tag is missing or critically unoptimized.",
        defaultWarningDetails: "The page title tag can be further optimized for search length and target keywords.",
      },
      description: {
        title: "Meta Description Optimization",
        tabDestination: "settings",
        actionLabel: "Fix Meta Description",
        defaultCriticalDetails: "A compelling meta description is required for high click-through rates.",
        defaultWarningDetails: "Meta description length or wording can be optimized for higher click-through rates.",
      },
      headings: {
        title: "Heading Structure Hierarchy",
        tabDestination: "settings",
        actionLabel: "Review Headings",
        defaultCriticalDetails: "Missing H1 tag or improper heading hierarchy detected.",
        defaultWarningDetails: "Heading tags (H1/H2) hierarchy can be enhanced for keyword clarity.",
      },
      canonical: {
        title: "Canonical URL Configuration",
        tabDestination: "technical",
        actionLabel: "Fix Canonical Tag",
        defaultCriticalDetails: "No canonical URL configured. Search engines may index duplicate URL variations.",
        defaultWarningDetails: "Canonical URL formatting should be reviewed.",
      },
      robots: {
        title: "Robots Indexing Directive",
        tabDestination: "technical",
        actionLabel: "Review Technical SEO",
        defaultCriticalDetails: "Search engine crawlers may be restricted from indexing pages.",
        defaultWarningDetails: "Robots indexing configurations need review.",
      },
      open_graph: {
        title: "Social Preview Cards Incomplete",
        tabDestination: "settings",
        actionLabel: "Fix Open Graph Cards",
        defaultCriticalDetails: "Configure Open Graph images and titles for WhatsApp, LinkedIn, and X.",
        defaultWarningDetails: "Social preview metadata can be enriched.",
      },
      schema: {
        title: "Enhance Structured Data (Schema.org)",
        tabDestination: "settings",
        actionLabel: "Configure Schema",
        defaultCriticalDetails: "Adding Organization or Article schema helps Google render rich snippets.",
        defaultWarningDetails: "Adding Schema.org rich markup helps Google render rich snippets.",
      },
      images: {
        title: "Missing Image Alt Attributes",
        tabDestination: "pages",
        actionLabel: "Review Image Alts",
        defaultCriticalDetails: "Several images on the website lack descriptive alt text.",
        defaultWarningDetails: "Some images can be improved with descriptive alt text.",
      },
      technical: {
        title: "Technical HTML Standards",
        tabDestination: "technical",
        actionLabel: "Review Technical SEO",
        defaultCriticalDetails: "HTML5 doctype, viewport, or charset directives missing.",
        defaultWarningDetails: "Technical HTML markup can be enhanced.",
      },
    };

    Object.entries(analysis).forEach(([key, item]: [string, any]) => {
      if (!item || typeof item.max !== "number" || item.max <= 0) return;
      const pct = (item.score / item.max) * 100;
      if (pct < 100) {
        const config = ISSUE_CONFIG[key] || {
          title: `Optimize ${key}`,
          tabDestination: "settings",
          actionLabel: "Review SEO",
          defaultCriticalDetails: `${key} requires critical SEO attention.`,
          defaultWarningDetails: `${key} can be further optimized.`,
        };

        const severity: "critical" | "warning" | "opportunity" =
          pct < 60 ? "critical" : key === "schema" ? "opportunity" : "warning";

        issues.push({
          severity,
          title: config.title,
          details: item.details || (pct < 60 ? config.defaultCriticalDetails : config.defaultWarningDetails),
          tabDestination: config.tabDestination,
          actionLabel: config.actionLabel,
        });
      }
    });

    if (orphanedPagesCount > 0) {
      issues.push({
        severity: "warning",
        title: `${orphanedPagesCount} Orphaned Page(s) Detected`,
        details: "Pages exist that are not linked from internal navigation.",
        tabDestination: "pages",
        actionLabel: "View Orphan Pages",
      });
    }

    // Sort by severity: critical first, then warning, then opportunity
    const severityOrder = { critical: 0, warning: 1, opportunity: 2 };
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return issues;
  };

  const priorityIssues = buildPriorityIssues();

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------- */}
      {/* SECTION A: SEO HEALTH SUMMARY CARD                            */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Left Score Gauge */}
          <div className="flex items-center gap-6">
            <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  strokeDasharray={`${seoScore}, 100`}
                  strokeWidth="3.5"
                  stroke={getScoreRingColor(seoScore)}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                  {seoScore}
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-400">/ 100</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">Overall Website SEO Score</h2>
                {isDirty ? (
                  <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    Re-audit Needed
                  </span>
                ) : analysisStatus === "queued" ? (
                  <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold rounded-full">
                    Analysis Queued
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-full">
                    Audit Up-to-Date
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 max-w-md leading-relaxed">
                Deterministic server-side audit evaluating website title, meta tags, image alts, crawlability, canonicals, and open graph standards.
              </p>

              {lastAnalyzedAt && (
                <p className="text-[11px] text-slate-400 font-mono">
                  Last analyzed: {new Date(lastAnalyzedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Right Action Button & Issue Metrics */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-4 w-full lg:w-auto">
            <button
              type="button"
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="px-5 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Analyzing Website...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Re-run Full SEO Audit
                </>
              )}
            </button>

            {/* Issue Count Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                {criticalCount} Critical
              </span>
              <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                {warningCount} Warnings
              </span>
              <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                {opportunityCount} Growth Ops
              </span>
              <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {passedCount} Passed
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION B: SEO CATEGORY HEALTH BREAKDOWN                     */}
      {/* ------------------------------------------------------------- */}
      {categories && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">SEO Category Health Breakdown</h3>
              <p className="text-xs text-slate-500 mt-0.5">High-level status of core search optimization domains.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {categories.map((cat, idx) => (
              <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{cat.name}</span>
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${getScoreColor(cat.score)}`}>
                    {cat.score}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">{cat.desc}</p>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${cat.score}%` }}
                    className={`h-full transition-all duration-500 ${
                      cat.score >= 80 ? "bg-emerald-500" : cat.score >= 50 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                    {cat.score >= 80 ? "Optimal" : cat.score >= 50 ? "Needs Improvement" : "Critical Attention"}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateTab(cat.tab)}
                    className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 transition-colors"
                  >
                    View Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SECTION C: PRIORITY ISSUES & ACTION ITEMS                     */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Priority Issues & Action Items</h3>
            <p className="text-xs text-slate-500 mt-0.5">Recommended tasks prioritized by severity impact on Google rankings.</p>
          </div>
          <span className="text-xs font-semibold text-slate-500 font-mono">
            {priorityIssues.length} Recommended Actions
          </span>
        </div>

        {priorityIssues.length === 0 ? (
          <div className="p-8 text-center bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 space-y-2">
            <svg className="w-8 h-8 mx-auto text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 className="text-sm font-bold">No Critical SEO Issues Found</h4>
            <p className="text-xs text-emerald-600">Your website passes all primary search engine health directives.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {priorityIssues.map((issue, idx) => (
              <div
                key={idx}
                className="p-4 border rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white hover:bg-slate-50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {issue.severity === "critical" && (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded uppercase tracking-wider">
                        Critical
                      </span>
                    )}
                    {issue.severity === "warning" && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded uppercase tracking-wider">
                        Warning
                      </span>
                    )}
                    {issue.severity === "opportunity" && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded uppercase tracking-wider">
                        Growth Op
                      </span>
                    )}
                    <h4 className="text-xs font-bold text-slate-900">{issue.title}</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-snug">{issue.details}</p>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateTab(issue.tabDestination)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shrink-0 transition-all self-end sm:self-auto"
                >
                  {issue.actionLabel} →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION D: PAGE HEALTH OVERVIEW                              */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Website Page Health Summary</h3>
            <p className="text-xs text-slate-500 mt-0.5">Aggregated audit status across all website pages.</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab("pages")}
            className="text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors"
          >
            View All Pages ({totalPagesCount}) →
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Pages</span>
            <span className="text-2xl font-extrabold text-slate-900 font-mono mt-1 block">{totalPagesCount}</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">Healthy Pages</span>
            <span className="text-2xl font-extrabold text-emerald-600 font-mono mt-1 block">{healthyPagesCount}</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider block">Critical Issues</span>
            <span className="text-2xl font-extrabold text-rose-600 font-mono mt-1 block">{criticalPagesCount}</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">Orphaned Pages</span>
            <span className="text-2xl font-extrabold text-amber-600 font-mono mt-1 block">{orphanedPagesCount}</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION E: RECENT ANALYSIS HISTORY TIMELINE                  */}
      {/* ------------------------------------------------------------- */}
      {history.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Recent SEO Audit History</h3>
              <p className="text-xs text-slate-500 mt-0.5">Historical audit executions and score progression timeline.</p>
            </div>
            <span className="text-xs font-mono text-slate-500">{history.length} Saved Records</span>
          </div>

          <div className="space-y-3">
            {history.map((record, idx) => {
              const prevRecord = history[idx + 1];
              const scoreDiff = prevRecord ? (record.seo_score || 0) - (prevRecord.seo_score || 0) : 0;

              return (
                <div
                  key={record.id || idx}
                  className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-white border border-slate-200 rounded font-mono font-bold text-slate-900">
                      Score: {record.seo_score}
                    </span>
                    {scoreDiff !== 0 && (
                      <span className={`font-mono font-bold text-[11px] ${scoreDiff > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff}
                      </span>
                    )}
                    <span className="text-slate-600">
                      Trigger: <strong className="font-mono text-slate-800">{record.trigger_type || "manual"}</strong>
                    </span>
                  </div>

                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(record.created_at).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SECTION F: GOOGLE SEARCH CONSOLE SUMMARY                      */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              Google Search Console Performance Intelligence
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Real search engine traffic, impression volume, and rankings.</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab("performance")}
            className="text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors"
          >
            View Full Performance Dashboard →
          </button>
        </div>

        {/* State A: DISCONNECTED */}
        {(!gscPerformance || !gscPerformance.connected || !gscPerformance.gsc_property) ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl mx-auto flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Search Console Not Connected</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Connect your Google Search Console property to see real organic clicks, impressions, keyword rankings, and CTR.
              </p>
            </div>
            <button
              type="button"
              onClick={onConnectGsc}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-2"
            >
              Connect Search Console
            </button>
          </div>
        ) : (
          /* State B: CONNECTED WITH DATA */
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Clicks (28d)</span>
                <span className="text-2xl font-extrabold text-slate-900 font-mono mt-1 block">
                  {gscPerformance.totals?.clicks.toLocaleString() || 0}
                </span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Impressions (28d)</span>
                <span className="text-2xl font-extrabold text-slate-900 font-mono mt-1 block">
                  {gscPerformance.totals?.impressions.toLocaleString() || 0}
                </span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider block">Avg CTR</span>
                <span className="text-2xl font-extrabold text-purple-600 font-mono mt-1 block">
                  {gscPerformance.totals?.ctr.toFixed(2) || 0}%
                </span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider block">Avg Position</span>
                <span className="text-2xl font-extrabold text-indigo-600 font-mono mt-1 block">
                  {gscPerformance.totals?.position ? `#${gscPerformance.totals.position.toFixed(1)}` : "—"}
                </span>
              </div>
            </div>

            {/* Top 3 Queries Preview */}
            {gscPerformance.queries && gscPerformance.queries.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900">Top Search Queries</h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                  {gscPerformance.queries.slice(0, 3).map((q, idx) => (
                    <div key={idx} className="p-3 bg-white flex items-center justify-between">
                      <span className="font-mono font-semibold text-slate-800">{q.query}</span>
                      <div className="flex items-center gap-4 text-slate-600 font-mono">
                        <span>{q.clicks} Clicks</span>
                        <span>{q.impressions} Imp</span>
                        <span className="text-purple-600 font-bold">#{q.position.toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION G: QUICK NAVIGATION HUB                              */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">SEO Management Modules</h3>
          <p className="text-xs text-slate-500 mt-0.5">Quickly navigate to specialized SEO tools and configurations.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => onNavigateTab("performance")}
            className="p-4 bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-slate-200 rounded-xl text-left transition-all group"
          >
            <div className="text-purple-600 font-bold text-xs group-hover:translate-x-0.5 transition-transform">Performance →</div>
            <div className="text-slate-900 font-bold text-xs mt-1">Search Console</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Clicks & Impressions</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("organic")}
            className="p-4 bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-slate-200 rounded-xl text-left transition-all group"
          >
            <div className="text-purple-600 font-bold text-xs group-hover:translate-x-0.5 transition-transform">Organic SEO →</div>
            <div className="text-slate-900 font-bold text-xs mt-1">Focus Keywords</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Content Fingerprint</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("technical")}
            className="p-4 bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-slate-200 rounded-xl text-left transition-all group"
          >
            <div className="text-purple-600 font-bold text-xs group-hover:translate-x-0.5 transition-transform">Technical SEO →</div>
            <div className="text-slate-900 font-bold text-xs mt-1">Indexing & Crawl</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Robots.txt & Sitemap</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("pages")}
            className="p-4 bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-slate-200 rounded-xl text-left transition-all group"
          >
            <div className="text-purple-600 font-bold text-xs group-hover:translate-x-0.5 transition-transform">Pages →</div>
            <div className="text-slate-900 font-bold text-xs mt-1">Page Health</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Orphan Analysis</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("keywords")}
            className="p-4 bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-slate-200 rounded-xl text-left transition-all group"
          >
            <div className="text-purple-600 font-bold text-xs group-hover:translate-x-0.5 transition-transform">Keywords →</div>
            <div className="text-slate-900 font-bold text-xs mt-1">Rank Tracking</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Keyword Visibility</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("ai_agent")}
            className="p-4 bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-slate-200 rounded-xl text-left transition-all group"
          >
            <div className="text-purple-600 font-bold text-xs group-hover:translate-x-0.5 transition-transform">AI SEO Agent →</div>
            <div className="text-slate-900 font-bold text-xs mt-1">AI Suggestions</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Smart Optimization</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("integrations")}
            className="p-4 bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-slate-200 rounded-xl text-left transition-all group"
          >
            <div className="text-purple-600 font-bold text-xs group-hover:translate-x-0.5 transition-transform">Integrations →</div>
            <div className="text-slate-900 font-bold text-xs mt-1">Connected Tools</div>
            <div className="text-[11px] text-slate-500 mt-0.5">GSC & Analytics Tags</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("monitoring")}
            className="p-4 bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-slate-200 rounded-xl text-left transition-all group"
          >
            <div className="text-purple-600 font-bold text-xs group-hover:translate-x-0.5 transition-transform">Monitoring 🔔 →</div>
            <div className="text-slate-900 font-bold text-xs mt-1">Scheduled Audits</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Alerts & Trend History</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("settings")}
            className="p-4 bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-slate-200 rounded-xl text-left transition-all group"
          >
            <div className="text-purple-600 font-bold text-xs group-hover:translate-x-0.5 transition-transform">SEO Settings →</div>
            <div className="text-slate-900 font-bold text-xs mt-1">Meta & Schema</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Global Configuration</div>
          </button>
        </div>
      </div>
    </div>
  );
}
