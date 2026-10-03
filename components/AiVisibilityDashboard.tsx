"use client";

import React, { useState, useEffect } from "react";
import {
  Eye,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  ShieldCheck,
  Globe,
  ExternalLink,
  Bot,
  RefreshCw,
  Zap,
  HelpCircle,
  AlertTriangle,
  History,
  TrendingUp,
  BarChart3,
  Calendar,
  Settings,
  Bell,
  Play,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
} from "lucide-react";
import {
  AiVisibilityProviderName,
  AiVisibilityPromptCategory,
  NormalizedAiVisibilityResponse,
} from "@/lib/ai-visibility/types";
import { HistoricalVisibilitySummary } from "@/lib/ai-visibility/persistence";
import {
  WebsiteAiVisibilityConfig,
  MonitoringAlert,
} from "@/lib/ai-visibility/monitoring/types";
import { AggregateMonitoringTrends } from "@/lib/ai-visibility/monitoring/aggregation";


interface AiVisibilityDashboardProps {
  websiteId: string;
  brandName?: string;
}

export function AiVisibilityDashboard({
  websiteId,
  brandName: initialBrandName,
}: AiVisibilityDashboardProps) {
  const [selectedProvider, setSelectedProvider] = useState<
    AiVisibilityProviderName | "all"
  >("all");
  const [promptCategory, setPromptCategory] =
    useState<AiVisibilityPromptCategory>("buyer_intent");
  const [brandName, setBrandName] = useState<string>(
    initialBrandName || "My Brand"
  );
  const [prompt, setPrompt] = useState<string>(
    "What is the best luxury service provider in Austin?"
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<NormalizedAiVisibilityResponse[]>([]);
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);

  // Stage 6B Historical Data State
  const [history, setHistory] = useState<HistoricalVisibilitySummary | null>(
    null
  );
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Phase 3 Automated Monitoring State
  const [monitoringConfig, setMonitoringConfig] =
    useState<WebsiteAiVisibilityConfig | null>(null);
  const [monitoringTrends, setMonitoringTrends] =
    useState<AggregateMonitoringTrends | null>(null);
  const [monitoringAlerts, setMonitoringAlerts] = useState<MonitoringAlert[]>(
    []
  );
  const [loadingMonitoring, setLoadingMonitoring] = useState<boolean>(true);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [monitoringMsg, setMonitoringMsg] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      setHistoryError(null);
      const res = await fetch(
        `/api/websites/${websiteId}/seo/ai-visibility/history`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch visibility history.");
      }
      if (data.history) {
        setHistory(data.history);
      }
    } catch (err: any) {
      console.error("Failed to load visibility history:", err);
      setHistoryError(err?.message || "Could not load probe history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchMonitoringData = async () => {
    try {
      setLoadingMonitoring(true);
      const res = await fetch(
        `/api/websites/${websiteId}/seo/ai-visibility/config`
      );
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.config) setMonitoringConfig(data.config);
        if (data.trends) setMonitoringTrends(data.trends);
        if (data.alerts) setMonitoringAlerts(data.alerts);
      }
    } catch (err) {
      console.error("Failed to load monitoring config:", err);
    } finally {
      setLoadingMonitoring(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchMonitoringData();
  }, [websiteId]);

  const handleSaveMonitoringConfig = async (
    updates: Partial<WebsiteAiVisibilityConfig>
  ) => {
    if (savingConfig) return;
    setSavingConfig(true);
    setMonitoringMsg(null);
    try {
      const res = await fetch(
        `/api/websites/${websiteId}/seo/ai-visibility/config`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save configuration.");
      }
      if (data.config) {
        setMonitoringConfig(data.config);
        setMonitoringMsg("Monitoring configuration updated successfully.");
      }
    } catch (err: any) {
      setMonitoringMsg(`Error: ${err?.message || "Failed to save"}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunProbe = async (providerToRun?: AiVisibilityProviderName) => {
    if (loading) return;

    const target =
      providerToRun || (selectedProvider === "all" ? "openai" : selectedProvider);

    if (!prompt.trim()) {
      setErrorMessage("Prompt is required.");
      return;
    }

    if (prompt.length > 1000) {
      setErrorMessage("Prompt cannot exceed 1000 characters.");
      return;
    }

    setLoading(true);
    setLoadingProvider(target);
    setErrorMessage(null);

    try {
      if (selectedProvider === "all" && !providerToRun) {
        // Run all 4 providers in parallel batch execution
        const providersList: AiVisibilityProviderName[] = [
          "openai",
          "perplexity",
          "gemini",
          "claude",
        ];
        const probePromises = providersList.map((p) =>
          fetch(`/api/websites/${websiteId}/seo/ai-visibility/probe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: p,
              prompt,
              category: promptCategory,
              brandName,
            }),
          }).then((res) => res.json())
        );

        const responses = await Promise.all(probePromises);
        const newResults: NormalizedAiVisibilityResponse[] = [];

        responses.forEach((resData) => {
          if (resData.response) {
            newResults.push(resData.response);
          }
          if (typeof resData.liveMode === "boolean") {
            setIsLiveMode(resData.liveMode);
          }
        });

        setResults(newResults);
      } else {
        // Single provider execution
        const res = await fetch(
          `/api/websites/${websiteId}/seo/ai-visibility/probe`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: target,
              prompt,
              category: promptCategory,
              brandName,
            }),
          }
        );

        const resData = await res.json();
        if (!res.ok) {
          throw new Error(
            resData.error || "Failed to execute AI visibility probe."
          );
        }

        if (resData.liveMode !== undefined) {
          setIsLiveMode(resData.liveMode);
        }

        if (resData.response) {
          setResults((prev) => {
            const filtered = prev.filter((r) => r.provider !== target);
            return [resData.response, ...filtered];
          });
        }
      }

      // Refresh historical data after probe execution
      await fetchHistory();
      await fetchMonitoringData();
    } catch (err: any) {
      setErrorMessage(err?.message || "An error occurred during probing.");
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  const providersInfo: {
    name: AiVisibilityProviderName;
    label: string;
    model: string;
    iconColor: string;
  }[] = [
    {
      name: "openai",
      label: "OpenAI",
      model: "gpt-4o-mini",
      iconColor: "text-emerald-600",
    },
    {
      name: "perplexity",
      label: "Perplexity",
      model: "sonar",
      iconColor: "text-cyan-600",
    },
    {
      name: "gemini",
      label: "Google Gemini",
      model: "gemini-2.5-flash",
      iconColor: "text-indigo-600",
    },
    {
      name: "claude",
      label: "Anthropic Claude",
      model: "claude-3-5-sonnet",
      iconColor: "text-purple-600",
    },
  ];

  const totalMentions = results.filter((r) => r.brandMentioned).length;
  const totalCitations = results.reduce(
    (acc, r) => acc + (r.citationDomains?.length || 0),
    0
  );

  const delta = monitoringTrends?.trendDelta;

  return (
    <div className="space-y-8">
      {/* 1. Header Banner & Mode Badge */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Live AI Visibility & LLM Search Intelligence
                </h2>
                <span
                  className={`px-3 py-0.5 rounded-full text-[11px] font-extrabold uppercase border ${
                    isLiveMode
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}
                >
                  {isLiveMode ? "Live Provider Mode" : "Demo / Mock Mode"}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Measure brand recommendations, citations, and search grounding across ChatGPT, Perplexity, Gemini, and Claude
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRunProbe()}
              disabled={loading}
              className="h-10 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              <span>Run All 4 Providers</span>
            </button>
          </div>
        </div>

        {/* Status Metrics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-center">
            <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
              Brand Mentions
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {results.length > 0 ? `${totalMentions} / ${results.length}` : "—"}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-center">
            <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
              Source Citations
            </div>
            <div className="text-2xl font-black text-purple-700 mt-1">
              {results.length > 0 ? totalCitations : "—"}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-center">
            <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
              Unprompted Mentions
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {results.length > 0
                ? results.filter((r) => r.unpromptedMention).length
                : "—"}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-center">
            <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
              Sentiment
            </div>
            <div className="text-2xl font-black text-indigo-600 capitalize mt-1">
              {results.length > 0 ? results[0].sentiment : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* PHASE 3 AUTOMATED MONITORING PANEL */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Automated AI Visibility Monitoring
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    monitoringConfig?.enabled
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {monitoringConfig?.enabled ? "Active Schedule" : "Disabled"}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Scheduled background brand measurement across AI engines with alert foundation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                handleSaveMonitoringConfig({ enabled: !monitoringConfig?.enabled })
              }
              disabled={savingConfig || loadingMonitoring}
              className={`h-9 px-3.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                monitoringConfig?.enabled
                  ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {savingConfig ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sliders className="w-3.5 h-3.5" />
              )}
              <span>
                {monitoringConfig?.enabled
                  ? "Disable Monitoring"
                  : "Enable Monitoring"}
              </span>
            </button>
          </div>
        </div>

        {monitoringMsg && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-xs font-medium">
            {monitoringMsg}
          </div>
        )}

        {/* Monitoring Config & Schedule Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
              Frequency
            </div>
            <select
              value={monitoringConfig?.frequency || "daily"}
              onChange={(e) =>
                handleSaveMonitoringConfig({ frequency: e.target.value as any })
              }
              className="mt-1 font-bold text-slate-900 bg-transparent border-b border-slate-300 text-sm focus:outline-none capitalize"
            >
              <option value="daily">Daily Schedule</option>
              <option value="weekly">Weekly Schedule</option>
            </select>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
              Last Executed Run
            </div>
            <div className="text-xs font-bold text-slate-900 mt-1.5 font-mono">
              {monitoringConfig?.lastRunAt
                ? new Date(monitoringConfig.lastRunAt).toLocaleString()
                : "No runs yet"}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
              Next Scheduled Run
            </div>
            <div className="text-xs font-bold text-purple-700 mt-1.5 font-mono">
              {monitoringConfig?.nextRunAt
                ? new Date(monitoringConfig.nextRunAt).toLocaleString()
                : "Not scheduled"}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
              Recent Measured Delta
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              {delta && delta.mentionRateChange !== 0 ? (
                <span
                  className={`text-sm font-black flex items-center gap-0.5 ${
                    delta.mentionRateChange > 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {delta.mentionRateChange > 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {delta.mentionRateChange > 0 ? "+" : ""}
                  {delta.mentionRateChange} percentage points
                </span>
              ) : (
                <span className="text-xs font-bold text-slate-500">
                  0% change baseline
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Measured Trend Analytics Grid */}
        {monitoringTrends && (
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              <span>Measured Provider Trend Metrics</span>
            </h4>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="text-[11px] font-medium text-slate-500">
                  OpenAI Mention Rate
                </div>
                <div className="text-lg font-black text-slate-900 mt-0.5">
                  {monitoringTrends.providerMentionRates.openai}%
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="text-[11px] font-medium text-slate-500">
                  Perplexity Mention Rate
                </div>
                <div className="text-lg font-black text-slate-900 mt-0.5">
                  {monitoringTrends.providerMentionRates.perplexity}%
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="text-[11px] font-medium text-slate-500">
                  Gemini Mention Rate
                </div>
                <div className="text-lg font-black text-slate-900 mt-0.5">
                  {monitoringTrends.providerMentionRates.gemini}%
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="text-[11px] font-medium text-slate-500">
                  Claude Mention Rate
                </div>
                <div className="text-lg font-black text-slate-900 mt-0.5">
                  {monitoringTrends.providerMentionRates.claude}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Monitoring Alerts Foundation Section */}
        {monitoringAlerts.length > 0 && (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-600" />
              <span>Detected Monitoring Alerts & Events ({monitoringAlerts.length})</span>
            </h4>
            <div className="space-y-2">
              {monitoringAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                    alert.severity === "critical"
                      ? "bg-rose-50 border-rose-200 text-rose-900"
                      : "bg-amber-50 border-amber-200 text-amber-900"
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{alert.title}</span>
                    </div>
                    <p className="text-slate-600 font-medium">{alert.message}</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Provider Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {providersInfo.map((p) => {
          const res = results.find((r) => r.provider === p.name);
          const isPending = loading && loadingProvider === p.name;
          const histStats = history?.providerBreakdown?.[p.name];

          return (
            <div
              key={p.name}
              className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`font-black text-sm ${p.iconColor} flex items-center gap-1.5`}
                  >
                    <Bot className="w-4 h-4" />
                    {p.label}
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                    {p.model}
                  </span>
                </div>

                <div className="pt-1">
                  {isPending ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Probing engine...</span>
                    </div>
                  ) : res ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">
                          Mention Status:
                        </span>
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                            res.brandMentioned
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {res.brandMentioned ? "Mentioned" : "Not Found"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">
                          Citations:
                        </span>
                        <span className="font-bold text-purple-700">
                          {res.citationDomains?.length || 0} Domains
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">
                          Latency:
                        </span>
                        <span className="font-mono text-slate-700">
                          {res.latencyMs}ms
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 text-xs">
                      <p className="text-slate-500 font-medium">
                        Hist. Mention Rate:{" "}
                        <span className="font-bold text-slate-900">
                          {histStats && histStats.total > 0
                            ? `${histStats.mentionRate}% (${histStats.mentions}/${histStats.total})`
                            : "No history"}
                        </span>
                      </p>
                      {histStats && histStats.total > 0 && (
                        <p className="text-slate-400 text-[11px] font-mono">
                          Avg Latency: {histStats.avgLatencyMs}ms
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleRunProbe(p.name)}
                disabled={loading}
                className="w-full h-8 mt-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-200 text-purple-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Probe {p.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* 3. Probe Configuration Form */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <Search className="w-5 h-5 text-purple-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Configure AI Visibility Probe
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Simulate customer search queries to measure how LLMs render your business brand
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-600 font-bold hover:text-rose-900"
            >
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Target Provider
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as any)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-xs text-slate-900 focus:outline-none focus:border-purple-500"
            >
              <option value="all">All 4 AI Engines (Batch)</option>
              <option value="openai">OpenAI (gpt-4o-mini)</option>
              <option value="perplexity">Perplexity (sonar)</option>
              <option value="gemini">Google Gemini (gemini-2.5-flash)</option>
              <option value="claude">Anthropic Claude (claude-3-5-sonnet)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Prompt Category
            </label>
            <select
              value={promptCategory}
              onChange={(e) => setPromptCategory(e.target.value as any)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-xs text-slate-900 focus:outline-none focus:border-purple-500"
            >
              <option value="buyer_intent">Buyer Intent Query</option>
              <option value="informational">Informational Research Query</option>
              <option value="commercial">Commercial Comparison Query</option>
              <option value="local">Local Search Query</option>
              <option value="competitor">Competitor Alternatives Query</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Target Brand Name
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="e.g. Acme Dental"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-xs text-slate-900 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Test Search Prompt
            </label>
            <span className="text-[11px] font-mono text-slate-400">
              {prompt.length} / 1000
            </span>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-xs text-slate-900 focus:outline-none focus:border-purple-500 leading-relaxed"
            placeholder="Enter search prompt..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            onClick={() => handleRunProbe()}
            disabled={loading}
            className="h-11 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>
              {selectedProvider === "all"
                ? "Run All 4 AI Probes"
                : "Run Selected Probe"}
            </span>
          </button>
        </div>
      </div>

      {/* 4. Stage 6B Historical Reporting Dashboard */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-purple-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                AI Visibility Audit History & Telemetry
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Persisted historical probe telemetry stored in `seo_ai_visibility_logs`
              </p>
            </div>
          </div>

          <button
            onClick={fetchHistory}
            disabled={loadingHistory}
            className="h-9 px-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`}
            />
            <span>Refresh History</span>
          </button>
        </div>

        {historyError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium">
            {historyError}
          </div>
        )}

        {/* Historical Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
              Total Audits Run
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {history ? history.totalProbes : "0"}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
              Mention Rate
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {history ? `${history.brandMentionRate}%` : "0%"}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
              Total Citations
            </div>
            <div className="text-2xl font-black text-purple-700 mt-1">
              {history ? history.totalCitations : "0"}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
              Unique Citation Domains
            </div>
            <div className="text-2xl font-black text-indigo-600 mt-1">
              {history ? history.uniqueCitationDomains.length : "0"}
            </div>
          </div>
        </div>

        {/* Recent History Table */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Recent Audit Logs ({history?.recentHistory.length || 0})
          </h4>

          {loadingHistory ? (
            <div className="py-8 text-center text-xs font-medium text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              <span>Loading historical telemetry...</span>
            </div>
          ) : history && history.recentHistory.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase text-[10px] tracking-wider">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Provider</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Mentioned</th>
                    <th className="p-3">Citations</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.recentHistory.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-all">
                      <td className="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3 font-bold text-slate-900 uppercase">
                        {log.provider}
                        <span className="block text-[10px] font-normal text-slate-400 lowercase">
                          {log.modelName}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-600 capitalize">
                        {log.promptCategory}
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                            log.brandMentioned
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {log.brandMentioned ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-purple-700">
                        {log.citationDomains?.length || 0} Domains
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.status === "success"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-500">
                        {log.latencyMs}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs font-medium text-slate-400 bg-slate-50 rounded-xl border border-slate-200/80">
              AI Visibility probe history will appear after probes are executed.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
