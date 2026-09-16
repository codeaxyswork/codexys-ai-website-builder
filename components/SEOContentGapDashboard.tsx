'use me';
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Target,
  Search,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Check,
  Play,
  RotateCw,
  Database,
} from 'lucide-react';
import { CompetitorGapItem } from '@/lib/seo-competitors/types';

interface SEOContentGapDashboardProps {
  websiteId: string;
}

export default function SEOContentGapDashboard({ websiteId }: SEOContentGapDashboardProps) {
  const [gaps, setGaps] = useState<CompetitorGapItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  const fetchGaps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/competitors/gaps`);
      if (res.ok) {
        const data = await res.json();
        setGaps(data.gaps || []);
      }
    } catch (err) {
      console.error('Failed to load competitor gaps:', err);
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    fetchGaps();
  }, [fetchGaps]);

  const filteredGaps = gaps.filter((item) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    if (selectedCategory !== 'all' && item.gapType !== selectedCategory) return false;
    if (selectedSeverity !== 'all' && item.severity.toLowerCase() !== selectedSeverity.toLowerCase()) return false;
    return true;
  });

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'high':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'medium':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Content &amp; Keyword Gap Matrix
            </h2>
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
              Competitor Opportunities
            </span>
          </div>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Surface missing topics, keywords, and page structures covered by competitors to expand website coverage.
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Discovered Gaps</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-slate-900">{gaps.length}</span>
            <span className="text-xs text-slate-500 font-medium font-bold">items</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Critical Priority Gaps</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-red-600">
              {gaps.filter((g) => g.severity === 'critical').length}
            </span>
            <span className="text-xs text-red-500 font-bold">Immediate action</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Topic / Content Gaps</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-purple-600">
              {gaps.filter((g) => g.gapType === 'topic' || g.gapType === 'content').length}
            </span>
            <span className="text-xs text-slate-500 font-medium">articles/sections</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Keyword &amp; Page Gaps</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-amber-600">
              {gaps.filter((g) => g.gapType === 'keyword' || g.gapType === 'page').length}
            </span>
            <span className="text-xs text-amber-700 font-bold">items</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search gaps or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200/90 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3.5 py-2 border border-slate-200/90 rounded-xl text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer"
          >
            <option value="all">All Gap Categories</option>
            <option value="topic">Topic Gaps</option>
            <option value="content">Content Gaps</option>
            <option value="keyword">Keyword Gaps</option>
            <option value="page">Page Gaps</option>
            <option value="aeo">AEO Gaps</option>
          </select>

          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-3.5 py-2 border border-slate-200/90 rounded-xl text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical (85+)</option>
            <option value="high">High (70-84)</option>
            <option value="medium">Medium (50-69)</option>
            <option value="low">Low (&lt;50)</option>
          </select>
        </div>
      </div>

      {/* Gap Cards */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center font-sans">
          <RotateCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">Aggregating competitor content &amp; keyword gaps...</p>
        </div>
      ) : filteredGaps.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-2xs font-sans">
          <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No matching content gaps found</h3>
          <p className="text-sm text-slate-500 font-medium mt-1 max-w-md mx-auto">
            {gaps.length === 0
              ? 'Analyze tracked competitor domains above to discover competitive content gaps.'
              : 'Try relaxing your filter criteria or search query to view more items.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGaps.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs hover:border-purple-200 transition-all"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Priority badge */}
                    <span
                      className={`px-3 py-0.5 rounded-full text-xs font-bold border ${getPriorityBadgeClass(
                        item.priority
                      )}`}
                    >
                      {item.priority.toUpperCase()} ({item.priorityScore})
                    </span>

                    {/* Gap Type badge */}
                    <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 capitalize">
                      {item.gapType} Gap
                    </span>

                    {/* Competitor Domain badge */}
                    {item.competitorDomain && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        Source: {item.competitorDomain}
                      </span>
                    )}

                    {/* Data Source badge */}
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800 uppercase flex items-center gap-1">
                      <Database className="w-3 h-3 text-slate-500" />
                      {item.dataSource}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 leading-snug">{item.title}</h3>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">{item.description}</p>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs space-y-1">
                    <p className="text-slate-800">
                      <strong className="text-slate-900 font-bold">Recommended Action:</strong>{' '}
                      {item.recommendedAction}
                    </p>
                  </div>
                </div>

                <div className="flex lg:flex-col items-center lg:items-end gap-2 shrink-0">
                  <a
                    href={`/dashboard/websites/${websiteId}/seo?tab=opportunities`}
                    className="w-full lg:w-44 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    View Opportunity
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
