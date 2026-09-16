'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  FileText,
  Search,
  BookOpen,
  Sparkles,
  RefreshCw,
  GitBranch,
  Bot,
  MapPin,
  Link2,
  Swords,
  Boxes,
  Clock,
  ArrowUpRight,
  HelpCircle,
  X,
  Cpu,
} from 'lucide-react';
import { CommandCenterPayload, CategoryScoreItem } from '@/lib/seo-command-center/types';

interface SEOCommandCenterDashboardProps {
  websiteId: string;
  onNavigateTab: (tabId: string) => void;
}

export function SEOCommandCenterDashboard({ websiteId, onNavigateTab }: SEOCommandCenterDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CommandCenterPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedExplanation, setSelectedExplanation] = useState<CategoryScoreItem | null>(null);

  useEffect(() => {
    loadCommandCenter();
  }, [websiteId]);

  const loadCommandCenter = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/command-center`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load Command Center');
      setData(json.commandCenter);
    } catch (err: any) {
      setError(err?.message || 'Error loading Command Center');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
        <p className="text-slate-300 text-sm font-medium">Aggregating Unified SEO Intelligence...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400 text-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <span>{error || 'Unable to load SEO Command Center.'}</span>
        </div>
        <button onClick={loadCommandCenter} className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-white rounded text-xs font-semibold">
          Retry
        </button>
      </div>
    );
  }

  const { unifiedScoreResult, dataFreshness, healthSummary, priorityActions, historicalTrend, beforeAfterHealth, activityTimeline, autopilotSummary, gscSummary, thirdPartySummary } = data;

  const scoreColor =
    unifiedScoreResult.unifiedScore >= 80
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
      : unifiedScoreResult.unifiedScore >= 60
      ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      : 'text-red-400 border-red-500/30 bg-red-500/10';

  return (
    <div className="space-y-6">
      {/* Hero Banner with Unified SEO Score */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
          {/* Left: Unified Score Gauge */}
          <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-xl p-6 text-center space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" /> Unified SEO Score
            </div>
            <div className="py-2">
              <span className="text-6xl font-extrabold text-white tracking-tight">{unifiedScoreResult.unifiedScore}</span>
              <span className="text-slate-500 text-lg"> / 100</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase border ${scoreColor}`}>
                {unifiedScoreResult.unifiedScore >= 80 ? 'Optimal Health' : unifiedScoreResult.unifiedScore >= 60 ? 'Needs Optimization' : 'Critical Attention'}
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  unifiedScoreResult.confidenceLevel === 'high'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : unifiedScoreResult.confidenceLevel === 'medium'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-red-500/20 text-red-300'
                }`}
              >
                {unifiedScoreResult.confidenceLevel.toUpperCase()} CONFIDENCE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 pt-1">
              Deterministic weighting across {Math.round(unifiedScoreResult.availableWeightSum * 100)}% available active signals.
            </p>
          </div>

          {/* Right: Score Breakdown Progress List */}
          <div className="lg:col-span-8 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between">
              <span>Category Score Breakdown</span>
              <span className="text-xs text-slate-400 font-normal">Click category to inspect explanation</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.values(unifiedScoreResult.categories).map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => setSelectedExplanation(cat)}
                  className="bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 rounded-lg p-3 text-xs transition cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-200 flex items-center gap-1.5">
                      {cat.name}
                      <HelpCircle className="w-3 h-3 text-slate-500" />
                    </span>
                    <span className={cat.status === 'AVAILABLE' ? 'text-white font-bold' : 'text-slate-500'}>
                      {cat.status === 'AVAILABLE' ? `${cat.score} / 100` : 'N/A'}
                    </span>
                  </div>

                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        cat.status === 'NOT_AVAILABLE'
                          ? 'bg-slate-700'
                          : cat.score! >= 80
                          ? 'bg-emerald-500'
                          : cat.score! >= 60
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${cat.status === 'AVAILABLE' ? cat.score : 0}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Weight: {Math.round(cat.weight * 100)}%</span>
                    <span>Contribution: +{cat.contribution} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Health Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400">Critical Issues</div>
          <div className="text-2xl font-bold text-red-400 mt-1">{healthSummary.criticalIssuesCount}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400">High Priority</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{healthSummary.highIssuesCount}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400">Total Opportunities</div>
          <div className="text-2xl font-bold text-white mt-1">{healthSummary.totalOpportunitiesCount}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400">Score Improvement</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {beforeAfterHealth.scoreChange >= 0 ? `+${beforeAfterHealth.scoreChange}` : beforeAfterHealth.scoreChange} pts
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400">SEO Autopilot</div>
          <div className="text-lg font-bold text-indigo-400 capitalize mt-1">{autopilotSummary.status}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400">GSC Status</div>
          <div className="text-lg font-bold text-emerald-400 mt-1">{gscSummary.connected ? 'Connected' : 'Not Linked'}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400">Third Party APIs</div>
          <div className="text-lg font-bold text-cyan-400 mt-1">{thirdPartySummary.connectedProviders.length} Linked</div>
        </div>
      </div>

      {/* SEO Data Freshness Indicators */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" /> SEO Data Source Freshness
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          {Object.entries(dataFreshness).map(([key, item]) => (
            <div key={key} className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
              <div className="font-semibold text-slate-200">{item.label}</div>
              <div className="flex items-center justify-between pt-1">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    item.status === 'fresh'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : item.status === 'needs_refresh'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.status.replace('_', ' ')}
                </span>
                <span className="text-[10px] text-slate-500">
                  {item.lastAnalyzedAt ? new Date(item.lastAnalyzedAt).toLocaleDateString() : 'Never'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Priority Actions from Opportunity Engine */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" /> Priority SEO Actions
          </h3>
          <button
            onClick={() => onNavigateTab('opportunities')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
          >
            Open Opportunity Engine <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {priorityActions.length > 0 ? (
          <div className="space-y-3">
            {priorityActions.map((act) => (
              <div key={act.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-bold uppercase text-[10px]">
                      {act.category}
                    </span>
                    <span className="font-bold text-white text-sm">{act.title}</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      act.priority === 'critical'
                        ? 'bg-red-500/20 text-red-400'
                        : act.priority === 'high'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {act.priority} ({act.priorityScore} pts)
                  </span>
                </div>

                <div className="text-slate-300">{act.reason}</div>
                <div className="text-emerald-400 font-medium">
                  <strong>Recommended Action:</strong> {act.recommendedAction}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto mb-2" />
            <p>No critical priority actions requiring immediate attention.</p>
          </div>
        )}
      </div>

      {/* Quick Actions Navigation Hub */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Quick Navigation Hub</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigateTab('technical-crawl')}
            className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-200 transition text-left flex items-center justify-between"
          >
            <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-400" /> Technical Crawl</span>
            <ChevronRight className="w-3 h-3 text-slate-500" />
          </button>

          <button
            onClick={() => onNavigateTab('content-studio')}
            className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-200 transition text-left flex items-center justify-between"
          >
            <span className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-indigo-400" /> Content Studio</span>
            <ChevronRight className="w-3 h-3 text-slate-500" />
          </button>

          <button
            onClick={() => onNavigateTab('competitors')}
            className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-200 transition text-left flex items-center justify-between"
          >
            <span className="flex items-center gap-2"><Swords className="w-4 h-4 text-amber-400" /> Competitors</span>
            <ChevronRight className="w-3 h-3 text-slate-500" />
          </button>

          <button
            onClick={() => onNavigateTab('aeo')}
            className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-200 transition text-left flex items-center justify-between"
          >
            <span className="flex items-center gap-2"><Bot className="w-4 h-4 text-purple-400" /> AEO / AI Search</span>
            <ChevronRight className="w-3 h-3 text-slate-500" />
          </button>

          <button
            onClick={() => onNavigateTab('local-seo')}
            className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-200 transition text-left flex items-center justify-between"
          >
            <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-400" /> Local SEO</span>
            <ChevronRight className="w-3 h-3 text-slate-500" />
          </button>

          <button
            onClick={() => onNavigateTab('internal-links')}
            className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-200 transition text-left flex items-center justify-between"
          >
            <span className="flex items-center gap-2"><Link2 className="w-4 h-4 text-teal-400" /> Internal Links</span>
            <ChevronRight className="w-3 h-3 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Historical Trend & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-md font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" /> Historical SEO Score Trend
          </h3>
          {historicalTrend.length > 0 ? (
            <div className="space-y-2">
              {historicalTrend.map((t, idx) => (
                <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">{t.date}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white text-sm">{t.unifiedScore} / 100</span>
                    <span className="text-[10px] text-emerald-400 uppercase font-bold">{t.confidenceLevel} confidence</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-xs">Not enough historical trend data yet.</div>
          )}
        </div>

        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-md font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" /> Recent SEO Activity
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activityTimeline.map((act) => (
              <div key={act.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
                <div className="font-semibold text-slate-200">{act.title}</div>
                <div className="text-[10px] text-slate-500">{new Date(act.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SCORE EXPLANATION MODAL */}
      {selectedExplanation && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedExplanation(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" /> {selectedExplanation.name} Explanation
            </h3>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400">Score</span>
                <span className="font-bold text-white text-base">
                  {selectedExplanation.status === 'AVAILABLE' ? `${selectedExplanation.score} / 100` : 'Not Available'}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400">Weight</span>
                <span className="font-bold text-slate-200">{Math.round(selectedExplanation.weight * 100)}%</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400">Score Contribution</span>
                <span className="font-bold text-emerald-400">+{selectedExplanation.contribution} points</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400">Source Engine</span>
                <span className="font-bold text-slate-200">{selectedExplanation.source}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Last Analyzed</span>
                <span className="text-slate-400">
                  {selectedExplanation.lastAnalyzedAt ? new Date(selectedExplanation.lastAnalyzedAt).toLocaleString() : 'Never'}
                </span>
              </div>
              <div className="pt-2 text-slate-300 italic border-t border-slate-800">
                <strong>Reasoning:</strong> {selectedExplanation.reason}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  const targetTab = selectedExplanation.navigationTab;
                  setSelectedExplanation(null);
                  onNavigateTab(targetTab);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
              >
                Inspect {selectedExplanation.name} Module <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
