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
  const [selectedActionForReview, setSelectedActionForReview] = useState<any | null>(null);
  const [applyingFix, setApplyingFix] = useState(false);
  const [fixSuccessMessage, setFixSuccessMessage] = useState<string | null>(null);
  const [fixErrorMessage, setFixErrorMessage] = useState<string | null>(null);

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

  const handleApplyFix = async () => {
    if (!selectedActionForReview || !selectedActionForReview.proposedFix) return;
    setApplyingFix(true);
    setFixSuccessMessage(null);
    setFixErrorMessage(null);

    try {
      // 1. Execute safe AI Fix
      const fixRes = await fetch(`/api/websites/${websiteId}/seo/agent/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposedFix: selectedActionForReview.proposedFix }),
      });
      const fixJson = await fixRes.json();
      if (!fixRes.ok) throw new Error(fixJson.error || 'Failed to apply fix');

      // 2. Mark opportunity as completed
      if (selectedActionForReview.opportunityId) {
        await fetch(`/api/websites/${websiteId}/seo/opportunities/${selectedActionForReview.opportunityId}/fix`, {
          method: 'POST',
        });
      }

      setFixSuccessMessage(
        fixJson.message || `Fix applied successfully! SEO score changed from ${fixJson.oldScore ?? 'previous'} → ${fixJson.newScore ?? 'updated'}.`
      );

      // Refresh Command Center data
      loadCommandCenter();
    } catch (err: any) {
      setFixErrorMessage(err.message || 'Error applying fix.');
    } finally {
      setApplyingFix(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
        <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
        <p className="text-slate-600 text-sm font-medium">Aggregating Unified SEO Intelligence...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-700 text-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>{error || 'Unable to load SEO Command Center.'}</span>
        </div>
        <button onClick={loadCommandCenter} className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs">
          Retry
        </button>
      </div>
    );
  }

  const { unifiedScoreResult, dataFreshness, healthSummary, priorityActions, historicalTrend, beforeAfterHealth, activityTimeline, autopilotSummary, gscSummary, thirdPartySummary } = data;

  const scoreColor =
    unifiedScoreResult.unifiedScore >= 80
      ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
      : unifiedScoreResult.unifiedScore >= 60
      ? 'text-amber-700 border-amber-200 bg-amber-50'
      : 'text-rose-700 border-rose-200 bg-rose-50';

  const availableDataPct = Math.round(unifiedScoreResult.availableWeightSum * 100);

  return (
    <div className="space-y-6">
      {/* Hero Banner with Primary Metric: AI Search Readiness */}
      <div className="bg-gradient-to-r from-purple-50/80 via-indigo-50/50 to-slate-50 border border-purple-100/80 rounded-xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-80 h-80 bg-purple-200/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch relative z-10">
          {/* Left: Primary AI Search Readiness Score Gauge */}
          <div className="lg:col-span-5 bg-white border border-slate-200 shadow-sm rounded-xl p-6 text-center h-full flex flex-col justify-center space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>AI Search Readiness</span>
              <div className="relative group/tooltip inline-block cursor-help">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-purple-600 transition-colors" />
                <div className="opacity-0 group-hover/tooltip:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-slate-900 text-white text-[11px] font-normal normal-case rounded-lg p-2.5 shadow-xl z-30 pointer-events-none text-center">
                  AI Search Readiness combines your existing SEO (35%), AEO (25%), GEO (20%), and AIO (20%) signals to measure how well your website communicates its business, content, answers, entities, and topics to modern search systems.
                </div>
              </div>
            </div>

            <div className="py-1">
              <span className="text-6xl font-black text-slate-900 tracking-tight">
                {data.aiSearchReadiness?.score ?? unifiedScoreResult.unifiedScore}
              </span>
              <span className="text-slate-400 text-lg"> / 100</span>
            </div>

            <p className="text-xs font-medium text-slate-700 max-w-sm mx-auto leading-relaxed">
              AI Search Readiness measures how clearly your website is structured, understood, and prepared for modern search and AI discovery.
            </p>

            <div className="flex flex-col items-center gap-2 pt-1">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase border ${scoreColor}`}>
                  { (data.aiSearchReadiness?.score ?? unifiedScoreResult.unifiedScore) >= 80 ? 'Optimal Readiness' : (data.aiSearchReadiness?.score ?? unifiedScoreResult.unifiedScore) >= 60 ? 'Needs Optimization' : 'Attention Required' }
                </span>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    unifiedScoreResult.confidenceLevel === 'high'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : unifiedScoreResult.confidenceLevel === 'medium'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  {unifiedScoreResult.confidenceLevel.toUpperCase()} CONFIDENCE
                </span>
              </div>

              {/* Sub-Score Weight Breakdown Bar */}
              <div className="grid grid-cols-4 gap-1.5 w-full pt-2 text-[11px] text-center">
                <div className="bg-slate-50 border border-slate-200 rounded p-1.5">
                  <div className="text-slate-500 font-medium text-[10px]">SEO (35%)</div>
                  <div className="font-bold text-slate-900">{data.aiSearchReadiness?.seo ?? unifiedScoreResult.unifiedScore}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded p-1.5">
                  <div className="text-slate-500 font-medium text-[10px]">AEO (25%)</div>
                  <div className="font-bold text-emerald-700">{data.aiSearchReadiness?.aeo ?? data.aioSummary?.answerReadinessScore ?? 0}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded p-1.5">
                  <div className="text-slate-500 font-medium text-[10px]">GEO (20%)</div>
                  <div className="font-bold text-purple-700">{data.aiSearchReadiness?.geo ?? data.geoSummary?.geoScore ?? 0}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded p-1.5">
                  <div className="text-slate-500 font-medium text-[10px]">AIO (20%)</div>
                  <div className="font-bold text-cyan-700">{data.aiSearchReadiness?.aio ?? data.aioSummary?.aioScore ?? 0}</div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 leading-tight">
              <p className="italic text-slate-400">
                This is a technical readiness measurement. It does not predict or guarantee third-party ChatGPT, Perplexity, Gemini, or search rankings.
              </p>
            </div>
          </div>

          {/* Right: Score Breakdown Progress List */}
          <div className="lg:col-span-7 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
              <span>Category Score Breakdown</span>
              <span className="text-xs text-slate-500 font-normal">Click category to inspect module</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.values(unifiedScoreResult.categories).map((cat) => {
                const isCoreSeo = cat.id === 'core_seo';
                const displayName = isCoreSeo ? 'Core SEO' : cat.name;
                const tooltipText = isCoreSeo
                  ? 'Your existing core on-page SEO analysis score.'
                  : `Score calculation for ${cat.name}.`;

                return (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setSelectedExplanation(cat);
                    }}
                    className="bg-white hover:bg-purple-50/40 border border-slate-200 shadow-2xs rounded-lg p-3 text-xs transition cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-slate-800 flex items-center gap-1.5">
                        {displayName}
                        <div className="relative group/tooltip inline-block cursor-help">
                          <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-purple-600 transition-colors" />
                          <div className="opacity-0 group-hover/tooltip:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-900 text-white text-[11px] font-normal normal-case rounded-lg p-2 shadow-xl z-30 pointer-events-none text-center">
                            {tooltipText}
                          </div>
                        </div>
                      </span>
                      <span className={cat.status === 'AVAILABLE' ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                        {cat.status === 'AVAILABLE' ? `${cat.score} / 100` : 'N/A'}
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          cat.status === 'NOT_AVAILABLE'
                            ? 'bg-slate-300'
                            : cat.score! >= 80
                            ? 'bg-emerald-500'
                            : cat.score! >= 60
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${cat.status === 'AVAILABLE' ? cat.score : 0}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Weight: {Math.round(cat.weight * 100)}%</span>
                      <span className="font-medium text-slate-700">Contribution: +{cat.contribution} pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* AI SEARCH READINESS EXPLANATION BOX */}
      <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row items-start gap-3.5">
        <div className="p-2.5 bg-purple-100 text-purple-700 rounded-lg shrink-0 mt-0.5">
          <HelpCircle className="w-5 h-5" />
        </div>
        <div className="space-y-1 text-xs">
          <h4 className="font-bold text-slate-900 text-sm">
            What is AI Search Readiness?
          </h4>
          <p className="text-slate-600 leading-relaxed">
            <strong>AI Search Readiness</strong> combines your existing <strong>SEO (35%)</strong>, <strong>AEO (25%)</strong>, <strong>GEO (20%)</strong>, and <strong>AIO (20%)</strong> signals to measure how clearly your website communicates its business entity, factual answers, structured data, and topics to modern search engines and AI discovery systems.
          </p>
          <p className="text-slate-500 text-[11px] italic pt-1">
            Note: This is a technical readiness measurement. It is not a ranking prediction, does not guarantee search indexing, and does not guarantee recommendations or citations by third-party LLM systems.
          </p>
        </div>
      </div>

      {/* Top Health Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white border border-slate-200 shadow-2xs rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 font-medium">Critical Issues</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{healthSummary.criticalIssuesCount}</div>
        </div>
        <div className="bg-white border border-slate-200 shadow-2xs rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 font-medium">High Priority</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{healthSummary.highIssuesCount}</div>
        </div>
        <div className="bg-white border border-slate-200 shadow-2xs rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 font-medium">Total Opportunities</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{healthSummary.totalOpportunitiesCount}</div>
        </div>
        <div className="bg-white border border-slate-200 shadow-2xs rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 font-medium">Score Improvement</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {beforeAfterHealth.scoreChange >= 0 ? `+${beforeAfterHealth.scoreChange}` : beforeAfterHealth.scoreChange} pts
          </div>
        </div>
        <div className="bg-white border border-slate-200 shadow-2xs rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 font-medium">SEO Autopilot</div>
          <div className="text-lg font-bold text-purple-600 capitalize mt-1">{autopilotSummary.status}</div>
        </div>
        <div className="bg-white border border-slate-200 shadow-2xs rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 font-medium">GSC Status</div>
          <div className="text-lg font-bold text-emerald-600 mt-1">{gscSummary.connected ? 'Connected' : 'Not Linked'}</div>
        </div>
        <div className="bg-white border border-slate-200 shadow-2xs rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 font-medium">Third Party APIs</div>
          <div className="text-lg font-bold text-indigo-600 mt-1">{thirdPartySummary.connectedProviders.length} Linked</div>
        </div>
      </div>

      {/* GEO Readiness & Entity Relationship Card */}
      {data.geoSummary && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-600" /> Generative Engine Optimization (GEO) Readiness
            </h3>
            <span className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-bold">
              GEO Score: {data.geoSummary.geoScore}/100
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-slate-500 font-medium">Entity Clarity (30%)</div>
              <div className="text-lg font-bold text-slate-900 mt-1">{data.geoSummary.entityClarityScore}/100</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-slate-500 font-medium">Factual Consistency (25%)</div>
              <div className="text-lg font-bold text-emerald-600 mt-1">{data.geoSummary.factualConsistencyScore}/100</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-slate-500 font-medium">Structured Data Depth (25%)</div>
              <div className="text-lg font-bold text-indigo-600 mt-1">{data.geoSummary.structuredDataDepthScore}/100</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-slate-500 font-medium">Citation Readiness (20%)</div>
              <div className="text-lg font-bold text-purple-600 mt-1">{data.geoSummary.citationReadinessScore}/100</div>
            </div>
          </div>

          {/* Entity Relationship Status Checklist */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs space-y-2">
            <div className="font-semibold text-slate-800 flex items-center justify-between">
              <span>Entity Relationship Status Graph</span>
              <span className="text-[11px] text-purple-600 font-medium">{data.geoSummary.relationshipStatus}</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap pt-1">
              {['Business', 'Brand', 'Website', 'Services', 'Location'].map((label) => {
                const node = data.geoSummary?.entityNodes?.find(
                  (n) => n.type.toLowerCase() === label.toLowerCase() || n.name.toLowerCase().includes(label.toLowerCase())
                );
                const isPresent = node ? node.present : label === 'Business' || label === 'Website';
                return (
                  <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-md shadow-2xs text-slate-700 font-medium text-[11px]">
                    <span className={isPresent ? 'text-emerald-600 font-bold' : 'text-slate-400 font-bold'}>
                      {isPresent ? '✓' : '—'}
                    </span>
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-slate-600 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="font-semibold text-slate-700">
              Entity Relationship Graph: {data.geoSummary.relationshipStatus}
            </span>
            <button
              onClick={() => onNavigateTab("aeo")}
              className="text-purple-600 hover:text-purple-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              Inspect GEO & AEO <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* AIO Readiness & Questions Your Website Should Answer Card */}
      {data.aioSummary && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-600" /> Answer Intelligence Optimization (AIO) Readiness
            </h3>
            <span className="px-3 py-1 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-full text-xs font-bold">
              AIO Score: {data.aioSummary.aioScore}/100
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-slate-500 font-medium">Answer Readiness (35%)</div>
              <div className="text-lg font-bold text-slate-900 mt-1">{data.aioSummary.answerReadinessScore}/100</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-slate-500 font-medium">Topic Depth (30%)</div>
              <div className="text-lg font-bold text-emerald-600 mt-1">{data.aioSummary.topicDepthScore}/100</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-slate-500 font-medium">Content Structure (20%)</div>
              <div className="text-lg font-bold text-indigo-600 mt-1">{data.aioSummary.contentStructureScore}/100</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-slate-500 font-medium">Question Coverage (15%)</div>
              <div className="text-lg font-bold text-purple-600 mt-1">{data.aioSummary.questionCoverageScore}/100</div>
            </div>
          </div>

          {/* Questions Your Website Should Answer Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs space-y-3">
            <div className="font-semibold text-slate-800 flex items-center justify-between">
              <span>Questions Your Website Should Answer</span>
              <span className="text-[11px] text-slate-500 font-normal">
                {data.aioSummary.answeredQuestionsCount} Answered / {data.aioSummary.unansweredQuestionsCount} Unanswered
              </span>
            </div>

            {data.aioSummary.priorityQuestions && data.aioSummary.priorityQuestions.length > 0 ? (
              <div className="space-y-2">
                {data.aioSummary.priorityQuestions.slice(0, 4).map((qItem, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded p-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-800 font-medium truncate max-w-md">{qItem.question}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          qItem.status === 'answered'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : qItem.status === 'partial'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {qItem.status}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">[{qItem.source}]</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic">No specific priority unanswered questions identified.</p>
            )}
          </div>

          <div className="text-xs text-slate-600 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium italic">
              Answer Intelligence Optimization evaluates structured, fact-rich answer extraction readiness for search engines and AI systems.
            </span>
            <button
              onClick={() => onNavigateTab("aeo")}
              className="text-cyan-600 hover:text-cyan-700 font-bold flex items-center gap-1 cursor-pointer shrink-0"
            >
              Inspect AIO Details <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* AI-readable website manifest Card (Only visible when website is published) */}
      {data.websiteInfo?.isPublished && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">AI-readable website manifest</h3>
            </div>
            <a
              href={
                data.websiteInfo.customDomain
                  ? `https://${data.websiteInfo.customDomain}/llms.txt`
                  : `/site/${data.websiteInfo.publishedSlug}/llms.txt`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              View manifest <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your website has an automatically generated machine-readable summary containing important public business and content information.
          </p>
        </div>
      )}

      {/* SEO Data Freshness Indicators */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-600" /> SEO Data Source Freshness
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          {Object.entries(dataFreshness).map(([key, item]) => (
            <div key={key} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
              <div className="font-semibold text-slate-800">{item.label}</div>
              <div className="flex items-center justify-between pt-1">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    item.status === 'fresh'
                      ? 'bg-emerald-100 text-emerald-800'
                      : item.status === 'needs_refresh'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-slate-700'
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
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" /> Priority SEO Actions
          </h3>
          <button
            onClick={() => onNavigateTab('opportunities')}
            className="text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1 cursor-pointer"
          >
            Open Opportunity Engine <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {priorityActions.length > 0 ? (
          <div className="space-y-3">
            {priorityActions.map((act: any) => (
              <div key={act.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-bold uppercase text-[10px]">
                      {act.category}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{act.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        act.priority === 'critical'
                          ? 'bg-rose-100 text-rose-800'
                          : act.priority === 'high'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {act.priority} ({act.priorityScore} pts)
                    </span>

                    {act.hasSupportedFix && act.proposedFix ? (
                      <button
                        onClick={() => {
                          setFixSuccessMessage(null);
                          setFixErrorMessage(null);
                          setSelectedActionForReview(act);
                        }}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
                      >
                        Review Fix <ChevronRight className="w-3 h-3" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setFixSuccessMessage(null);
                          setFixErrorMessage(null);
                          setSelectedActionForReview(act);
                        }}
                        className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                      >
                        Review Opportunity <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-slate-600">{act.reason}</div>
                <div className="text-emerald-700 font-medium">
                  <strong>Recommended Action:</strong> {act.recommendedAction}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/60 mx-auto mb-2" />
            <p>No critical priority actions requiring immediate attention.</p>
          </div>
        )}
      </div>

      {/* Quick Actions Navigation Hub */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Quick Navigation Hub</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigateTab('technical-crawl')}
            className="p-3 bg-slate-50 hover:bg-purple-50/60 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 transition text-left flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-600" /> Technical Crawl</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={() => onNavigateTab('content-studio')}
            className="p-3 bg-slate-50 hover:bg-purple-50/60 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 transition text-left flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-indigo-600" /> Content Studio</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={() => onNavigateTab('competitors')}
            className="p-3 bg-slate-50 hover:bg-purple-50/60 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 transition text-left flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2"><Swords className="w-4 h-4 text-amber-600" /> Competitors</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={() => onNavigateTab('aeo')}
            className="p-3 bg-slate-50 hover:bg-purple-50/60 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 transition text-left flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2"><Bot className="w-4 h-4 text-purple-600" /> AEO / AI Search</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={() => onNavigateTab('local-seo')}
            className="p-3 bg-slate-50 hover:bg-purple-50/60 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 transition text-left flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-600" /> Local SEO</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={() => onNavigateTab('internal-links')}
            className="p-3 bg-slate-50 hover:bg-purple-50/60 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 transition text-left flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2"><Link2 className="w-4 h-4 text-teal-600" /> Internal Links</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Historical Trend & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-4">
          <h3 className="text-md font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-600" /> Historical SEO Score Trend
          </h3>
          {historicalTrend.length > 0 ? (
            <div className="space-y-2">
              {historicalTrend.map((t, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500">{t.date}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 text-sm">{t.unifiedScore} / 100</span>
                    <span className="text-[10px] text-emerald-700 uppercase font-bold">{t.confidenceLevel} confidence</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-xs">Not enough historical trend data yet.</div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-4">
          <h3 className="text-md font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" /> Recent SEO Activity
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activityTimeline.map((act) => (
              <div key={act.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="font-semibold text-slate-800">{act.title}</div>
                <div className="text-[10px] text-slate-500">{new Date(act.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SCORE EXPLANATION MODAL */}
      {selectedExplanation && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full space-y-4 shadow-xl relative">
            <button
              onClick={() => setSelectedExplanation(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" /> {selectedExplanation.id === 'core_seo' ? 'Core SEO' : selectedExplanation.name} Explanation
            </h3>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
                <span className="text-slate-500">Score</span>
                <span className="font-bold text-slate-900 text-base">
                  {selectedExplanation.status === 'AVAILABLE' ? `${selectedExplanation.score} / 100` : 'Not Available'}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
                <span className="text-slate-500">Weight</span>
                <span className="font-bold text-slate-800">{Math.round(selectedExplanation.weight * 100)}%</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
                <span className="text-slate-500">Score Contribution</span>
                <span className="font-bold text-emerald-700">+{selectedExplanation.contribution} points</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
                <span className="text-slate-500">Source Engine</span>
                <span className="font-bold text-slate-800">{selectedExplanation.source}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Last Analyzed</span>
                <span className="text-slate-500">
                  {selectedExplanation.lastAnalyzedAt ? new Date(selectedExplanation.lastAnalyzedAt).toLocaleString() : 'Never'}
                </span>
              </div>
              <div className="pt-2 text-slate-700 italic border-t border-slate-200/80">
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
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                Inspect {selectedExplanation.id === 'core_seo' ? 'Core SEO' : selectedExplanation.name} Module <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW FIX / REVIEW OPPORTUNITY MODAL */}
      {selectedActionForReview && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setSelectedActionForReview(null);
                setFixSuccessMessage(null);
                setFixErrorMessage(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Zap className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedActionForReview.hasSupportedFix ? 'Review Proposed SEO Fix' : 'Review Optimization Opportunity'}
                </h3>
                <p className="text-xs text-slate-500">
                  Category: <span className="font-semibold capitalize">{selectedActionForReview.category}</span> | Priority: <span className="font-semibold capitalize text-amber-600">{selectedActionForReview.priority}</span>
                </p>
              </div>
            </div>

            {fixSuccessMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{fixSuccessMessage}</span>
              </div>
            )}

            {fixErrorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{fixErrorMessage}</span>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
              <div>
                <div className="text-slate-500 font-medium">Issue Title</div>
                <div className="font-bold text-slate-900 text-sm mt-0.5">{selectedActionForReview.title}</div>
              </div>

              <div>
                <div className="text-slate-500 font-medium">Affected Page / Component</div>
                <div className="font-mono text-slate-800 bg-white border border-slate-200 rounded px-2 py-1 mt-0.5 inline-block">
                  {selectedActionForReview.affectedPage || 'index.html'}
                </div>
              </div>

              <div>
                <div className="text-slate-500 font-medium">Why It Matters</div>
                <div className="text-slate-700 leading-relaxed mt-0.5">{selectedActionForReview.reason}</div>
              </div>

              {selectedActionForReview.hasSupportedFix && selectedActionForReview.proposedFix && (
                <div className="border-t border-slate-200 pt-3 space-y-2">
                  <div className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Proposed Fix Payload</div>
                  
                  {selectedActionForReview.proposedFix.currentValue ? (
                    <div>
                      <div className="text-slate-500 text-[11px]">Current Value:</div>
                      <div className="bg-rose-50/60 border border-rose-200/60 text-rose-900 font-mono text-[11px] p-2 rounded mt-0.5">
                        {selectedActionForReview.proposedFix.currentValue}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <div className="text-slate-500 text-[11px]">Proposed Change ({selectedActionForReview.proposedFix.issueType}):</div>
                    <div className="bg-emerald-50/60 border border-emerald-200/60 text-emerald-900 font-mono text-[11px] p-2 rounded mt-0.5 font-semibold">
                      {selectedActionForReview.proposedFix.recommendedValue}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 italic">
                {selectedActionForReview.hasSupportedFix ? 'Requires explicit customer confirmation.' : 'Informational opportunity.'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedActionForReview(null);
                    setFixSuccessMessage(null);
                    setFixErrorMessage(null);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Close
                </button>

                {selectedActionForReview.hasSupportedFix && selectedActionForReview.proposedFix && !fixSuccessMessage ? (
                  <button
                    onClick={handleApplyFix}
                    disabled={applyingFix}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {applyingFix ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Applying Fix & Re-analyzing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        Apply Fix & Re-analyze
                      </>
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
