'use me';
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Swords,
  Plus,
  RotateCw,
  Trash2,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Globe,
  Database,
} from 'lucide-react';
import { SEOCompetitor } from '@/lib/seo-competitors/types';

interface SEOCompetitorDashboardProps {
  websiteId: string;
}

export default function SEOCompetitorDashboard({ websiteId }: SEOCompetitorDashboardProps) {
  const [competitors, setCompetitors] = useState<SEOCompetitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchCompetitors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/competitors`);
      if (res.ok) {
        const data = await res.json();
        setCompetitors(data.competitors || []);
      }
    } catch (err) {
      console.error('Failed to load competitors:', err);
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    fetchCompetitors();
  }, [fetchCompetitors]);

  const handleAddCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    setAdding(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/competitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain, name: newName }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add competitor domain.');
      }
      setNewDomain('');
      setNewName('');
      await fetchCompetitors();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleAnalyzeCompetitor = async (competitorId: string) => {
    setAnalyzingId(competitorId);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/competitors/${competitorId}/analyze`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchCompetitors();
      }
    } catch (err) {
      console.error('Failed to analyze competitor:', err);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleDeleteCompetitor = async (competitorId: string) => {
    if (!confirm('Are you sure you want to remove this competitor domain?')) return;
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/competitors/${competitorId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setCompetitors((prev) => prev.filter((c) => c.id !== competitorId));
      }
    } catch (err) {
      console.error('Failed to remove competitor:', err);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Swords className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Competitor Intelligence
            </h2>
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
              SERP Benchmarking
            </span>
          </div>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Benchmark public content, page structures, and keyword themes against competitor domains.
          </p>
        </div>
      </div>

      {/* Add Competitor Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Plus className="w-5 h-5 text-purple-600" />
          Track New Competitor Domain
        </h3>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-900">
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleAddCompetitor} className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            placeholder="competitor.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            className="flex-1 px-4 py-2.5 border border-slate-200/90 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 w-full"
            required
          />
          <input
            type="text"
            placeholder="Competitor Name (Optional)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full sm:w-64 px-4 py-2.5 border border-slate-200/90 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={adding || !newDomain.trim()}
            className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl shadow-md shadow-purple-600/20 transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            {adding ? 'Adding...' : 'Track Competitor'}
          </button>
        </form>
      </div>

      {/* Tracked Competitors Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">
            Tracked Competitors ({competitors.length})
          </h3>
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-purple-600" /> Public Site &amp; Integration Benchmarks
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs font-bold text-slate-500">
            <RotateCw className="w-6 h-6 text-purple-600 animate-spin mx-auto mb-2" />
            Loading tracked competitors...
          </div>
        ) : competitors.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 font-medium space-y-2">
            <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
            <p>No competitor domains tracked yet. Add your first competitor above to start gap analysis.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Domain</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Last Analyzed</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {competitors.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-bold font-mono text-purple-700">
                      <a
                        href={`https://${c.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-purple-900 inline-flex items-center gap-1"
                      >
                        {c.domain}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{c.name || c.domain}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          c.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : c.status === 'analyzing'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-500 font-medium">
                      {c.last_analyzed_at ? new Date(c.last_analyzed_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleAnalyzeCompetitor(c.id)}
                        disabled={analyzingId === c.id}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <RotateCw className={`w-3 h-3 ${analyzingId === c.id ? 'animate-spin' : ''}`} />
                        {analyzingId === c.id ? 'Analyzing...' : 'Analyze Gaps'}
                      </button>

                      <button
                        onClick={() => handleDeleteCompetitor(c.id)}
                        className="px-2.5 py-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 font-bold rounded-lg transition-colors cursor-pointer"
                        title="Remove competitor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
