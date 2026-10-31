"use client";

import React from "react";
import { getCompletePlanFeatures } from "@/lib/pricing/plan-features-catalog";
import { CheckCircle2, XCircle, Sparkles, Layers, ShieldCheck, X } from "lucide-react";

interface PlanFeaturesModalProps {
  planId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan?: (planId: string) => void;
}

export function PlanFeaturesModal({
  planId,
  isOpen,
  onClose,
  onSelectPlan,
}: PlanFeaturesModalProps) {
  if (!isOpen) return null;

  const planFeatures = getCompletePlanFeatures(planId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-purple-50 via-slate-50 to-indigo-50 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
                Detailed Plan Specifications
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              {planFeatures.planName} Plan — Complete Feature Audit
            </h3>
            <p className="text-xs text-slate-600 mt-0.5 max-w-lg">
              {planFeatures.summary}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-white/80 transition-all text-lg cursor-pointer"
            aria-label="Close features modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Plan Quota Highlights */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2 bg-white rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-semibold text-slate-500 block">Websites</span>
            <strong className="font-extrabold text-slate-900">{planFeatures.websiteLimit} {planFeatures.websiteLimit === 1 ? "Site" : "Sites"}</strong>
          </div>
          <div className="p-2 bg-white rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-semibold text-slate-500 block">AI Credits</span>
            <strong className="font-extrabold text-purple-700">{planFeatures.monthlyCredits.toLocaleString()} / mo</strong>
          </div>
          <div className="p-2 bg-white rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-semibold text-slate-500 block">Storage</span>
            <strong className="font-extrabold text-emerald-700">{planFeatures.storageFormatted}</strong>
          </div>
          <div className="p-2 bg-white rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-semibold text-slate-500 block">Domain Connections</span>
            <strong className="font-extrabold text-indigo-700">Up to {planFeatures.customDomainConnectionLimit}</strong>
          </div>
        </div>

        {/* Scrollable Feature Categories */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {planFeatures.categoryGroups.map((group) => (
            <div key={group.category} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
                <Layers className="w-4 h-4 text-purple-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  {group.categoryLabel}
                </h4>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {group.features.map((feat, idx) => {
                  const isIncluded = feat.availability === "included";
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border transition-all text-xs flex items-start gap-3 ${
                        isIncluded
                          ? "bg-white border-slate-200/80 hover:border-purple-200"
                          : "bg-slate-50/70 border-slate-200/60 opacity-80"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isIncluded ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-400" />
                        )}
                      </div>

                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span
                            className={`font-bold ${
                              isIncluded ? "text-slate-900" : "text-slate-600"
                            }`}
                          >
                            {feat.name}
                          </span>

                          {feat.badgeText && (
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                              {feat.badgeText}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {feat.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Safety & Entitlement Transparency Notice */}
          <div className="p-3.5 bg-purple-50/70 border border-purple-200/70 rounded-2xl flex items-start gap-2.5 text-[11px] text-purple-950">
            <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="font-bold block">Implementation & Entitlement Verification:</strong>
              <p className="text-purple-900 leading-relaxed">
                Feature entitlements are enforced strictly server-side. Unavailable features require an eligible tier upgrade or approved add-on subscription.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold cursor-pointer"
          >
            Close Feature Overview
          </button>

          {onSelectPlan && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectPlan(planId);
              }}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer active:scale-95"
            >
              Select {planFeatures.planName} Plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
