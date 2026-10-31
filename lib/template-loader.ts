import fs from "fs";
import path from "path";
import type { GeneratedFile, WebsitePlan, SectionPlan, ColorPaletteItem } from "./types";
import { getTemplateById, type TemplateItem } from "./template-registry";
import { isValidTemplateId } from "./auth-redirect";

const TEMPLATES_ROOT_DIR = path.resolve(process.cwd(), "templates");
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB per text file
const MAX_TOTAL_SIZE_BYTES = 10 * 1024 * 1024; // 10MB total payload

export interface TemplatePageMeta {
  path: string;
  title: string;
  isIndex: boolean;
}

export interface TemplateAssetMeta {
  path: string;
  url: string;
  type: "image" | "font" | "media" | "other";
}

export interface LoadedTemplatePayload {
  template: TemplateItem & {
    baseAssetUrl: string;
    pages: TemplatePageMeta[];
    assets: TemplateAssetMeta[];
  };
  plan: WebsitePlan;
  files: GeneratedFile[];
}

/**
 * Extracts clean section plans from HTML markup.
 */
function extractSectionsFromHtml(html: string): SectionPlan[] {
  const sections: SectionPlan[] = [];
  const seenNames = new Set<string>();

  // Look for header
  if (/<header\b/i.test(html)) {
    sections.push({ name: "Header & Navigation", description: "Top brand identity and navigation bar" });
    seenNames.add("Header & Navigation");
  }

  // Look for sections with id or aria-label or class
  const sectionRegex = /<section\b[^>]*?(?:id=["']([^"']+)["']|aria-label=["']([^"']+)["']|class=["']([^"']+)["'])?[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(html)) !== null) {
    const rawIdentifier = match[1] || match[2] || (match[3] ? match[3].split(/\s+/)[0] : "");
    if (!rawIdentifier) continue;

    // Clean up slug or kebab case into Title Case
    const cleanName = rawIdentifier
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

    if (cleanName && cleanName.length <= 40 && !seenNames.has(cleanName)) {
      sections.push({
        name: cleanName,
        description: `${cleanName} content and visual components`,
      });
      seenNames.add(cleanName);
    }

    if (sections.length >= 8) break;
  }

  // Look for footer
  if (/<footer\b/i.test(html) && !seenNames.has("Footer")) {
    sections.push({ name: "Footer", description: "Website footer, copyright, and secondary links" });
  }

  // Fallback if none parsed
  if (sections.length === 0) {
    return [
      { name: "Hero Section", description: "Primary banner and introduction" },
      { name: "Main Content", description: "Features, showcase, and information" },
      { name: "Footer", description: "Bottom links and contact details" },
    ];
  }

  return sections;
}

/**
 * Extracts page title from <title> tag.
 */
function extractTitleFromHtml(html: string, fallback: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    const clean = titleMatch[1].trim();
    if (clean.length > 0 && clean.length <= 60) return clean;
  }
  return fallback;
}

/**
 * Injects <base href="..."> into <head> of an HTML document if not already present.
 */
function ensureBaseHref(html: string, baseHref: string): string {
  if (/<base\b[^>]*href=/i.test(html)) {
    return html;
  }

  const baseTag = `\n  <base href="${baseHref}">`;

  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/(<head\b[^>]*>)/i, `$1${baseTag}`);
  }

  if (/<html\b[^>]*>/i.test(html)) {
    return html.replace(/(<html\b[^>]*>)/i, `$1\n<head>${baseTag}\n</head>`);
  }

  return `<head>${baseTag}\n</head>\n${html}`;
}

/**
 * Loads a template from disk with full security checks, asset mapping, and structure parsing.
 */
export async function loadTemplateFromDisk(templateId: string): Promise<LoadedTemplatePayload> {
  // 1. Strict template identifier validation
  if (!isValidTemplateId(templateId)) {
    throw new Error(`Invalid template identifier: "${templateId}".`);
  }

  const templateItem = getTemplateById(templateId);
  if (!templateItem) {
    throw new Error(`Template definition not found for ID: "${templateId}".`);
  }
  const currentTemplate = templateItem;

  // 2. Path traversal security check
  const templateDir = path.resolve(TEMPLATES_ROOT_DIR, currentTemplate.folderName);
  if (!templateDir.startsWith(TEMPLATES_ROOT_DIR)) {
    throw new Error("Access Denied: Path traversal detected.");
  }

  if (!fs.existsSync(templateDir)) {
    throw new Error(`Template directory not found on disk: "${currentTemplate.folderName}".`);
  }

  const baseAssetUrl = `/api/templates-preview/${encodeURIComponent(currentTemplate.folderName)}/`;
  const files: GeneratedFile[] = [];
  const pages: TemplatePageMeta[] = [];
  const assets: TemplateAssetMeta[] = [];
  let totalBytes = 0;

  // 3. Recursive directory walker
  function walkDirectory(currentDir: string, relativeDir: string = "") {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "package-lock.json") {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        walkDirectory(fullPath, relativePath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const stat = fs.statSync(fullPath);

        // A. HTML Files
        if (ext === ".html" || ext === ".htm") {
          if (stat.size > MAX_FILE_SIZE_BYTES) continue;
          totalBytes += stat.size;
          if (totalBytes > MAX_TOTAL_SIZE_BYTES) continue;

          const rawContent = fs.readFileSync(fullPath, "utf-8");
          const title = extractTitleFromHtml(
            rawContent,
            relativePath === "index.html" ? currentTemplate.name : relativePath.replace(/\.html?$/i, "")
          );

          // Inject base href for 100% relative asset resolution in preview
          const processedContent = ensureBaseHref(rawContent, baseAssetUrl);

          files.push({
            path: relativePath,
            content: processedContent,
          });

          pages.push({
            path: relativePath,
            title,
            isIndex: relativePath === "index.html",
          });
        }
        // B. CSS Files
        else if (ext === ".css") {
          if (stat.size > MAX_FILE_SIZE_BYTES) continue;
          totalBytes += stat.size;
          if (totalBytes > MAX_TOTAL_SIZE_BYTES) continue;

          const rawContent = fs.readFileSync(fullPath, "utf-8");
          files.push({
            path: relativePath,
            content: rawContent,
          });
        }
        // C. JavaScript Files
        else if (ext === ".js" || ext === ".mjs") {
          if (stat.size > MAX_FILE_SIZE_BYTES) continue;
          totalBytes += stat.size;
          if (totalBytes > MAX_TOTAL_SIZE_BYTES) continue;

          const rawContent = fs.readFileSync(fullPath, "utf-8");
          files.push({
            path: relativePath,
            content: rawContent,
          });
        }
        // D. Static Assets (Images, Fonts, Media)
        else {
          let assetType: TemplateAssetMeta["type"] = "other";
          if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico"].includes(ext)) {
            assetType = "image";
          } else if ([".woff", ".woff2", ".ttf", ".otf", ".eot"].includes(ext)) {
            assetType = "font";
          } else if ([".mp4", ".webm", ".mp3", ".wav"].includes(ext)) {
            assetType = "media";
          }

          assets.push({
            path: relativePath,
            url: `${baseAssetUrl}${relativePath}`,
            type: assetType,
          });
        }
      }
    }
  }

  walkDirectory(templateDir);

  // Ensure index.html exists
  const hasIndex = files.some((f) => f.path === "index.html");
  if (!hasIndex) {
    const firstHtml = files.find((f) => f.path.endsWith(".html"));
    if (firstHtml) {
      files.push({
        path: "index.html",
        content: firstHtml.content,
      });
      pages.unshift({
        path: "index.html",
        title: currentTemplate.name,
        isIndex: true,
      });
    } else {
      throw new Error(`Template "${currentTemplate.name}" has no valid HTML files.`);
    }
  }

  // 4. Derive Structured WebsitePlan
  const indexHtml = files.find((f) => f.path === "index.html")?.content || "";
  const parsedSections = extractSectionsFromHtml(indexHtml);

  const defaultColorPalettes: Record<string, ColorPaletteItem[]> = {
    "Finance & Advisory": [
      { name: "Navy Corporate", hex: "#0f2b48" },
      { name: "Gold Accent", hex: "#c29b38" },
      { name: "Slate Light", hex: "#f1f5f9" },
    ],
    "Beauty & Wellness": [
      { name: "Rose Blush", hex: "#f43f5e" },
      { name: "Warm Gold", hex: "#eab308" },
      { name: "Soft Silk", hex: "#fff1f2" },
    ],
    "Food & Dining": [
      { name: "Deep Saffron", hex: "#ea580c" },
      { name: "Charcoal", hex: "#1c1917" },
      { name: "Amber Cream", hex: "#fef3c7" },
    ],
    "Hospitality & Resort": [
      { name: "Ocean Cyan", hex: "#0284c7" },
      { name: "Sand Gold", hex: "#d97706" },
      { name: "Pearl White", hex: "#f8fafc" },
    ],
  };

  const colorPalette = defaultColorPalettes[currentTemplate.category] || [
    { name: "Primary Brand", hex: "#4f46e5" },
    { name: "Accent Highlight", hex: "#7c3aed" },
    { name: "Background Light", hex: "#f8fafc" },
  ];

  const plan: WebsitePlan = {
    websiteType: currentTemplate.category,
    brandIdentity: currentTemplate.name,
    designDirection: currentTemplate.description,
    colorPalette,
    typographyDirection: "Curated modern typography tailored for " + currentTemplate.category,
    layoutStrategy: "Responsive fluid layout with high-converting visual hierarchy",
    sections: parsedSections,
  };

  // Sort files so index.html is first
  files.sort((a, b) => {
    if (a.path === "index.html") return -1;
    if (b.path === "index.html") return 1;
    return a.path.localeCompare(b.path);
  });

  return {
    template: {
      ...currentTemplate,
      baseAssetUrl,
      pages,
      assets,
    },
    plan,
    files,
  };
}
