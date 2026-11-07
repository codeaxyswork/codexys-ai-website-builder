/**
 * Cookie Consent Manager for Codeaxys Marketing Website
 *
 * Implements privacy-first consent management compatible with:
 * - EU/UK GDPR & ePrivacy Directive
 * - Google Consent Mode v2 (BASIC consent mode)
 * - India DPDP Act 2023 & global privacy standards
 *
 * Invariants:
 * 1. Default consent state: analytics_storage DENIED.
 * 2. Necessary cookies are always enabled for security and core functionality.
 * 3. Analytics cookies are strictly disabled until explicit opt-in.
 * 4. Stored in localStorage with 180-day expiry (re-prompting thereafter).
 * 5. Supports instant preference withdrawal and cookie purging.
 */

export const CONSENT_STORAGE_KEY = "codeaxys_cookie_consent";
export const CONSENT_EXPIRY_DAYS = 180;
export const CONSENT_EXPIRY_MS = CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

export interface CookieConsentPreferences {
  version: number;
  necessary: true;
  analytics: boolean;
  timestamp: number;
  expiresAt: number;
}

let cachedConsent: CookieConsentPreferences | null = null;
let cachedRaw: string | null = null;

/**
 * Retrieve verified, unexpired consent preferences from browser storage
 * Uses referential snapshot caching for React useSyncExternalStore compatibility.
 */
export function getStoredConsent(): CookieConsentPreferences | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) {
      cachedConsent = null;
      cachedRaw = null;
      return null;
    }

    // Fast-path: return cached reference if localStorage raw string has not changed
    if (raw === cachedRaw && cachedConsent !== null) {
      if (Date.now() > cachedConsent.expiresAt) {
        window.localStorage.removeItem(CONSENT_STORAGE_KEY);
        cachedConsent = null;
        cachedRaw = null;
        return null;
      }
      return cachedConsent;
    }

    const parsed = JSON.parse(raw) as CookieConsentPreferences;

    // Validate structural schema
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.necessary !== true ||
      typeof parsed.analytics !== "boolean" ||
      typeof parsed.expiresAt !== "number"
    ) {
      window.localStorage.removeItem(CONSENT_STORAGE_KEY);
      cachedConsent = null;
      cachedRaw = null;
      return null;
    }

    // Check expiry
    if (Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(CONSENT_STORAGE_KEY);
      cachedConsent = null;
      cachedRaw = null;
      return null;
    }

    cachedConsent = parsed;
    cachedRaw = raw;
    return cachedConsent;
  } catch {
    cachedConsent = null;
    cachedRaw = null;
    return null;
  }
}

/**
 * Save user consent preferences and update Google Consent Mode v2
 */
export function saveConsent(preferences: { analytics: boolean }): CookieConsentPreferences {
  const now = Date.now();
  const consent: CookieConsentPreferences = {
    version: 1,
    necessary: true,
    analytics: preferences.analytics,
    timestamp: now,
    expiresAt: now + CONSENT_EXPIRY_MS,
  };

  if (typeof window !== "undefined" && window.localStorage) {
    const serialized = JSON.stringify(consent);
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, serialized);
      cachedConsent = consent;
      cachedRaw = serialized;
    } catch {
      // Graceful fallback for strict storage quotas or private browsing modes
    }

    // Update Google Consent Mode v2
    updateGtagConsent(preferences.analytics);

    // If analytics is rejected or withdrawn, clear all GA4 client cookies
    if (!preferences.analytics) {
      clearAnalyticsCookies();
    }

    // Notify active React components
    window.dispatchEvent(
      new CustomEvent("codeaxys_consent_change", { detail: consent })
    );
  }

  return consent;
}

/**
 * Update Google Consent Mode v2 state via gtag
 */
export function updateGtagConsent(analyticsGranted: boolean): void {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
  }

  window.gtag("consent", "update", {
    analytics_storage: analyticsGranted ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

/**
 * Purge Google Analytics client cookies (_ga, _ga_*, _gid, _gat)
 */
export function clearAnalyticsCookies(): void {
  if (typeof document === "undefined") return;

  const hostname = window.location.hostname;
  const domainParts = hostname.split(".");
  const domainsToTry = ["", `.${hostname}`];

  if (domainParts.length >= 2) {
    const apex = domainParts.slice(-2).join(".");
    domainsToTry.push(`.${apex}`);
  }

  const allCookies = document.cookie.split(";").map((c) => c.trim().split("=")[0]);
  for (const name of allCookies) {
    if (
      name === "_ga" ||
      name.startsWith("_ga_") ||
      name === "_gid" ||
      name === "_gat"
    ) {
      for (const domain of domainsToTry) {
        const domainAttr = domain ? `; domain=${domain}` : "";
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT${domainAttr}`;
      }
    }
  }
}

/**
 * Subscribe to consent preference changes (compatible with useSyncExternalStore)
 */
export function subscribeToConsent(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("codeaxys_consent_change", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("codeaxys_consent_change", callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * Reopen the cookie preferences customize dialog
 */
export function triggerOpenCookiePreferences(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("codeaxys_open_cookie_preferences"));
  }
}
