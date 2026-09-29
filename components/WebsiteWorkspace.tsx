"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Wand2,
  Globe2,
  Image as ImageIcon,
  CreditCard,
  ArrowUpRight,
  LayoutGrid,
  ChevronRight,
  Sparkles,
  X,
  Info,
} from "lucide-react";

interface WebsiteWorkspaceProps {
  firstWebsiteId?: string | null;
}

export function WebsiteWorkspace({ firstWebsiteId }: WebsiteWorkspaceProps) {
  const [showMigrateModal, setShowMigrateModal] = useState(false);

  const scrollToMyWebsites = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById("my-websites");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({ top: 800, behavior: "smooth" });
    }
  };

  return (
    <>
      {/* Outer Single Workspace Card */}
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-md relative overflow-hidden transition-all">
        {/* Decorative background ambient glows */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header */}
        <div className="relative z-10 mb-6 border-b border-slate-100 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[11px] font-bold tracking-wide uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Unified Hub</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              WEBSITE WORKSPACE
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              Create, migrate, manage and publish your websites from one place.
            </p>
          </div>
        </div>

        {/* Action Groups Grid */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* GROUP 1: CREATE & MIGRATE */}
          <div className="flex flex-col gap-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 p-4 sm:p-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Create & Migrate
              </h3>
            </div>

            {/* Action 1: Create Website */}
            <Link
              href="/"
              className="group bg-white hover:bg-purple-50/40 border border-slate-200 hover:border-purple-300 rounded-xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                  <Wand2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                  AI Generator
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm group-hover:text-purple-700 transition-colors">
                  Create Website
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Create a new website with AI from your business idea.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-700">
                <span>Start Creation</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Action 2: Migrate Website */}
            <Link
              href="/dashboard/migrate"
              className="group text-left bg-white hover:bg-purple-50/40 border border-slate-200 hover:border-purple-300 rounded-xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Import & Sync
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm group-hover:text-purple-700 transition-colors">
                  Migrate Website
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Bring your existing website to Codeaxys while preserving its content and design.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-700">
                <span>Migrate Site</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>

          {/* GROUP 2: PUBLISH & ACCOUNT */}
          <div className="flex flex-col gap-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 p-4 sm:p-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Publish & Account
              </h3>
            </div>

            {/* Action: Domains */}
            {firstWebsiteId ? (
              <Link
                href={`/dashboard/websites/${firstWebsiteId}/domain`}
                className="group bg-white hover:bg-indigo-50/40 border border-slate-200 hover:border-indigo-300 rounded-xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <Globe2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Custom Domain
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm group-hover:text-indigo-900 transition-colors">
                    Domains
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Connect and manage custom domains for your websites.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-700">
                  <span>Manage Custom Domains</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ) : (
              <a
                href="#my-websites"
                onClick={scrollToMyWebsites}
                className="group bg-white hover:bg-indigo-50/40 border border-slate-200 hover:border-indigo-300 rounded-xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <Globe2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Custom Domain
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm group-hover:text-indigo-900 transition-colors">
                    Domains
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Connect and manage custom domains for your websites.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-700">
                  <span>Manage Custom Domains</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </a>
            )}

            {/* Action: Billing & Plan */}
            <Link
              href="/dashboard/billing"
              className="group bg-white hover:bg-purple-50/40 border border-slate-200 hover:border-purple-300 rounded-xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                  Subscription
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm group-hover:text-purple-700 transition-colors">
                  Billing & Plan
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Manage your subscription, plan and account usage.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-700">
                <span>View Plan & Billing</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Migration Safe UI Placeholder Modal */}
      {showMigrateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 relative">
            <button
              onClick={() => setShowMigrateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0 text-indigo-600">
                <ArrowUpRight className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
                  <Info className="w-3 h-3" />
                  <span>Coming Soon</span>
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  Website Migration Engine
                </h3>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Bring your existing WordPress, HTML, or Webflow site directly into Codeaxys. Our automated migration assistant will transfer your content, structure, media, and SEO metadata automatically.
            </p>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1.5 text-xs text-slate-600">
              <p className="font-bold text-slate-800">Planned Migration Features:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500 text-[11px]">
                <li>One-click WordPress & HTML content importer</li>
                <li>Preserve URL structure & 301 redirect mapping</li>
                <li>Automatic media library & asset migration</li>
                <li>AI design enhancement & responsive optimization</li>
              </ul>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowMigrateModal(false)}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/20 active:scale-95 cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
