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

    const siteKey = (propSiteKey || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "").trim();

    const handleSuccess = useCallback(
      (token: string) => {
        setStatus("success");
        setErrorMessage(null);
        onSuccess(token);
      },
      [onSuccess]
    );

    const handleExpire = useCallback(() => {
      setStatus("expired");
      if (onExpire) {
        onExpire();
      }
      // Automatically reset to obtain a fresh token
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
    }, [onExpire]);

    const handleError = useCallback(
      (code?: string) => {
        setStatus("error");
        const msg = code ? `Security verification error (${code})` : "Security verification failed";
        setErrorMessage(msg);
        if (onError) {
          onError(msg);
        }
      },
      [onError]
    );

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

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: handleSuccess,
          "expired-callback": handleExpire,
          "error-callback": handleError,
          theme,
          size,
          retry: "auto",
        });
        widgetIdRef.current = id;
        setStatus("ready");
      } catch (err: unknown) {
        console.error("[Turnstile] Render error:", err);
        setStatus("error");
        const msg = err instanceof Error ? err.message : "Failed to initialize security verification widget";
        setErrorMessage(msg);
        if (onError) onError(msg);
      }
    }, [siteKey, handleSuccess, handleExpire, handleError, theme, size, onError]);

    useEffect(() => {
      if (!siteKey) {
        setStatus("error");
        setErrorMessage("NEXT_PUBLIC_TURNSTILE_SITE_KEY is not configured.");
        return;
      }

      // Check if turnstile script already loaded
      if (window.turnstile) {
        renderWidget();
        return;
      }

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

      const checkInterval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(checkInterval);
          renderWidget();
        }
      }, 50);

      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.turnstile) {
          setStatus("error");
          const msg = "Security check script failed to load. Please check your network or ad blocker.";
          setErrorMessage(msg);
          if (onError) onError(msg);
        }
      }, 8000);

      return () => {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore
          }
        }
      };
    }, [siteKey, renderWidget, onError]);

    if (!siteKey) {
      return (
        <div className={`p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-center gap-2 ${className}`}>
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Security check configuration required (NEXT_PUBLIC_TURNSTILE_SITE_KEY).</span>
        </div>
      );
    }

    return (
      <div className={`flex flex-col items-center justify-center my-2 ${className}`}>
        {/* Container for Cloudflare Turnstile */}
        <div ref={containerRef} className="min-h-[65px] flex items-center justify-center" />

        {/* Loading placeholder when initializing */}
        {status === "loading" && (
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
