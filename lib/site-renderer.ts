import { injectSEOIntoHTML } from "./seo-injector";
import { SEOSettingsInput } from "./seo-analyzer";

export interface RenderSiteParams {
  htmlContent?: string | null;
  cssContent?: string | null;
  jsContent?: string | null;
  seoSettings?: SEOSettingsInput | null;
  websiteTitle?: string | null;
}

export function assemblePublishedWebsite(params: RenderSiteParams): string {
  const htmlRaw = (params.htmlContent || "").trim();
  const css = (params.cssContent || "").trim();
  const js = (params.jsContent || "").trim();

  let html = htmlRaw;

  // 1. Ensure basic HTML5 structure
  if (!html.includes("<!DOCTYPE html") && !html.includes("<!doctype html")) {
    const hasHead = html.includes("<head>") || html.includes("</head>");
    const hasBody = html.includes("<body>") || html.includes("</body>");

    if (!hasHead && !hasBody) {
      html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n</head>\n<body>\n${html}\n</body>\n</html>`;
    } else {
      html = `<!DOCTYPE html>\n<html lang="en">\n${html}\n</html>`;
    }
  }

  // 2. Inject CSS styles into <head>
  if (css) {
    const styleBlock = `<style>\n/* PUBLISHED WEBSITE STYLES */\n${css}\n</style>`;
    if (html.includes("</head>")) {
      html = html.replace("</head>", `${styleBlock}\n</head>`);
    } else if (html.includes("<body>")) {
      html = html.replace("<body>", `<head>\n${styleBlock}\n</head>\n<body>`);
    } else {
      html = `${styleBlock}\n${html}`;
    }
  }

  // 3. Inject JS interactivity script before </body>
  if (js) {
    const scriptBlock = `<script>\n// PUBLISHED WEBSITE INTERACTIVITY\ntry {\n${js}\n} catch (e) { console.error("Site Script Error:", e); }\n</script>`;
    if (html.includes("</body>")) {
      html = html.replace("</body>", `${scriptBlock}\n</body>`);
    } else {
      html = `${html}\n${scriptBlock}`;
    }
  }

  // 4. Inject SEO Metadata, Open Graph, Twitter Cards, Schema, Analytics & GTM
  if (params.seoSettings) {
    html = injectSEOIntoHTML(html, params.seoSettings);
  } else if (params.websiteTitle) {
    html = injectSEOIntoHTML(html, { seo_title: params.websiteTitle });
  }

  return html;
}
