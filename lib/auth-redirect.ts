/**
 * Centralized Authentication & Template Context Redirection Engine
 *
 * Provides safe validation for template identifiers and internal redirects,
 * preventing open redirects and ensuring template context is strictly preserved
 * across login, signup, email confirmation, and OAuth callbacks.
 */

export const VALID_TEMPLATE_IDS = [
  "accounting-firm",
  "architecture",
  "beauty-salon",
  "creative-agency",
  "digital-marketing-agency",
  "financial-services-and-bank",
  "hotel",
  "it-company",
  "interior-design",
  "jewellery",
  "ngo",
  "restaurant",
  "solar-company",
  "spa-and-wellness",
  "travel-tourism",
  "dancer",
  "fitness",
  "insurance",
  "photography",
  "yoga",
] as const;

export type ValidTemplateId = (typeof VALID_TEMPLATE_IDS)[number];

const VALID_SET = new Set<string>(VALID_TEMPLATE_IDS);

/**
 * Validates if a template ID is one of the 20 approved templates.
 */
export function isValidTemplateId(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return VALID_SET.has(id.trim().toLowerCase());
}

/**
 * Validates that a redirect path is a safe internal relative path.
 * Rejects external URLs, protocol-relative URLs (//), backslash tricks, and javascript:.
 */
export function isSafeInternalRedirect(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();

  // Must start with single slash
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return false;
  }

  // Must not contain protocol schemes
  if (trimmed.includes("://") || trimmed.toLowerCase().startsWith("/javascript:")) {
    return false;
  }

  return true;
}

/**
 * Resolves post-auth redirection destination on the client side.
 * Checks URL parameters, pending template in sessionStorage, pending prompt, and safe next/redirect params.
 */
export function getClientPostAuthRedirect(searchParams?: URLSearchParams): string {
  if (typeof window === "undefined") return "/dashboard";

  // 1. Direct template query param in current URL
  const urlTemplate = searchParams?.get("template") || new URLSearchParams(window.location.search).get("template");
  if (urlTemplate && isValidTemplateId(urlTemplate)) {
    try {
      sessionStorage.removeItem("pending_template");
    } catch {}
    return `/?template=${encodeURIComponent(urlTemplate.trim().toLowerCase())}`;
  }

  // 2. Pending template in sessionStorage
  try {
    const sessionTemplate = sessionStorage.getItem("pending_template");
    if (sessionTemplate && isValidTemplateId(sessionTemplate)) {
      sessionStorage.removeItem("pending_template");
      return `/?template=${encodeURIComponent(sessionTemplate.trim().toLowerCase())}`;
    }
  } catch {}

  // 3. Pending prompt in sessionStorage
  try {
    const pendingPrompt = sessionStorage.getItem("pending_prompt");
    if (pendingPrompt && pendingPrompt.trim()) {
      return "/";
    }
  } catch {}

  // 4. Safe next / redirect parameter
  const nextParam =
    searchParams?.get("next") ||
    searchParams?.get("redirect") ||
    new URLSearchParams(window.location.search).get("redirect");

  if (nextParam && isSafeInternalRedirect(nextParam)) {
    return nextParam.trim();
  }

  // 5. Default fallback
  return "/dashboard";
}

/**
 * Resolves post-auth destination on the server side (e.g. inside middleware or route handlers).
 */
export function resolveServerPostAuthRedirect(params: {
  templateParam?: string | null;
  nextParam?: string | null;
}): string {
  if (params.templateParam && isValidTemplateId(params.templateParam)) {
    return `/?template=${encodeURIComponent(params.templateParam.trim().toLowerCase())}`;
  }

  if (params.nextParam && isSafeInternalRedirect(params.nextParam)) {
    return params.nextParam.trim();
  }

  return "/dashboard";
}

