'use me';
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  GitFork,
  RotateCw,
  Layers,
  Sparkles,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { TopicCluster, ContentGap } from '@/lib/seo-aeo/types';

interface SEOTopicalAuthorityDashboardProps {
  websiteId: string;
}

export default function SEOTopicalAuthorityDashboard({ websiteId }: SEOTopicalAuthorityDashboardProps) {
  const [coverageScore, setCoverageScore] = useState<number>(0);
  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [gaps, setGaps] = useState<ContentGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchTopicalData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/topical-authority`);
      if (res.ok) {
        const data = await res.json();
        const info = data.topicalAuthority || {};
        setCoverageScore(info.topic_coverage_score || 0);
        setClusters(info.topic_clusters || []);
        setGaps(info.content_gaps || []);
      }
    } catch (err) {
      console.error('Failed to load topical authority data:', err);
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    fetchTopicalData();
  }, [fetchTopicalData]);

  const handleReanalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/topical-authority`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchTopicalData();
      }
    } catch (err) {
      console.error('Failed to update topical authority:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center font-sans">
        <RotateCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
        <p className="text-sm font-bold text-slate-600">Building Topical Authority Map...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <GitFork className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Topical Authority & Cluster Architecture
            </h2>
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
              Topic Graph
            </span>
          </div>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Map core topics, supporting subtopics, and content relationships to build semantic domain authority.
          </p>
        </div>

        <button
          onClick={handleReanalyze}
          disabled={analyzing}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl shadow-md shadow-purple-600/20 transition-all cursor-pointer disabled:opacity-50"
        >
          <RotateCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
          {analyzing ? 'Re-building Clusters...' : 'Re-calculate Topic Graph'}
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Topic Coverage Score</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-purple-600">{coverageScore}</span>
            <span className="text-xs text-slate-500 font-medium">/ 100</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Topic Clusters</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-slate-900">{clusters.length}</span>
            <span className="text-xs text-slate-500 font-medium">indexed</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Content Gaps Discovered</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-amber-600">{gaps.length}</span>
            <span className="text-xs text-amber-700 font-bold">missing subtopics</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Internal Link Health</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg">
              Cluster Linked
            </span>
          </div>
        </div>
      </div>

      {/* Topic Clusters Grid */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-purple-600" />
          Indexed Topic Clusters ({clusters.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {clusters.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4 hover:border-purple-200 transition-all"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 block">
                    Core Topic
                  </span>
                  <h4 className="text-lg font-bold text-slate-900">{c.mainTopic}</h4>
                </div>
                <span className="px-3 py-1 bg-purple-50 text-purple-800 font-extrabold text-xs rounded-full border border-purple-200">
                  Coverage: {c.clusterCoverageScore}%
                </span>
              </div>

              {/* Supporting Topics */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Supporting Topics
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(c.supportingTopics || []).map((st, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg"
                    >
                      {st}
                    </span>
                  ))}
                </div>
              </div>

              {/* Missing Subtopics if any */}
              {c.missingSubtopics && c.missingSubtopics.length > 0 && (
                <div className="pt-2 border-t border-slate-50 space-y-1">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">
                    Missing Cluster Subtopics:
                  </span>
                  <ul className="space-y-1 text-xs text-slate-600 font-medium">
                    {c.missingSubtopics.slice(0, 3).map((sub, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{sub}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Content Gaps */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-purple-600" />
          Recommended Topical Content Gaps ({gaps.length})
        </h3>

        {gaps.length === 0 ? (
          <p className="text-xs text-slate-500 font-medium italic">
            No critical content gaps detected. Your topic coverage is comprehensive.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {gaps.map((gap) => (
              <div key={gap.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{gap.suggestedTitle}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">
                      Missing Subtopic
                    </span>
                  </div>
                  <p className="text-slate-600 font-medium">{gap.reason}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 bg-purple-50 text-purple-700 font-bold rounded-lg">
                    Target Topic: {gap.mainTopic}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
