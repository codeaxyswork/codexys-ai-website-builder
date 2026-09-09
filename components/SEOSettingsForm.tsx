"use client";

import React, { useState } from "react";

export interface SEOSettingsFormData {
  seo_title: string;
  meta_description: string;
  focus_keywords: string[];
  canonical_url: string;
  robots_index: boolean;
  robots_follow: boolean;
  og_title: string;
  og_description: string;
  og_image_url: string;
  twitter_card: string;
  twitter_title: string;
  twitter_description: string;
  twitter_image_url: string;
  google_analytics_id: string;
  google_tag_manager_id: string;
}

interface SEOSettingsFormProps {
  formData: SEOSettingsFormData;
  onChange: (updated: SEOSettingsFormData) => void;
  onSave: () => void;
  isSaving: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
}

export function SEOSettingsForm({
  formData,
  onChange,
  onSave,
  isSaving,
  saveStatus,
}: SEOSettingsFormProps) {
  const [keywordInput, setKeywordInput] = useState("");

  const handleTextChange = (field: keyof SEOSettingsFormData, value: any) => {
    onChange({
      ...formData,
      [field]: value,
    });
  };

  const addKeyword = () => {
    if (!keywordInput.trim()) return;
    const kw = keywordInput.trim();
    if (!formData.focus_keywords.includes(kw)) {
      onChange({
        ...formData,
        focus_keywords: [...formData.focus_keywords, kw],
      });
    }
    setKeywordInput("");
  };

  const removeKeyword = (kw: string) => {
    onChange({
      ...formData,
      focus_keywords: formData.focus_keywords.filter((k) => k !== kw),
    });
  };

  return (
    <div className="space-y-8">
      {/* 1. BASIC SEO */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Basic SEO Configuration
        </h3>

        <div className="space-y-5">
          {/* SEO Title */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-semibold text-slate-700">SEO Title</label>
              <span className={`text-xs ${formData.seo_title.length > 60 ? "text-amber-600 font-semibold" : "text-slate-400"}`}>
                {formData.seo_title.length} / 60 chars
              </span>
            </div>
            <input
              type="text"
              value={formData.seo_title}
              onChange={(e) => handleTextChange("seo_title", e.target.value)}
              placeholder="e.g. Best Luxury Dental Clinic in Chicago | Smile Design"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            />
          </div>

          {/* Meta Description */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-semibold text-slate-700">Meta Description</label>
              <span className={`text-xs ${formData.meta_description.length > 160 ? "text-amber-600 font-semibold" : "text-slate-400"}`}>
                {formData.meta_description.length} / 160 chars
              </span>
            </div>
            <textarea
              rows={3}
              value={formData.meta_description}
              onChange={(e) => handleTextChange("meta_description", e.target.value)}
              placeholder="e.g. Experience premium dental care with state-of-the-art technology. Book your consultation online today."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            />
          </div>

          {/* Focus Keywords */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Focus Keywords</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="Add keyword and press Enter..."
                className="flex-1 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <button
                type="button"
                onClick={addKeyword}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-all"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.focus_keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-semibold"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => removeKeyword(kw)}
                    className="hover:text-purple-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Canonical URL */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Canonical URL</label>
            <input
              type="url"
              value={formData.canonical_url}
              onChange={(e) => handleTextChange("canonical_url", e.target.value)}
              placeholder="https://example.com/site/your-slug"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* 2. SEARCH ENGINE SETTINGS */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Search Engine Robots Directives
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100/50 transition-all">
            <input
              type="checkbox"
              checked={formData.robots_index}
              onChange={(e) => handleTextChange("robots_index", e.target.checked)}
              className="mt-1 h-4 w-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
            />
            <div>
              <span className="text-sm font-bold text-slate-900 block">Allow Search Engines to Index (index)</span>
              <span className="text-xs text-slate-500">Enable search engines like Google and Bing to list this website in search results.</span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100/50 transition-all">
            <input
              type="checkbox"
              checked={formData.robots_follow}
              onChange={(e) => handleTextChange("robots_follow", e.target.checked)}
              className="mt-1 h-4 w-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
            />
            <div>
              <span className="text-sm font-bold text-slate-900 block">Allow Search Engines to Follow Links (follow)</span>
              <span className="text-xs text-slate-500">Instruct search engine crawlers to follow links on your pages.</span>
            </div>
          </label>
        </div>
      </div>

      {/* 3. SOCIAL SEO (OPEN GRAPH & TWITTER) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Social Media Cards (Open Graph & Twitter)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Open Graph */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-purple-700">Open Graph (Facebook, LinkedIn)</h4>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">OG Title</label>
              <input
                type="text"
                value={formData.og_title}
                onChange={(e) => handleTextChange("og_title", e.target.value)}
                placeholder="Defaults to SEO Title if empty"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">OG Description</label>
              <textarea
                rows={2}
                value={formData.og_description}
                onChange={(e) => handleTextChange("og_description", e.target.value)}
                placeholder="Defaults to Meta Description if empty"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">OG Image URL</label>
              <input
                type="url"
                value={formData.og_image_url}
                onChange={(e) => handleTextChange("og_image_url", e.target.value)}
                placeholder="https://example.com/og-banner.jpg"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Twitter Card */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-purple-700">Twitter Card</h4>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Twitter Card Type</label>
              <select
                value={formData.twitter_card}
                onChange={(e) => handleTextChange("twitter_card", e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="summary_large_image">Summary Card with Large Image</option>
                <option value="summary">Summary Card</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Twitter Title</label>
              <input
                type="text"
                value={formData.twitter_title}
                onChange={(e) => handleTextChange("twitter_title", e.target.value)}
                placeholder="Defaults to OG Title if empty"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Twitter Description</label>
              <textarea
                rows={2}
                value={formData.twitter_description}
                onChange={(e) => handleTextChange("twitter_description", e.target.value)}
                placeholder="Defaults to OG Description if empty"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button Bar */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4 shadow-sm sticky bottom-4 z-10">
        <div className="flex items-center gap-2">
          {saveStatus === "saving" && (
            <span className="text-xs font-medium text-purple-600 flex items-center gap-1.5">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Saving SEO settings...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              ✓ SEO settings saved!
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
              ✕ Error saving SEO settings.
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm rounded-lg shadow-sm transition-all disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save SEO Settings"}
        </button>
      </div>
    </div>
  );
}
