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

/**
 * Returns the draft preview URL for a website (adds ?preview=true when unpublished).
 */
export function getWebsitePreviewUrl(
  website: WebsiteUrlInput | null | undefined,
  options?: GetPublicUrlOptions
): string {
  if (!website) return "";
  const base = getWebsitePublicUrl(website, options);
  if (!base) return "";

  if (website.is_published) return base;

  return base.includes("?") ? `${base}&preview=true` : `${base}?preview=true`;
}

/**
 * Returns the canonical production subdomain URL for a published website.
 */
export function getWebsiteProductionUrl(
  website: WebsiteUrlInput | null | undefined,
  options?: GetPublicUrlOptions
): string {
  if (!website) return "";
  const activeSlug = (website.published_slug || website.slug || "").trim().toLowerCase();
  if (!activeSlug) return "";

  if (website.custom_domain && website.custom_domain.trim().length > 0) {
    const cleanCustom = website.custom_domain.trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
    return `https://${cleanCustom}${options?.subpath ? (options.subpath.startsWith("/") ? options.subpath : `/${options.subpath}`) : ""}`;
  }

  const appDomainRaw = (
    process.env.NEXT_PUBLIC_APP_DOMAIN ||
    process.env.APP_DOMAIN ||
    "codeaxys.com"
  ).trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");

  const baseDomain = (appDomainRaw && !appDomainRaw.includes("localhost") && !appDomainRaw.includes("vercel.app"))
    ? appDomainRaw
    : "codeaxys.com";

  const prodUrl = `https://${activeSlug}.${baseDomain}`;
  if (options?.subpath) {
    const cleanSubpath = options.subpath.startsWith("/") ? options.subpath : `/${options.subpath}`;
    return `${prodUrl}${cleanSubpath}`;
  }
  return prodUrl;
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

