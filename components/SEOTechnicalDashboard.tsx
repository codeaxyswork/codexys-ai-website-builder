'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Database,
  ExternalLink,
  FileCode,
  FileText,
  Filter,
  GitBranch,
  Globe,
  Layers,
  Link2,
  RefreshCw,
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { TechnicalCrawlResult, TechnicalCrawlIssue } from '@/lib/seo-technical/types';

interface SEOTechnicalDashboardProps {
  websiteId: string;
}

export function SEOTechnicalDashboard({ websiteId }: SEOTechnicalDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [crawlResult, setCrawlResult] = useState<TechnicalCrawlResult | null>(null);
  const [historicalRuns, setHistoricalRuns] = useState<any[]>([]);
  const [issues, setIssues] = useState<TechnicalCrawlIssue[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'issues' | 'breakdown' | 'graph' | 'history'>('issues');

  // Load latest crawl data and historical runs
  useEffect(() => {
    loadDashboardData();
  }, [websiteId]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch runs
      const runsRes = await fetch(`/api/websites/${websiteId}/seo/technical/runs`);
      const runsData = await runsRes.json();
      if (runsData.runs) {
        setHistoricalRuns(runsData.runs);
      }

      // Fetch issues
      const issuesRes = await fetch(`/api/websites/${websiteId}/seo/technical/issues`);
      const issuesData = await issuesRes.json();
      if (issuesData.issues) {
        setIssues(issuesData.issues);
      }
    } catch (err: any) {
      setError('Failed to load technical crawl data.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunCrawl = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/technical/crawl`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Technical crawl failed');

      setCrawlResult(data.result);
      if (data.result.issues) {
        setIssues(data.result.issues);
      }
      loadDashboardData();
    } catch (err: any) {
      setError(err?.message || 'Error running technical crawl');
    } finally {
      setLoading(false);
    }
  };

  const filteredIssues = issues.filter((iss) => {
    if (severityFilter !== 'all' && iss.severity !== severityFilter) return false;
    if (categoryFilter !== 'all' && iss.category !== categoryFilter) return false;
    return true;
  });

  const latestRun = historicalRuns[0];
  const technicalScore = crawlResult?.technicalScore ?? latestRun?.technical_score ?? 0;
  const statusCounts = crawlResult?.statusCounts || latestRun?.summary_breakdown?.statusCounts || {
    ok2xx: 0,
    redirect3xx: 0,
    clientError4xx: 0,
    serverError5xx: 0,
    blocked: 0,
    noindex: 0,
    orphans: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-cyan-50/80 via-blue-50/50 to-slate-50 border border-cyan-100/80 rounded-xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-cyan-200/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-cyan-700 font-semibold text-sm mb-1">
              <Activity className="w-4 h-4" /> Technical SEO & Crawl Intelligence
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Crawl Graph & Technical Health</h2>
            <p className="text-slate-600 text-sm mt-1">
              Deep crawlable URL analysis, HTTP status breakdown, redirect chains, canonical signals, robots & XML sitemap consistency.
            </p>
          </div>
          <button
            onClick={handleRunCrawl}
            disabled={loading}
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold shadow-xs transition flex items-center gap-2 disabled:opacity-50 shrink-0"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Run Technical Crawl
          </button>
        </div>

        {/* Data Source Transparency Banner */}
        <div className="mt-4 bg-white border border-slate-200 shadow-2xs rounded-lg p-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 font-bold uppercase text-[10px]">
              OBSERVED BY CODEAXYS CRAWLER
            </span>
            <span>Technical status codes, canonical link tags, robots rules, and redirect chains.</span>
          </div>
          <div className="text-slate-500 text-[11px]">
            GSC Indexing data integrated where connected
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" /> {error}
        </div>
      )}

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-white border border-slate-200 shadow-2xs rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 font-medium">Technical Score</div>
          <div className="text-2xl font-extrabold text-cyan-600 mt-1">{technicalScore} / 100</div>
        </div>
        <div className="bg-white border border-slate-200 shadow-2xs rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 font-medium">URLs Crawled</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{crawlResult?.totalUrlsCrawled ?? latestRun?.total_urls_crawled ?? 0}</div>
        </div>
        <div className="bg-white border border-slate-200 shadow-2xs rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 font-medium">2xx Successful</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{statusCounts.ok2xx}</div>
        </div>
        <div className="bg-white border border-slate-200 shadow-2xs rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 font-medium">3xx Redirects</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{statusCounts.redirect3xx}</div>
        </div>
        <div className="bg-white border border-slate-200 shadow-2xs rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 font-medium">4xx Client Errors</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{statusCounts.clientError4xx}</div>
        </div>
        <div className="bg-white border border-slate-200 shadow-2xs rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 font-medium">5xx Server Errors</div>
          <div className="text-2xl font-bold text-rose-700 mt-1">{statusCounts.serverError5xx}</div>
        </div>
        <div className="bg-white border border-slate-200 shadow-2xs rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 font-medium">Blocked / Noindex</div>
          <div className="text-2xl font-bold text-slate-700 mt-1">{statusCounts.blocked + statusCounts.noindex}</div>
        </div>
        <div className="bg-white border border-slate-200 shadow-2xs rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 font-medium">Orphan Pages</div>
          <div className="text-2xl font-bold text-purple-600 mt-1">{statusCounts.orphans}</div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('issues')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'issues' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4" /> Technical Issues ({issues.length})
          </button>
          <button
            onClick={() => setActiveTab('breakdown')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'breakdown' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Health Category Breakdown
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'graph' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <GitBranch className="w-4 h-4" /> Crawl Graph View
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'history' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Database className="w-4 h-4" /> Historical Crawl Runs ({historicalRuns.length})
          </button>
        </div>

        {/* TAB 1: TECHNICAL ISSUES */}
        {activeTab === 'issues' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-xs text-slate-700 font-semibold">Filter Issues:</span>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
                >
                  <option value="all">All Categories</option>
                  <option value="status_codes">Status Codes</option>
                  <option value="redirects">Redirects</option>
                  <option value="canonicals">Canonicals</option>
                  <option value="indexability">Indexability</option>
                  <option value="sitemap">Sitemap</option>
                  <option value="robots">Robots.txt</option>
                  <option value="structured_data">Structured Data</option>
                  <option value="page_quality">Page Quality</option>
                </select>
              </div>
            </div>

            {/* Issues Cards */}
            {filteredIssues.length > 0 ? (
              <div className="space-y-3">
                {filteredIssues.map((iss, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 font-bold uppercase text-[10px]">
                          {iss.category}
                        </span>
                        <span className="font-bold text-slate-900 text-sm">{iss.issue_type.replace(/_/g, ' ')}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                          iss.severity === 'critical'
                            ? 'bg-rose-100 text-rose-800'
                            : iss.severity === 'high'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {iss.severity}
                      </span>
                    </div>

                    <div className="text-slate-600 font-mono text-[11px] truncate">
                      <strong>URL:</strong> {iss.url}
                    </div>
                    <div className="text-slate-700">{iss.explanation}</div>
                    {iss.evidence && <div className="text-slate-700 italic bg-white p-2 rounded border border-slate-200">{iss.evidence}</div>}
                    <div className="text-emerald-700 font-medium pt-1">
                      <strong>Recommended Action:</strong> {iss.recommended_action}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <CheckCircle2 className="w-12 h-12 text-emerald-500/60 mx-auto mb-2" />
                <p>No technical issues detected for selected filters.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HEALTH BREAKDOWN */}
        {activeTab === 'breakdown' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center font-bold text-slate-900">
                <span>Robots.txt Analysis</span>
                <span className="text-emerald-700 font-bold">{crawlResult?.robotsTxtAnalysis?.exists ? 'Exists' : 'Not Found'}</span>
              </div>
              <p className="text-slate-600">
                Disallowed paths: {crawlResult?.robotsTxtAnalysis?.disallowedPathsCount || 0}
              </p>
              <p className="text-slate-600">
                Declared sitemaps: {crawlResult?.robotsTxtAnalysis?.sitemapsDeclared?.length || 0}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center font-bold text-slate-900">
                <span>XML Sitemap Health</span>
                <span className="text-cyan-700 font-bold">{crawlResult?.sitemapAnalysis?.exists ? 'Valid Sitemap' : 'Missing'}</span>
              </div>
              <p className="text-slate-600">Declared URLs: {crawlResult?.sitemapAnalysis?.totalUrls || 0}</p>
              <p className="text-slate-600">
                Sitemap vs Crawl Mismatches: {crawlResult?.sitemapAnalysis?.sitemapVsCrawlMismatchesCount || 0}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center font-bold text-slate-900">
                <span>Canonical Signals</span>
                <span className="text-amber-700 font-bold">Verified</span>
              </div>
              <p className="text-slate-600">Missing canonical tags: {issues.filter((i) => i.issue_type === 'missing_canonical').length}</p>
              <p className="text-slate-600">HTTP/HTTPS mismatches: {issues.filter((i) => i.issue_type === 'canonical_http_mismatch').length}</p>
            </div>
          </div>
        )}

        {/* TAB 3: CRAWL GRAPH */}
        {activeTab === 'graph' && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
            <h4 className="text-sm font-bold text-slate-900">Technical Crawl Graph</h4>
            <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-xs text-slate-800">
              {crawlResult?.crawlGraph?.nodes?.map((node, idx) => (
                <div key={idx} className="p-2.5 bg-white border border-slate-200 rounded flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${node.statusCode < 300 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {node.statusCode}
                    </span>
                    <span className="truncate">{node.url}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-500 text-[11px] shrink-0">
                    <span>Depth: {node.depth}</span>
                    {node.isOrphan && <span className="text-purple-700 font-bold">Orphan</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: HISTORICAL RUNS */}
        {activeTab === 'history' && (
          <div className="space-y-3 text-xs">
            {historicalRuns.map((run) => (
              <div key={run.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-sm">
                    Crawl Run — {new Date(run.created_at).toLocaleString()}
                  </div>
                  <div className="text-slate-600 mt-1">
                    URLs Crawled: {run.total_urls_crawled} | Duration: {run.crawl_duration_ms}ms | Issues: {run.total_issues_count}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-cyan-600">{run.technical_score}</span>
                  <span className="text-slate-400"> / 100</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
