"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SEOScoreCard } from "@/components/SEOScoreCard";
import { SEOSettingsForm, SEOSettingsFormData } from "@/components/SEOSettingsForm";
import { SchemaMarkupEditor } from "@/components/SchemaMarkupEditor";
import { SEOIntegrations } from "@/components/SEOIntegrations";
import { AISEOSuggestionsModal } from "@/components/AISEOSuggestions";
import { SEOPerformanceDashboard, GscPerformanceData } from "@/components/SEOPerformanceDashboard";
import { GscPropertySelectorModal } from "@/components/GscPropertySelectorModal";
import { SEOAnalysisResult } from "@/lib/seo-analyzer";
import { AISEOSuggestions } from "@/lib/seo-ai";

interface SEODashboardPageProps {
  params: Promise<{ id: string }>;
}

export default function SEODashboardPage({ params }: SEODashboardPageProps) {
  const { id: websiteId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active Navigation Tab
  const initialTab = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState<string>(initialTab);

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
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [pagesSeo, setPagesSeo] = useState<any[]>([]);

  // GSC Performance & Property Selector State
  const [gscPerformance, setGscPerformance] = useState<GscPerformanceData | null>(null);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [isSyncingGsc, setIsSyncingGsc] = useState(false);
  const [gscSyncError, setGscSyncError] = useState<string | null>(null);
  const [isPropertySelectorOpen, setIsPropertySelectorOpen] = useState(false);

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

  useEffect(() => {
    // Check for GSC OAuth callback triggers or errors in URL query params
    const gscConnected = searchParams.get("gsc_connected");
    const openSelectProperty = searchParams.get("select_property");
    const gscError = searchParams.get("gsc_error");
    const tabParam = searchParams.get("tab");

    if (tabParam) {
      setActiveTab(tabParam);
    }
    if (gscError) {
      setErrorMessage(gscError);
    }
    if (openSelectProperty === "1" || gscConnected === "1") {
      setIsPropertySelectorOpen(true);
      fetchGscPerformance();
    }
  }, [searchParams]);

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

      // 3. Fetch SEO Settings & Integrations
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
          setIsDirty(s.is_dirty || false);
        }
        if (seoData.pages_seo) {
          setPagesSeo(seoData.pages_seo);
        }
        if (seoData.integrations) {
          setIntegrations(seoData.integrations);
        }
      }

      // 4. Fetch GSC Performance
      await fetchGscPerformance();
    } catch (err: any) {
      console.error("Failed to load SEO Dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGscPerformance = async () => {
    try {
      setLoadingPerformance(true);
      const res = await fetch(`/api/websites/${websiteId}/seo/gsc/performance`);
      if (res.ok) {
        const data = await res.json();
        setGscPerformance(data);
      }
    } catch (err) {
      console.error("Failed to fetch GSC performance:", err);
    } finally {
      setLoadingPerformance(false);
    }
  };

  const handleConnectGsc = () => {
    window.location.href = `/api/seo/gsc/connect?website_id=${websiteId}&redirect=1`;
  };

  const handleSelectGscProperty = async (propertyUrl: string) => {
    const res = await fetch(`/api/websites/${websiteId}/seo/gsc/select-property`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_url: propertyUrl }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || "Failed to select property.");
    }

    // Refresh integrations list & GSC performance
    await fetchInitialData();
    // Auto-trigger sync after selecting property
    handleSyncGsc();
  };

  const handleSyncGsc = async () => {
    try {
      setIsSyncingGsc(true);
      setGscSyncError(null);

      const res = await fetch(`/api/websites/${websiteId}/seo/gsc/sync`, {
        method: "POST",
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Search Console sync failed.");
      }

      await fetchGscPerformance();
    } catch (err: any) {
      console.error("GSC Sync Error:", err);
      setGscSyncError(err.message || "Failed to sync Search Console data.");
    } fontally: {
      setIsSyncingGsc(false);
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
      setIsDirty(false);
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

  const tabs = [
    { id: "overview", label: "SEO Overview" },
    { id: "performance", label: "Performance" },
    { id: "organic", label: "Organic SEO" },
    { id: "technical", label: "Technical SEO" },
    { id: "pages", label: "Pages" },
    { id: "keywords", label: "Keywords / Rankings" },
    { id: "agent", label: "AI SEO Agent" },
    { id: "integrations", label: "Integrations" },
    { id: "settings", label: "SEO Settings" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
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
              <p className="text-xs text-slate-500 mt-0.5">Website SEO Management & Search Console Performance</p>
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

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-100 overflow-x-auto scrollbar-none">
          <nav className="flex space-x-1 py-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                  activeTab === t.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
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

        {/* 1. SEO OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            <SEOScoreCard
              score={seoScore}
              analysis={analysis}
              imageStats={imageStats}
              onAnalyze={handleAnalyze}
              onGenerateAI={handleGenerateAI}
              isAnalyzing={isAnalyzing}
              isGeneratingAI={isGeneratingAI}
              canUseAI={canUseAI}
              isDirty={isDirty}
            />

            {/* Search Visibility Status Alert */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  Google Search Visibility Status
                </h4>
                {gscPerformance?.connected && gscPerformance?.gsc_property ? (
                  <p className="text-xs text-slate-600 mt-1">
                    Connected to Search Console property <strong className="font-mono text-slate-800">{gscPerformance.gsc_property}</strong>. Overall clicks: {gscPerformance.totals?.clicks.toLocaleString() || 0}.
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">
                    Search visibility data unavailable — connect Google Search Console to track real search impressions and keyword ranks.
                  </p>
                )}
              </div>

              {!gscPerformance?.connected && (
                <button
                  type="button"
                  onClick={handleConnectGsc}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all whitespace-nowrap"
                >
                  Connect Search Console
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2. PERFORMANCE TAB */}
        {activeTab === "performance" && (
          <SEOPerformanceDashboard
            websiteId={websiteId}
            performance={gscPerformance}
            loading={loadingPerformance}
            onConnect={handleConnectGsc}
            onSync={handleSyncGsc}
            isSyncing={isSyncingGsc}
            syncError={gscSyncError}
            onOpenPropertySelector={() => setIsPropertySelectorOpen(true)}
          />
        )}

        {/* 3. ORGANIC SEO TAB */}
        {activeTab === "organic" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
              Organic Content & Keyword SEO
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="text-sm font-bold text-slate-900">Focus Keywords Analysis</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Target keywords configured for this website:
                </p>
                <div className="flex flex-wrap gap-2">
                  {(formData.focus_keywords || []).length > 0 ? (
                    formData.focus_keywords.map((kw, i) => (
                      <span key={i} className="px-2.5 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-lg">
                        {kw}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No focus keywords set yet. Add keywords in SEO Settings.</span>
                  )}
                </div>
              </div>

              <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="text-sm font-bold text-slate-900">Page Content Fingerprint</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Deterministic keyword density and readability audits are updated automatically whenever you run a fresh analysis.
                </p>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
                >
                  {isAnalyzing ? "Analyzing..." : "Re-run Content Audit"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. TECHNICAL SEO TAB */}
        {activeTab === "technical" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
              Technical SEO Checklist & Health
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">XML Sitemap Status</span>
                  <span className="text-[11px] text-slate-500">Automatically generated for published sites.</span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
                  Active
                </span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Robots.txt Status</span>
                  <span className="text-[11px] text-slate-500">Crawling directives configured.</span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
                  Active
                </span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Canonical URL Rule</span>
                  <span className="text-[11px] text-slate-500">{formData.canonical_url || "Default domain canonical URL"}</span>
                </div>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
                  Configured
                </span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Schema JSON-LD Editor</span>
                  <span className="text-[11px] text-slate-500">Structured data markup.</span>
                </div>
                <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full border border-purple-200">
                  {Object.keys(schemaMarkup || {}).length > 0 ? "JSON-LD Active" : "Default Schema"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 5. PAGES TAB */}
        {activeTab === "pages" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Page-Level SEO State ({pagesSeo.length} Pages)</h3>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl"
              >
                Analyze All Pages
              </button>
            </div>

            {pagesSeo.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No page SEO records found yet. Run an analysis to index site pages.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="py-3 px-4">Path</th>
                      <th className="py-3 px-4">Page SEO Title</th>
                      <th className="py-3 px-4 text-center">Score</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagesSeo.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">{p.path}</td>
                        <td className="py-3 px-4 text-slate-700">{p.seo_title || "Untitled Page"}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 font-bold rounded">
                            {p.seo_score || 0}/100
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded-full border border-emerald-200">
                            {p.analysis_status || "completed"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 6. KEYWORDS / RANKINGS TAB */}
        {activeTab === "keywords" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
              Google Keyword Position Rankings
            </h3>

            {!gscPerformance?.connected ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <p className="text-xs text-slate-700 font-medium">
                  Connect Google Search Console to display real Google keyword rankings.
                </p>
                <button
                  type="button"
                  onClick={handleConnectGsc}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl"
                >
                  Connect Search Console
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="py-3 px-4">Search Query</th>
                      <th className="py-3 px-4 text-right">Avg Position</th>
                      <th className="py-3 px-4 text-right">Clicks</th>
                      <th className="py-3 px-4 text-right">Impressions</th>
                      <th className="py-3 px-4 text-right">CTR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(gscPerformance?.queries || []).map((q, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">{q.query}</td>
                        <td className="py-3 px-4 text-right font-bold text-purple-600">#{q.position.toFixed(1)}</td>
                        <td className="py-3 px-4 text-right text-slate-900 font-semibold">{q.clicks}</td>
                        <td className="py-3 px-4 text-right text-slate-600">{q.impressions}</td>
                        <td className="py-3 px-4 text-right text-purple-700">{q.ctr.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 7. AI SEO AGENT TAB (PLACEHOLDER ONLY) */}
        {activeTab === "agent" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center shadow-xs space-y-4">
            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl mx-auto flex items-center justify-center font-bold text-2xl">
              🤖
            </div>
            <h3 className="text-xl font-bold text-slate-900">AI SEO Agent — Autonomous Optimization</h3>
            <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
              Autonomous AI SEO Agent monitoring and automatic meta-tag optimization will be introduced in a future update.
            </p>
            <span className="inline-block px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold rounded-full">
              Coming Soon in Phase 3
            </span>
          </div>
        )}

        {/* 8. INTEGRATIONS TAB */}
        {activeTab === "integrations" && (
          <SEOIntegrations
            integrations={integrations}
            gaId={formData.google_analytics_id}
            gtmId={formData.google_tag_manager_id}
            onUpdateGaId={(val) => setFormData((prev) => ({ ...prev, google_analytics_id: val }))}
            onUpdateGtmId={(val) => setFormData((prev) => ({ ...prev, google_tag_manager_id: val }))}
            onSaveIntegration={handleSaveIntegration}
            canUseIntegrations={canUseIntegrations}
            websiteId={websiteId}
            onOpenPropertySelector={() => setIsPropertySelectorOpen(true)}
          />
        )}

        {/* 9. SEO SETTINGS TAB */}
        {activeTab === "settings" && (
          <div className="space-y-8">
            <SEOSettingsForm
              formData={formData}
              onChange={setFormData}
              onSave={handleSave}
              isSaving={isSaving}
              saveStatus={saveStatus}
            />

            <SchemaMarkupEditor
              schemaMarkup={schemaMarkup}
              onChange={setSchemaMarkup}
              canUseSchema={canUseSchema}
            />
          </div>
        )}
      </main>

      {/* GSC Property Selector Modal */}
      <GscPropertySelectorModal
        websiteId={websiteId}
        isOpen={isPropertySelectorOpen}
        onClose={() => setIsPropertySelectorOpen(false)}
        onSelectProperty={handleSelectGscProperty}
      />

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
