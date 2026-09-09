"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLANS, PlanConfig } from "@/lib/constants";
import { MockCheckoutModal } from "@/components/MockCheckoutModal";

export default function PricingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string>("free");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Header Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white font-extrabold text-lg">
              C
            </div>
            <span className="font-bold text-lg text-slate-900 tracking-tight">Codexys AI</span>
          </Link>

          <nav className="flex items-center gap-6 text-sm font-semibold text-slate-600">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
            </Link>
            <Link href="/pricing" className="text-purple-600 font-bold">
              Pricing
            </Link>
            {user ? (
              <>
                <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/billing"
                  className="px-3.5 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-all text-xs"
                >
                  My Billing
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:text-slate-900 transition-colors">
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all text-xs shadow-xs"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full">
        {/* Test Mode Banner */}
        <div className="max-w-3xl mx-auto mb-10 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center gap-3 text-amber-900 text-xs font-semibold text-center shadow-xs">
          <span className="text-base">🧪</span>
          <span>
            <strong>TEST BILLING MODE ACTIVE:</strong> No real payments are processed. Upgrades use instant mock transaction simulation.
          </span>
        </div>

        {/* Hero Headline */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold uppercase tracking-wider inline-block mb-3">
            Flexible Subscription Pricing
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Build Stunning AI Websites at any Scale
          </h1>
          <p className="text-base text-slate-600 mt-4 leading-relaxed">
            Choose the plan that fits your business needs. Upgrade or downgrade anytime with instant mock checkout.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20 items-stretch">
          {Object.values(PLANS).map((plan) => {
            const isCurrent = currentPlanId === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative bg-white border rounded-2xl p-8 flex flex-col justify-between transition-all ${
                  plan.popular
                    ? "border-purple-500 shadow-xl ring-2 ring-purple-500/20"
                    : "border-slate-200 shadow-sm hover:shadow-md"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-purple-600 text-white text-[11px] font-extrabold uppercase tracking-widest rounded-full shadow-sm">
                    Most Popular
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-4 mb-6">
                    <span className="text-4xl font-extrabold text-slate-900">
                      ₹{plan.price.toLocaleString("en-IN")}
                    </span>
                    <span className="text-sm font-semibold text-slate-500">/ month</span>
                  </div>

                  <ul className="space-y-3 border-t border-slate-100 pt-6 mb-8">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                        <span className="text-purple-600 font-bold text-sm">✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => handlePlanClick(plan.id)}
                  disabled={isCurrent}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all shadow-xs ${
                    isCurrent
                      ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      : plan.popular
                      ? "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-200 active:scale-95"
                      : "bg-slate-900 hover:bg-slate-800 text-white active:scale-95"
                  }`}
                >
                  {isCurrent ? "Current Active Plan" : plan.price === 0 ? "Get Started Free" : `Upgrade to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Matrix */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
            Comprehensive Feature Comparison
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-4 px-4 font-bold text-slate-900 text-sm">Feature</th>
                  <th className="py-4 px-4 font-bold text-slate-900 text-center text-sm">Free</th>
                  <th className="py-4 px-4 font-bold text-purple-700 text-center text-sm">Pro (₹999)</th>
                  <th className="py-4 px-4 font-bold text-slate-900 text-center text-sm">Agency (₹2,999)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="py-3.5 px-4 font-semibold">Monthly AI Credits</td>
                  <td className="py-3.5 px-4 text-center font-bold">50</td>
                  <td className="py-3.5 px-4 text-center font-bold text-purple-700">500</td>
                  <td className="py-3.5 px-4 text-center font-bold">2,000</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold">Website Limit</td>
                  <td className="py-3.5 px-4 text-center font-bold">1 Site</td>
                  <td className="py-3.5 px-4 text-center font-bold text-purple-700">10 Sites</td>
                  <td className="py-3.5 px-4 text-center font-bold">50 Sites</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold">Storage Quota</td>
                  <td className="py-3.5 px-4 text-center">100 MB</td>
                  <td className="py-3.5 px-4 text-center text-purple-700 font-medium">5 GB</td>
                  <td className="py-3.5 px-4 text-center font-medium">20 GB</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold">Basic SEO & Meta Directives</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold">AI SEO Generator (Gemini)</td>
                  <td className="py-3.5 px-4 text-center text-slate-300">✕</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold">Structured JSON-LD Schema</td>
                  <td className="py-3.5 px-4 text-center text-slate-300">✕</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold">Google Analytics (GA4) & GTM</td>
                  <td className="py-3.5 px-4 text-center text-slate-300">✕</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold">Custom Domain Connection</td>
                  <td className="py-3.5 px-4 text-center text-slate-300">✕</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold">SEMrush Integration Architecture</td>
                  <td className="py-3.5 px-4 text-center text-slate-300">✕</td>
                  <td className="py-3.5 px-4 text-center text-slate-300">✕</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold">Ahrefs Integration Architecture</td>
                  <td className="py-3.5 px-4 text-center text-slate-300">✕</td>
                  <td className="py-3.5 px-4 text-center text-slate-300">✕</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold">Google Search Console Integration</td>
                  <td className="py-3.5 px-4 text-center text-slate-300">✕</td>
                  <td className="py-3.5 px-4 text-center text-slate-300">✕</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        © 2026 Codexys AI Inc. All rights reserved.
      </footer>

      {/* Mock Checkout Modal */}
      {selectedPlanId && (
        <MockCheckoutModal
          planId={selectedPlanId}
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </div>
  );
}
