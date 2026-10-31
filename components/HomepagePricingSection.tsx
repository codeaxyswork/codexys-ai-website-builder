"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MockCheckoutModal } from "@/components/MockCheckoutModal";
import { calculatePlanPrice, BillingInterval } from "@/lib/billing-periods";
import {
  PRICING_PLANS,
  SHARED_FEATURE_SECTIONS,
  FEATURE_ICON_MAP,
  DIGITAL_MARKETING_FEATURES,
  ADDON_PRICE_MONTHLY,
  ADDON_PRICE_ANNUAL,
} from "@/app/pricing/page";
import {
  Sparkles,
  ChevronDown,
  Info,
  CheckCircle2,
  ArrowRight,
  AppWindow,
  Cloud,
  Globe,
  Megaphone,
} from "lucide-react";

export function HomepagePricingSection() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string>("free");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [activeDomainTooltip, setActiveDomainTooltip] = useState<string | null>(null);

  // Billing Duration Selector State: 1 Month, 12 Months, 36 Months
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");

  // Digital Marketing Suite Add-on selection state
  const [includeMarketingSuite, setIncludeMarketingSuite] = useState<boolean>(false);

  // Expandable sections start collapsed
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    seo_essentials: false,
    social_media: false,
  });

  const toggleSection = (category: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const res = await fetch("/api/billing/subscription");
      if (res.ok) {
        const data = await res.json();
        if (data.usage?.plan?.id) {
          setCurrentPlanId(data.usage.plan.id);
        }
        setUser(true);
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    }
  };

  const handlePlanClick = (planId: string) => {
    if (planId === currentPlanId) return;

    if (!user) {
      router.push("/login");
      return;
    }

    setSelectedPlanId(planId);
    setIsCheckoutOpen(true);
  };

  const handleCheckoutSuccess = () => {
    fetchUserData();
    router.push("/dashboard/billing");
  };

  return (
    <div className="w-full">
      {/* 2. BILLING DURATION SELECTOR: 1 Month, 12 Months, 36 Months */}
      <div className="pt-2 pb-8 flex flex-col items-center">
        <div className="inline-flex items-center p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-xs relative gap-1">
          {/* 1 Month Tab */}
          <button
            type="button"
            id="billing-tab-1month"
            onClick={() => setBillingInterval("monthly")}
            className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              billingInterval === "monthly"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            1 Month
          </button>

          {/* 12 Months Tab */}
          <button
            type="button"
            id="billing-tab-12months"
            onClick={() => setBillingInterval("yearly")}
            className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              billingInterval === "yearly"
                ? "bg-white text-slate-900 shadow-sm border-2 border-[#6938ef]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>12 Months</span>
            <span className="text-[10px] font-black text-[#6938ef] bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
              16.7% OFF
            </span>
          </button>

          {/* 36 Months Tab */}
          <button
            type="button"
            id="billing-tab-36months"
            onClick={() => setBillingInterval("triennial")}
            className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              billingInterval === "triennial"
                ? "bg-white text-slate-900 shadow-sm border-2 border-[#6938ef]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>36 Months</span>
            <span className="text-[10px] font-black text-[#6938ef] bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
              35% OFF
            </span>
          </button>
        </div>
      </div>

      {/* 1. FOUR PRIMARY PRICING CARDS SIDE BY SIDE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 items-stretch">
        {PRICING_PLANS.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          const calc = calculatePlanPrice(plan.id, billingInterval);

          // Compute add-on amount based on billing duration
          const addonAmount =
            billingInterval === "yearly"
              ? ADDON_PRICE_ANNUAL
              : billingInterval === "triennial"
              ? ADDON_PRICE_ANNUAL * 3
              : ADDON_PRICE_MONTHLY;

          const finalDisplayTotal = includeMarketingSuite
            ? calc.finalTotal + addonAmount
            : calc.finalTotal;

          return (
            <div
              key={plan.id}
              id={`pricing-card-${plan.id}`}
              className={`relative bg-white rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 ${
                plan.popular
                  ? "border-2 border-[#6938ef] shadow-xl shadow-purple-600/10 ring-4 ring-purple-500/10 hover:shadow-2xl hover:border-[#5b2bdc]"
                  : "border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-slate-300"
              }`}
            >
              {/* Most Popular Badge on Pro Card */}
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#6938ef] text-white text-[11px] font-black uppercase tracking-wider rounded-full shadow-md shadow-purple-600/30 whitespace-nowrap flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-purple-200" />
                  Most Popular
                </div>
              )}

              <div>
                {/* 1. Plan Name */}
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    {plan.name}
                  </h3>
                </div>

                {/* 2. Price Display according to selected Duration */}
                <div className="mt-2 mb-3 min-h-[58px]">
                  {billingInterval === "monthly" ? (
                    /* 1 Month: Monthly price */
                    <div>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className={`text-3xl sm:text-4xl font-black tracking-tight ${includeMarketingSuite ? "text-[#6938ef]" : "text-slate-900"}`}>
                          ₹{finalDisplayTotal.toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          / month
                        </span>
                      </div>
                      {includeMarketingSuite ? (
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                          Base: ₹{calc.finalTotal.toLocaleString("en-IN")} + Add-on: ₹{addonAmount} / mo
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 font-medium mt-1">
                          Billed monthly
                        </div>
                      )}
                    </div>
                  ) : billingInterval === "yearly" ? (
                    /* 12 Months: Strikethrough reference, prepaid total, savings, effective monthly */
                    <div>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        {!includeMarketingSuite && (
                          <span className="text-sm font-semibold text-slate-400 line-through">
                            ₹{calc.referencePrice.toLocaleString("en-IN")}
                          </span>
                        )}
                        <span className={`text-3xl sm:text-4xl font-black tracking-tight ${includeMarketingSuite ? "text-[#6938ef]" : "text-slate-900"}`}>
                          ₹{finalDisplayTotal.toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          / 12 months
                        </span>
                      </div>
                      {includeMarketingSuite ? (
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                          Base: ₹{calc.finalTotal.toLocaleString("en-IN")} + Add-on: ₹{addonAmount.toLocaleString("en-IN")}
                          <span className="text-purple-700 font-bold ml-1">
                            (Effective ₹{Math.round(finalDisplayTotal / 12).toLocaleString("en-IN")}/mo)
                          </span>
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Save ₹{calc.savingsAmount.toLocaleString("en-IN")} (16.7% OFF)
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Effective ₹{Math.round(calc.effectiveMonthlyPrice).toLocaleString("en-IN")}/mo
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* 36 Months: Strikethrough reference, prepaid total, savings, effective monthly */
                    <div>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        {!includeMarketingSuite && (
                          <span className="text-sm font-semibold text-slate-400 line-through">
                            ₹{calc.referencePrice.toLocaleString("en-IN")}
                          </span>
                        )}
                        <span className={`text-3xl sm:text-4xl font-black tracking-tight ${includeMarketingSuite ? "text-[#6938ef]" : "text-slate-900"}`}>
                          ₹{finalDisplayTotal.toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          / 36 months
                        </span>
                      </div>
                      {includeMarketingSuite ? (
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                          Base: ₹{calc.finalTotal.toLocaleString("en-IN")} + Add-on: ₹{addonAmount.toLocaleString("en-IN")}
                          <span className="text-purple-700 font-bold ml-1">
                            (Effective ₹{Math.round(finalDisplayTotal / 36).toLocaleString("en-IN")}/mo)
                          </span>
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-extrabold text-[#6938ef] bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                            Save ₹{calc.savingsAmount.toLocaleString("en-IN")} (35% OFF)
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Effective ₹{Math.round(calc.effectiveMonthlyPrice).toLocaleString("en-IN")}/mo
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 36-Month 1 Free Domain Offer Banner */}
                {billingInterval === "triennial" && (
                  <div className="mb-4 p-2 bg-purple-50/80 border border-purple-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-bold text-purple-950 flex items-center gap-1.5 text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-[#6938ef] shrink-0" />
                      1 Free Domain · First Year Free*
                    </span>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDomainTooltip(activeDomainTooltip === plan.id ? null : plan.id);
                        }}
                        onMouseEnter={() => setActiveDomainTooltip(plan.id)}
                        onMouseLeave={() => setActiveDomainTooltip(null)}
                        className="p-1 text-[#6938ef] hover:text-purple-900 hover:bg-purple-100 rounded-full transition-colors cursor-pointer"
                        aria-label="Domain offer details"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>

                      {activeDomainTooltip === plan.id && (
                        <div className="absolute bottom-full right-0 mb-2 w-72 p-3 bg-slate-900 text-white text-[11px] leading-relaxed rounded-2xl shadow-xl z-50 border border-slate-800 text-left cursor-default animate-in fade-in duration-150">
                          <strong className="text-white block mb-1">36-Month Domain Policy:</strong>
                          <p className="text-slate-300">
                            Every qualifying 36-month subscription receives a maximum of 1 free eligible standard domain registration (.com, .in, .net, .org) for the 1st year. Note that multiple websites do not grant multiple free domain registrations. Standard registry renewal fees apply for Years 2 and 3.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Short Description */}
                <p className="text-xs text-slate-600 font-medium mb-4 min-h-[32px] leading-relaxed">
                  {plan.description}
                </p>

                {/* Plan Specifications Panel (Matching visual reference design) */}
                <div className="mb-6 bg-slate-50/80 rounded-2xl p-3 sm:p-3.5 border border-slate-200/70 divide-y divide-slate-200/60">
                  {/* 1. Website Limit */}
                  <div className="flex items-center gap-3 py-2.5 first:pt-0.5 last:pb-0.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-100/90 text-[#6938ef] flex items-center justify-center shrink-0">
                      <AppWindow className="w-4 h-4" strokeWidth={2.2} />
                    </div>
                    <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                      {plan.websiteLimit}
                    </span>
                  </div>

                  {/* 2. Monthly AI Credits */}
                  <div className="flex items-center gap-3 py-2.5 first:pt-0.5 last:pb-0.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-100/90 text-[#6938ef] flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" strokeWidth={2.2} />
                    </div>
                    <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                      {plan.aiCredits}
                    </span>
                  </div>

                  {/* 3. Storage Capacity */}
                  <div className="flex items-center gap-3 py-2.5 first:pt-0.5 last:pb-0.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-100/90 text-[#6938ef] flex items-center justify-center shrink-0">
                      <Cloud className="w-4 h-4" strokeWidth={2.2} />
                    </div>
                    <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                      {plan.storage}
                    </span>
                  </div>

                  {/* 4. Custom Domain Allowance */}
                  <div className="flex items-center gap-3 py-2.5 first:pt-0.5 last:pb-0.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-100/90 text-[#6938ef] flex items-center justify-center shrink-0">
                      <Globe className="w-4 h-4" strokeWidth={2.2} />
                    </div>
                    <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                      {plan.domain}
                    </span>
                  </div>
                </div>

                {/* 8. Feature List: Always-visible Website Builder + Expandable SEO Essentials & Social Media */}
                <div className="space-y-4 text-xs">
                  {SHARED_FEATURE_SECTIONS.map((section) => {
                    const isExpanded = Boolean(openSections[section.category]);
                    const SectionIcon = section.icon;

                    if (!section.collapsible) {
                      // Always-visible static section (Website Builder): No button, no chevron, no badge
                      return (
                        <div
                          key={section.category}
                          className="rounded-2xl border border-slate-200/80 overflow-hidden bg-white shadow-2xs"
                        >
                          {/* Static Section Header */}
                          <div
                            className={`w-full p-2.5 sm:px-3 sm:py-2.5 flex items-center justify-between text-left border-b border-slate-200/70 ${section.headerBg}`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${section.iconBg}`}
                              >
                                <SectionIcon className="w-3 h-3" />
                              </div>
                              <span
                                className={`text-[11px] tracking-wider uppercase ${
                                  section.isBold
                                    ? "font-black text-slate-900"
                                    : "font-extrabold text-slate-800"
                                }`}
                              >
                                {section.title}
                              </span>
                            </div>
                          </div>

                          {/* All 8 features always displayed directly inside every pricing card */}
                          <div
                            className={`p-3 space-y-2.5 ${
                              section.isBold
                                ? "font-bold text-slate-900 bg-purple-50/20"
                                : "font-medium text-slate-600 bg-slate-50/30"
                            }`}
                          >
                            {section.features.map((feat, fIdx) => {
                              const FeatureIcon = FEATURE_ICON_MAP[feat] || CheckCircle2;

                              return (
                                <div
                                  key={fIdx}
                                  className="flex items-start gap-2.5 leading-snug"
                                >
                                  <FeatureIcon
                                    className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                                      section.isBold
                                        ? "text-[#6938ef]"
                                        : "text-slate-400"
                                    }`}
                                    strokeWidth={2}
                                  />
                                  <span>{feat}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    // Expandable sections (SEO Essentials & Social Media Management): No feature count badge
                    return (
                      <div
                        key={section.category}
                        className="rounded-2xl border border-slate-200/80 overflow-hidden bg-white shadow-2xs"
                      >
                        {/* Interactive Section Header: Section icon, title, rotating chevron. No feature count badge */}
                        <button
                          type="button"
                          onClick={() => toggleSection(section.category)}
                          className={`w-full p-2.5 sm:px-3 sm:py-2.5 flex items-center justify-between text-left transition-colors cursor-pointer select-none border-b ${
                            isExpanded ? "border-slate-200/70" : "border-transparent"
                          } ${section.headerBg}`}
                          aria-expanded={isExpanded}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${section.iconBg}`}
                            >
                              <SectionIcon className="w-3 h-3" />
                            </div>
                            <span
                              className={`text-[11px] tracking-wider uppercase ${
                                section.isBold
                                  ? "font-black text-slate-900"
                                  : "font-extrabold text-slate-800"
                              }`}
                            >
                              {section.title}
                            </span>
                          </div>

                          <div className="flex items-center">
                            <ChevronDown
                              className={`w-4 h-4 transition-transform duration-300 ${
                                section.isBold ? "text-[#6938ef]" : "text-slate-400"
                              } ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </div>
                        </button>

                        {/* Smooth Accordion Body (CSS Grid Rows Animation) */}
                        <div
                          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                            isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                          }`}
                        >
                          <div className="overflow-hidden">
                            <div
                              className={`p-3 space-y-2.5 ${
                                section.isBold
                                  ? "font-bold text-slate-900 bg-purple-50/20"
                                  : "font-medium text-slate-600 bg-slate-50/30"
                              }`}
                            >
                              {section.features.map((feat, fIdx) => {
                                const FeatureIcon = FEATURE_ICON_MAP[feat] || CheckCircle2;

                                return (
                                  <div
                                    key={fIdx}
                                    className="flex items-start gap-2.5 leading-snug"
                                  >
                                    <FeatureIcon
                                      className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                                        section.isBold
                                          ? "text-[#6938ef]"
                                          : "text-slate-400"
                                      }`}
                                      strokeWidth={2}
                                    />
                                    <span>{feat}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 9. Existing Plan CTA Button */}
              <div className="mt-8 pt-4 border-t border-slate-100">
                <button
                  id={`btn-get-plan-${plan.id}`}
                  onClick={() => handlePlanClick(plan.id)}
                  disabled={isCurrent}
                  className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                    isCurrent
                      ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      : plan.popular
                      ? "bg-[#6938ef] hover:bg-[#5928df] text-white shadow-purple-600/20 active:scale-98"
                      : "bg-slate-900 hover:bg-slate-800 text-white active:scale-98"
                  }`}
                >
                  <span>{isCurrent ? "Current Active Plan" : `Get ${plan.name} Plan`}</span>
                  {!isCurrent && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. DIGITAL MARKETING SUITE ADD-ON (High-Impact Premium Feature Section) */}
      <section id="digital-marketing-suite-addon" className="w-full my-12">
        <div
          className={`rounded-3xl p-6 sm:p-10 transition-all duration-300 space-y-8 ${
            includeMarketingSuite
              ? "bg-[#FAF5FF] border-2 border-[#A60BFF] shadow-xl shadow-purple-600/10 ring-4 ring-[#A60BFF]/10"
              : "bg-[#FCF9FF] border-2 border-purple-200/90 shadow-md shadow-purple-900/5 hover:border-purple-300"
          }`}
        >
          {/* Panel Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 border-b border-purple-200/70">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#A60BFF]/25 text-[#A60BFF] text-xs font-black uppercase tracking-wider shadow-2xs">
                <Megaphone className="w-3.5 h-3.5 text-[#A60BFF]" strokeWidth={2.2} />
                <span>Comprehensive Growth Platform</span>
              </div>

              <div className="flex items-center gap-3.5 flex-wrap">
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                  Digital Marketing Suite
                </h2>
                <span className="text-xs sm:text-sm font-black text-[#A60BFF] bg-white px-3.5 py-1 rounded-full border-2 border-[#A60BFF]/30 shadow-xs whitespace-nowrap">
                  {billingInterval === "yearly"
                    ? `+₹${ADDON_PRICE_ANNUAL.toLocaleString("en-IN")} / 12 months (+₹${ADDON_PRICE_MONTHLY}/mo)`
                    : billingInterval === "triennial"
                    ? `+₹${ADDON_PRICE_ANNUAL.toLocaleString("en-IN")} / year recurring (+₹${ADDON_PRICE_MONTHLY}/mo)`
                    : `+₹${ADDON_PRICE_MONTHLY} / month`}
                </span>
              </div>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                Equip your websites with advanced SEO intelligence, multi-engine AI search visibility tracking, autonomous SEO autopilot, and automated marketing campaigns.
              </p>
            </div>

            {/* Checkbox Selection Control */}
            <div className="shrink-0">
              <label
                htmlFor="include-digital-marketing-suite"
                className={`inline-flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:px-6 sm:py-4 rounded-2xl cursor-pointer select-none transition-all duration-200 border-2 ${
                  includeMarketingSuite
                    ? "bg-white border-[#A60BFF] shadow-md shadow-[#A60BFF]/20 ring-2 ring-[#A60BFF]/20"
                    : "bg-white hover:bg-[#F5EBFF]/50 border-purple-200/90 shadow-2xs hover:border-[#A60BFF]/40"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <input
                    type="checkbox"
                    id="include-digital-marketing-suite"
                    checked={includeMarketingSuite}
                    onChange={(e) => setIncludeMarketingSuite(e.target.checked)}
                    className="w-5 h-5 rounded text-[#A60BFF] border-slate-300 focus:ring-[#A60BFF] cursor-pointer accent-[#A60BFF] shrink-0"
                  />
                  <div className="text-left">
                    <span className="block text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                      Include Digital Marketing Suite
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Optional add-on for any website plan
                    </span>
                  </div>
                </div>
                <div className="sm:pl-4 sm:border-l sm:border-slate-200/80">
                  <span className="inline-flex items-center px-3 py-1 rounded-xl bg-[#F5EBFF] text-[#A60BFF] font-black text-xs sm:text-sm border border-[#A60BFF]/25 shadow-2xs">
                    {billingInterval === "yearly"
                      ? `+₹${ADDON_PRICE_ANNUAL}/12m`
                      : billingInterval === "triennial"
                      ? `+₹${ADDON_PRICE_ANNUAL}/yr`
                      : `+₹${ADDON_PRICE_MONTHLY}/mo`}
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Selection Status Feedback */}
          {includeMarketingSuite ? (
            <div className="p-4 bg-white/95 border border-[#A60BFF]/30 rounded-2xl flex items-center justify-between text-xs sm:text-sm text-slate-900 font-medium shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#F5EBFF] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-[#A60BFF]" strokeWidth={2.5} />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">Digital Marketing Suite active:</strong> Added to all four plans above for the selected {billingInterval === "yearly" ? "12 Months" : billingInterval === "triennial" ? "36 Months" : "1 Month"} billing period.
                </span>
              </div>
              <span className="font-black text-[#A60BFF] bg-[#F5EBFF] px-3 py-1 rounded-full text-xs uppercase tracking-wider border border-[#A60BFF]/20 hidden sm:inline-block">
                Active
              </span>
            </div>
          ) : (
            <div className="p-4 bg-white/70 border border-purple-200/70 rounded-2xl text-xs sm:text-sm text-slate-600 font-medium flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-[#F5EBFF] flex items-center justify-center shrink-0">
                <Info className="w-4 h-4 text-[#A60BFF]" />
              </div>
              <span>
                Select the checkbox above to add advanced SEO intelligence, multi-engine AI search visibility, autonomous SEO autopilot, and marketing campaign tools to your plan.
              </span>
            </div>
          )}

          {/* Add-on Features List (Strict 6 Features Preserved) */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                ADD-ON FEATURES
              </h3>
              <div className="h-px bg-purple-200/80 flex-1" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {DIGITAL_MARKETING_FEATURES.map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={idx}
                    className="p-6 bg-white rounded-2xl border border-purple-100/90 hover:border-[#A60BFF]/50 hover:shadow-md transition-all duration-200 flex items-start gap-4 group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#F5EBFF] flex items-center justify-center shrink-0 border border-[#A60BFF]/15 group-hover:scale-105 transition-transform duration-200">
                      <Icon className="w-5 h-5 text-[#A60BFF]" strokeWidth={2} />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <h4 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">
                        {feat.title}
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                        {feat.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Mock Checkout Modal: Carries plan, billing duration, and add-on selection */}
      {selectedPlanId && (
        <MockCheckoutModal
          planId={selectedPlanId}
          initialInterval={billingInterval}
          isBundleSelected={includeMarketingSuite}
          selectedAddonIds={includeMarketingSuite ? ["digital_marketing_meta_suite"] : []}
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          onSuccess={handleCheckoutSuccess}
          onIntervalChange={(newInterval) => setBillingInterval(newInterval)}
        />
      )}
    </div>
  );
}
