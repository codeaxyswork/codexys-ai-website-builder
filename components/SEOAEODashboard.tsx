'use me';
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Building2,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { WebsiteAEOAnalysis } from '@/lib/seo-aeo/types';

interface SEOAEODashboardProps {
  websiteId: string;
}

export default function SEOAEODashboard({ websiteId }: SEOAEODashboardProps) {
  const [analysis, setAnalysis] = useState<WebsiteAEOAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchAEOData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/aeo`);
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis || null);
      }
    } catch (err) {
      console.error('Failed to load AEO data:', err);
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    fetchAEOData();
  }, [fetchAEOData]);

  const handleRunAEOScan = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/aeo`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchAEOData();
      }
    } catch (err) {
      console.error('Failed to run AEO scan:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center font-sans">
        <RotateCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
        <p className="text-sm font-bold text-slate-600">Analyzing Answer Engine Readiness...</p>
      </div>
    );
  }

  const score = analysis?.answer_readiness_score || 0;
  const breakdown = analysis?.aeo_breakdown || {
    answerClarity: 0,
    questionCoverage: 0,
    contentStructure: 0,
    entityUnderstanding: 0,
    semanticRelevance: 0,
    structuredData: 0,
    topicDepth: 0,
  };
  const entity = analysis?.entity_clarity || {
    businessName: null,
    city: null,
    phone: null,
    brand: null,
    productsServices: [],
    missingEntities: [],
    clarityScore: 0,
  };
  const questions = analysis?.questions_discovered || [];

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              AEO & AI Search Readiness Engine
            </h2>
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
              Generative SERP Ready
            </span>
          </div>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Evaluate content structure, entity clarity, and direct answer readiness for conversational search engines.
          </p>
        </div>

        <button
          onClick={handleRunAEOScan}
          disabled={analyzing}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl shadow-md shadow-purple-600/20 transition-all cursor-pointer disabled:opacity-50"
        >
          <RotateCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
          {analyzing ? 'Scanning AEO Readiness...' : 'Re-Analyze AEO Signals'}
        </button>
      </div>

      {/* Main Score & Sub-score Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Score Gauge */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4 text-center flex flex-col justify-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Answer Readiness Score</p>
          <div className="relative inline-flex items-center justify-center mx-auto">
            <div className="text-5xl font-black text-slate-900 tracking-tight">{score}</div>
            <span className="text-sm font-bold text-slate-400 ml-1">/100</span>
          </div>
          <div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                score >= 85
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : score >= 70
                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                  : score >= 50
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {score >= 85 ? 'OPTIMAL AEO READINESS' : score >= 70 ? 'HIGH READINESS' : score >= 50 ? 'MEDIUM READINESS' : 'NEEDS ATTENTION'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto">
            Based on answer clarity, heading structure, entity representation, and question coverage.
          </p>
        </div>

        {/* Right: Sub-score Category Progress Bars */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            AEO Signal Breakdown
          </h3>

          {[
            { label: 'Answer Clarity & Conciseness', val: breakdown.answerClarity, max: 20 },
            { label: 'Conversational Question Coverage', val: breakdown.questionCoverage, max: 15 },
            { label: 'Heading Structure (H1 -> H2 -> H3)', val: breakdown.contentStructure, max: 15 },
            { label: 'Entity Understanding & Representation', val: breakdown.entityUnderstanding, max: 15 },
            { label: 'Semantic Relevance & Keywords', val: breakdown.semanticRelevance, max: 15 },
            { label: 'Structured JSON-LD Schema Data', val: breakdown.structuredData, max: 10 },
            { label: 'Topic Depth & Article Coverage', val: breakdown.topicDepth, max: 10 },
          ].map((item, idx) => {
            const pct = Math.round((item.val / item.max) * 100);
            return (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700">{item.label}</span>
                  <span className="text-purple-700 font-bold">{item.val} / {item.max} pts</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Entity Clarity & Discovered Questions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entity Clarity Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-600" />
              Entity Clarity & Representation
            </h3>
            <span className="px-2.5 py-0.5 bg-purple-50 text-purple-800 text-xs font-bold rounded-full border border-purple-200">
              Clarity: {entity.clarityScore}%
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Business / Organization:</span>
              <span className="font-bold text-slate-900">{entity.businessName || 'Not Specified'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Location / City:</span>
              <span className="font-bold text-slate-900">{entity.city || 'Not Specified'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Contact Phone:</span>
              <span className="font-bold text-slate-900">{entity.phone || 'Not Specified'}</span>
            </div>
          </div>

          {entity.missingEntities.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
              <p className="font-bold text-amber-900 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                Missing Entity Signals:
              </p>
              <ul className="list-disc list-inside text-amber-800 font-medium">
                {entity.missingEntities.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Discovered Questions Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-purple-600" />
              Conversational Questions Indexed ({questions.length})
            </h3>
          </div>

          {questions.length === 0 ? (
            <p className="text-xs text-slate-500 font-medium italic py-4 text-center">
              No explicit question headings or FAQ sections detected. Add question-formatted subheadings (e.g. &quot;What is...&quot;, &quot;How to...&quot;).
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50 text-xs flex items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900">{q.question}</p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Source: <span className="capitalize">{q.source.replace('_', ' ')}</span> &bull; Page: {q.pagePath}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      q.hasDirectAnswer
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {q.hasDirectAnswer ? 'Answer Ready' : 'Needs Direct Answer'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
