/**
 * Link Localizer Utility for Migrated Websites.
 * Identifies internal links pointing to the original source website domain or paths,
 * and rewrites them to point to corresponding local migrated pages.
 */

export interface LocalPageRecord {
  path: string;
  original_url?: string;
  url?: string;
}

export interface LinkLocalizationResult {
  html: string;
  totalLinksFound: number;
  internalLinksRewritten: number;
  externalLinksPreserved: number;
  unmigratedLinksPreserved: number;
  wpSystemLinksPreserved?: number;
}

/**
 * Identifies whether a URL path points to a WordPress administrative/system endpoint.
 */
export function isWordPressSystemLink(urlOrPath: string): boolean {
  if (!urlOrPath) return false;
  const lower = urlOrPath.toLowerCase();
  return (
    lower.includes("/wp-admin") ||
    lower.includes("/wp-login") ||
    lower.includes("/wp-json") ||
    lower.includes("/xmlrpc.php") ||
    lower.includes("/wp-cron.php")
  );
}

/**
 * Normalizes a URL path or slug to a standard page identifier.
 * Examples:
 *   "https://mnconline.com/profile/" -> "profile"
 *   "/profile/" -> "profile"
 *   "profile.html" -> "profile"
 *   "https://mnconline.com/" -> "index"
 *   "/" -> "index"
 *   "index.html" -> "index"
 */
export function normalizePageSlug(rawUrlOrPath: string, sourceHostnames: string[] = []): string {
  if (!rawUrlOrPath || rawUrlOrPath.trim() === "") return "index";

  let clean = rawUrlOrPath.trim();

  // If absolute or protocol-relative URL, strip protocol & hostname if it matches source hostnames
  if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("//")) {
    try {
      const fullUrl = clean.startsWith("//") ? `https:${clean}` : clean;
      const parsed = new URL(fullUrl);
      const host = parsed.hostname.toLowerCase();

      // Check if hostname matches any source hostnames
      const isSourceHost = sourceHostnames.some(
        (h) => host === h.toLowerCase() || host === `www.${h.toLowerCase()}` || `www.${host}` === h.toLowerCase()
      );

      if (isSourceHost) {
        clean = parsed.pathname;
      } else {
        // External hostname -> return empty or raw to indicate not internal
        return "";
      }
    } catch {
      // Invalid URL
    }
  }

  // Remove query params and hash
  clean = clean.split("?")[0].split("#")[0];

  // Strip /site/{slug}/ prefix if already formatted as a local public site URL
  if (clean.includes("/site/")) {
    const siteIdx = clean.indexOf("/site/");
    const afterSite = clean.substring(siteIdx + 6);
    const parts = afterSite.split("/").filter(Boolean);
    if (parts.length > 1) {
      parts.shift();
      clean = parts.join("/");
    } else {
      clean = "index";
    }
  }

  // Decode URI components safely
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // Keep raw clean if decode fails
  }

  // Remove leading and trailing slashes
  clean = clean.replace(/^\/+|\/+$/g, "");

  // Remove .html extension
  if (clean.endsWith(".html")) {
    clean = clean.slice(0, -5);
  }

  // Standardize index / home variations
  if (!clean || clean === "index" || clean === "home" || clean === "default") {
    return "index";
  }

  return clean.toLowerCase();
}

/**
 * Builds a deterministic lookup map of normalized page slugs to local migrated href targets.
 */
export function buildLocalPageMap(
  pages: LocalPageRecord[],
  sourceDomain?: string,
  urlPrefix: string = ""
): { pageMap: Map<string, string>; sourceHostnames: string[] } {
  const pageMap = new Map<string, string>();
  const sourceHostnames: string[] = [];
  const cleanPrefix = urlPrefix ? urlPrefix.replace(/\/+$/, "") : "";

  if (sourceDomain) {
    let cleanDomain = sourceDomain.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
    if (cleanDomain) {
      sourceHostnames.push(cleanDomain);
      if (cleanDomain.startsWith("www.")) {
        sourceHostnames.push(cleanDomain.slice(4));
      } else {
        sourceHostnames.push(`www.${cleanDomain}`);
      }
    }
  }

  // Also collect hostnames from pages original_url or url if present
  for (const page of pages) {
    const rawUrl = page.original_url || page.url;
    if (rawUrl) {
      try {
        const parsed = new URL(rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl);
        const host = parsed.hostname.toLowerCase();
        if (host && !sourceHostnames.includes(host)) {
          sourceHostnames.push(host);
          if (host.startsWith("www.")) {
            sourceHostnames.push(host.slice(4));
          } else {
            sourceHostnames.push(`www.${host}`);
          }
        }
      } catch {
        // Ignore invalid URLs
      }
    }
  }

  // Build mapping from normalized slug to local href
  for (const page of pages) {
    const slugFromPath = normalizePageSlug(page.path, sourceHostnames);
    const slugFromUrl = page.original_url || page.url ? normalizePageSlug(page.original_url || page.url!, sourceHostnames) : "";

    const targetSlug = (slugFromPath === "index" || slugFromUrl === "index") ? "index" : (slugFromPath || slugFromUrl);

    // Local target format:
    // With urlPrefix e.g. "/site/my-slug":
    //   index -> "/site/my-slug/"
    //   profile -> "/site/my-slug/profile/"
    // Without urlPrefix:
    //   index -> "/"
    //   profile -> "/profile/"
    let localHref = "/";
    if (cleanPrefix) {
      localHref = targetSlug === "index" ? `${cleanPrefix}/` : `${cleanPrefix}/${targetSlug}/`;
    } else {
      localHref = targetSlug === "index" ? "/" : `/${targetSlug}/`;
    }

    if (slugFromPath) pageMap.set(slugFromPath, localHref);
    if (slugFromUrl) pageMap.set(slugFromUrl, localHref);

    // Also map path directly if formatted like "about-us.html" -> "/about-us/"
    const cleanPath = page.path.replace(/^\/+|\/+$/g, "");
    if (cleanPath) {
      const barePath = cleanPath.endsWith(".html") ? cleanPath.slice(0, -5) : cleanPath;
      pageMap.set(barePath.toLowerCase(), localHref);
    }
  }

  return { pageMap, sourceHostnames };
}

/**
 * Rewrites internal links in an HTML document to point to corresponding local migrated pages.
 */
export function localizeHtmlLinks(
  html: string,
  pageMap: Map<string, string>,
  sourceHostnames: string[] = []
): LinkLocalizationResult {
  if (!html) {
    return { html: "", totalLinksFound: 0, internalLinksRewritten: 0, externalLinksPreserved: 0, unmigratedLinksPreserved: 0, wpSystemLinksPreserved: 0 };
  }

  let totalLinksFound = 0;
  let internalLinksRewritten = 0;
  let externalLinksPreserved = 0;
  let unmigratedLinksPreserved = 0;
  let wpSystemLinksPreserved = 0;

  // Regex matches href="..." or href='...' attribute values inside HTML tags
  const hrefAttributeRegex = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

  const rewrittenHtml = html.replace(hrefAttributeRegex, (fullMatch, doubleQuoted, singleQuoted) => {
    totalLinksFound++;
    const rawHref = (doubleQuoted !== undefined ? doubleQuoted : singleQuoted) || "";
    const quoteChar = doubleQuoted !== undefined ? '"' : "'";

    const trimmedHref = rawHref.trim();

    // 1. Leave anchor-only, special protocols, and empty links untouched
    if (
      !trimmedHref ||
      trimmedHref.startsWith("#") ||
      trimmedHref.startsWith("mailto:") ||
      trimmedHref.startsWith("tel:") ||
      trimmedHref.startsWith("javascript:") ||
      trimmedHref.startsWith("data:") ||
      trimmedHref.startsWith("whatsapp:") ||
      trimmedHref.startsWith("sms:") ||
      trimmedHref.startsWith("callto:")
    ) {
      externalLinksPreserved++;
      return fullMatch;
    }

    // 2. Audit WordPress administrative and system links (Part D)
    if (isWordPressSystemLink(trimmedHref)) {
      wpSystemLinksPreserved++;
      // Do NOT expose original WordPress admin or rewrite into customer-facing route
      return `href=${quoteChar}javascript:void(0)${quoteChar}`;
    }

    // 3. Check if link is an absolute URL to an external domain
    if (trimmedHref.startsWith("http://") || trimmedHref.startsWith("https://") || trimmedHref.startsWith("//")) {
      try {
        const fullUrl = trimmedHref.startsWith("//") ? `https:${trimmedHref}` : trimmedHref;
        const parsed = new URL(fullUrl);
        const host = parsed.hostname.toLowerCase();

        const isSourceHost = sourceHostnames.some(
          (h) => host === h.toLowerCase() || host === `www.${h.toLowerCase()}` || `www.${host}` === h.toLowerCase()
        );

        if (!isSourceHost) {
          externalLinksPreserved++;
          return fullMatch; // External link preserved untouched
        }
      } catch {
        externalLinksPreserved++;
        return fullMatch;
      }
    }

    // 4. Extract query params and hash fragment to preserve them (e.g. ?ref=1#section)
    let extra = "";
    let cleanPath = trimmedHref;

    const qIdx = trimmedHref.indexOf("?");
    const hIdx = trimmedHref.indexOf("#");

    if (qIdx !== -1 || hIdx !== -1) {
      const splitIdx = qIdx !== -1 && hIdx !== -1 ? Math.min(qIdx, hIdx) : qIdx !== -1 ? qIdx : hIdx;
      cleanPath = trimmedHref.substring(0, splitIdx);
      extra = trimmedHref.substring(splitIdx);
    }

    // 5. Normalize slug to look up in pageMap
    const slug = normalizePageSlug(cleanPath, sourceHostnames);

    // 6. Check if target page exists in local pageMap
    const localTarget = pageMap.get(slug);

    if (localTarget) {
      internalLinksRewritten++;
      const newHref = `${localTarget}${extra.startsWith("/") && localTarget.endsWith("/") ? extra.slice(1) : extra}`;
      // Format clean output maintaining original quoting
      return `href=${quoteChar}${newHref}${quoteChar}`;
    }

    // 7. Unmigrated internal link -> preserve original href safely
    unmigratedLinksPreserved++;
    return fullMatch;
  });

  return {
    html: rewrittenHtml,
    totalLinksFound,
    internalLinksRewritten,
    externalLinksPreserved,
    unmigratedLinksPreserved,
    wpSystemLinksPreserved,
  };
}

/**
 * Localizes internal links for an entire set of website_pages.
 */
export function localizeWebsitePages(
  pages: { id?: string; path: string; html_content: string; original_url?: string; url?: string }[],
  sourceDomain?: string,
  urlPrefix?: string
): { localizedPages: { id?: string; path: string; html_content: string }[]; totalRewritten: number } {
  const { pageMap, sourceHostnames } = buildLocalPageMap(pages, sourceDomain, urlPrefix);
  let totalRewritten = 0;

  const localizedPages = pages.map((page) => {
    const res = localizeHtmlLinks(page.html_content || "", pageMap, sourceHostnames);
    totalRewritten += res.internalLinksRewritten;
    return {
      ...page,
      html_content: res.html,
    };
  });

  return { localizedPages, totalRewritten };
}
