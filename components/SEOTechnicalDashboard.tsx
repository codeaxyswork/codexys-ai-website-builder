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
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm mb-1">
              <Activity className="w-4 h-4" /> Technical SEO & Crawl Intelligence
            </div>
            <h2 className="text-2xl font-bold text-white">Crawl Graph & Technical Health</h2>
            <p className="text-slate-400 text-sm mt-1">
              Deep crawlable URL analysis, HTTP status breakdown, redirect chains, canonical signals, robots & XML sitemap consistency.
            </p>
          </div>
          <button
            onClick={handleRunCrawl}
            disabled={loading}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-sm font-semibold shadow-lg transition flex items-center gap-2 disabled:opacity-50 shrink-0"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Run Technical Crawl
          </button>
        </div>

        {/* Data Source Transparency Banner */}
        <div className="mt-4 bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold uppercase text-[10px]">
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
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400">Technical Score</div>
          <div className="text-2xl font-extrabold text-cyan-400 mt-1">{technicalScore} / 100</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400">URLs Crawled</div>
          <div className="text-2xl font-bold text-white mt-1">{crawlResult?.totalUrlsCrawled ?? latestRun?.total_urls_crawled ?? 0}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400">2xx Successful</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{statusCounts.ok2xx}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400">3xx Redirects</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{statusCounts.redirect3xx}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400">4xx Client Errors</div>
          <div className="text-2xl font-bold text-red-400 mt-1">{statusCounts.clientError4xx}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400">5xx Server Errors</div>
          <div className="text-2xl font-bold text-red-500 mt-1">{statusCounts.serverError5xx}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400">Blocked / Noindex</div>
          <div className="text-2xl font-bold text-slate-300 mt-1">{statusCounts.blocked + statusCounts.noindex}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400">Orphan Pages</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">{statusCounts.orphans}</div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('issues')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'issues' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4" /> Technical Issues ({issues.length})
          </button>
          <button
            onClick={() => setActiveTab('breakdown')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'breakdown' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Health Category Breakdown
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'graph' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <GitBranch className="w-4 h-4" /> Crawl Graph View
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'history' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Database className="w-4 h-4" /> Historical Crawl Runs ({historicalRuns.length})
          </button>
        </div>

        {/* TAB 1: TECHNICAL ISSUES */}
        {activeTab === 'issues' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-300 font-semibold">Filter Issues:</span>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-cyan-500"
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
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-cyan-500"
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
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold uppercase text-[10px]">
                          {iss.category}
                        </span>
                        <span className="font-semibold text-slate-300 text-sm">{iss.issue_type.replace(/_/g, ' ')}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                          iss.severity === 'critical'
                            ? 'bg-red-500/20 text-red-400'
                            : iss.severity === 'high'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {iss.severity}
                      </span>
                    </div>

                    <div className="text-slate-400 font-mono text-[11px] truncate">
                      <strong>URL:</strong> {iss.url}
                    </div>
                    <div className="text-slate-300">{iss.explanation}</div>
                    {iss.evidence && <div className="text-slate-400 italic bg-slate-900 p-2 rounded border border-slate-800">{iss.evidence}</div>}
                    <div className="text-emerald-400 pt-1">
                      <strong>Recommended Action:</strong> {iss.recommended_action}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <CheckCircle2 className="w-12 h-12 text-emerald-500/40 mx-auto mb-2" />
                <p>No technical issues detected for selected filters.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HEALTH BREAKDOWN */}
        {activeTab === 'breakdown' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center font-bold text-white">
                <span>Robots.txt Analysis</span>
                <span className="text-emerald-400">{crawlResult?.robotsTxtAnalysis?.exists ? 'Exists' : 'Not Found'}</span>
              </div>
              <p className="text-slate-400">
                Disallowed paths: {crawlResult?.robotsTxtAnalysis?.disallowedPathsCount || 0}
              </p>
              <p className="text-slate-400">
                Declared sitemaps: {crawlResult?.robotsTxtAnalysis?.sitemapsDeclared?.length || 0}
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center font-bold text-white">
                <span>XML Sitemap Health</span>
                <span className="text-cyan-400">{crawlResult?.sitemapAnalysis?.exists ? 'Valid Sitemap' : 'Missing'}</span>
              </div>
              <p className="text-slate-400">Declared URLs: {crawlResult?.sitemapAnalysis?.totalUrls || 0}</p>
              <p className="text-slate-400">
                Sitemap vs Crawl Mismatches: {crawlResult?.sitemapAnalysis?.sitemapVsCrawlMismatchesCount || 0}
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center font-bold text-white">
                <span>Canonical Signals</span>
                <span className="text-amber-400">Verified</span>
              </div>
              <p className="text-slate-400">Missing canonical tags: {issues.filter((i) => i.issue_type === 'missing_canonical').length}</p>
              <p className="text-slate-400">HTTP/HTTPS mismatches: {issues.filter((i) => i.issue_type === 'canonical_http_mismatch').length}</p>
            </div>
          </div>
        )}

        {/* TAB 3: CRAWL GRAPH */}
        {activeTab === 'graph' && (
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-4">
            <h4 className="text-sm font-semibold text-white">Technical Crawl Graph</h4>
            <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-xs text-slate-300">
              {crawlResult?.crawlGraph?.nodes?.map((node, idx) => (
                <div key={idx} className="p-2.5 bg-slate-900 border border-slate-800 rounded flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${node.statusCode < 300 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {node.statusCode}
                    </span>
                    <span className="truncate">{node.url}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400 text-[11px] shrink-0">
                    <span>Depth: {node.depth}</span>
                    {node.isOrphan && <span className="text-purple-400 font-bold">Orphan</span>}
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
              <div key={run.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white text-sm">
                    Crawl Run — {new Date(run.created_at).toLocaleString()}
                  </div>
                  <div className="text-slate-400 mt-1">
                    URLs Crawled: {run.total_urls_crawled} | Duration: {run.crawl_duration_ms}ms | Issues: {run.total_issues_count}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-cyan-400">{run.technical_score}</span>
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
