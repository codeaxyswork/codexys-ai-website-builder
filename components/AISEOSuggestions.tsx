"use client";

import React, { useState } from "react";
import { AISEOSuggestions as AISEOSuggestionsType } from "@/lib/seo-ai";

interface AISEOSuggestionsModalProps {
  suggestions: AISEOSuggestionsType;
  isOpen: boolean;
  onClose: () => void;
  onApply: (selected: Partial<AISEOSuggestionsType>) => void;
}

export function AISEOSuggestionsModal({
  suggestions,
  isOpen,
  onClose,
  onApply,
}: AISEOSuggestionsModalProps) {
  const [selectedFields, setSelectedFields] = useState<{
    seo_title: boolean;
    meta_description: boolean;
    focus_keywords: boolean;
    og_title: boolean;
    og_description: boolean;
    schema_markup: boolean;
  }>({
    seo_title: true,
    meta_description: true,
    focus_keywords: true,
    og_title: true,
    og_description: true,
    schema_markup: true,
  });

  if (!isOpen) return null;

  const toggleField = (key: keyof typeof selectedFields) => {
    setSelectedFields((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleApplySelected = () => {
    const payload: Partial<AISEOSuggestionsType> = {};
    if (selectedFields.seo_title) payload.seo_title = suggestions.seo_title;
    if (selectedFields.meta_description) payload.meta_description = suggestions.meta_description;
    if (selectedFields.focus_keywords) payload.focus_keywords = suggestions.focus_keywords;
    if (selectedFields.og_title) payload.og_title = suggestions.og_title;
    if (selectedFields.og_description) payload.og_description = suggestions.og_description;
    if (selectedFields.schema_markup) payload.schema_markup = suggestions.schema_markup;

    onApply(payload);
    onClose();
  };

  const handleApplyAll = () => {
    onApply(suggestions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-purple-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <div>
              <h3 className="text-lg font-bold text-slate-900">AI SEO Suggestions Review</h3>
              <p className="text-xs text-slate-500">
                Review Gemini AI suggestions before applying them to your SEO configuration.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* SEO Title Suggestion */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition-all">
            <label className="flex items-center justify-between cursor-pointer mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700">SEO Title</span>
              <input
                type="checkbox"
                checked={selectedFields.seo_title}
                onChange={() => toggleField("seo_title")}
                className="h-4 w-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
              />
            </label>
            <p className="text-sm font-semibold text-slate-900 bg-white p-3 rounded-lg border border-slate-200">
              {suggestions.seo_title}
            </p>
          </div>

          {/* Meta Description Suggestion */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition-all">
            <label className="flex items-center justify-between cursor-pointer mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Meta Description</span>
              <input
                type="checkbox"
                checked={selectedFields.meta_description}
                onChange={() => toggleField("meta_description")}
                className="h-4 w-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
              />
            </label>
            <p className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
              {suggestions.meta_description}
            </p>
          </div>

          {/* Focus Keywords Suggestion */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition-all">
            <label className="flex items-center justify-between cursor-pointer mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Focus Keywords</span>
              <input
                type="checkbox"
                checked={selectedFields.focus_keywords}
                onChange={() => toggleField("focus_keywords")}
                className="h-4 w-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
              />
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {suggestions.focus_keywords.map((kw) => (
                <span
                  key={kw}
                  className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium border border-purple-200"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>

          {/* Schema Markup Preview */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition-all">
            <label className="flex items-center justify-between cursor-pointer mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Structured Data Schema</span>
              <input
                type="checkbox"
                checked={selectedFields.schema_markup}
                onChange={() => toggleField("schema_markup")}
                className="h-4 w-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
              />
            </label>
            <pre className="text-xs font-mono bg-slate-900 text-emerald-400 p-3 rounded-lg overflow-x-auto max-h-36">
              {JSON.stringify(suggestions.schema_markup, null, 2)}
            </pre>
          </div>

          {/* Strategic Recommendations */}
          {suggestions.recommendations.length > 0 && (
            <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
              <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider mb-2">
                💡 Strategic AI SEO Advice
              </h4>
              <ul className="space-y-1 text-xs text-purple-800">
                {suggestions.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span>•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium transition-all"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleApplySelected}
              className="px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-sm font-semibold rounded-lg shadow-sm transition-all"
            >
              Apply Selected
            </button>
            <button
              type="button"
              onClick={handleApplyAll}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all"
            >
              Apply All Suggestions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
