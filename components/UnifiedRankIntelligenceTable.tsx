'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  PenTool,
  Zap,
  BarChart3,
  Layers,
  ArrowUpDown,
  Filter,
  Info,
  Shield,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface UnifiedRankKeywordItem {
  id: string;
  query: string;
  is_focus_keyword: boolean;
  gsc_position: number | null;
  gsc_clicks: number;
  gsc_impressions: number;
  gsc_ctr: number;
  ai_visibility_score: number | null;
  ai_citation_rate: number | null;
  ai_sample_count: number;
  ai_sample_status: 'live_sample' | 'historical_sample' | 'insufficient_sample' | 'unprobed';
  ai_last_probed_at: string | null;
  gap_status: 'AI_CITATION_GAP' | 'STRONG_IN_BOTH' | 'RANK_OPPORTUNITY' | 'AI_WIN' | 'UNPROBED';
  gap_description: string;
  opportunity_id?: string | null;
}

interface RankIntelligenceSummary {
  total_keywords: number;
  gsc_page_one_count: number;
  ai_citation_gaps_count: number;
  strong_in_both_count: number;
  unprobed_count: number;
  live_ai_enabled: boolean;
  credit_cost_per_single_probe: number;
  daily_probe_limit_per_website: number;
}

interface UnifiedRankIntelligenceTableProps {
  websiteId: string;
  isGscConnected: boolean;
  onConnectGsc?: () => void;
  onNavigateToContentStudio?: (topic?: string, keyword?: string) => void;
}

type FilterCategory = 'all' | 'gaps' | 'page_one' | 'strong' | 'unprobed';
type SortField = 'query' | 'gsc_position' | 'clicks' | 'impressions' | 'ai_citation' | 'gap';
type SortDirection = 'asc' | 'desc';

export function UnifiedRankIntelligenceTable({
  websiteId,
  isGscConnected,
  onConnectGsc,
  onNavigateToContentStudio,
}: UnifiedRankIntelligenceTableProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<UnifiedRankKeywordItem[]>([]);
  const [summary, setSummary] = useState<RankIntelligenceSummary | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [sortField, setSortField] = useState<SortField>('gap');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Action states
  const [probingQuery, setProbingQuery] = useState<string | null>(null);
  const [generatingOpportunityFor, setGeneratingOpportunityFor] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/rank-intelligence`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load unified rank intelligence data');
      }
      setKeywords(data.keywords || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      setError(err.message || 'Error loading rank data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [websiteId]);

  // Handle single keyword probe
  const handleProbeKeyword = async (query: string) => {
    setProbingQuery(query);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/rank-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'probe_query', query }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to probe AI visibility');
      }

      // Update in local state
      if (data.updated_keyword) {
        setKeywords((prev) =>
          prev.map((k) => (k.query.toLowerCase() === query.toLowerCase() ? data.updated_keyword : k))
        );
      } else {
        await fetchData();
      }

      const modeText = data.live_mode ? 'live multi-engine' : 'simulated (live disabled)';
      setActionMessage({
        text: `AI visibility analyzed for "${query}" (${modeText}). Deducted ${data.credits_deducted} credits.`,
        type: 'success',
      });
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Probe error occurred', type: 'error' });
    } finally {
      setProbingQuery(null);
    }
  };

  // Handle generating opportunity
  const handleGenerateOpportunity = async (query: string) => {
    setGeneratingOpportunityFor(query);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/rank-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_opportunity', query }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create SEO opportunity');
      }

      // Refresh data
      await fetchData();
      setActionMessage({
        text: data.message || `SEO Opportunity created for "${query}". Ready for Content Studio handoff!`,
        type: 'success',
      });
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to create opportunity', type: 'error' });
    } finally {
      setGeneratingOpportunityFor(null);
    }
  };

  // Filtered & Sorted Keywords
  const filteredKeywords = useMemo(() => {
    let result = [...keywords];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((item) => item.query.toLowerCase().includes(q));
    }

    // Category filter
    if (activeFilter === 'gaps') {
      result = result.filter((item) => item.gap_status === 'AI_CITATION_GAP');
    } else if (activeFilter === 'page_one') {
      result = result.filter((item) => item.gsc_position !== null && item.gsc_position <= 10);
    } else if (activeFilter === 'strong') {
      result = result.filter((item) => item.gap_status === 'STRONG_IN_BOTH');
    } else if (activeFilter === 'unprobed') {
      result = result.filter((item) => item.ai_sample_status === 'unprobed');
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'query':
          comparison = a.query.localeCompare(b.query);
          break;
        case 'gsc_position':
          const posA = a.gsc_position ?? 999;
          const posB = b.gsc_position ?? 999;
          comparison = posA - posB;
          break;
        case 'clicks':
          comparison = a.gsc_clicks - b.gsc_clicks;
          break;
        case 'impressions':
          comparison = a.gsc_impressions - b.gsc_impressions;
          break;
        case 'ai_citation':
          const citeA = a.ai_citation_rate ?? -1;
          const citeB = b.ai_citation_rate ?? -1;
          comparison = citeA - citeB;
          break;
        case 'gap':
          const priorityOrder: Record<string, number> = {
            AI_CITATION_GAP: 5,
            RANK_OPPORTUNITY: 4,
            STRONG_IN_BOTH: 3,
            AI_WIN: 2,
            UNPROBED: 1,
          };
          comparison = (priorityOrder[a.gap_status] || 0) - (priorityOrder[b.gap_status] || 0);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [keywords, searchQuery, activeFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'gsc_position' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Live AI Visibility Status Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Unified SERP + AI Intelligence
              </span>
              {summary?.live_ai_enabled ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-400" /> Live AI Engine Active
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-amber-400" /> Live AI Safeguarded (Mock Probes)
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Unified Keyword & Citation Intelligence</h2>
            <p className="text-sm text-slate-300 max-w-2xl mt-1">
              Correlate historical Google Search Console rankings with AI generative engine visibility (ChatGPT, Perplexity, Gemini, Claude).
              Identify keywords where you hold Google top-10 positions but lack AI citations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-medium border border-slate-700/60 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
              Refresh Data
            </button>
          </div>
        </div>

        {/* 2. Informational Disclosure Notice (Mandatory Requirement 5) */}
        <div className="mt-5 p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-200/90 flex items-start gap-3">
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-white">Note on Google Search Console Metrics:</strong> The position shown below is Google's{' '}
            <span className="underline decoration-indigo-400 font-semibold">Average Position</span> aggregate reported by Google Search Console across all queries, user locations, and search intents over time. It is not an instantaneous single-point SERP tracker rank. Live on-demand SERP rank checks require specialized SERP scraping infrastructure (such as DataForSEO).
          </div>
        </div>
      </div>

      {/* 3. Executive KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Total Tracked</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{summary?.total_keywords ?? keywords.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Queries & focus terms</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Google Top 10</span>
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-700">{summary?.gsc_page_one_count ?? 0}</div>
          <div className="text-[11px] text-purple-600/80 mt-1">Avg position ≤ 10.0</div>
        </div>

        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 text-xs font-medium mb-1">
            <span>AI Citation Gaps</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-800">{summary?.ai_citation_gaps_count ?? 0}</div>
          <div className="text-[11px] text-amber-700 mt-1">Top-10 Google, low AI cit.</div>
        </div>

        <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-medium mb-1">
            <span>Dominant in Both</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-800">{summary?.strong_in_both_count ?? 0}</div>
          <div className="text-[11px] text-emerald-700 mt-1">Google top-10 + AI cited</div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Awaiting AI Probe</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-700">{summary?.unprobed_count ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Cost: 1 credit / probe</div>
        </div>
      </div>

      {/* Action Message Toast */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : actionMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-indigo-50 border-indigo-200 text-indigo-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : actionMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-indigo-600 shrink-0" />
            )}
            <span className="font-medium">{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-xs underline ml-4 hover:opacity-75 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4. Controls: Filter Pills & Search */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Keywords ({keywords.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('gaps')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeFilter === 'gaps'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              AI Citation Gaps ({keywords.filter((k) => k.gap_status === 'AI_CITATION_GAP').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('page_one')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeFilter === 'page_one'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/60'
              }`}
            >
              Google Page 1 (Top 10)
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('strong')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeFilter === 'strong'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
              }`}
            >
              Dominant in Both
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('unprobed')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeFilter === 'unprobed'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Awaiting AI Probe
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by keyword / query..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* GSC Not Connected Banner if applicable */}
        {!isGscConnected && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Google Search Console is not connected for this site. Search rankings and impressions cannot be populated automatically.</span>
            </div>
            {onConnectGsc && (
              <button
                type="button"
                onClick={onConnectGsc}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs cursor-pointer ml-3 shrink-0"
              >
                Connect GSC
              </button>
            )}
          </div>
        )}
      </div>

      {/* 5. Unified Keyword & SERP/AI Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
            <p className="text-xs text-slate-600 font-medium">Aggregating SERP rankings and AI citation records...</p>
          </div>
        ) : filteredKeywords.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <BarChart3 className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No keywords match your filter</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Try adjusting your search criteria, or connect Google Search Console to pull in real Google search queries.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px] tracking-wider select-none">
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:bg-slate-100/70 transition-colors"
                    onClick={() => handleSort('query')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Search Query</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-4 text-right cursor-pointer hover:bg-slate-100/70 transition-colors"
                    onClick={() => handleSort('gsc_position')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Google Avg. Position</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-4 text-right cursor-pointer hover:bg-slate-100/70 transition-colors"
                    onClick={() => handleSort('clicks')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Clicks / Impr.</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-4 text-center cursor-pointer hover:bg-slate-100/70 transition-colors"
                    onClick={() => handleSort('ai_citation')}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>AI Citation Visibility</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:bg-slate-100/70 transition-colors"
                    onClick={() => handleSort('gap')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Gap Classification</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredKeywords.map((item) => {
                  const isProbing = probingQuery === item.query;
                  const isGeneratingOpp = generatingOpportunityFor === item.query;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        item.gap_status === 'AI_CITATION_GAP' ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* 1. Query */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-slate-900 text-xs">
                            {item.query}
                          </span>
                          {item.is_focus_keyword && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Focus
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Google Avg Position */}
                      <td className="py-3.5 px-4 text-right">
                        {item.gsc_position !== null ? (
                          <div className="inline-flex flex-col items-end">
                            <span
                              className={`font-bold font-mono text-xs ${
                                item.gsc_position <= 3
                                  ? 'text-emerald-700'
                                  : item.gsc_position <= 10
                                  ? 'text-purple-700'
                                  : 'text-slate-600'
                              }`}
                            >
                              #{item.gsc_position.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-slate-400">GSC Avg Pos</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No GSC data</span>
                        )}
                      </td>

                      {/* 3. Clicks / Impressions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="text-slate-900 font-semibold text-xs">
                          {item.gsc_clicks.toLocaleString()} clicks
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {item.gsc_impressions.toLocaleString()} impr. ({item.gsc_ctr.toFixed(1)}% CTR)
                        </div>
                      </td>

                      {/* 4. AI Citation Visibility & Sample Status */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          {item.ai_citation_rate !== null ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-bold text-xs ${
                                  item.ai_citation_rate >= 0.5
                                    ? 'text-emerald-700'
                                    : item.ai_citation_rate > 0
                                    ? 'text-amber-700'
                                    : 'text-rose-700'
                                }`}
                              >
                                {Math.round(item.ai_citation_rate * 100)}% Citations
                              </span>
                              {item.ai_visibility_score !== null && (
                                <span className="text-[10px] text-slate-400">
                                  ({item.ai_visibility_score}/100)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Not Probed</span>
                          )}

                          {/* Sample Status Tag */}
                          <SampleStatusBadge status={item.ai_sample_status} count={item.ai_sample_count} />
                        </div>
                      </td>

                      {/* 5. Gap Classification */}
                      <td className="py-3.5 px-4">
                        <GapStatusBadge status={item.gap_status} description={item.gap_description} />
                      </td>

                      {/* 6. Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Probe AI Button */}
                          <button
                            type="button"
                            onClick={() => handleProbeKeyword(item.query)}
                            disabled={isProbing}
                            title="Probe AI Engines (ChatGPT, Perplexity, Gemini, Claude). Deducts 1 credit."
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Sparkles className={`w-3 h-3 ${isProbing ? 'animate-spin text-indigo-500' : ''}`} />
                            <span>{isProbing ? 'Probing...' : 'Probe AI'}</span>
                          </button>

                          {/* Write in Content Studio */}
                          {onNavigateToContentStudio && (
                            <button
                              type="button"
                              onClick={() => onNavigateToContentStudio(item.query, item.query)}
                              title="Open in SEO Content Studio to write brief and content targeting this query"
                              className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <PenTool className="w-3 h-3" />
                              <span>Studio</span>
                            </button>
                          )}

                          {/* Generate Opportunity Button if Gap exists */}
                          {item.gap_status === 'AI_CITATION_GAP' && (
                            <button
                              type="button"
                              onClick={() => handleGenerateOpportunity(item.query)}
                              disabled={isGeneratingOpp}
                              title="Generate an actionable SEO Opportunity item in the SEO Opportunities dashboard"
                              className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Zap className={`w-3 h-3 ${isGeneratingOpp ? 'animate-spin' : ''}`} />
                              <span>{isGeneratingOpp ? 'Adding...' : 'Add Opp'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Footer Legend & Information */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-slate-700">Sample Types:</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Live Sample (24h)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Historical (30d)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Insufficient Sample (&lt;2)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-400" /> Unprobed
          </span>
        </div>

        <div className="text-[11px] text-slate-400">
          Daily Probe Limit: {summary?.daily_probe_limit_per_website || 25} probes/website · 1 credit per query probe
        </div>
      </div>
    </div>
  );
}

// Subcomponents for Clean Badging
function SampleStatusBadge({
  status,
  count,
}: {
  status: 'live_sample' | 'historical_sample' | 'insufficient_sample' | 'unprobed';
  count: number;
}) {
  switch (status) {
    case 'live_sample':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          Live Sample ({count})
        </span>
      );
    case 'historical_sample':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
          Historical ({count})
        </span>
      );
    case 'insufficient_sample':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
          Low Sample ({count})
        </span>
      );
    case 'unprobed':
    default:
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
          Unprobed
        </span>
      );
  }
}

function GapStatusBadge({
  status,
  description,
}: {
  status: 'AI_CITATION_GAP' | 'STRONG_IN_BOTH' | 'RANK_OPPORTUNITY' | 'AI_WIN' | 'UNPROBED';
  description: string;
}) {
  switch (status) {
    case 'AI_CITATION_GAP':
      return (
        <div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            AI Citation Gap
          </span>
          <p className="text-[10px] text-amber-700 mt-0.5 max-w-[200px] leading-tight">
            Top-10 Google rank, low AI citations
          </p>
        </div>
      );
    case 'STRONG_IN_BOTH':
      return (
        <div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Dominant in Both
          </span>
          <p className="text-[10px] text-emerald-700 mt-0.5 max-w-[200px] leading-tight">
            Strong Google position &amp; AI visibility
          </p>
        </div>
      );
    case 'RANK_OPPORTUNITY':
      return (
        <div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-800 border border-purple-200">
            Google Rank Opp
          </span>
          <p className="text-[10px] text-slate-500 mt-0.5 max-w-[200px] leading-tight">
            Beyond page 1 on Google
          </p>
        </div>
      );
    case 'AI_WIN':
      return (
        <div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
            AI Engine Leader
          </span>
          <p className="text-[10px] text-slate-500 mt-0.5 max-w-[200px] leading-tight">
            Cited by AI engines despite low Google rank
          </p>
        </div>
      );
    case 'UNPROBED':
    default:
      return (
        <div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
            Awaiting AI Probe
          </span>
          <p className="text-[10px] text-slate-400 mt-0.5 max-w-[200px] leading-tight">
            Run probe to evaluate AI citations
          </p>
        </div>
      );
  }
}
