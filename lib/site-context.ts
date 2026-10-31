import { GeneratedFile, WebsitePlan } from "./types";

export interface NavLinkMeta {
  label: string;
  href: string;
}

export interface PageSummary {
  path: string;
  title: string;
  isIndex: boolean;
  hasHeader: boolean;
  hasFooter: boolean;
  sections: string[];
  navLinks: NavLinkMeta[];
  baseHref: string | null;
}

export interface WebsiteContextSummary {
  brandName: string;
  category: string;
  totalPages: number;
  hasMultiPage: boolean;
  pages: PageSummary[];
  stylesheets: string[];
  scripts: string[];
  colorPalette: { name: string; hex: string }[];
}

export interface InstructionScope {
  scope: "global" | "page_specific" | "styles_only";
  targetPages: string[];
  affectedAreas: string[];
  reason: string;
}

/**
 * Extracts <base href="..."> if present in an HTML file.
 */
export function extractBaseHref(html: string): string | null {
  const match = html.match(/<base\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
  return match ? match[1] : null;
}

/**
 * Ensures an HTML file has the given base tag preserved in <head>.
 */
export function ensureBaseHref(html: string, baseHref: string): string {
  if (!baseHref) return html;

  // If already has exact base tag, return
  const currentBase = extractBaseHref(html);
  if (currentBase === baseHref) {
    return html;
  }

  // If it has a different base tag, replace it
  if (currentBase) {
    return html.replace(/<base\b[^>]*\bhref=["'][^"']+["'][^>]*>/i, `<base href="${baseHref}">`);
  }

  // Inject into <head>
  const baseTag = `<base href="${baseHref}">`;
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/(<head\b[^>]*>)/i, `$1\n  ${baseTag}`);
  }

  if (/<html\b[^>]*>/i.test(html)) {
    return html.replace(/(<html\b[^>]*>)/i, `$1\n<head>\n  ${baseTag}\n</head>`);
  }

  return `<head>\n  ${baseTag}\n</head>\n${html}`;
}

/**
 * Extracts metadata for a single HTML page.
 */
export function analyzePage(file: GeneratedFile): PageSummary {
  const html = file.content;
  const isIndex = file.path.endsWith("index.html") || file.path === "index.html";

  // Extract <title>
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : isIndex ? "Home" : file.path;

  // Extract base href
  const baseHref = extractBaseHref(html);

  // Check header & footer
  const hasHeader = /<header\b/i.test(html) || /<nav\b/i.test(html);
  const hasFooter = /<footer\b/i.test(html);

  // Extract section names / IDs / Headings
  const sections: string[] = [];
  const sectionRegex = /<section\b([^>]*)>/gi;
  let sMatch: RegExpExecArray | null;
  while ((sMatch = sectionRegex.exec(html)) !== null) {
    const attrs = sMatch[1];
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
    const ariaMatch = attrs.match(/\baria-label=["']([^"']+)["']/i);
    const name = idMatch ? idMatch[1] : ariaMatch ? ariaMatch[1] : null;
    if (name) sections.push(name);
  }

  // Fallback: extract h2 headings as section markers if no sections found
  if (sections.length === 0) {
    const h2Regex = /<h2\b[^>]*>([^<]+)<\/h2>/gi;
    let hMatch: RegExpExecArray | null;
    while ((hMatch = h2Regex.exec(html)) !== null) {
      if (hMatch[1]) sections.push(hMatch[1].trim());
    }
  }

  // Extract navigation links
  const navLinks: NavLinkMeta[] = [];
  const linkRegex = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let lMatch: RegExpExecArray | null;
  while ((lMatch = linkRegex.exec(html)) !== null) {
    const href = lMatch[1].trim();
    const rawText = lMatch[2].replace(/<[^>]+>/g, "").trim();
    if (rawText && !href.startsWith("#") && !href.startsWith("javascript:")) {
      if (!navLinks.some((l) => l.href === href)) {
        navLinks.push({ label: rawText, href });
      }
    }
  }

  return {
    path: file.path,
    title,
    isIndex,
    hasHeader,
    hasFooter,
    sections: sections.slice(0, 10),
    navLinks: navLinks.slice(0, 10),
    baseHref,
  };
}

/**
 * Builds a structured, complete context summary of the entire website.
 */
export function buildSiteContext(
  files: GeneratedFile[],
  existingPlan?: WebsitePlan | null
): WebsiteContextSummary {
  const htmlFiles = files.filter((f) => f.path.endsWith(".html") || f.path.endsWith(".htm"));
  const stylesheets = files.filter((f) => f.path.endsWith(".css")).map((f) => f.path);
  const scripts = files.filter((f) => f.path.endsWith(".js")).map((f) => f.path);

  const pages = htmlFiles.map(analyzePage);

  // Derive brand name
  let brandName = existingPlan?.brandIdentity || "";
  if (!brandName && pages.length > 0) {
    const indexPage = pages.find((p) => p.isIndex) || pages[0];
    brandName = indexPage.title.split(/[-|–:]/)[0].trim() || "Website";
  }

  const category = existingPlan?.websiteType || "General Business";
  const colorPalette = existingPlan?.colorPalette || [];

  return {
    brandName,
    category,
    totalPages: pages.length,
    hasMultiPage: pages.length > 1,
    pages,
    stylesheets,
    scripts,
    colorPalette,
  };
}

/**
 * Intelligently classifies the scope of the customer's edit instruction.
 */
export function determineInstructionScope(
  instruction: string,
  context: WebsiteContextSummary
): InstructionScope {
  const lower = instruction.toLowerCase().trim();

  // 1. Global / Site-wide indicators
  const globalPatterns = [
    /\b(all pages|every page|across the (entire )?website|entire website|whole site|site-wide|sitewide|everywhere|globally|theme|all buttons|all headings)\b/i,
    /\b(header|navbar|nav bar|navigation|footer)\b.*\b(all|every|consistent|throughout)\b/i,
    /\b(all|every)\b.*\b(header|navbar|nav bar|footer|menu)\b/i,
    /\b(change|update|switch)\b.*\b(color palette|theme|brand colors?|primary color|font family|typography)\b/i,
    /\b(phone|email|contact info|address)\b.*\b(everywhere|all pages|across)\b/i,
  ];

  const isExplicitGlobal = globalPatterns.some((pattern) => pattern.test(lower));

  // 2. Page-specific indicators
  const matchedPages: string[] = [];
  for (const page of context.pages) {
    const pageNameBase = page.path.replace(/\.html?$/i, "").toLowerCase();
    const titleLower = page.title.toLowerCase();

    // Direct path match (e.g. "about.html")
    if (lower.includes(page.path.toLowerCase())) {
      matchedPages.push(page.path);
      continue;
    }

    // Name match (e.g. "about page", "services page", "contact page", "home page")
    if (pageNameBase === "index" && (lower.includes("home") || lower.includes("landing"))) {
      matchedPages.push(page.path);
    } else if (pageNameBase !== "index" && lower.includes(pageNameBase)) {
      matchedPages.push(page.path);
    } else if (titleLower && lower.includes(titleLower)) {
      matchedPages.push(page.path);
    }
  }

  // 3. Pure styling indicators
  const styleOnlyPatterns = [
    /\b(only change colors?|only update (the )?css|adjust (the )?spacing|make buttons? (more )?rounded|change font size)\b/i,
  ];
  const isPureStyle = styleOnlyPatterns.some((pattern) => pattern.test(lower));

  if (isExplicitGlobal || (matchedPages.length === 0 && (lower.includes("header") || lower.includes("footer") || lower.includes("color") || lower.includes("theme")))) {
    return {
      scope: "global",
      targetPages: context.pages.map((p) => p.path),
      affectedAreas: ["all pages", ...context.stylesheets],
      reason: "Instruction specifies a global or site-wide update across all pages.",
    };
  }

  if (matchedPages.length > 0) {
    return {
      scope: "page_specific",
      targetPages: matchedPages,
      affectedAreas: matchedPages,
      reason: `Instruction explicitly targets specific page(s): ${matchedPages.join(", ")}.`,
    };
  }

  if (isPureStyle) {
    return {
      scope: "styles_only",
      targetPages: [],
      affectedAreas: context.stylesheets,
      reason: "Instruction only requests style/CSS adjustments.",
    };
  }

  // Default: If single-page site or ambiguous instruction, treat as primary page + styles
  const defaultPage = context.pages.find((p) => p.isIndex)?.path || context.pages[0]?.path || "index.html";
  return {
    scope: context.hasMultiPage ? "global" : "page_specific",
    targetPages: context.hasMultiPage ? context.pages.map((p) => p.path) : [defaultPage],
    affectedAreas: context.hasMultiPage ? ["all pages"] : [defaultPage],
    reason: context.hasMultiPage
      ? "Ambiguous multi-page instruction evaluated as site-wide to prevent inconsistencies."
      : "Single page edit instruction.",
  };
}

/**
 * Formats structured website context into a concise, token-efficient prompt string for Gemini.
 */
export function formatSiteContextPrompt(
  context: WebsiteContextSummary,
  scope: InstructionScope
): string {
  const pageListStr = context.pages
    .map((p) => {
      const secStr = p.sections.length > 0 ? ` [Sections: ${p.sections.join(", ")}]` : "";
      return `- "${p.path}" (Title: "${p.title}", isIndex: ${p.isIndex})${secStr}`;
    })
    .join("\n");

  const cssListStr = context.stylesheets.join(", ") || "None";
  const jsListStr = context.scripts.join(", ") || "None";
  const colorsStr = context.colorPalette.map((c) => `${c.name}: ${c.hex}`).join(", ") || "Standard";

  return `=== WEBSITE ARCHITECTURE CONTEXT ===
Brand Identity: ${context.brandName}
Industry/Category: ${context.category}
Total Pages: ${context.totalPages} (${context.hasMultiPage ? "Multi-Page Website" : "Single Page Website"})
Available Pages:
${pageListStr}
Stylesheets: ${cssListStr}
Scripts: ${jsListStr}
Current Color Palette: ${colorsStr}

=== INSTRUCTION ANALYSIS ===
Detected Scope: ${scope.scope.toUpperCase()}
Targeted Page(s): ${scope.targetPages.length > 0 ? scope.targetPages.join(", ") : "All Pages / Global"}
Reason: ${scope.reason}
`;
}

/**
 * Ensures that any <base href="..."> tags present in the original files are preserved in the updated files.
 */
export function preserveBaseTags(
  updatedFiles: GeneratedFile[],
  originalFiles: GeneratedFile[]
): GeneratedFile[] {
  return updatedFiles.map((updated) => {
    if (!updated.path.endsWith(".html") && !updated.path.endsWith(".htm")) {
      return updated;
    }

    const original = originalFiles.find((o) => o.path === updated.path);
    if (!original) {
      return updated;
    }

    const originalBase = extractBaseHref(original.content);
    if (originalBase) {
      const updatedWithBase = ensureBaseHref(updated.content, originalBase);
      return {
        ...updated,
        content: updatedWithBase,
      };
    }

    return updated;
  });
}

/**
 * Merges modified files into original files atomically:
 * - Only files modified by the AI are updated.
 * - Any original files NOT returned by the AI are preserved untouched.
 * - Any new files created by the AI are appended.
 * - Re-injects base tags to avoid breaking asset preview.
 * - Throws if validation fails (e.g. empty content, corrupt output).
 */
export function atomicMergeFiles(
  originalFiles: GeneratedFile[],
  modifiedFiles: GeneratedFile[]
): GeneratedFile[] {
  if (!modifiedFiles || modifiedFiles.length === 0) {
    throw new Error("AI editing returned zero files. Original website preserved.");
  }

  // Validate each modified file
  for (const mf of modifiedFiles) {
    if (!mf.path || typeof mf.path !== "string") {
      throw new Error("Invalid file path in AI editing response. Original website preserved.");
    }
    if (typeof mf.content !== "string" || mf.content.trim().length === 0) {
      throw new Error(`AI generated empty content for file "${mf.path}". Original website preserved.`);
    }

    // Basic HTML validation
    if (mf.path.endsWith(".html") || mf.path.endsWith(".htm")) {
      if (!mf.content.includes("<") || !mf.content.includes(">")) {
        throw new Error(`AI generated invalid HTML markup for file "${mf.path}". Original website preserved.`);
      }
    }
  }

  // Build merged map
  const fileMap = new Map<string, GeneratedFile>();

  // 1. Initialize with original files
  for (const orig of originalFiles) {
    fileMap.set(orig.path, { ...orig });
  }

  // 2. Overwrite or add modified files
  for (const mod of modifiedFiles) {
    fileMap.set(mod.path, { ...mod });
  }

  const merged = Array.from(fileMap.values());

  // 3. Preserve base tags from original files
  return preserveBaseTags(merged, originalFiles);
}
