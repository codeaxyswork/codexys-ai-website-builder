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
import { SEOOverviewDashboard } from "@/components/SEOOverviewDashboard";
import { SEOAgentChat } from "@/components/SEOAgentChat";
import { InternalLinkingDashboard } from "@/components/InternalLinkingDashboard";
import { LocalSEODashboard } from "@/components/LocalSEODashboard";
import { SEOMonitoringDashboard } from "@/components/SEOMonitoringDashboard";
import SEOOpportunitiesDashboard from "@/components/SEOOpportunitiesDashboard";
import SEOAutopilotDashboard from "@/components/SEOAutopilotDashboard";
import SEOAEODashboard from "@/components/SEOAEODashboard";
import SEOTopicalAuthorityDashboard from "@/components/SEOTopicalAuthorityDashboard";
import SEOCompetitorDashboard from "@/components/SEOCompetitorDashboard";
import SEOContentGapDashboard from "@/components/SEOContentGapDashboard";
import { SEOContentStudio } from "@/components/SEOContentStudio";
import { SEOTechnicalDashboard } from "@/components/SEOTechnicalDashboard";
import { SEOCommandCenterDashboard } from "@/components/SEOCommandCenterDashboard";
import { SEOAnalysisResult } from "@/lib/seo-analyzer";
import { AISEOSuggestions } from "@/lib/seo-ai";
import { 
  ChevronRight, 
  Sparkles, 
  ArrowLeft,
  LayoutDashboard,
  TrendingUp,
  Bell,
  Search,
  Sliders,
  Link2,
  MapPin,
  PenTool,
  Layers,
  FileText,
  Boxes,
  Settings,
  Lightbulb,
  Cpu,
  Bot,
  GitFork,
  Swords,
  Target,
  Activity,
  ShieldCheck
} from "lucide-react";

interface SEODashboardPageProps {
  params: Promise<{ id: string }>;
}

export default function SEODashboardPage({ params }: SEODashboardPageProps) {
  const { id: websiteId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active Navigation Tab
  const initialTab = searchParams.get("tab") || "command-center";
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const [loading, setLoading] = useState(true);
  const [website, setWebsite] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [userCredits, setUserCredits] = useState<number>(0);

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
    google_site_verification_token: "",
  });

  const [schemaMarkup, setSchemaMarkup] = useState<Record<string, any>>({});
  const [integrations, setIntegrations] = useState<any[]>([]);

  // Score & Analysis state
  const [seoScore, setSeoScore] = useState<number>(0);
  const [analysis, setAnalysis] = useState<SEOAnalysisResult["analysis"] | null>(null);
  const [imageStats, setImageStats] = useState<SEOAnalysisResult["image_stats"] | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [pagesSeo, setPagesSeo] = useState<any[]>([]);
  const [seoAnalysisHistory, setSeoAnalysisHistory] = useState<any[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);

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

  // AI Modal & Navigation State
  const [aiSuggestions, setAiSuggestions] = useState<AISEOSuggestions | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const navScrollRef = React.useRef<HTMLDivElement>(null);
  const scrollNav = (direction: "left" | "right") => {
    if (navScrollRef.current) {
      const scrollAmount = direction === "left" ? -240 : 240;
      navScrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

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
        if (typeof usageData?.credits?.balance === "number") {
          setUserCredits(usageData.credits.balance);
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
            google_site_verification_token: s.google_site_verification_token || "",
          });

          setSchemaMarkup(s.schema_markup || {});
          setSeoScore(s.seo_score || 0);
          setAnalysis(s.seo_analysis || null);
          setIsDirty(s.is_dirty || false);
          setAnalysisStatus(s.analysis_status || null);
          setLastAnalyzedAt(s.last_analyzed_at || null);
        }
        if (seoData.pages_seo) {
          setPagesSeo(seoData.pages_seo);
        }
        if (seoData.integrations) {
          setIntegrations(seoData.integrations);
        }
        if (seoData.history) {
          setSeoAnalysisHistory(seoData.history);
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
    setGscSyncError(null);
    window.location.href = `/api/seo/gsc/connect?website_id=${websiteId}&redirect=1`;
  };

  const handleSelectGscProperty = async (propertyUrl: string) => {
    setGscSyncError(null);
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
      if (provider === "google_search_console" && (status === "disconnected" || !status)) {
        setGscSyncError(null);
      }
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
        if (provider === "google_search_console" && (status === "disconnected" || !status)) {
          setGscSyncError(null);
          await fetchGscPerformance();
        }
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
    { id: "command-center", label: "SEO Command Center", icon: ShieldCheck, badge: "🛡️" },
    { id: "overview", label: "SEO Overview", icon: LayoutDashboard },
    { id: "technical-crawl", label: "Technical Crawl", icon: Activity, badge: "🕸️" },
    { id: "content-studio", label: "Content Studio", icon: PenTool, badge: "🚀" },
    { id: "competitors", label: "Competitors", icon: Swords, badge: "⚔️" },
    { id: "content-gaps", label: "Content Gaps", icon: Target, badge: "🎯" },
    { id: "aeo", label: "AEO / AI Search", icon: Bot, badge: "🤖" },
    { id: "topical-authority", label: "Topical Authority", icon: GitFork, badge: "🌳" },
    { id: "opportunities", label: "Opportunity Engine", icon: Lightbulb, badge: "⚡" },
    { id: "autopilot", label: "SEO Autopilot", icon: Cpu, badge: "⚙️" },
    { id: "performance", label: "Performance", icon: TrendingUp },
    { id: "monitoring", label: "Monitoring", icon: Bell, badge: "🔔" },
    { id: "organic", label: "Organic SEO", icon: Search },
    { id: "technical", label: "Technical SEO", icon: Sliders },
    { id: "internal-links", label: "Internal Links", icon: Link2, badge: "🔗" },
    { id: "local-seo", label: "Local SEO", icon: MapPin, badge: "📍" },
    { id: "blog", label: "Content & Blog", icon: PenTool, badge: "✍️" },
    { id: "pages", label: "Pages", icon: Layers },
    { id: "keywords", label: "Keywords / Rankings", icon: FileText },
    { id: "integrations", label: "Integrations", icon: Boxes },
    { id: "settings", label: "SEO Settings", icon: Settings },
  ];

  const activeTabObj = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans">
      {/* Premium Enterprise SaaS SEO Dashboard Header System */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-xs">
        <div className="w-full max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* TOP UTILITY & IDENTITY ROW */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4">
            
            {/* LEFT: Navigation Back Button, Title, Badges */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href={`/dashboard/websites/${websiteId}`}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200/90 bg-slate-50 hover:bg-slate-100 text-xs sm:text-sm font-bold text-slate-700 transition-all shadow-2xs shrink-0"
                  title="Return to Website Dashboard Hub"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-500" />
                  <span>Website Dashboard</span>
                </Link>

                <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-200/80 text-purple-700 text-xs font-bold tracking-wide">
                  <span>SEO Control Center</span>
                </span>

                {website?.is_published ? (
                  <span className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-bold">
                    Live Published
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-600 border border-slate-200/80 rounded-full text-xs font-bold">
                    Draft
                  </span>
                )}

                {typeof seoScore === "number" && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-purple-50 text-purple-700 border border-purple-200/80">
                    Score: {seoScore}/100
                  </span>
                )}
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {website?.title || "Website SEO"}
                </h1>
                <p className="text-sm text-slate-500 font-medium">
                  Search Engine Optimization & Google Search Console Intelligence
                </p>
              </div>
            </div>

            {/* RIGHT: Action Buttons Cluster */}
            <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none py-0.5 shrink-0">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 h-11 px-5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-sm font-bold rounded-xl shadow-md shadow-purple-600/20 transition-all shrink-0"
              >
                <span>Open AI Builder</span>
                <span className="text-xs opacity-80">&rarr;</span>
              </Link>

              <Link
                href={`/dashboard/websites/${websiteId}/blog`}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 border border-purple-200/90 bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm font-bold rounded-xl transition-all shadow-2xs shrink-0"
              >
                <span>Blog Engine</span>
              </Link>

              {website?.is_published && website?.published_slug && (
                <>
                  <a
                    href={`/sitemap/${website.published_slug}.xml`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-sm font-semibold rounded-xl border border-slate-200/90 shadow-2xs transition-all shrink-0"
                  >
                    <span>XML Sitemap</span>
                    <span className="text-xs opacity-60">&rarr;</span>
                  </a>
                  <a
                    href={`/robots/${website.published_slug}.txt`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-sm font-semibold rounded-xl border border-slate-200/90 shadow-2xs transition-all shrink-0"
                  >
                    <span>Robots.txt</span>
                    <span className="text-xs opacity-60">&rarr;</span>
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Body (Full Screen Responsive Canvas) */}
      <main className="w-full max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* MOBILE SECTION SELECTOR DROPDOWN (VISIBLE ON SMALL SCREENS) */}
        <div className="lg:hidden w-full mb-6 bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-sm">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-purple-50/70 border border-purple-200/80 rounded-xl text-sm font-bold text-purple-900"
          >
            <div className="flex items-center gap-3 min-w-0">
              {activeTabObj?.icon && <activeTabObj.icon className="w-4.5 h-4.5 text-purple-600 shrink-0" />}
              <span className="truncate">Section: {activeTabObj?.label || "SEO Overview"}</span>
            </div>
            <ChevronRight className={`w-4 h-4 text-purple-600 transition-transform duration-200 ${isMobileNavOpen ? "rotate-90" : ""}`} />
          </button>

          {isMobileNavOpen && (
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
              {tabs.map((t) => {
                const isActive = activeTab === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      if (t.id === "blog") {
                        router.push(`/dashboard/websites/${websiteId}/blog`);
                      } else {
                        setActiveTab(t.id);
                        setIsMobileNavOpen(false);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                      isActive ? "bg-purple-600 text-white shadow-xs" : "text-slate-700 hover:bg-slate-100/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4.5 h-4.5 shrink-0" />
                      <span>{t.label}</span>
                    </div>
                    {t.badge && <span className="text-sm">{t.badge}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* SPLIT DASHBOARD LAYOUT */}
        <div className="flex flex-col lg:flex-row items-start gap-8">
          
          {/* LEFT: SEO CONTROL CENTER SIDEBAR (DESKTOP) */}
          <aside className="hidden lg:block w-72 shrink-0 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm shadow-slate-200/50 sticky top-24">
            <div className="px-3 py-2.5 border-b border-slate-100 mb-3 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                SEO Tools Navigation
              </span>
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-100">
                12 Tools
              </span>
            </div>

            <nav className="space-y-1.5">
              {tabs.map((t) => {
                const isActive = activeTab === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      if (t.id === "blog") {
                        router.push(`/dashboard/websites/${websiteId}/blog`);
                      } else {
                        setActiveTab(t.id);
                      }
                    }}
                    className={`w-full flex items-center justify-between h-11 px-4 py-2.5 rounded-xl text-sm transition-all duration-150 group cursor-pointer ${
                      isActive
                        ? "bg-purple-600 text-white font-extrabold shadow-md shadow-purple-600/20"
                        : "text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 font-bold"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-purple-600"}`} />
                      <span className="truncate">{t.label}</span>
                    </div>
                    {t.badge && (
                      <span className="text-sm shrink-0">{t.badge}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* RIGHT: MAIN SEO CONTENT AREA */}
          <div className="flex-1 min-w-0 w-full">
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
              <SEOOverviewDashboard
                websiteId={websiteId}
                seoScore={seoScore}
                analysis={analysis}
                imageStats={imageStats}
                pagesSeo={pagesSeo}
                history={seoAnalysisHistory}
                gscPerformance={gscPerformance}
                loadingPerformance={loadingPerformance}
                isDirty={isDirty}
                analysisStatus={analysisStatus}
                lastAnalyzedAt={lastAnalyzedAt}
                onAnalyze={handleAnalyze}
                isAnalyzing={isAnalyzing}
                onNavigateTab={(tabId) => setActiveTab(tabId)}
                onConnectGsc={handleConnectGsc}
                onSyncGsc={handleSyncGsc}
                isSyncingGsc={isSyncingGsc}
                gscSyncError={gscSyncError}
              />
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

            {/* COMMAND CENTER TAB */}
            {activeTab === "command-center" && (
              <SEOCommandCenterDashboard websiteId={websiteId} onNavigateTab={(tab) => setActiveTab(tab)} />
            )}

            {/* TECHNICAL CRAWL TAB */}
            {activeTab === "technical-crawl" && (
              <SEOTechnicalDashboard websiteId={websiteId} />
            )}

            {/* CONTENT STUDIO TAB */}
            {activeTab === "content-studio" && (
              <SEOContentStudio websiteId={websiteId} />
            )}

            {/* COMPETITORS TAB */}
            {activeTab === "competitors" && (
              <SEOCompetitorDashboard websiteId={websiteId} />
            )}

            {/* CONTENT GAPS TAB */}
            {activeTab === "content-gaps" && (
              <SEOContentGapDashboard websiteId={websiteId} />
            )}

            {/* AEO TAB */}
            {activeTab === "aeo" && (
              <SEOAEODashboard websiteId={websiteId} />
            )}

            {/* TOPICAL AUTHORITY TAB */}
            {activeTab === "topical-authority" && (
              <SEOTopicalAuthorityDashboard websiteId={websiteId} />
            )}

            {/* OPPORTUNITIES TAB */}
            {activeTab === "opportunities" && (
              <SEOOpportunitiesDashboard websiteId={websiteId} />
            )}

            {/* AUTOPILOT TAB */}
            {activeTab === "autopilot" && (
              <SEOAutopilotDashboard websiteId={websiteId} />
            )}

            {/* MONITORING TAB */}
            {activeTab === "monitoring" && (
              <SEOMonitoringDashboard websiteId={websiteId} />
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
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
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

            {/* INTERNAL LINKS TAB */}
            {activeTab === "internal-links" && (
              <InternalLinkingDashboard websiteId={websiteId} />
            )}

            {/* LOCAL SEO TAB */}
            {activeTab === "local-seo" && (
              <LocalSEODashboard websiteId={websiteId} />
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
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
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
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl cursor-pointer"
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

            {/* 7. INTEGRATIONS TAB */}
            {activeTab === "integrations" && (
              <SEOIntegrations
                integrations={integrations}
                gaId={formData.google_analytics_id}
                gtmId={formData.google_tag_manager_id}
                gscVerificationToken={formData.google_site_verification_token}
                onUpdateGaId={(val) => setFormData((prev) => ({ ...prev, google_analytics_id: val }))}
                onUpdateGtmId={(val) => setFormData((prev) => ({ ...prev, google_tag_manager_id: val }))}
                onUpdateGscVerificationToken={(val) => setFormData((prev) => ({ ...prev, google_site_verification_token: val }))}
                onSaveIntegration={handleSaveIntegration}
                canUseIntegrations={canUseIntegrations}
                websiteId={websiteId}
                onOpenPropertySelector={() => setIsPropertySelectorOpen(true)}
              />
            )}

            {/* 8. SEO SETTINGS TAB */}
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
          </div>
        </div>
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

      {/* Floating SEO AI Assistant */}
      <SEOAgentChat
        websiteId={websiteId}
        userPlan={userPlan}
        userCredits={userCredits}
        gscConnected={gscPerformance?.connected}
        onNavigateTab={(tabId) => setActiveTab(tabId)}
      />
    </div>
  );
}
