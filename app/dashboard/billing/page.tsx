"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLANS, PlanConfig } from "@/lib/constants";
import { MockCheckoutModal } from "@/components/MockCheckoutModal";

export default function BillingDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [plan, setPlan] = useState<PlanConfig>(PLANS.free);
  const [usage, setUsage] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Modals & Statuses
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      // 1. Fetch Subscription & Usage
      const subRes = await fetch("/api/billing/subscription");
      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData.subscription || null);
        if (subData.plan) setPlan(subData.plan);
        if (subData.usage) setUsage(subData.usage);
      }

      // 2. Fetch Transactions History
      const transRes = await fetch("/api/billing/transactions");
      if (transRes.ok) {
        const transData = await transRes.json();
        setTransactions(transData.transactions || []);
      }
    } catch (err: any) {
      console.error("Failed to load billing dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCheckout = (planId: string) => {
    setSelectedPlanId(planId);
    setIsCheckoutOpen(true);
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel your subscription renewal?")) return;

    try {
      setIsCanceling(true);
      setErrorMessage(null);

      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel subscription.");
      }

      setStatusMessage(data.message);
      fetchBillingData();
    } catch (err: any) {
      console.error("Cancel Subscription Error:", err);
      setErrorMessage(err.message || "Failed to cancel subscription.");
    } finally {
      setIsCanceling(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return dateStr;
    }
  };

  const formatBytes = (bytes: number = 0) => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + " GB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-600 font-medium">
          <svg className="animate-spin h-5 w-5 text-purple-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading Billing & Subscription Dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-all"
            >
              ← Back to Dashboard
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Billing & Subscription</h1>
              <p className="text-xs text-slate-500">Manage plan subscription, usage limits, and payment history</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-semibold flex items-center gap-1.5">
              <span>🧪</span> Test Mode Enabled
            </span>
            <Link
              href="/pricing"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
            >
              View All Plans ↗
            </Link>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="font-bold hover:text-rose-900">
              ×
            </button>
          </div>
        )}

        {statusMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center justify-between">
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage(null)} className="font-bold hover:text-emerald-900">
              ×
            </button>
          </div>
        )}

        {/* 1. CURRENT SUBSCRIPTION OVERVIEW & USAGE GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Subscription Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Current Plan</span>
                  <h2 className="text-2xl font-extrabold text-slate-900 mt-1 flex items-center gap-2">
                    {plan.name} Plan
                    <span className="text-xs font-semibold px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full">
                      ₹{plan.price}/mo
                    </span>
                  </h2>
                </div>

                <div className="text-right">
                  {subscription?.cancel_at_period_end ? (
                    <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
                      Cancels at Period End
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                      Active
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600 mb-6">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Billing Provider:</span>
                  <strong className="font-mono text-slate-800 capitalize">{subscription?.billing_provider || "Mock"} (Test Mode)</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Current Period:</span>
                  <strong className="text-slate-800">
                    {formatDate(subscription?.current_period_start)} → {formatDate(subscription?.current_period_end)}
                  </strong>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Next Renewal:</span>
                  <strong className="text-slate-800">
                    {subscription?.cancel_at_period_end ? "None (Ending Soon)" : `${formatDate(subscription?.current_period_end)} (Test Mode)`}
                  </strong>
                </div>
              </div>
            </div>

            {/* Subscription Action Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 flex-wrap">
              {plan.id === "free" ? (
                <button
                  type="button"
                  onClick={() => handleOpenCheckout("pro")}
                  className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all"
                >
                  Upgrade to Pro (₹999)
                </button>
              ) : plan.id === "pro" ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenCheckout("agency")}
                    className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all"
                  >
                    Upgrade to Agency (₹2,999)
                  </button>
                  {!subscription?.cancel_at_period_end && (
                    <button
                      type="button"
                      onClick={handleCancelSubscription}
                      disabled={isCanceling}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-semibold text-xs rounded-lg transition-all"
                    >
                      {isCanceling ? "Canceling..." : "Cancel Subscription"}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenCheckout("pro")}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-all"
                  >
                    Change to Pro
                  </button>
                  {!subscription?.cancel_at_period_end && (
                    <button
                      type="button"
                      onClick={handleCancelSubscription}
                      disabled={isCanceling}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-semibold text-xs rounded-lg transition-all"
                    >
                      {isCanceling ? "Canceling..." : "Cancel Subscription"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Plan Usage Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 mb-5">
              Current Resource Usage & Quotas
            </h3>

            <div className="space-y-5">
              {/* AI Credits */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-semibold text-slate-700">AI Credits Balance</span>
                  <span className="font-bold text-purple-700">
                    {usage?.credits.balance || 0} / {plan.monthlyCredits}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(5, ((usage?.credits.balance || 0) / plan.monthlyCredits) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Saved Websites */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-semibold text-slate-700">Saved Websites</span>
                  <span className="font-bold text-slate-900">
                    {usage?.websites.used || 0} / {plan.maxWebsites}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-800 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(5, ((usage?.websites.used || 0) / plan.maxWebsites) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Media Storage */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-semibold text-slate-700">Media Storage Used</span>
                  <span className="font-bold text-slate-900">
                    {formatBytes(usage?.storage.usedBytes || 0)} / {plan.storageLimitFormatted}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(5, ((usage?.storage.usedBytes || 0) / plan.storageLimitBytes) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. PAYMENT & TRANSACTION HISTORY TABLE */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Payment & Transaction History</h3>
              <p className="text-xs text-slate-500">Log of all subscription upgrades, changes, and test transactions</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Total Transactions: {transactions.length}
            </span>
          </div>

          {transactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
              No transactions recorded yet. Upgrade your plan to trigger a mock test transaction.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="py-3 px-4 font-bold text-slate-700">Date</th>
                    <th className="py-3 px-4 font-bold text-slate-700">Plan</th>
                    <th className="py-3 px-4 font-bold text-slate-700">Amount</th>
                    <th className="py-3 px-4 font-bold text-slate-700">Provider</th>
                    <th className="py-3 px-4 font-bold text-slate-700">Status</th>
                    <th className="py-3 px-4 font-bold text-slate-700">Transaction ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 text-slate-900 font-medium">{formatDate(tx.created_at)}</td>
                      <td className="py-3 px-4 font-bold text-purple-700 uppercase">{tx.plan_id}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">₹{tx.amount}</td>
                      <td className="py-3 px-4 capitalize font-medium text-slate-600">{tx.provider} (Test)</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold">
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">{tx.provider_payment_id || tx.id.substring(0, 12)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Mock Checkout Modal */}
      {selectedPlanId && (
        <MockCheckoutModal
          planId={selectedPlanId}
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          onSuccess={() => {
            fetchBillingData();
          }}
        />
      )}
    </div>
  );
}
