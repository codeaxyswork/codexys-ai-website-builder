"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/AdminLayout";
import { Users, Globe, Sparkles, CreditCard, DollarSign, ShieldAlert, ArrowUpRight } from "lucide-react";

export default function AdminOverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/stats");
      if (res.status === 403 || res.status === 401) {
        router.push("/dashboard");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load admin stats.");

      setStats(data);
    } catch (err: any) {
      console.error("Admin Stats Fetch Error:", err);
      setErrorMessage(err.message || "Failed to load admin dashboard.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-600 font-medium">
          <svg className="animate-spin h-5 w-5 text-purple-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading Admin Control Panel...
        </div>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Title & Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Overview</h1>
          <p className="text-xs text-slate-500 mt-1">Real-time metrics for users, websites, AI usage, and subscriptions</p>
        </div>

        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Total Users */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Users</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <div>
              <span className="text-3xl font-extrabold text-slate-900">{stats?.users?.total || 0}</span>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                <span>Today: <strong className="text-slate-900">+{stats?.users?.today || 0}</strong></span>
                <span>Active: <strong className="text-emerald-600">{stats?.users?.active || 0}</strong></span>
              </div>
            </div>
          </div>

          {/* Websites Generated */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Websites</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                <Globe className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div>
              <span className="text-3xl font-extrabold text-slate-900">{stats?.websites?.total || 0}</span>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                <span>Published: <strong className="text-emerald-600">{stats?.websites?.published || 0}</strong></span>
                <span>Drafts: <strong className="text-slate-700">{stats?.websites?.draft || 0}</strong></span>
              </div>
            </div>
          </div>

          {/* AI Credits Consumption */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Credits Used</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-indigo-600" />
              </div>
            </div>
            <div>
              <span className="text-3xl font-extrabold text-slate-900">{stats?.ai?.totalUsed || 0}</span>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                <span>Today: <strong className="text-indigo-600">+{stats?.ai?.todayUsed || 0}</strong></span>
                <span>Month: <strong className="text-slate-900">{stats?.ai?.monthUsed || 0}</strong></span>
              </div>
            </div>
          </div>

          {/* Mock Revenue */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mock Revenue</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div>
              <span className="text-3xl font-extrabold text-slate-900">
                ₹{(stats?.mockRevenue?.total || 0).toLocaleString("en-IN")}
              </span>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                <span>This Month: <strong className="text-emerald-700">₹{(stats?.mockRevenue?.monthly || 0).toLocaleString("en-IN")}</strong></span>
                <span className="font-mono text-[10px]">Test Mode</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links & Plan Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Plan Distribution */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-3">
              Subscription Plan Distribution
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Free Tier Users</span>
                <span className="font-extrabold text-slate-900">{stats?.subscriptions?.free || 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-purple-700">Pro Tier (₹999/mo)</span>
                <span className="font-extrabold text-purple-700">{stats?.subscriptions?.pro || 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-700">Agency Tier (₹2,999/mo)</span>
                <span className="font-extrabold text-indigo-700">{stats?.subscriptions?.agency || 0}</span>
              </div>
            </div>
          </div>

          {/* Quick Management Shortcuts */}
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                Admin Management Actions
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Fast navigation to user account management, credit adjustments, and platform settings.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Link
                href="/admin/users"
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-purple-50 hover:border-purple-200 transition-all text-xs font-semibold text-slate-800 flex items-center justify-between group"
              >
                <span>Manage Users</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600" />
              </Link>
              <Link
                href="/admin/websites"
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-purple-50 hover:border-purple-200 transition-all text-xs font-semibold text-slate-800 flex items-center justify-between group"
              >
                <span>All Websites</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600" />
              </Link>
              <Link
                href="/admin/credits"
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-purple-50 hover:border-purple-200 transition-all text-xs font-semibold text-slate-800 flex items-center justify-between group"
              >
                <span>Credit Logs</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600" />
              </Link>
              <Link
                href="/admin/settings"
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-purple-50 hover:border-purple-200 transition-all text-xs font-semibold text-slate-800 flex items-center justify-between group"
              >
                <span>Settings</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
