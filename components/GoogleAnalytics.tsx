"use client";

import { useEffect, useRef, useSyncExternalStore, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import {
  GA_MEASUREMENT_ID,
  isValidMeasurementId,
  isPublicMarketingPath,
  isPublicMarketingHost,
  sanitizeAnalyticsUrl,
  trackPageView,
} from "@/lib/gtag";
import {
  getStoredConsent,
  subscribeToConsent,
} from "@/lib/cookie-consent";

const emptySubscribe = () => () => {};

function GoogleAnalyticsClient({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedUrlRef = useRef<string | null>(null);

  // Validate the browser host safely across SSR and client hydration
  const isAllowedHost = useSyncExternalStore(
    emptySubscribe,
    () => isPublicMarketingHost(),
    () => false
  );

  // Subscribe to consent state (BASIC consent mode: disabled by default until explicit opt-in)
  const consent = useSyncExternalStore(
    subscribeToConsent,
    () => getStoredConsent(),
    () => null
  );
  const hasConsent = consent?.analytics === true;

  const isEligible = isAllowedHost && isPublicMarketingPath(pathname);

  // Monitor client-side route changes and dispatch page_view events ONLY when consent is granted
  useEffect(() => {
    if (!isAllowedHost || !hasConsent) {
      lastTrackedUrlRef.current = null;
      return;
    }

    // Do not track non-marketing routes (e.g. /dashboard, /admin, /login, /signup, /site/*)
    if (!isPublicMarketingPath(pathname)) {
      lastTrackedUrlRef.current = null;
      return;
    }

    const queryString = searchParams?.toString() || "";
    const currentUrl = sanitizeAnalyticsUrl(pathname, queryString);

    // Prevent duplicate page_view events for the exact same URL path
    if (lastTrackedUrlRef.current === currentUrl) {
      return;
    }

    lastTrackedUrlRef.current = currentUrl;

    // Allow Next.js microtasks to update document.title
    const timeoutId = setTimeout(() => {
      const sanitizedLocation =
        typeof window !== "undefined"
          ? `${window.location.origin}${currentUrl}`
          : currentUrl;

      trackPageView({
        measurementId,
        pagePath: currentUrl,
        pageLocation: sanitizedLocation,
        pageTitle: document.title || "Codeaxys",
      });
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [pathname, searchParams, isAllowedHost, hasConsent, measurementId]);

  // Inject tracking scripts only on verified public marketing routes and hosts
  if (!isEligible) {
    return null;
  }

  return (
    <>
      {/* 1. Google Consent Mode v2 Default Setup (analytics_storage denied by default) */}
      <Script
        id="ga4-consent-default"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('consent', 'default', {
              'analytics_storage': 'denied',
              'ad_storage': 'denied',
              'ad_user_data': 'denied',
              'ad_personalization': 'denied',
              'functionality_storage': 'granted',
              'security_storage': 'granted'
            });
          `,
        }}
      />

      {/* 2. Load GA4 Library & Config ONLY after explicit analytics consent (BASIC Consent Mode) */}
      {hasConsent && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('consent', 'update', {
                  'analytics_storage': 'granted'
                });
                gtag('js', new Date());
                gtag('config', '${measurementId}', {
                  send_page_view: false
                });
              `,
            }}
          />
        </>
      )}
    </>
  );
}

export function GoogleAnalytics() {
  const measurementId = GA_MEASUREMENT_ID;

  if (!isValidMeasurementId(measurementId)) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <GoogleAnalyticsClient measurementId={measurementId} />
    </Suspense>
  );
}
