"use client";

import React, { useState } from "react";
import { PLANS, PlanConfig } from "@/lib/constants";

interface MockCheckoutModalProps {
  planId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedSub: any) => void;
}

export function MockCheckoutModal({
  planId,
  isOpen,
  onClose,
  onSuccess,
}: MockCheckoutModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const plan: PlanConfig = PLANS[planId] || PLANS.pro;

  const handleCompletePayment = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Mock payment simulation failed.");
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsProcessing(false);
        onSuccess(data);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Mock Checkout Error:", err);
      setErrorMessage(err.message || "Test payment failed.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-purple-50/40">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-700 block">
              Mock Billing Checkout
            </span>
            <h3 className="text-lg font-bold text-slate-900">
              Upgrade to {plan.name} Plan
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all text-xl"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Test Mode Disclaimer Banner */}
          <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs flex items-center gap-2.5">
            <span className="text-base">🧪</span>
            <div>
              <strong className="font-bold">MOCK BILLING MODE:</strong> No real money or credit card will be charged. This simulates a instant subscription upgrade for testing.
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Pricing Summary Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-medium">Selected Plan</span>
              <h4 className="text-base font-bold text-slate-900">{plan.name} Subscription</h4>
            </div>
            <div className="text-right">
              <span className="text-2xl font-extrabold text-slate-900">
                ₹{plan.price.toLocaleString("en-IN")}
              </span>
              <span className="text-xs text-slate-500 font-medium block">/ month</span>
            </div>
          </div>

          {/* Included Features */}
          <div>
            <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Plan Features Included:
            </h5>
            <ul className="space-y-2">
              {plan.features.map((feat, idx) => (
                <li key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold transition-all"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleCompletePayment}
            disabled={isProcessing}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
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
              `Complete Test Payment (₹${plan.price})`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
