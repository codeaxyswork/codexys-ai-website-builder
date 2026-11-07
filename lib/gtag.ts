/**
 * Google Analytics 4 (GA4) Integration for Codeaxys Marketing Website
 *
 * Requirements:
 * 1. Only active when NEXT_PUBLIC_GA_MEASUREMENT_ID is configured with a valid format ('G-XXXXXXXXXX').
 * 2. Applies exclusively to the public marketing website (codeaxys.com and apex marketing routes).
 * 3. Never tracks private routes (/dashboard, /admin, /api, /auth, /login, /signup).
 * 4. Never tracks tenant subdomains (*.codeaxys.com) or customer custom domains.
 * 5. Sanitizes URLs to remove sensitive PII query parameters.
 * 6. Prevents duplicate page_view events via strict tracking state.
 */

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

// Validate Measurement ID format: must start with 'G-' followed by alphanumeric characters
export function isValidMeasurementId(id: string | null | undefined): boolean {
  if (!id || typeof id !== "string") return false;
  return /^G-[A-Za-z0-9]+$/.test(id.trim());
}

// Public marketing paths eligible for marketing analytics
export const PUBLIC_MARKETING_PATHS = [
  "/",
  "/pricing",
  "/privacy-policy",
  "/features/ai-website-builder",
  "/features/visual-editor",
  "/features/website-migration",
  "/features/seo-autopilot",
  "/features/ai-search-visibility",
] as const;

export function isPublicMarketingPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const cleanPath = pathname.split("?")[0].split("#")[0];

  // Exact matches for public marketing pages
  if ((PUBLIC_MARKETING_PATHS as readonly string[]).includes(cleanPath)) {
    return true;
  }

  // Subpages of allowed public sections (e.g. /pricing/details, /features/*)
  if (
    cleanPath.startsWith("/pricing/") ||
    cleanPath.startsWith("/privacy-policy/") ||
    cleanPath.startsWith("/features/")
  ) {
    return true;
  }

  return false;
}

// Check whether the current browser hostname is the public marketing domain
export function isPublicMarketingHost(hostname?: string): boolean {
  const host = (
    hostname || (typeof window !== "undefined" ? window.location.hostname : "")
  )
    .toLowerCase()
    .trim();
  if (!host) return false;

  // Local development and preview testing hosts
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app")) {
    return true;
  }

  // Canonical apex domain and www subdomain
  if (host === "codeaxys.com" || host === "www.codeaxys.com") {
    return true;
  }

  // Any customer tenant subdomain (e.g. acme.codeaxys.com) is NOT the public marketing host
  if (host.endsWith(".codeaxys.com")) {
    return false;
  }

  // Any third-party custom domain is NOT the public marketing host
  return false;
}

// Sensitive query parameters that must be stripped to prevent PII leakage
export const SENSITIVE_QUERY_PARAMS = [
  "email",
  "user",
  "username",
  "name",
  "phone",
  "token",
  "access_token",
  "refresh_token",
  "code",
  "session",
  "key",
  "secret",
  "password",
  "state",
  "codeaxys_token",
] as const;

// Sanitize URL to ensure no PII is transmitted to Google Analytics
export function sanitizeAnalyticsUrl(path: string, search?: string): string {
  try {
    const rawSearch = search ? (search.startsWith("?") ? search : `?${search}`) : "";
    if (!rawSearch) return path;

    const params = new URLSearchParams(rawSearch);

    for (const param of SENSITIVE_QUERY_PARAMS) {
      if (params.has(param)) {
        params.delete(param);
      }
    }

    const cleanQuery = params.toString();
    return cleanQuery ? `${path}?${cleanQuery}` : path;
  } catch {
    return path;
  }
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (
      command: "js" | "config" | "event" | "consent",
      targetIdOrEventName: string | Date,
      optionsOrParams?: Record<string, unknown>
    ) => void;
  }
}

export function trackPageView(params: {
  measurementId: string;
  pagePath: string;
  pageLocation?: string;
  pageTitle?: string;
}): boolean {
  if (typeof window === "undefined") return false;
  if (!isValidMeasurementId(params.measurementId)) return false;

  // Initialize dataLayer and gtag queue if not yet initialized
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
  }

  window.gtag("event", "page_view", {
    send_to: params.measurementId,
    page_path: params.pagePath,
    page_location: params.pageLocation || window.location.href,
    page_title: params.pageTitle || document.title || "Codeaxys",
  });

  return true;
}
