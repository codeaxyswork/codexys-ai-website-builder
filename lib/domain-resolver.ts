export interface WebsiteUrlInput {
  slug?: string | null;
  published_slug?: string | null;
  custom_domain?: string | null;
  custom_domain_verified?: boolean | null;
  custom_domain_status?: string | null;
  is_published?: boolean | null;
}

export interface GetPublicUrlOptions {
  /** Optional origin passed from client-side window.location.origin */
  origin?: string | null;
  /** Force local path format e.g. /site/{slug} only when explicitly testing on localhost */
  forceLocalPath?: boolean;
  /** Force using custom_domain even if unverified (e.g. for previewing custom domain target) */
  forceCustomDomain?: boolean;
  /** Append subpath e.g. /blog/my-post */
  subpath?: string;
  /** Control whether root homepage has trailing slash (default: true -> "https://slug.codeaxys.com/") */
  trailingSlash?: boolean;
}

export interface NormalizedDomainResult {
  isValid: boolean;
  error?: string;
  rawInput: string;
  canonicalDomain: string; // The primary apex hostname (e.g. "example.com")
  apexDomain: string;      // "example.com"
  wwwDomain: string;       // "www.example.com"
  hasWww: boolean;
  isSubdomain: boolean;
}

/**
 * Normalizes any URL path, internal route, or slug into a standard clean public website path.
 *
 * Requirements:
 * - Empty, "/", "", "/index", "index.html", "/site/{slug}" -> "/"
 * - Internal pages: "/about-us", "/services", "/blog/example-post"
 * - Normalizes leading slashes, trailing slashes, duplicate slashes
 * - Preserves query parameters and hash fragments (e.g. "/about-us?preview=true#team")
 */
export function normalizePagePath(rawPath?: string | null): string {
  if (!rawPath || typeof rawPath !== "string") {
    return "/";
  }

  let str = rawPath.trim();
  if (!str || str === "/") {
    return "/";
  }

  // Separate query parameters and hash fragments
  let extra = "";
  const qIdx = str.indexOf("?");
  const hIdx = str.indexOf("#");
  if (qIdx !== -1 || hIdx !== -1) {
    const splitIdx = qIdx !== -1 && hIdx !== -1 ? Math.min(qIdx, hIdx) : qIdx !== -1 ? qIdx : hIdx;
    extra = str.substring(splitIdx);
    str = str.substring(0, splitIdx);
  }

  // Strip internal Next.js /site/{slug}/ prefix if present
  if (str.includes("/site/")) {
    const siteIdx = str.indexOf("/site/");
    const afterSite = str.substring(siteIdx + 6);
    const parts = afterSite.split("/").filter(Boolean);
    if (parts.length > 1) {
      parts.shift(); // remove website slug
      str = "/" + parts.join("/");
    } else {
      str = "/";
    }
  }

  // Remove duplicate slashes
  str = str.replace(/\/+/g, "/");

  // Remove leading and trailing slashes for clean evaluation
  str = str.replace(/^\/+|\/+$/g, "");

  // Remove .html or .htm extensions
  if (str.endsWith(".html")) {
    str = str.slice(0, -5);
  } else if (str.endsWith(".htm")) {
    str = str.slice(0, -4);
  }

  // Decode URI component safely
  try {
    str = decodeURIComponent(str);
  } catch {}

  const lower = str.toLowerCase();
  if (!str || lower === "index" || lower === "home" || lower === "default") {
    return extra ? `/${extra}` : "/";
  }

  return `/${str}${extra}`;
}

/**
 * Universal canonical public URL resolver for Codeaxys websites.
 * Single source of truth across AI-generated, migrated, and existing websites.
 *
 * Canonical Public URLs:
 * - Homepage: https://{slug}.codeaxys.com/
 * - Subpages: https://{slug}.codeaxys.com/{path}
 * - Custom domain homepage: https://{custom-domain}/
 * - Custom domain subpages: https://{custom-domain}/{path}
 */
export function getWebsitePublicUrl(
  website: WebsiteUrlInput | null | undefined,
  options?: GetPublicUrlOptions
): string {
  if (!website) return "";

  const trailingSlash = options?.trailingSlash !== false;

  // 1. Custom Domain takes priority IF verified/ready or forceCustomDomain is enabled
  const hasCustomDomain = Boolean(website.custom_domain && website.custom_domain.trim().length > 0);
  const isCustomDomainReady =
    hasCustomDomain &&
    (options?.forceCustomDomain ||
      website.custom_domain_verified === true ||
      website.custom_domain_status === "ready" ||
      website.custom_domain_status === "verified" ||
      (website.custom_domain_verified === undefined && website.custom_domain_status === undefined));

  if (hasCustomDomain && isCustomDomainReady) {
    const cleanCustom = website.custom_domain!.trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
    const baseCustomUrl = `https://${cleanCustom}`;

    if (options?.subpath) {
      const normPath = normalizePagePath(options.subpath);
      if (normPath === "/") {
        return trailingSlash ? `${baseCustomUrl}/` : baseCustomUrl;
      }
      if (normPath.startsWith("/?") || normPath.startsWith("/#")) {
        return `${baseCustomUrl}/${normPath.slice(1)}`;
      }
      return `${baseCustomUrl}${normPath}`;
    }

    return trailingSlash ? `${baseCustomUrl}/` : baseCustomUrl;
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
    options?.forceLocalPath === true ||
    (Boolean(origin) && (origin.includes("localhost") || origin.includes("127.0.0.1"))) ||
    appDomainRaw.includes("localhost") ||
    appDomainRaw.includes("127.0.0.1");

  if (isDevMode) {
    const localHost = (origin && (origin.includes("localhost") || origin.includes("127.0.0.1")))
      ? origin.replace(/^https?:\/\//i, "").replace(/\/.*$/, "")
      : appDomainRaw.includes("localhost")
      ? appDomainRaw
      : "localhost:3000";
    const baseDev = `http://${localHost}/site/${activeSlug}`;

    if (options?.subpath) {
      const normPath = normalizePagePath(options.subpath);
      if (normPath === "/") {
        return `${baseDev}/`;
      }
      return `${baseDev}${normPath}`;
    }

    return trailingSlash ? `${baseDev}/` : baseDev;
  }

  const baseDomain = (appDomainRaw && !appDomainRaw.includes("localhost") && !appDomainRaw.includes("vercel.app"))
    ? appDomainRaw
    : "codeaxys.com";

  const baseSubdomainUrl = `https://${activeSlug}.${baseDomain}`;

  if (options?.subpath) {
    const normPath = normalizePagePath(options.subpath);
    if (normPath === "/") {
      return trailingSlash ? `${baseSubdomainUrl}/` : baseSubdomainUrl;
    }
    if (normPath.startsWith("/?") || normPath.startsWith("/#")) {
      return `${baseSubdomainUrl}/${normPath.slice(1)}`;
    }
    return `${baseSubdomainUrl}${normPath}`;
  }

  return trailingSlash ? `${baseSubdomainUrl}/` : baseSubdomainUrl;
}

/**
 * Universal canonical page URL resolver.
 * Homepage: https://{slug}.codeaxys.com/
 * Subpages: https://{slug}.codeaxys.com/{normalizedPath}
 */
export function getWebsitePageUrl(
  website: WebsiteUrlInput | null | undefined,
  pagePath?: string | null,
  options?: GetPublicUrlOptions
): string {
  if (!website) return "";
  const norm = normalizePagePath(pagePath);
  return getWebsitePublicUrl(website, {
    ...options,
    subpath: norm,
  });
}

/**
 * Returns the draft preview URL for a website (adds ?preview=true when unpublished).
 * Exposes clean public URL with ?preview=true, NEVER leaking /site/{slug}.
 */
export function getWebsitePreviewUrl(
  website: WebsiteUrlInput | null | undefined,
  options?: GetPublicUrlOptions
): string {
  if (!website) return "";
  const base = getWebsitePublicUrl(website, options);
  if (!base) return "";

  if (website.is_published) return base;

  if (base.includes("?")) {
    return base.includes("preview=") ? base : `${base}&preview=true`;
  }
  return base.endsWith("/") ? `${base}?preview=true` : `${base}?preview=true`;
}

/**
 * Returns the canonical production subdomain URL for a published website.
 */
export function getWebsiteProductionUrl(
  website: WebsiteUrlInput | null | undefined,
  options?: GetPublicUrlOptions
): string {
  return getWebsitePublicUrl(website, options);
}

/**
 * Normalizes user-entered domain inputs into canonical, validated domain hostnames.
 * Accepts:
 *   example.com
 *   www.example.com
 *   https://example.com
 *   https://www.example.com/
 *   http://example.com
 *   https://www.Example.com/about?q=1#hash
 *   my-company.com
 */
export function normalizeCustomDomainInput(input: string): NormalizedDomainResult {
  if (!input || typeof input !== "string") {
    return {
      isValid: false,
      error: "Domain name cannot be empty.",
      rawInput: input || "",
      canonicalDomain: "",
      apexDomain: "",
      wwwDomain: "",
      hasWww: false,
      isSubdomain: false,
    };
  }

  let raw = input.trim().toLowerCase();
  // 1. Remove protocol (https://, http://, //)
  raw = raw.replace(/^(https?:\/\/|\/\/)/i, "");
  // 2. Remove path, query string, hash fragment
  raw = raw.replace(/[\/\?#].*$/, "");
  // 3. Remove port numbers
  raw = raw.replace(/:\d+$/, "");
  // 4. Remove leading/trailing dots and whitespace
  raw = raw.replace(/^\.+|\.+$/g, "");

  if (!raw) {
    return {
      isValid: false,
      error: "Please enter a valid domain name.",
      rawInput: input,
      canonicalDomain: "",
      apexDomain: "",
      wwwDomain: "",
      hasWww: false,
      isSubdomain: false,
    };
  }

  if (raw.length > 253) {
    return {
      isValid: false,
      error: "Domain name exceeds maximum allowed length of 253 characters.",
      rawInput: input,
      canonicalDomain: "",
      apexDomain: "",
      wwwDomain: "",
      hasWww: false,
      isSubdomain: false,
    };
  }

  // Reject IP addresses
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(raw)) {
    return {
      isValid: false,
      error: "IP addresses are not supported. Please use a domain name (e.g., example.com).",
      rawInput: input,
      canonicalDomain: "",
      apexDomain: "",
      wwwDomain: "",
      hasWww: false,
      isSubdomain: false,
    };
  }

  // Reject platform domains
  if (
    raw === "codeaxys.com" ||
    raw.endsWith(".codeaxys.com") ||
    raw.endsWith(".vercel.app") ||
    raw === "localhost" ||
    raw.endsWith(".localhost")
  ) {
    return {
      isValid: false,
      error: "Cannot use platform or Vercel system domains as a custom domain.",
      rawInput: input,
      canonicalDomain: "",
      apexDomain: "",
      wwwDomain: "",
      hasWww: false,
      isSubdomain: false,
    };
  }

  const parts = raw.split(".");
  if (parts.length < 2) {
    return {
      isValid: false,
      error: "Domain must include a valid top-level domain (e.g., .com, .org, .in).",
      rawInput: input,
      canonicalDomain: "",
      apexDomain: "",
      wwwDomain: "",
      hasWww: false,
      isSubdomain: false,
    };
  }

  // Validate individual labels
  for (const part of parts) {
    if (!part || part.length > 63) {
      return {
        isValid: false,
        error: "Domain contains invalid label length (labels must be 1-63 characters).",
        rawInput: input,
        canonicalDomain: "",
        apexDomain: "",
        wwwDomain: "",
        hasWww: false,
        isSubdomain: false,
      };
    }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(part)) {
      return {
        isValid: false,
        error: "Domain labels may only contain alphanumeric characters and non-consecutive hyphens.",
        rawInput: input,
        canonicalDomain: "",
        apexDomain: "",
        wwwDomain: "",
        hasWww: false,
        isSubdomain: false,
      };
    }
  }

  const tld = parts[parts.length - 1];
  if (tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return {
      isValid: false,
      error: "Top-level domain must be at least 2 alphabetic characters.",
      rawInput: input,
      canonicalDomain: "",
      apexDomain: "",
      wwwDomain: "",
      hasWww: false,
      isSubdomain: false,
    };
  }

  const hasWww = parts[0] === "www";
  let apexDomain = raw;

  if (hasWww) {
    apexDomain = parts.slice(1).join(".");
  } else {
    // Check for multi-part ccTLDs (e.g. .co.uk, .com.au, .gov.in)
    const isTwoPart =
      parts.length >= 3 &&
      parts[parts.length - 1].length === 2 &&
      TWO_PART_TLD_PREFIXES.has(parts[parts.length - 2]);

    if (isTwoPart && parts.length === 3) {
      apexDomain = raw;
    } else if (isTwoPart && parts.length > 3) {
      apexDomain = parts.slice(-3).join(".");
    } else if (!isTwoPart && parts.length > 2) {
      apexDomain = parts.slice(-2).join(".");
    }
  }

  const wwwDomain = `www.${apexDomain}`;
  const isSubdomain = hasWww || parts.length > (parts[parts.length - 1].length === 2 && TWO_PART_TLD_PREFIXES.has(parts[parts.length - 2]) ? 3 : 2);

  return {
    isValid: true,
    rawInput: input,
    canonicalDomain: apexDomain,
    apexDomain,
    wwwDomain,
    hasWww,
    isSubdomain,
  };
}


/**
 * Returns the canonical subdomain hostname for a website (e.g. "example.codeaxys.com").
 */
export function getWebsiteSubdomainHostname(
  website: WebsiteUrlInput | string | null | undefined
): string {
  if (!website) return "";
  const activeSlug = typeof website === "string"
    ? deriveCanonicalDomainSlug(website)
    : (website.published_slug || website.slug || "").trim().toLowerCase();

  if (!activeSlug) return "";

  const appDomainRaw = (
    process.env.NEXT_PUBLIC_APP_DOMAIN ||
    process.env.APP_DOMAIN ||
    "codeaxys.com"
  ).trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");

  const baseDomain = (appDomainRaw && !appDomainRaw.includes("localhost") && !appDomainRaw.includes("vercel.app"))
    ? appDomainRaw
    : "codeaxys.com";

  return `${activeSlug}.${baseDomain}`;
}

/**
 * Common multi-part ccTLD prefixes (e.g. .co.uk, .com.au, .gov.in, .org.nz).
 */
const TWO_PART_TLD_PREFIXES = new Set([
  "co", "com", "org", "net", "edu", "gov", "ac", "gen", "firm", "ind", "mil", "nom"
]);

/**
 * Derives a clean, readable canonical slug from an arbitrary website URL, domain, or brand string.
 * Completely generic and deterministic. No website-specific hardcoded names.
 *
 * Rules:
 * 1. Remove protocol (http://, https://)
 * 2. Remove www. and ports
 * 3. Extract the registrable/meaningful domain label (handles single and multi-part ccTLDs like .in, .com, .co.uk)
 * 4. Normalize to lowercase
 * 5. Convert invalid characters (anything not [a-z0-9]) to hyphens
 * 6. Remove duplicate hyphens
 * 7. Remove leading/trailing hyphens
 * 8. Preserve meaningful readable slug
 */
export function deriveCanonicalDomainSlug(input: string): string {
  if (!input || typeof input !== "string") return "site";

  let raw = input.trim().toLowerCase();

  // 1. Remove protocol if present
  raw = raw.replace(/^https?:\/\//i, "");

  // 2. Remove path, query string, hash, and port
  raw = raw.replace(/[\/?#].*$/, "");
  raw = raw.replace(/:\d+$/, "");

  // 3. Remove leading www. and common subdomains like m. or mobile.
  raw = raw.replace(/^(www\d*|mobile|m)\./i, "");

  // 4. Split hostname into domain labels
  const parts = raw.split(".").filter(Boolean);

  let meaningfulName = "";

  if (parts.length === 0) {
    meaningfulName = raw;
  } else if (parts.length === 1) {
    meaningfulName = parts[0];
  } else {
    const lastPart = parts[parts.length - 1];
    const secondLastPart = parts[parts.length - 2];

    const isTwoPartTLD =
      parts.length >= 3 &&
      lastPart.length === 2 &&
      TWO_PART_TLD_PREFIXES.has(secondLastPart);

    if (isTwoPartTLD) {
      meaningfulName = parts[parts.length - 3];
    } else {
      meaningfulName = parts[parts.length - 2];
    }
  }

  // 5. Convert invalid characters to hyphens
  let slug = meaningfulName
    .replace(/[^a-z0-9]+/g, "-")
    // 6. Remove duplicate hyphens
    .replace(/-+/g, "-")
    // 7. Remove leading and trailing hyphens
    .replace(/^-+|-+$/g, "");

  // 8. If empty or single character, fallback
  if (!slug || slug.length < 2) {
    slug = raw.replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  }

  return slug || "site";
}

/**
 * Resolves a canonical website slug with deterministic collision avoidance against existing active websites.
 * 
 * Rules:
 * 1. If preferredSlug is not owned by any OTHER user, preferredSlug is returned as-is (clean, no suffix).
 * 2. If preferredSlug is owned by ANOTHER user (active collision), sequentially tries deterministic alternatives:
 *    `${preferredSlug}-2`, `${preferredSlug}-3`, etc., until an unused slug is found.
 * 3. Never generates random hashes by default.
 */
export async function resolveCanonicalWebsiteSlug(
  db: any,
  userId: string,
  preferredSlug: string,
  excludeWebsiteId?: string
): Promise<{ slug: string; isCollision: boolean }> {
  const cleanPreferred = deriveCanonicalDomainSlug(preferredSlug);

  // Check if any website owned by ANOTHER user has this slug or published_slug
  let query = db
    .from("websites")
    .select("id, user_id, slug, published_slug")
    .neq("user_id", userId)
    .or(`slug.eq.${cleanPreferred},published_slug.eq.${cleanPreferred}`);

  if (excludeWebsiteId) {
    query = query.neq("id", excludeWebsiteId);
  }

  const { data: collisions, error } = await query.limit(1);

  if (error) {
    console.warn(`[SLUG_RESOLVER_COLLISION_CHECK_WARN] slug="${cleanPreferred}":`, error.message);
  }

  // If no collision with other users, preferred slug is safe to use!
  if (!collisions || collisions.length === 0) {
    return { slug: cleanPreferred, isCollision: false };
  }

  // Active collision with another user: find next available deterministic alternative
  let counter = 2;
  let candidateSlug = `${cleanPreferred}-${counter}`;

  while (counter < 50) {
    candidateSlug = `${cleanPreferred}-${counter}`;
    const { data: candidateCollisions } = await db
      .from("websites")
      .select("id")
      .neq("user_id", userId)
      .or(`slug.eq.${candidateSlug},published_slug.eq.${candidateSlug}`)
      .limit(1);

    if (!candidateCollisions || candidateCollisions.length === 0) {
      return { slug: candidateSlug, isCollision: true };
    }
    counter++;
  }

  // Last-resort fallback if 50 collisions exist
  const suffix = Math.random().toString(36).substring(2, 6);
  return { slug: `${cleanPreferred}-${suffix}`, isCollision: true };
}

