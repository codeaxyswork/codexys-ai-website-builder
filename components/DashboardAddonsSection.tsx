"use client";

import React, { useState } from "react";
import { listAllAddons, isAddonEligibleForPlan } from "@/lib/addons/catalog";
import { AddonCategory, UserAddonRecord } from "@/lib/addons/types";
import {
  Layers,
  Sparkles,
  Search,
  Bot,
  FileCheck2,
  Globe2,
  HardDrive,
  Megaphone,
  CheckCircle2,
  Lock,
  Clock,
  AlertCircle,
  Database,
  Calendar,
} from "lucide-react";

interface DashboardAddonsSectionProps {
  currentPlanId: string;
  userAddons?: UserAddonRecord[];
  isMigrationApplied?: boolean;
}

type TabType = "available" | "my_addons";
type CategoryFilter = "all" | AddonCategory;

const ADDON_ICONS: Record<string, React.ElementType> = {
  ai_visibility_tracker: Search,
  seo_autopilot_fix_agent: Bot,
  white_label_agency_reports: FileCheck2,
  extra_website_slot: Globe2,
  ai_credit_top_up_pack: Sparkles,
  media_storage_expansion: HardDrive,
  digital_marketing_meta_suite: Megaphone,
};

export function DashboardAddonsSection({
  currentPlanId,
  userAddons = [],
  isMigrationApplied = false,
}: DashboardAddonsSectionProps) {
  const [activeTab, setActiveTab] = useState<TabType>("available");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

  const catalog = listAllAddons();

  const filteredCatalog =
    activeCategory === "all"
      ? catalog
      : catalog.filter((addon) => addon.category === activeCategory);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
              Phase 2 Staging
            </span>
            <h3 className="text-lg font-bold text-slate-900">Add-ons & Upgrades</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage optional specialized add-ons, capacity top-ups, and agency tools
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("available")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "available"
                ? "bg-white text-purple-700 shadow-xs border border-purple-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Available Add-ons ({catalog.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("my_addons")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "my_addons"
                ? "bg-white text-purple-700 shadow-xs border border-purple-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            My Add-ons ({userAddons.length})
          </button>
        </div>
      </div>

      {/* VIEW 1: AVAILABLE ADD-ONS */}
      {activeTab === "available" && (
        <div className="space-y-5">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: "all", label: "All" },
              { id: "seo", label: "SEO & AI" },
              { id: "marketing", label: "Marketing" },
              { id: "agency", label: "Agency Tools" },
              { id: "capacity", label: "Capacity" },
            ].map((tab) => {
              const isSelected = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id as CategoryFilter)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 text-white"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Catalog Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalog.map((addon) => {
              const IconComponent = ADDON_ICONS[addon.id] || Layers;
              const isEligible = isAddonEligibleForPlan(addon.id, currentPlanId);

              return (
                <div
                  key={addon.id}
                  className="bg-slate-50/60 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-100/70 border border-purple-200 flex items-center justify-center shrink-0">
                        <IconComponent className="w-4 h-4 text-purple-700" />
                      </div>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-amber-600" />
                        Pending Approval
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{addon.name}</h4>
                      <p className="text-xs text-slate-600 leading-snug mt-1">
                        {addon.description}
                      </p>
                    </div>

                    {/* Quota & Eligibility Pills */}
                    <div className="space-y-1 text-[11px] pt-1 border-t border-slate-200/60">
                      <div className="flex justify-between text-slate-500">
                        <span>Plan Eligibility:</span>
                        <strong
                          className={`font-semibold ${
                            isEligible ? "text-emerald-700" : "text-slate-500"
                          }`}
                        >
                          {isEligible
                            ? `Eligible (${currentPlanId})`
                            : `Requires: ${addon.eligibleBasePlans.join(", ")}`}
                        </strong>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Quota Included:</span>
                        <strong className="text-purple-900 font-semibold">
                          {addon.quotaConfig.probesPerMonth
                            ? `${addon.quotaConfig.probesPerMonth} probes/mo`
                            : addon.quotaConfig.fixesPerMonth
                            ? `${addon.quotaConfig.fixesPerMonth} fixes/mo`
                            : addon.quotaConfig.websites
                            ? `+${addon.quotaConfig.websites} Website`
                            : addon.quotaConfig.credits
                            ? `+${addon.quotaConfig.credits} Credits`
                            : addon.quotaConfig.storageBytes
                            ? `+10 GB Storage`
                            : "Included"}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Card Action */}
                  <div className="pt-3 border-t border-slate-200/60 space-y-2">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-slate-500 font-medium">Price:</span>
                      <strong className="text-slate-900 font-bold">Pricing Pending Approval</strong>
                    </div>

                    <button
                      type="button"
                      disabled={true}
                      className="w-full py-2 px-3 rounded-lg bg-slate-200/70 text-slate-400 font-bold text-xs cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <Lock className="w-3 h-3" />
                      <span>Activation Inactive (Phase 2)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: MY ADD-ONS */}
      {activeTab === "my_addons" && (
        <div className="space-y-4">
          {userAddons.length === 0 ? (
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 mx-auto flex items-center justify-center text-purple-700">
                <Database className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-sm font-bold text-slate-900">
                  {isMigrationApplied ? "No Active Add-ons Purchased" : "Add-on Module Staging"}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {isMigrationApplied
                    ? "You currently do not have any optional add-ons or capacity packs attached to your subscription."
                    : "The additive add-on database migration (20261015_addon_pricing_foundation.sql) is prepared and pending administrator execution. No active paid add-ons are attached to your account."}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("available")}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Explore Available Add-ons →
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-3 px-4 font-bold text-slate-700">Add-on Name</th>
                    <th className="py-3 px-4 font-bold text-slate-700">Status</th>
                    <th className="py-3 px-4 font-bold text-slate-700">Billing Term</th>
                    <th className="py-3 px-4 font-bold text-slate-700">Current Period End</th>
                    <th className="py-3 px-4 font-bold text-slate-700">Renewal Policy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userAddons.map((ua) => (
                    <tr key={ua.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-900 capitalize">
                        {ua.addon_id.replace(/_/g, " ")}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            ua.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : ua.status === "canceled"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {ua.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono capitalize">{ua.billing_interval}</td>
                      <td className="py-3 px-4">{formatDate(ua.current_period_end)}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {ua.cancel_at_period_end ? "Cancels at period end" : "Auto-renews"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
