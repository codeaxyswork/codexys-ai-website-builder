"use client";

import React, { useState } from "react";
import { BillingInterval } from "@/lib/billing-periods";
import { getPlanBundleDefinition } from "@/lib/pricing/premium-bundle";
import {
  Sparkles,
  CheckCircle2,
  Lock,
  ChevronDown,
  Info,
  Clock,
  ShieldCheck,
  Check,
} from "lucide-react";

interface PremiumBundleSelectionCardProps {
  selectedPlanId: string;
  billingInterval: BillingInterval;
  isBundleSelected: boolean;
  onToggleBundle: (selected: boolean) => void;
  className?: string;
}

export function PremiumBundleSelectionCard({
  selectedPlanId,
  billingInterval,
  isBundleSelected,
  onToggleBundle,
  className = "",
}: PremiumBundleSelectionCardProps) {
  const [showBaseFeatures, setShowBaseFeatures] = useState(false);
  const bundle = getPlanBundleDefinition(selectedPlanId, billingInterval);

  return (
    <div
      className={`bg-white border rounded-3xl p-6 sm:p-7 shadow-sm transition-all duration-200 relative overflow-hidden ${
        isBundleSelected
          ? "border-purple-500 ring-2 ring-purple-500/20 shadow-md"
          : "border-slate-200 hover:border-slate-300"
      } ${className}`}
    >
      {/* Top Banner / Status Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-600/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-slate-900">
                Optional Add-on
              </span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 text-amber-600" />
                Pricing Pending Approval
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              Premium Features Bundle ({bundle.planName} Edition)
            </h3>
          </div>
        </div>

        {/* Pricing / Toggle Box */}
        <div className="flex items-center gap-3 sm:justify-end">
          {bundle.alreadyFullyIncluded ? (
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              100% Included in Agency Base Plan
            </div>
          ) : (
            <label className="flex items-center gap-2.5 cursor-pointer select-none bg-slate-50 hover:bg-purple-50/60 p-2 sm:px-3 rounded-2xl border border-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={isBundleSelected}
                onChange={(e) => onToggleBundle(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 border-slate-300 focus:ring-purple-500 cursor-pointer"
              />
              <span className="text-xs font-extrabold text-slate-900">
                {isBundleSelected ? "Bundle Selected (Preview)" : "Select Bundle"}
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-600 leading-relaxed font-normal mb-5">
        {bundle.disclosureNotice}
      </p>

      {/* Features Included in Bundle for this plan */}
      {bundle.featuresIncluded.length > 0 ? (
        <div className="space-y-3 mb-5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px]">
              Verified Capabilities Added by this Bundle ({bundle.featuresIncluded.length}):
            </span>
            <span className="text-[10px] text-purple-700 font-bold">
              Synchronized with {bundle.intervalLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {bundle.featuresIncluded.map((feat) => (
              <div
                key={feat.id}
                className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/80 flex items-start gap-2.5 text-xs"
              >
                <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold text-slate-900 block leading-tight">
                    {feat.name}
                  </strong>
                  <span className="text-[11px] text-slate-500 block mt-0.5 leading-snug">
                    {feat.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl mb-5 text-xs text-emerald-950 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <strong className="font-bold block">No Additional Bundle Needed:</strong>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              The Agency plan already includes all verified SEO intelligence, AI Visibility, SEO Autopilot, White-Label client reporting, and advanced integrations natively.
            </p>
          </div>
        </div>
      )}

      {/* Features already provided by the base plan (zero double charging disclosure) */}
      <div className="border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setShowBaseFeatures(!showBaseFeatures)}
          className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer py-1"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
          <span>
            {showBaseFeatures ? "Hide" : "Show"} features already provided by your {bundle.planName} base plan (no double-charge)
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              showBaseFeatures ? "rotate-180" : ""
            }`}
          />
        </button>

        {showBaseFeatures && (
          <div className="mt-2.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1.5 text-xs">
            <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
              Included in {bundle.planName} Base Plan (Excluded from Bundle):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {bundle.featuresAlreadyInBasePlan.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-slate-600 text-[11px]">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Safeguard Callout */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
          <Info className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span>
            Preview-only. Bundle checkout does not add charges until official price approval.
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-black text-slate-900">
            {bundle.priceDisplay}
          </span>
        </div>
      </div>
    </div>
  );
}
