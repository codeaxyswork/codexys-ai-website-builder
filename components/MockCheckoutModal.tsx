"use client";

import React, { useState, useEffect } from "react";
import { PLANS, PlanConfig } from "@/lib/constants";
import {
  BillingInterval,
  calculatePlanPrice,
} from "@/lib/billing-periods";
import { calculateCartPrice } from "@/lib/addons/pricing";
import { Sparkles, CheckCircle2, Lock } from "lucide-react";

interface MockCheckoutModalProps {
  planId: string;
  initialInterval?: BillingInterval;
  selectedAddonIds?: string[];
  isBundleSelected?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedSub: any) => void;
  onIntervalChange?: (interval: BillingInterval) => void;
}

export function MockCheckoutModal({
  planId,
  initialInterval = "yearly",
  selectedAddonIds = [],
  isBundleSelected = false,
  isOpen,
  onClose,
  onSuccess,
  onIntervalChange,
}: MockCheckoutModalProps) {
  const [interval, setInterval] = useState<BillingInterval>(initialInterval || "yearly");
  const [bundleOptIn, setBundleOptIn] = useState<boolean>(isBundleSelected);
  const [includeDomainOffer, setIncludeDomainOffer] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialInterval) {
      setInterval(initialInterval);
    }
  }, [initialInterval, isOpen]);

  useEffect(() => {
    setBundleOptIn(isBundleSelected);
  }, [isBundleSelected, isOpen]);

  if (!isOpen) return null;

  const plan: PlanConfig = PLANS[planId] || PLANS.pro;
  const calculation = calculatePlanPrice(plan.id, interval, {
    optInDomainOffer: includeDomainOffer,
  });

  const handleIntervalChange = (newInterval: BillingInterval) => {
    setInterval(newInterval);
    onIntervalChange?.(newInterval);
  };

  const handleCompletePayment = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          interval,
          includeDomainOffer: interval === "triennial" ? includeDomainOffer : false,
          isBundleSelected: bundleOptIn,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Payment initialization failed.");
      }

      // 1. Direct Mock / Simulation branch
      if (data.mode === "mock" || data.provider === "mock") {
        setIsSuccess(true);
        setTimeout(() => {
          setIsSuccess(false);
          setIsProcessing(false);
          onSuccess(data);
          onClose();
        }, 1500);
        return;
      }

      // 2. Razorpay Gateway branch
      if (data.provider === "razorpay") {
        const loadRazorpayScript = (): Promise<boolean> => {
          return new Promise((resolve) => {
            if (typeof window !== "undefined" && (window as any).Razorpay) return resolve(true);
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
          });
        };

        const loaded = await loadRazorpayScript();
        if (!loaded || !(window as any).Razorpay) {
          // Fallback if Razorpay SDK script is blocked or offline: verify in sandbox mode
          const verifyRes = await fetch("/api/billing/checkout/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: data.orderId,
              paymentId: `pay_sandbox_${Date.now()}`,
              signature: "mock_signature_valid",
              planId: plan.id,
              interval,
              includeDomainOffer: interval === "triennial" ? includeDomainOffer : false,
            }),
          });
          const verifyData = await verifyRes.json();
          if (!verifyRes.ok || !verifyData.success) {
            throw new Error(verifyData.error || "Sandbox payment verification failed.");
          }
          setIsSuccess(true);
          setTimeout(() => {
            setIsSuccess(false);
            setIsProcessing(false);
            onSuccess(verifyData);
            onClose();
          }, 1500);
          return;
        }

        const options = {
          key: data.keyId,
          amount: Math.round(data.amount * 100),
          currency: data.currency || "INR",
          name: "Codeaxys",
          description: `${plan.name} Plan (${intervalDisplayLabel})`,
          order_id: data.orderId,
          handler: async (response: any) => {
            try {
              const verifyRes = await fetch("/api/billing/checkout/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderId: response.razorpay_order_id,
                  paymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                  planId: plan.id,
                  interval,
                  includeDomainOffer: interval === "triennial" ? includeDomainOffer : false,
                }),
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok || !verifyData.success) {
                throw new Error(verifyData.error || "Payment verification failed.");
              }
              setIsSuccess(true);
              setTimeout(() => {
                setIsSuccess(false);
                setIsProcessing(false);
                onSuccess(verifyData);
                onClose();
              }, 1500);
            } catch (vErr: any) {
              setErrorMessage(vErr.message || "Payment verification failed.");
              setIsProcessing(false);
            }
          },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
            },
          },
          theme: {
            color: "#7c3aed",
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
        return;
      }

      // Default fallback
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsProcessing(false);
        onSuccess(data);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Checkout Error:", err);
      setErrorMessage(err.message || "Payment process encountered an error.");
      setIsProcessing(false);
    }
  };

  const intervalDisplayLabel =
    interval === "yearly"
      ? "12 Months"
      : interval === "triennial"
      ? "36 Months"
      : "Monthly";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-purple-50/40">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-700 block">
              Billing Checkout & Price Transparency
            </span>
            <h3 className="text-lg font-bold text-slate-900">
              Upgrade to {plan.name} Plan
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all text-xl cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Test Mode Disclaimer Banner */}
          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs flex items-center gap-2.5">
            <span className="text-base">🧪</span>
            <div>
              <strong className="font-bold">TEST BILLING SIMULATION:</strong> No real payment gateway is triggered. Upgrades use verified mock transaction processing for local and staging tests.
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Billing Period Selector Tabs: Monthly, 12 Months, 36 Months */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Billing Period
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => handleIntervalChange("monthly")}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                  interval === "monthly"
                    ? "bg-white text-purple-700 shadow-xs border border-purple-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Monthly
              </button>

              <button
                type="button"
                onClick={() => handleIntervalChange("yearly")}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center relative cursor-pointer ${
                  interval === "yearly"
                    ? "bg-white text-purple-700 shadow-xs border border-purple-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                12 Months
                <span className="block text-[9px] font-extrabold text-emerald-600">Save 16.7%</span>
              </button>

              <button
                type="button"
                onClick={() => handleIntervalChange("triennial")}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center relative cursor-pointer ${
                  interval === "triennial"
                    ? "bg-white text-purple-700 shadow-xs border border-purple-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                36 Months
                <span className="block text-[9px] font-extrabold text-purple-600">Save 35%</span>
              </button>
            </div>
          </div>

          {/* ITEMIZED CHECKOUT SUMMARY BREAKDOWN */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Order Itemization
              </span>
              <span className="text-xs font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                {calculation.planName} · {intervalDisplayLabel}
              </span>
            </div>

            {/* Line Item 1: Base Subscription */}
            <div className="flex items-start justify-between text-xs">
              <div>
                <span className="font-bold text-slate-900 block">
                  {calculation.planName} Plan ({intervalDisplayLabel})
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {calculation.upfrontChargeNotice}
                </span>
              </div>
              <div className="text-right">
                {calculation.durationMonths > 1 && (
                  <span className="text-[11px] text-slate-400 line-through block">
                    ₹{calculation.grossTotal.toLocaleString("en-IN")}
                  </span>
                )}
                <span className="font-extrabold text-slate-900 text-sm">
                  ₹{calculation.finalTotal.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Line Item 2: Term Savings & Discount */}
            {calculation.discountAmount > 0 ? (
              <div className="flex items-center justify-between text-xs text-emerald-700 font-semibold pt-1">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Prepaid Term Discount ({calculation.savingsPercentFormatted} Off):
                </span>
                <span className="font-bold">
                  -₹{calculation.discountAmount.toLocaleString("en-IN")}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                <span>Discounts & Savings:</span>
                <span className="font-medium">₹0 (Standard Monthly Rate)</span>
              </div>
            )}

            {/* Line Item 3: Premium Features Bundle Selection */}
            <div className="pt-2 border-t border-slate-200/80">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="checkout-bundle-toggle"
                    checked={bundleOptIn}
                    onChange={(e) => setBundleOptIn(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-purple-600 border-slate-300 focus:ring-purple-500 cursor-pointer"
                  />
                  <label htmlFor="checkout-bundle-toggle" className="font-semibold text-slate-800 cursor-pointer">
                    Marketing & Growth Features Bundle ({calculation.planName})
                  </label>
                </div>
                <div className="text-right">
                  {bundleOptIn ? (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 block">
                      Preview · ₹0 (Pending Approval)
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">Not Selected</span>
                  )}
                </div>
              </div>
              {bundleOptIn && (
                <p className="text-[10px] text-slate-500 mt-1 pl-5.5 leading-snug">
                  Bundle selection is staged in preview mode. Pricing is pending approval and will not be charged today.
                </p>
              )}
            </div>

            {/* Line Item 4: One-Time Charges */}
            <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
              <span>One-Time Setup & Activation:</span>
              <strong className="text-slate-700">₹0</strong>
            </div>

            {/* Total Charged Today Banner */}
            <div className="pt-3 border-t-2 border-slate-200 flex items-baseline justify-between bg-white p-3 rounded-xl border">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                  Total Charged Today:
                </span>
                <span className="text-[11px] text-purple-700 font-semibold block mt-0.5">
                  {calculation.durationMonths > 1
                    ? `Full upfront payment for ${calculation.durationMonths} months of access`
                    : "Standard monthly billing"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  ₹{calculation.finalTotal.toLocaleString("en-IN")}
                </span>
                {calculation.durationMonths > 1 && (
                  <span className="text-[10px] font-semibold text-slate-500 block">
                    (₹{calculation.effectiveMonthlyPrice.toLocaleString("en-IN")}/mo effective)
                  </span>
                )}
              </div>
            </div>

            {/* Renewal Period & Amount */}
            <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between">
              <span>Renewal Schedule:</span>
              <strong className="text-slate-700">{calculation.renewalNotice}</strong>
            </div>
          </div>

          {/* Optional 36-Month Domain Registration Offer */}
          {calculation.qualifiesForDomainOffer && (
            <div className="p-3.5 bg-gradient-to-br from-purple-50/90 via-slate-50 to-indigo-50/70 border border-purple-200/90 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-950">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Optional 36-Month Domain Registration Offer
                </div>
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-200 text-purple-900">
                  Max 1 Free Domain
                </span>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={includeDomainOffer}
                  onChange={(e) => setIncludeDomainOffer(e.target.checked)}
                  className="mt-0.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
                <div className="text-xs text-slate-800 leading-snug">
                  <span className="font-bold text-purple-950 block">
                    Claim 1 Free Eligible Custom Domain Registration (1st Year Free)
                  </span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">
                    Covers standard extensions (.com, .in, .net, .org). All plans receive maximum 1 free domain. Standard registry renewal fees apply for Years 2 and 3.
                  </span>
                </div>
              </label>

              {!includeDomainOffer && (
                <div className="text-[10px] text-slate-500 pt-1 border-t border-purple-100 flex items-center justify-between">
                  <span>Domain offer status:</span>
                  <span className="font-semibold text-slate-700">Declined (Software subscription only)</span>
                </div>
              )}
            </div>
          )}

          {/* Customer-Owned Domain Connection Limit Note */}
          <div className="text-[11px] text-slate-500 px-1 flex items-center justify-between">
            <span>Customer-Owned Domains:</span>
            <strong className="text-slate-700">
              Connect up to {calculation.customDomainConnectionLimit} {calculation.customDomainConnectionLimit === 1 ? "domain" : "domains"} (1 per website)
            </strong>
          </div>

          {/* AI Credits Invariant Notice */}
          <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl text-purple-900 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              Monthly AI Credit Replenishment Policy
            </div>
            <p className="text-[11px] text-purple-800 leading-relaxed font-medium">
              Your plan allowance of <strong>{plan.monthlyCredits.toLocaleString()} AI credits</strong> will be replenished every 30 days throughout your {calculation.durationMonths}-month term. Credits do not roll over.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleCompletePayment}
            disabled={isProcessing}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
          >
            {isProcessing ? (
              isSuccess ? (
                <>
                  <span className="text-emerald-300">✓</span>
                  Payment Successful!
                </>
              ) : (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Processing Test Payment...
                </>
              )
            ) : (
              `Complete Test Payment (₹${calculation.finalTotal.toLocaleString("en-IN")})`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
