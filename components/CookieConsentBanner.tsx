"use client";

import React, { useState, useEffect, useSyncExternalStore, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Cookie,
  ShieldCheck,
  BarChart2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { isPublicMarketingPath, isPublicMarketingHost } from "@/lib/gtag";
import {
  getStoredConsent,
  saveConsent,
  subscribeToConsent,
} from "@/lib/cookie-consent";

const emptySubscribe = () => () => {};

export function CookieConsentBanner() {
  const pathname = usePathname();

  // Validate host safely across SSR and hydration
  const isAllowedHost = useSyncExternalStore(
    emptySubscribe,
    () => isPublicMarketingHost(),
    () => false
  );

  // Subscribe to consent state
  const consent = useSyncExternalStore(
    subscribeToConsent,
    () => getStoredConsent(),
    () => null
  );

  // Detect client mount safely across SSR and hydration
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [dismissed, setDismissed] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  // Listen to persistent footer "Cookie Settings" trigger
  useEffect(() => {
    const handleOpenPreferences = () => {
      const current = getStoredConsent();
      setAnalyticsEnabled(current?.analytics === true);
      setShowCustomize(true);
    };

    window.addEventListener("codeaxys_open_cookie_preferences", handleOpenPreferences);
    return () => {
      window.removeEventListener(
        "codeaxys_open_cookie_preferences",
        handleOpenPreferences
      );
    };
  }, []);

  // Handle ESC key to close customize modal if open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showCustomize) {
        setShowCustomize(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCustomize]);

  const handleAcceptAll = useCallback(() => {
    saveConsent({ analytics: true });
    setAnalyticsEnabled(true);
    setDismissed(true);
    setShowCustomize(false);
  }, []);

  const handleRejectAll = useCallback(() => {
    saveConsent({ analytics: false });
    setAnalyticsEnabled(false);
    setDismissed(true);
    setShowCustomize(false);
  }, []);

  const handleSavePreferences = useCallback(() => {
    saveConsent({ analytics: analyticsEnabled });
    setDismissed(true);
    setShowCustomize(false);
  }, [analyticsEnabled]);

  // Scope guard: only display on public marketing website and allowed hosts
  const isEligible = isAllowedHost && isPublicMarketingPath(pathname);

  // Banner should show only on client mount if consent has not been set (null) and not dismissed
  const showBanner = isClient && isEligible && consent === null && !dismissed;

  if (!isEligible) {
    return null;
  }

  // Do not render anything if banner is dismissed and customize modal is closed
  if (!showBanner && !showCustomize) {
    return null;
  }

  return (
    <>
      {/* 1. Main Bottom Consent Banner */}
      {showBanner && !showCustomize && (
        <aside
          role="dialog"
          aria-live="polite"
          aria-label="Cookie and Privacy Consent"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-lg z-[9999] bg-slate-950/95 border border-slate-800/90 rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-2xl text-slate-200 transition-all animate-in fade-in slide-in-from-bottom-5 duration-300"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
              <Cookie className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Cookie & Privacy Preferences
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-normal">
                We use essential cookies to maintain secure sessions and account functionality. With your permission, we also use optional analytics cookies to measure aggregated site traffic and optimize performance. Learn more in our{" "}
                <Link
                  href="/privacy-policy"
                  className="text-purple-400 underline hover:text-purple-300 transition-colors"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => {
                const current = getStoredConsent();
                setAnalyticsEnabled(current?.analytics === true);
                setShowCustomize(true);
              }}
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 py-1.5 sm:py-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-md"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Customize
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRejectAll}
                className="flex-1 sm:flex-initial px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
              >
                Reject All
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md shadow-purple-900/30 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
              >
                Accept All
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* 2. Customize Preferences Modal */}
      {showCustomize && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-preferences-title"
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    id="cookie-preferences-title"
                    className="text-base font-bold text-white tracking-tight"
                  >
                    Customize Cookie Preferences
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Control which optional cookies you allow on Codeaxys.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomize(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500"
                aria-label="Close cookie preferences dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* Category 1: Necessary Cookies */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">
                      Strictly Necessary Cookies
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Always Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
                  Required for essential platform operations, user session authentication, security checks, and reliable page routing. These cannot be disabled.
                </p>
              </div>

              {/* Category 2: Analytics Cookies */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-white">
                      Analytics Cookies (Google Analytics 4)
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={analyticsEnabled}
                      onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                      className="sr-only peer"
                      aria-label="Toggle Analytics Cookies"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
                  Helps us understand website traffic volume and page popularity in an aggregated, non-personally identifiable manner. No advertising profiles or cross-site tracking.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRejectAll}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all cursor-pointer text-center"
              >
                Reject All
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md shadow-purple-900/30 cursor-pointer text-center"
                >
                  Save Preferences
                </button>
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-all border border-slate-600 cursor-pointer text-center"
                >
                  Accept All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
