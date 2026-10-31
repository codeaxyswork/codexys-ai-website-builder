"use client";

import React, { useState } from "react";
import { ADDON_CATALOG, listAllAddons } from "@/lib/addons/catalog";
import { AddonCategory, AddonDefinition } from "@/lib/addons/types";
import {
  Sparkles,
  Search,
  Bot,
  FileCheck2,
  Globe2,
  HardDrive,
  Megaphone,
  CheckCircle2,
  Lock,
  Layers,
  Info,
  Clock,
  ShieldAlert,
} from "lucide-react";

type FilterCategory = "all" | AddonCategory;

const CATEGORY_TABS: Array<{ id: FilterCategory; label: string }> = [
  { id: "all", label: "All Add-ons" },
  { id: "seo", label: "SEO & AI" },
  { id: "marketing", label: "Marketing" },
  { id: "agency", label: "Agency Tools" },
  { id: "capacity", label: "Capacity" },
];

const ADDON_ICONS: Record<string, React.ElementType> = {
  ai_visibility_tracker: Search,
  seo_autopilot_fix_agent: Bot,
  white_label_agency_reports: FileCheck2,
  extra_website_slot: Globe2,
  ai_credit_top_up_pack: Sparkles,
  media_storage_expansion: HardDrive,
  digital_marketing_meta_suite: Megaphone,
};

export function OptionalAddonsSection() {
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("all");
  const addons = listAllAddons();

  const filteredAddons =
    activeCategory === "all"
      ? addons
      : addons.filter((addon) => addon.category === activeCategory);

  return (
    <section id="optional-addons" className="relative py-12 space-y-8 w-full">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-100/90 border border-purple-200 text-purple-900 text-xs font-bold uppercase tracking-wider">
          <Layers className="w-3.5 h-3.5 text-purple-700" />
          Modular Add-on Capabilities
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Optional Paid Add-ons & Capacity Upgrades
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-2xl mx-auto">
          Power up your websites with multi-engine LLM tracking, autonomous SEO agents, agency client reporting, and capacity packs without jumping entire plan tiers.
        </p>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Add-on Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {filteredAddons.map((addon) => {
          const IconComponent = ADDON_ICONS[addon.id] || Layers;
          const isGoogleAdsUnavailable =
            addon.id === "digital_marketing_meta_suite" &&
            addon.metadata?.unavailableIntegrations?.includes("google_ads_campaign_publishing");

          return (
            <div
              key={addon.id}
              className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-5"
            >
              <div className="space-y-4">
                {/* Header: Icon, Category & Status Badges */}
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-200/80 flex items-center justify-center shrink-0">
                    <IconComponent className="w-5 h-5 text-purple-700" />
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {addon.category}
                    </span>

                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-amber-600" />
                      Pending Approval
                    </span>
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-base font-bold text-slate-900">{addon.name}</h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed mt-1">
                    {addon.description}
                  </p>
                </div>

                {/* Quota & Operational Status Badge */}
                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-600">Usage Quota:</span>
                    <strong className="font-bold text-purple-900">
                      {addon.quotaConfig.probesPerMonth
                        ? `${addon.quotaConfig.probesPerMonth} probes / mo`
                        : addon.quotaConfig.fixesPerMonth
                        ? `${addon.quotaConfig.fixesPerMonth} auto-fixes / mo`
                        : addon.quotaConfig.websites
                        ? `+${addon.quotaConfig.websites} Website Slot`
                        : addon.quotaConfig.credits
                        ? `+${addon.quotaConfig.credits} AI Credits (Non-Expiring)`
                        : addon.quotaConfig.storageBytes
                        ? `+${(addon.quotaConfig.storageBytes / (1024 * 1024 * 1024)).toFixed(0)} GB Storage`
                        : "Full Included Quota"}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-600">Eligible Plans:</span>
                    <strong className="font-bold text-slate-800 capitalize">
                      {addon.eligibleBasePlans.join(", ")}
                    </strong>
                  </div>

                  {isGoogleAdsUnavailable && (
                    <div className="pt-1 border-t border-slate-200/60 text-[10px] text-amber-800 font-medium flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-amber-600 shrink-0" />
                      Google Ads campaign publishing is mock-only / unavailable.
                    </div>
                  )}
                </div>

                {/* Included Features List */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Verified Included Capabilities:
                  </span>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {addon.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-[11px] leading-tight">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Card Footer: Pricing Tag & Disabled Activation Control */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-slate-500">Add-on Price:</span>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-slate-900 block">
                      Pricing Pending Approval
                    </span>
                    <span className="text-[10px] font-semibold text-purple-700">
                      Coming Soon in Phase 3
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={true}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 border border-slate-200 font-bold text-xs cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Activation Inactive (Phase 2 Preview)</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Safety & Compliance Notice */}
      <div className="max-w-4xl mx-auto p-4 bg-purple-50/70 border border-purple-200/80 rounded-2xl flex items-start gap-3 text-xs text-purple-950">
        <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="font-bold block">
            Add-on Pricing & Checkout Governance (Phase 2 Invariant):
          </strong>
          <p className="text-[11px] text-purple-900 leading-relaxed">
            All optional add-on prices displayed above are architectural placeholders pending unit cost modeling. Inactive add-ons cannot be purchased or activated, and customers are never charged. Base plans and approved prices (Starter ₹299, Pro ₹599, Business ₹999, Agency ₹1,999) remain authoritative.
          </p>
        </div>
      </div>
    </section>
  );
}
