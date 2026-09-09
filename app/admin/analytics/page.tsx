"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
  TrendingUp,
  Users,
  Globe,
  Zap,
  CreditCard,
  PieChart,
  BarChart3,
  Sparkles,
  RefreshCw,
  AlertCircle,
  FileCode,
  Search,
} from "lucide-react";

interface AnalyticsData {
  userGrowth: {
    total: number;
  };
  websiteActivity: {
    total: number;
    published: number;
    draft: number;
  };
  aiUsageBreakdown: {
    initialGenerations: number;
    aiEdits: number;
    aiSeoSuggestions: number;
  };
  planDistribution: {
    free: number;
    pro: number;
    agency: number;
  };
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAnalytics = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) {
        throw new Error("Failed to load analytics data.");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const totalPlans = data
    ? data.planDistribution.free + data.planDistribution.pro + data.planDistribution.agency
    : 0;

  const totalAiActions = data
    ? data.aiUsageBreakdown.initialGenerations +
      data.aiUsageBreakdown.aiEdits +
      data.aiUsageBreakdown.aiSeoSuggestions
    : 0;

  return (
    <AdminLayout title="Platform Analytics">
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchAnalytics}
            className="text-xs bg-red-100 hover:bg-red-200 text-red-800 font-medium px-3 py-1 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading analytics metrics...</p>
        </div>
      ) : data ? (
        <div className="space-y-8">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
                <BarChart3 className="w-3.5 h-3.5" /> Platform Intelligence
              </div>
              <h2 className="text-2xl font-bold">Real-time Platform Telemetry</h2>
              <p className="text-purple-100 text-sm mt-1">
                Comprehensive overview of user signups, website creations, AI generation activity, and plan distributions.
              </p>
            </div>
            <button
              onClick={fetchAnalytics}
              className="inline-flex items-center gap-2 bg-white text-purple-700 hover:bg-purple-50 font-medium text-sm px-4 py-2 rounded-xl transition-all shadow-sm shrink-0"
            >
              <RefreshCw className="w-4 h-4" /> Refresh Data
            </button>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Users</p>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-0.5">{data.userGrowth.total}</h3>
                <span className="inline-flex items-center text-xs text-emerald-600 font-medium mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" /> Real-time DB sync
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Websites</p>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-0.5">{data.websiteActivity.total}</h3>
                <span className="inline-flex items-center text-xs text-blue-600 font-medium mt-1">
                  {data.websiteActivity.published} Published ({data.websiteActivity.total > 0 ? Math.round((data.websiteActivity.published / data.websiteActivity.total) * 100) : 0}%)
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">AI Operations</p>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-0.5">{totalAiActions}</h3>
                <span className="inline-flex items-center text-xs text-amber-600 font-medium mt-1">
                  Gemini 3.6 Flash Engine
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Subscribers</p>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-0.5">{data.planDistribution.pro + data.planDistribution.agency}</h3>
                <span className="inline-flex items-center text-xs text-emerald-600 font-medium mt-1">
                  {data.planDistribution.pro} Pro / {data.planDistribution.agency} Agency
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Analytics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Website Activity Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-600" /> Website Deployment Activity
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Ratio of published websites vs drafts</p>
                </div>
                <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium">
                  {data.websiteActivity.total} Total
                </span>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-slate-700 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Published Websites
                    </span>
                    <span className="text-slate-900">{data.websiteActivity.published} ({data.websiteActivity.total > 0 ? Math.round((data.websiteActivity.published / data.websiteActivity.total) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${data.websiteActivity.total > 0 ? (data.websiteActivity.published / data.websiteActivity.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-slate-700 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Draft Websites
                    </span>
                    <span className="text-slate-900">{data.websiteActivity.draft} ({data.websiteActivity.total > 0 ? Math.round((data.websiteActivity.draft / data.websiteActivity.total) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${data.websiteActivity.total > 0 ? (data.websiteActivity.draft / data.websiteActivity.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4 pt-6 border-t border-slate-100">
                <div className="bg-slate-50 p-4 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium">Published Ratio</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">
                    {data.websiteActivity.total > 0 ? ((data.websiteActivity.published / data.websiteActivity.total) * 100).toFixed(1) : "0.0"}%
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium">Avg Websites / User</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">
                    {data.userGrowth.total > 0 ? (data.websiteActivity.total / data.userGrowth.total).toFixed(1) : "0.0"}
                  </p>
                </div>
              </div>
            </div>

            {/* AI Credit Usage Distribution */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" /> AI Usage Operations
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Breakdown by AI action type</p>
                </div>
                <span className="text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full font-medium">
                  {totalAiActions} Operations
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-slate-700 flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-purple-600" /> Initial Website Generation
                    </span>
                    <span className="text-slate-900">{data.aiUsageBreakdown.initialGenerations}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full transition-all duration-500"
                      style={{ width: `${totalAiActions > 0 ? (data.aiUsageBreakdown.initialGenerations / totalAiActions) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> AI Prompt Edits & Refinements
                    </span>
                    <span className="text-slate-900">{data.aiUsageBreakdown.aiEdits}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${totalAiActions > 0 ? (data.aiUsageBreakdown.aiEdits / totalAiActions) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-slate-700 flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-blue-600" /> AI SEO & Meta Generation
                    </span>
                    <span className="text-slate-900">{data.aiUsageBreakdown.aiSeoSuggestions}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${totalAiActions > 0 ? (data.aiUsageBreakdown.aiSeoSuggestions / totalAiActions) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-purple-50/60 rounded-xl border border-purple-100 text-xs text-purple-900 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Engine Efficiency:</span> Primary model <code className="bg-purple-100 px-1 py-0.5 rounded font-mono">gemini-3.6-flash</code> is active with zero fallback latency reported.
                </div>
              </div>
            </div>
          </div>

          {/* Subscription Plan Distribution Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-emerald-600" /> Plan Tier Distribution
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Active tier subscription breakdown across total users</p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium">
                {totalPlans} Total Subscriptions
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <span className="inline-block px-3 py-1 bg-white text-slate-700 text-xs font-semibold rounded-full border border-slate-200 mb-2">
                  Free Tier
                </span>
                <h4 className="text-3xl font-extrabold text-slate-900">{data.planDistribution.free}</h4>
                <p className="text-xs text-slate-500 mt-1">
                  {totalPlans > 0 ? ((data.planDistribution.free / totalPlans) * 100).toFixed(1) : 0}% of platform users
                </p>
                <div className="mt-4 w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-500 rounded-full"
                    style={{ width: `${totalPlans > 0 ? (data.planDistribution.free / totalPlans) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-purple-50/50 border border-purple-200 text-center">
                <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full mb-2">
                  Pro Plan
                </span>
                <h4 className="text-3xl font-extrabold text-purple-900">{data.planDistribution.pro}</h4>
                <p className="text-xs text-purple-700/80 mt-1">
                  {totalPlans > 0 ? ((data.planDistribution.pro / totalPlans) * 100).toFixed(1) : 0}% of platform users
                </p>
                <div className="mt-4 w-full h-2 bg-purple-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full"
                    style={{ width: `${totalPlans > 0 ? (data.planDistribution.pro / totalPlans) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200 text-center">
                <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full mb-2">
                  Agency Plan
                </span>
                <h4 className="text-3xl font-extrabold text-emerald-900">{data.planDistribution.agency}</h4>
                <p className="text-xs text-emerald-700/80 mt-1">
                  {totalPlans > 0 ? ((data.planDistribution.agency / totalPlans) * 100).toFixed(1) : 0}% of platform users
                </p>
                <div className="mt-4 w-full h-2 bg-emerald-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full"
                    style={{ width: `${totalPlans > 0 ? (data.planDistribution.agency / totalPlans) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
