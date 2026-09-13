"use client";

import React from "react";
import { SEOAnalysisResult } from "@/lib/seo-analyzer";

interface SEOScoreCardProps {
  score: number;
  analysis?: SEOAnalysisResult["analysis"] | null;
  imageStats?: SEOAnalysisResult["image_stats"] | null;
  onAnalyze: () => void;
  onGenerateAI: () => void;
  isAnalyzing: boolean;
  isGeneratingAI: boolean;
  canUseAI: boolean;
  isDirty?: boolean;
  issueCounts?: { critical: number; warning: number; opportunity: number; passed: number } | null;
  pagesCount?: number;
}

export function SEOScoreCard({
  score,
  analysis,
  imageStats,
  onAnalyze,
  onGenerateAI,
  isAnalyzing,
  isGeneratingAI,
  canUseAI,
  isDirty,
  issueCounts,
  pagesCount,
}: SEOScoreCardProps) {
  // Score color helper
  const getScoreColor = (val: number) => {
    if (val >= 80) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (val >= 50) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-rose-600 bg-rose-50 border-rose-200";
  };

  const getScoreRing = (val: number) => {
    if (val >= 80) return "stroke-emerald-500";
    if (val >= 50) return "stroke-amber-500";
    return "stroke-rose-500";
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Left: Score Badge & Title */}
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="stroke-slate-100"
                strokeWidth="3.5"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={`${getScoreRing(score)} transition-all duration-1000 ease-out`}
                strokeDasharray={`${score}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-slate-900">{score}</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">/ 100</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">Website SEO Score</h2>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getScoreColor(
                  score
                )}`}
              >
                {score >= 80 ? "Good" : score >= 50 ? "Needs Work" : "Poor"}
              </span>
              {isDirty && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                  ⚡ Content Modified • Re-analysis Ready
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-1 max-w-md">
              Multi-page Cheerio audit of HTML tags, heading hierarchy, images, links, schema, and directives.
            </p>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-medium text-sm rounded-lg shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <svg className="animate-spin h-4 w-4 text-slate-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-Analyze SEO
              </>
            )}
          </button>

          <button
            onClick={onGenerateAI}
            disabled={isGeneratingAI || !canUseAI}
            className={`flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 font-medium text-sm rounded-lg shadow-sm transition-all text-white ${
              canUseAI
                ? "bg-purple-600 hover:bg-purple-700 shadow-purple-200 active:scale-95"
                : "bg-slate-300 cursor-not-allowed opacity-80"
            }`}
            title={!canUseAI ? "Requires Pro or Agency Plan" : "Generate SEO with Gemini AI"}
          >
            {isGeneratingAI ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Generating AI Suggestions...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                ✨ Generate SEO with AI
              </>
            )}
          </button>
        </div>
      </div>

      {/* Analysis Category Breakdown Grid */}
      {analysis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3 mt-6 pt-6 border-t border-slate-100">
          {Object.entries(analysis).map(([key, item]) => (
            <div key={key} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block capitalize">
                {key.replace("_", " ")}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-base font-bold text-slate-900">{item.score}</span>
                <span className="text-xs text-slate-400">/{item.max}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Alt Stats Section */}
      {imageStats && (
        <div className="mt-4 p-3 bg-purple-50/50 rounded-lg border border-purple-100/60 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-4">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-semibold text-slate-800">Image Alt Text SEO:</span>
            <span>Total images: <strong className="text-slate-900">{imageStats.total}</strong></span>
            <span>• Images with alt text: <strong className="text-emerald-700">{imageStats.with_alt}</strong></span>
            {imageStats.missing_alt > 0 ? (
              <span>• Missing alt text: <strong className="text-rose-600 font-semibold">{imageStats.missing_alt}</strong></span>
            ) : (
              <span>• <strong className="text-emerald-600">All images set!</strong></span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
