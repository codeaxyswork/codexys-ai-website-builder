import type { GeneratedFile } from "./types";
import type { SaveState } from "@/components/SaveStatus";

export interface PrePublishValidationResult {
  canPublish: boolean;
  errors: string[];
  warnings: string[];
  pageCount: number;
  hasHomepage: boolean;
  pages: string[];
}

/**
 * Validates website files, homepage presence, and save state prior to publishing.
 */
export function validateWebsiteBeforePublish(
  files: GeneratedFile[],
  saveState: SaveState,
  websiteId: string | null
): PrePublishValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Save Status & Connectivity Gate
  if (!websiteId) {
    errors.push("Website must be saved before publishing. Please wait for the initial save to complete.");
  }

  if (saveState === "saving" || saveState === "retrying") {
    errors.push("Your latest changes are currently saving in the background. Please wait a moment for autosave to complete before publishing.");
  } else if (saveState === "offline") {
    errors.push("You are currently working offline. An internet connection is required to publish your website live.");
  } else if (saveState === "error") {
    errors.push("The latest background save encountered an error. Please verify your connection before publishing.");
  }

  // 2. File Presence & Homepage Gate
  if (!files || files.length === 0) {
    errors.push("The website does not contain any code files to publish.");
    return {
      canPublish: false,
      errors,
      warnings,
      pageCount: 0,
      hasHomepage: false,
      pages: [],
    };
  }

  const htmlFiles = files.filter((f) => f.path.endsWith(".html") || f.path.endsWith(".htm"));
  const indexHtml = files.find((f) => f.path.endsWith("index.html") || f.path === "index.html");

  if (!indexHtml || !indexHtml.content || indexHtml.content.trim().length === 0) {
    errors.push("A valid homepage ('index.html') is required before publishing.");
  } else if (!indexHtml.content.includes("<") || !indexHtml.content.includes(">")) {
    errors.push("The homepage ('index.html') does not contain valid HTML markup.");
  }

  // 3. Subpage Validation & Internal Navigation Check
  const pages: string[] = [];
  for (const hf of htmlFiles) {
    pages.push(hf.path);
    if (!hf.content || hf.content.trim().length === 0) {
      errors.push(`Page '${hf.path}' is empty. All pages must contain content.`);
    }

    // Check internal links for non-blocking navigational feedback
    const linkMatches = hf.content.matchAll(/href=["']([a-zA-Z0-9_\-]+\.html)["']/gi);
    for (const match of linkMatches) {
      const targetHref = match[1];
      const targetExists = htmlFiles.some(
        (f) => f.path === targetHref || f.path.endsWith("/" + targetHref)
      );
      if (!targetExists) {
        const warnMsg = `Page '${hf.path}' contains link to '${targetHref}', which is not found in the website pages.`;
        if (!warnings.includes(warnMsg)) {
          warnings.push(warnMsg);
        }
      }
    }
  }

  // 4. Stylesheet check (Warning only)
  const hasCss = files.some((f) => f.path.endsWith(".css"));
  if (!hasCss && !indexHtml?.content.includes("<style")) {
    warnings.push("No dedicated stylesheet found. Styles may be inline.");
  }

  return {
    canPublish: errors.length === 0,
    errors,
    warnings,
    pageCount: htmlFiles.length,
    hasHomepage: Boolean(indexHtml && indexHtml.content.trim().length > 0),
    pages,
  };
}
