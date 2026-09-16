'use me';
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Search,
  ExternalLink,
  X,
  Play,
  Check,
  Cpu,
} from 'lucide-react';
import { SEOOpportunity, OpportunityPriority, OpportunitySummary } from '@/lib/seo-opportunities/types';

interface SEOOpportunitiesDashboardProps {
  websiteId: string;
}

export default function SEOOpportunitiesDashboard({ websiteId }: SEOOpportunitiesDashboardProps) {
  const [opportunities, setOpportunities] = useState<SEOOpportunity[]>([]);
  const [summary, setSummary] = useState<OpportunitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/opportunities`);
      if (res.ok) {
        const data = await res.json();
        setOpportunities(data.opportunities || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error('Failed to fetch SEO opportunities:', err);
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const handleRunScan = async () => {
    setScanning(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/opportunities`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchOpportunities();
      }
    } catch (err) {
      console.error('Failed to run SEO scan:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleStatusUpdate = async (oppId: string, newStatus: string) => {
    setActionLoading(oppId);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/opportunities/${oppId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setOpportunities((prev) =>
          prev.map((item) => (item.id === oppId ? { ...item, status: newStatus as any } : item))
        );
        fetchOpportunities();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleExecuteFix = async (oppId: string) => {
    setActionLoading(oppId);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/opportunities/${oppId}/fix`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        await fetchOpportunities();
      } else {
        alert(data.message || 'Could not auto-apply fix.');
      }
    } catch (err) {
      console.error('Failed to execute fix:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered Opportunities
  const filtered = opportunities.filter((item) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchPage = item.affected_page?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchPage) return false;
    }
    if (selectedCategory !== 'all' && item.type !== selectedCategory) return false;
    if (selectedSeverity !== 'all' && item.priority.toLowerCase() !== selectedSeverity.toLowerCase()) return false;
    return true;
  });

  const getPriorityBadgeClass = (priority: OpportunityPriority) => {
    switch (priority) {
      case 'Critical':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'High':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Medium':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Low':
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">SEO Opportunity Engine</h2>
          </div>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Continuous automated detection & prioritised SEO recommendations across your website.
          </p>
        </div>

        <button
          onClick={handleRunScan}
          disabled={scanning}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl shadow-md shadow-purple-600/20 transition-all cursor-pointer disabled:opacity-50"
        >
          <RotateCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning Website...' : 'Scan For Opportunities'}
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Opportunities</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-slate-900">{summary?.total || 0}</span>
            <span className="text-xs text-slate-500 font-medium">active items</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Critical Priority</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-red-600">{summary?.critical || 0}</span>
            <span className="text-xs text-red-500 font-bold">Require immediate fix</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">High Priority</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-amber-600">{summary?.high || 0}</span>
            <span className="text-xs text-slate-500 font-medium">items</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Medium / Low</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-purple-600">{(summary?.medium || 0) + (summary?.low || 0)}</span>
            <span className="text-xs text-slate-500 font-medium">items</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search opportunities or URL..."
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
            <option value="all">All Categories</option>
            <option value="technical_seo">Technical SEO</option>
            <option value="content">Content Quality</option>
            <option value="internal_linking">Internal Links</option>
            <option value="gsc">GSC Analytics</option>
            <option value="local_seo">Local SEO</option>
            <option value="blog_content">Blog Engine</option>
            <option value="third_party">3rd-Party Data</option>
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

      {/* Opportunities List */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-2xs">
          <RotateCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">Evaluating website opportunity matrix...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-2xs">
          <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No matching SEO opportunities found</h3>
          <p className="text-sm text-slate-500 font-medium mt-1 max-w-md mx-auto">
            {opportunities.length === 0
              ? 'Your website is looking great! Run a fresh scan to detect any newly emergent opportunities.'
              : 'Try relaxing your filter criteria or search query to view more items.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs hover:border-purple-200 transition-all"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                {/* Main details */}
                <div className="space-y-2.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Priority badge */}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${getPriorityBadgeClass(
                        item.priority
                      )}`}
                    >
                      {item.priority.toUpperCase()} ({item.priority_score})
                    </span>

                    {/* Category badge */}
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 capitalize">
                      {item.type.replace('_', ' ')}
                    </span>

                    {/* Effort badge */}
                    <span className="px-2 py-0.5 text-xs text-slate-500 font-medium">
                      Effort: <strong className="text-slate-800 capitalize font-bold">{item.effort}</strong>
                    </span>

                    {/* Status Badge if not new */}
                    {item.status !== 'new' && (
                      <span className="px-2.5 py-0.5 rounded text-xs capitalize bg-slate-200 text-slate-700 font-bold">
                        {item.status.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  {/* Title & Affected Page */}
                  <h3 className="text-lg font-bold text-slate-900 leading-snug">{item.title}</h3>
                  {item.affected_page && (
                    <p className="text-xs text-purple-700 font-mono flex items-center gap-1">
                      <span>Affected Page:</span>
                      <a
                        href={item.affected_page}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-purple-900 inline-flex items-center gap-0.5 font-bold"
                      >
                        {item.affected_page}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </p>
                  )}

                  {/* Description */}
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">{item.description}</p>

                  {/* Fix recommendation & rationale */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs space-y-1">
                    <p className="text-slate-800">
                      <strong className="text-slate-900 font-bold">Recommended Fix:</strong>{' '}
                      {item.recommended_action}
                    </p>
                  </div>
                </div>

                {/* Actions sidebar on card */}
                <div className="flex lg:flex-col items-center lg:items-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                  <button
                    onClick={() => handleExecuteFix(item.id)}
                    disabled={actionLoading === item.id || item.status === 'completed'}
                    className="w-full lg:w-44 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading === item.id ? (
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    {item.status === 'completed' ? 'Fix Resolved' : 'Apply Fix Workflow'}
                  </button>

                  {item.status !== 'completed' && (
                    <button
                      onClick={() => handleStatusUpdate(item.id, 'completed')}
                      disabled={actionLoading === item.id}
                      className="w-full lg:w-44 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Mark Resolved
                    </button>
                  )}

                  <button
                    onClick={() => handleStatusUpdate(item.id, 'dismissed')}
                    disabled={actionLoading === item.id}
                    className="w-full lg:w-44 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-slate-400 hover:text-slate-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
