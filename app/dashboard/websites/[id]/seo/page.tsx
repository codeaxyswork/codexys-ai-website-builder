"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SEOScoreCard } from "@/components/SEOScoreCard";
import { SEOSettingsForm, SEOSettingsFormData } from "@/components/SEOSettingsForm";
import { SchemaMarkupEditor } from "@/components/SchemaMarkupEditor";
import { SEOIntegrations } from "@/components/SEOIntegrations";
import { AISEOSuggestionsModal } from "@/components/AISEOSuggestions";
import { SEOAnalysisResult } from "@/lib/seo-analyzer";
import { AISEOSuggestions } from "@/lib/seo-ai";

interface SEODashboardPageProps {
  params: Promise<{ id: string }>;
}

export default function SEODashboardPage({ params }: SEODashboardPageProps) {
  const { id: websiteId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [website, setWebsite] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<string>("free");

  // SEO Form Data State
  const [formData, setFormData] = useState<SEOSettingsFormData>({
    seo_title: "",
    meta_description: "",
    focus_keywords: [],
    canonical_url: "",
    robots_index: true,
    robots_follow: true,
    og_title: "",
    og_description: "",
    og_image_url: "",
    twitter_card: "summary_large_image",
    twitter_title: "",
    twitter_description: "",
    twitter_image_url: "",
    google_analytics_id: "",
    google_tag_manager_id: "",
  });

  const [schemaMarkup, setSchemaMarkup] = useState<Record<string, any>>({});
  const [integrations, setIntegrations] = useState<any[]>([]);

  // Score & Analysis state
  const [seoScore, setSeoScore] = useState<number>(0);
  const [analysis, setAnalysis] = useState<SEOAnalysisResult["analysis"] | null>(null);
  const [imageStats, setImageStats] = useState<SEOAnalysisResult["image_stats"] | null>(null);

  // Statuses
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // AI Modal
  const [aiSuggestions, setAiSuggestions] = useState<AISEOSuggestions | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, [websiteId]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // 1. Fetch website details
      const siteRes = await fetch(`/api/websites`);
      if (siteRes.ok) {
        const siteData = await siteRes.json();
        const found = (siteData.websites || []).find((w: any) => w.id === websiteId);
        if (found) setWebsite(found);
      }

      // 2. Fetch User Usage / Plan
      const usageRes = await fetch(`/api/user/usage`);
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        if (usageData?.plan?.id) {
          setUserPlan(usageData.plan.id);
        }
      }

      // 3. Fetch SEO Data
      const seoRes = await fetch(`/api/websites/${websiteId}/seo`);
      if (seoRes.ok) {
        const seoData = await seoRes.json();
        if (seoData.seo) {
          const s = seoData.seo;
          setFormData({
            seo_title: s.seo_title || "",
            meta_description: s.meta_description || "",
            focus_keywords: s.focus_keywords || [],
            canonical_url: s.canonical_url || "",
            robots_index: s.robots_index !== false,
            robots_follow: s.robots_follow !== false,
            og_title: s.og_title || "",
            og_description: s.og_description || "",
            og_image_url: s.og_image_url || "",
            twitter_card: s.twitter_card || "summary_large_image",
            twitter_title: s.twitter_title || "",
            twitter_description: s.twitter_description || "",
            twitter_image_url: s.twitter_image_url || "",
            google_analytics_id: s.google_analytics_id || "",
            google_tag_manager_id: s.google_tag_manager_id || "",
          });

          setSchemaMarkup(s.schema_markup || {});
          setSeoScore(s.seo_score || 0);
          setAnalysis(s.seo_analysis || null);
        }
        if (seoData.integrations) {
          setIntegrations(seoData.integrations);
        }
      }
    } catch (err: any) {
      console.error("Failed to load SEO Dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveStatus("saving");
      setErrorMessage(null);

      const payload = {
        ...formData,
        schema_markup: schemaMarkup,
      };

      const res = await fetch(`/api/websites/${websiteId}/seo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to save SEO settings.");
      }

      const resData = await res.json();
      if (resData.seo) {
        setSeoScore(resData.seo.seo_score || 0);
      }
      if (resData.analysis) {
        setAnalysis(resData.analysis.analysis);
        setImageStats(resData.analysis.image_stats);
      }

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err: any) {
      console.error("Save SEO Error:", err);
      setSaveStatus("error");
      setErrorMessage(err.message || "Failed to save SEO settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyze = async () => {
    try {
      setIsAnalyzing(true);
      setErrorMessage(null);

      const res = await fetch(`/api/websites/${websiteId}/seo/analyze`, {
        method: "POST",
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Analysis failed.");
      }

      const data = await res.json();
      setSeoScore(data.seo_score || 0);
      setAnalysis(data.analysis || null);
      setImageStats(data.image_stats || null);
    } catch (err: any) {
      console.error("Analyze SEO Error:", err);
      setErrorMessage(err.message || "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateAI = async () => {
    try {
      setIsGeneratingAI(true);
      setErrorMessage(null);

      const res = await fetch(`/api/websites/${websiteId}/seo/generate`, {
        method: "POST",
      });

      if (!res.ok) {
        const errJson = await res.json();
        if (errJson.code === "UPGRADE_REQUIRED") {
          throw new Error("AI SEO Suggestions feature requires a Pro or Agency plan upgrade.");
        }
        throw new Error(errJson.error || "Failed to generate AI SEO suggestions.");
      }

      const data = await res.json();
      if (data.suggestions) {
        setAiSuggestions(data.suggestions);
        setIsAiModalOpen(true);
      }
    } catch (err: any) {
      console.error("Generate AI SEO Error:", err);
      setErrorMessage(err.message || "Failed to generate AI SEO suggestions.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleApplyAISuggestions = (selected: Partial<AISEOSuggestions>) => {
    setFormData((prev) => ({
      ...prev,
      seo_title: selected.seo_title || prev.seo_title,
      meta_description: selected.meta_description || prev.meta_description,
      focus_keywords: selected.focus_keywords || prev.focus_keywords,
      og_title: selected.og_title || prev.og_title,
      og_description: selected.og_description || prev.og_description,
    }));

    if (selected.schema_markup) {
      setSchemaMarkup(selected.schema_markup);
    }
  };

  const handleSaveIntegration = async (provider: string, status: string, config: any) => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/integrations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, status, configuration: config }),
      });
      if (res.ok) {
        const data = await res.json();
        setIntegrations((prev) => {
          const filtered = prev.filter((i) => i.provider !== provider);
          return [...filtered, data.integration];
        });
      }
    } catch (err) {
      console.error("Save integration error:", err);
    }
  };

  const canUseAI = userPlan === "pro" || userPlan === "agency";
  const canUseSchema = userPlan === "pro" || userPlan === "agency";
  const canUseIntegrations = userPlan === "agency";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-600 font-medium">
          <svg className="animate-spin h-5 w-5 text-purple-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading SEO Management Dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-all"
              title="Back to Dashboard"
            >
              ← Back
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{website?.title || "Website SEO"}</h1>
                {website?.is_published ? (
                  <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                    Published
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">
                    Draft
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Website SEO Management & Indexing Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {website?.is_published && website?.published_slug && (
              <>
                <a
                  href={`/sitemap/${website.published_slug}.xml`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all"
                >
                  XML Sitemap ↗
                </a>
                <a
                  href={`/robots/${website.published_slug}.txt`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all"
                >
                  Robots.txt ↗
                </a>
              </>
            )}
            <Link
              href="/"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
            >
              Open AI Builder ↗
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {errorMessage && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 font-bold hover:text-rose-900">
              ×
            </button>
          </div>
        )}

        {/* 1. SEO Score Overview */}
        <SEOScoreCard
          score={seoScore}
          analysis={analysis}
          imageStats={imageStats}
          onAnalyze={handleAnalyze}
          onGenerateAI={handleGenerateAI}
          isAnalyzing={isAnalyzing}
          isGeneratingAI={isGeneratingAI}
          canUseAI={canUseAI}
        />

        {/* 2. Basic & Social SEO Form */}
        <SEOSettingsForm
          formData={formData}
          onChange={setFormData}
          onSave={handleSave}
          isSaving={isSaving}
          saveStatus={saveStatus}
        />

        {/* 3. Schema Markup Editor */}
        <div className="mt-8">
          <SchemaMarkupEditor
            schemaMarkup={schemaMarkup}
            onChange={setSchemaMarkup}
            canUseSchema={canUseSchema}
          />
        </div>

        {/* 4. Analytics & Integration Management */}
        <div className="mt-8">
          <SEOIntegrations
            integrations={integrations}
            gaId={formData.google_analytics_id}
            gtmId={formData.google_tag_manager_id}
            onUpdateGaId={(val) => setFormData((prev) => ({ ...prev, google_analytics_id: val }))}
            onUpdateGtmId={(val) => setFormData((prev) => ({ ...prev, google_tag_manager_id: val }))}
            onSaveIntegration={handleSaveIntegration}
            canUseIntegrations={canUseIntegrations}
          />
        </div>
      </main>

      {/* AI Suggestions Review Modal */}
      {aiSuggestions && (
        <AISEOSuggestionsModal
          suggestions={aiSuggestions}
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          onApply={handleApplyAISuggestions}
        />
      )}
    </div>
  );
}
