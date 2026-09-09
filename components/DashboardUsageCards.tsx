"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, HardDrive, Globe, Zap, Check, ArrowUpRight, X } from "lucide-react";
import { UserUsageData } from "@/lib/billing";

interface DashboardUsageCardsProps {
  usage: UserUsageData;
}

export function DashboardUsageCards({ usage }: DashboardUsageCardsProps) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1000) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  const creditPercentage = Math.min(
    100,
    Math.round((usage.credits.balance / usage.credits.limit) * 100)
  );

  const storagePercentage = Math.min(
    100,
    Math.round((usage.storage.usedBytes / usage.storage.limitBytes) * 100)
  );

  const websitePercentage = Math.min(
    100,
    Math.round((usage.websites.used / usage.websites.limit) * 100)
  );

  return (
    <div className="space-y-6">
      {/* 4 Light SaaS Usage Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. AI Credits Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
              AI Credits
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-900">
                {usage.credits.balance}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                / {usage.credits.limit} Remaining
              </span>
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full mt-2.5 overflow-hidden">
              <div
                className="bg-purple-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${creditPercentage}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-medium block mt-1.5">
              {usage.credits.monthlyUsed} credits used this month
            </span>
          </div>
        </div>

        {/* 2. Storage Quota Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
              Storage Quota
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
              <HardDrive className="w-4 h-4 text-indigo-600" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-slate-900">
                {formatBytes(usage.storage.usedBytes)}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                / {formatBytes(usage.storage.limitBytes)}
              </span>
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full mt-2.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${storagePercentage}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-medium block mt-1.5">
              Asset storage limit
            </span>
          </div>
        </div>

        {/* 3. Websites Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
              Websites Limit
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <Globe className="w-4 h-4 text-emerald-600" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-900">
                {usage.websites.used}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                / {usage.websites.limit} Websites
              </span>
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full mt-2.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${websitePercentage}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-medium block mt-1.5">
              {usage.websites.limit - usage.websites.used} slot(s) available
            </span>
          </div>
        </div>

        {/* 4. Current Plan Card */}
        <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/80 to-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-purple-700 tracking-wider">
              Current Plan
            </span>
            <span className="px-2 py-0.5 rounded bg-purple-600 text-white text-[10px] font-extrabold uppercase">
              {usage.plan.name}
            </span>
          </div>

          <div>
            <p className="text-xs text-slate-600 font-medium leading-tight">
              {usage.plan.id === "free"
                ? "50 AI Credits • 1 Website • 100 MB Storage"
                : `${usage.credits.limit} AI Credits • ${usage.websites.limit} Websites`}
            </p>

            <Link
              href="/dashboard/billing"
              className="mt-3 w-full py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-all shadow-2xs active:scale-95"
            >
              <span>Upgrade Plan</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Upgrade Plan Tier Info Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-5 relative">
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold mb-2">
                <Zap className="w-3.5 h-3.5" />
                <span>Select a Plan</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Upgrade Your SaaS Tier
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Unlock higher AI credits, custom domain publishing, and expanded media storage.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Free Plan */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="font-bold text-slate-900 text-sm">Free</div>
                <div className="text-xl font-extrabold text-slate-900">$0 <span className="text-xs text-slate-400 font-normal">/mo</span></div>
                <ul className="text-xs text-slate-600 space-y-1.5">
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> 50 AI Credits/mo</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> 1 Saved Website</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> 100 MB Storage</li>
                </ul>
                <div className="pt-2">
                  <span className="text-[11px] font-semibold text-slate-400 block text-center">Current Tier</span>
                </div>
              </div>

              {/* Pro Plan */}
              <div className="rounded-2xl border-2 border-purple-600 bg-white p-4 space-y-3 relative shadow-sm">
                <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full bg-purple-600 text-white text-[9px] font-extrabold uppercase">POPULAR</span>
                <div className="font-bold text-slate-900 text-sm">Pro</div>
                <div className="text-xl font-extrabold text-purple-700">$19 <span className="text-xs text-slate-400 font-normal">/mo</span></div>
                <ul className="text-xs text-slate-600 space-y-1.5">
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-purple-600" /> 500 AI Credits/mo</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-purple-600" /> 10 Saved Websites</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-purple-600" /> 5 GB Storage</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-purple-600" /> Custom Domain Support</li>
                </ul>
                <button
                  onClick={() => alert("Stripe Payment integration will be enabled in Phase 4.")}
                  className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-all shadow-xs"
                >
                  Upgrade to Pro
                </button>
              </div>

              {/* Agency Plan */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="font-bold text-slate-900 text-sm">Agency</div>
                <div className="text-xl font-extrabold text-slate-900">$49 <span className="text-xs text-slate-400 font-normal">/mo</span></div>
                <ul className="text-xs text-slate-600 space-y-1.5">
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> 2,000 AI Credits/mo</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> 50 Saved Websites</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> 20 GB Storage</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> Advanced SEO & Export</li>
                </ul>
                <button
                  onClick={() => alert("Stripe Payment integration will be enabled in Phase 4.")}
                  className="w-full py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-all"
                >
                  Upgrade to Agency
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
