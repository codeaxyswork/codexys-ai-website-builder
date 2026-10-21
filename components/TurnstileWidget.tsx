"use client";

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from "react";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

export interface TurnstileWidgetRef {
  reset: () => void;
  remove: () => void;
}

export interface TurnstileWidgetProps {
  siteKey?: string;
  onSuccess: (token: string) => void;
  onExpire?: () => void;
  onError?: (error: string) => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: (errorCode?: string) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
          retry?: "auto" | "never";
          "retry-interval"?: number;
          "refresh-expired"?: "auto" | "manual" | "never";
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoaded?: () => void;
  }
}

const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(
  (
    {
      siteKey: propSiteKey,
      onSuccess,
      onExpire,
      onError,
      theme = "light",
      size = "normal",
      className = "",
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "success" | "expired" | "error">("loading");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Keep stable callback refs to avoid recreating the widget on parent callback identity changes
    const callbacksRef = useRef({ onSuccess, onExpire, onError });
    callbacksRef.current = { onSuccess, onExpire, onError };

    const siteKey = (propSiteKey || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "").trim();

    const handleSuccess = useCallback((token: string) => {
      setStatus("success");
      setErrorMessage(null);
      callbacksRef.current.onSuccess(token);
    }, []);

    const handleExpire = useCallback(() => {
      setStatus("expired");
      if (callbacksRef.current.onExpire) {
        callbacksRef.current.onExpire();
      }
      // Automatically reset to obtain a fresh token
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
    }, []);

    const handleError = useCallback((code?: string) => {
      setStatus("error");
      const msg = code ? `Security verification error (${code})` : "Security verification failed";
      setErrorMessage(msg);
      if (callbacksRef.current.onError) {
        callbacksRef.current.onError(msg);
      }
    }, []);

    const reset = useCallback(() => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
          setStatus("ready");
          setErrorMessage(null);
        } catch (e) {
          console.error("[Turnstile] Failed to reset widget:", e);
        }
      }
    }, []);

    const remove = useCallback(() => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch (e) {
          console.error("[Turnstile] Failed to remove widget:", e);
        }
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        reset,
        remove,
      }),
      [reset, remove]
    );

    // Render widget when turnstile API is available
    const renderWidget = useCallback(() => {
      if (!containerRef.current || !window.turnstile || !siteKey) return;

      // Clean up previous instance if any
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }

      // Ensure container element is clean before rendering to avoid duplicate iframes
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: handleSuccess,
          "expired-callback": handleExpire,
          "error-callback": handleError,
          theme,
          size,
          retry: "auto",
          "retry-interval": 8000,
          "refresh-expired": "auto",
        });
        widgetIdRef.current = id;
        setStatus("ready");
      } catch (err: unknown) {
        console.error("[Turnstile] Render error:", err);
        setStatus("error");
        const msg = err instanceof Error ? err.message : "Failed to initialize security verification widget";
        setErrorMessage(msg);
        if (callbacksRef.current.onError) {
          callbacksRef.current.onError(msg);
        }
      }
    }, [siteKey, handleSuccess, handleExpire, handleError, theme, size]);

    useEffect(() => {
      if (!siteKey) {
        setStatus("error");
        setErrorMessage("NEXT_PUBLIC_TURNSTILE_SITE_KEY is not configured.");
        return;
      }

      let checkInterval: NodeJS.Timeout | null = null;
      let timeout: NodeJS.Timeout | null = null;

      // Check if turnstile script already loaded
      if (window.turnstile) {
        renderWidget();
      } else {
        // Check if script tag is already in DOM
        let script = document.querySelector<HTMLScriptElement>(`script[src*="turnstile/v0/api.js"]`);
        if (!script) {
          script = document.createElement("script");
          script.src = TURNSTILE_SCRIPT_SRC;
          script.async = true;
          script.defer = true;
          script.id = "cloudflare-turnstile-script";
          document.head.appendChild(script);
        }

        checkInterval = setInterval(() => {
          if (window.turnstile) {
            if (checkInterval) clearInterval(checkInterval);
            renderWidget();
          }
        }, 50);

        timeout = setTimeout(() => {
          if (checkInterval) clearInterval(checkInterval);
          if (!window.turnstile) {
            setStatus("error");
            const msg = "Security check script failed to load. Please check your network or ad blocker.";
            setErrorMessage(msg);
            if (callbacksRef.current.onError) {
              callbacksRef.current.onError(msg);
            }
          }
        }, 8000);
      }

      return () => {
        if (checkInterval) clearInterval(checkInterval);
        if (timeout) clearTimeout(timeout);
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore
          }
          widgetIdRef.current = null;
        }
      };
    }, [siteKey, renderWidget]);

    if (!siteKey) {
      return (
        <div className={`p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-center gap-2 ${className}`}>
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Security check configuration required (NEXT_PUBLIC_TURNSTILE_SITE_KEY).</span>
        </div>
      );
    }

    return (
      <div className={`w-full flex flex-col items-center justify-center my-2 ${className}`}>
        {/* Container for Cloudflare Turnstile */}
        <div
          ref={containerRef}
          className="w-full flex items-center justify-center min-h-[65px] max-w-full overflow-hidden"
        />

        {/* Loading placeholder when initializing before widget renders */}
        {status === "loading" && !widgetIdRef.current && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            <span>Verifying security environment...</span>
          </div>
        )}

        {/* Error State with explicit Retry Button */}
        {status === "error" && (
          <div className="flex flex-col items-center gap-1.5 mt-1.5">
            <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage || "Security check failed"}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setStatus("loading");
                setErrorMessage(null);
                if (window.turnstile) {
                  renderWidget();
                } else {
                  window.location.reload();
                }
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:text-purple-700 underline"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry security check</span>
            </button>
          </div>
        )}

        {/* Expired status indicator */}
        {status === "expired" && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium mt-1">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Security check expired. Refreshing...</span>
          </div>
        )}
      </div>
    );
  }
);

TurnstileWidget.displayName = "TurnstileWidget";
