export interface WebsiteUrlInput {
  slug?: string | null;
  published_slug?: string | null;
  custom_domain?: string | null;
  is_published?: boolean | null;
}

export interface GetPublicUrlOptions {
  /** Optional origin passed from client-side window.location.origin */
  origin?: string | null;
  /** Force local path format e.g. /site/{slug} only when explicitly testing on localhost */
  forceLocalPath?: boolean;
  /** Append subpath e.g. /blog/my-post */
  subpath?: string;
}

export function getWebsitePublicUrl(
  website: WebsiteUrlInput | null | undefined,
  options?: GetPublicUrlOptions
): string {
  if (!website) return "";

  // 1. Custom Domain takes priority
  if (website.custom_domain && website.custom_domain.trim().length > 0) {
    const cleanCustom = website.custom_domain.trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
    const baseCustomUrl = `https://${cleanCustom}`;
    if (options?.subpath) {
      const cleanSubpath = options.subpath.startsWith("/") ? options.subpath : `/${options.subpath}`;
      return `${baseCustomUrl}${cleanSubpath}`;
    }
    return baseCustomUrl;
  }

  // 2. Codeaxys Subdomain vs Local Dev Route
  const activeSlug = (website.published_slug || website.slug || "").trim().toLowerCase();
  if (!activeSlug) return "";

  const appDomainRaw = (
    process.env.NEXT_PUBLIC_APP_DOMAIN ||
    process.env.APP_DOMAIN ||
    "codeaxys.com"
  ).trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");

  // Deterministic local dev mode check evaluated identically on both server & client
  const origin = options?.origin || "";
  const isDevMode =
    options?.forceLocalPath ||
    process.env.NODE_ENV !== "production" ||
    appDomainRaw.includes("localhost") ||
    appDomainRaw.includes("127.0.0.1") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1");

  let baseUrl = "";
  if (isDevMode) {
    const localHost = (origin && (origin.includes("localhost") || origin.includes("127.0.0.1")))
      ? origin.replace(/^https?:\/\//i, "").replace(/\/.*$/, "")
      : appDomainRaw.includes("localhost")
      ? appDomainRaw
      : "localhost:3000";
    baseUrl = `http://${localHost}/site/${activeSlug}`;
  } else {
    const baseDomain = (appDomainRaw && !appDomainRaw.includes("localhost") && !appDomainRaw.includes("vercel.app"))
      ? appDomainRaw
      : "codeaxys.com";
    baseUrl = `https://${activeSlug}.${baseDomain}`;
  }

  if (options?.subpath) {
    const cleanSubpath = options.subpath.startsWith("/") ? options.subpath : `/${options.subpath}`;
    return `${baseUrl}${cleanSubpath}`;
  }

  return baseUrl;
}
