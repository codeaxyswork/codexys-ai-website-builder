import { SEOSettingsInput } from "./seo-analyzer";

export function injectSEOIntoHTML(
  htmlContent: string = "",
  seo: SEOSettingsInput | null = {}
): string {
  if (!seo || Object.keys(seo).length === 0) {
    return htmlContent;
  }

  let html = htmlContent;

  // Ensure <head> exists
  if (!html.includes("<head>") && !html.includes("</head>")) {
    if (html.includes("<html>")) {
      html = html.replace("<html>", "<html>\n<head>\n</head>");
    } else {
      html = `<!DOCTYPE html>\n<html>\n<head>\n</head>\n<body>\n${html}\n</body>\n</html>`;
    }
  }

  const tagsToInject: string[] = [];

  // 1. Title
  if (seo.seo_title?.trim()) {
    const titleClean = escapeHtml(seo.seo_title.trim());
    if (html.includes("<title>")) {
      html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${titleClean}</title>`);
    } else {
      tagsToInject.push(`<title>${titleClean}</title>`);
    }
  }

  // 2. Meta Description
  if (seo.meta_description?.trim()) {
    const descClean = escapeHtml(seo.meta_description.trim());
    html = removeMetaTag(html, "name", "description");
    tagsToInject.push(`<meta name="description" content="${descClean}">`);
  }

  // 3. Focus Keywords
  if (seo.focus_keywords && seo.focus_keywords.length > 0) {
    const keywordsClean = escapeHtml(seo.focus_keywords.join(", "));
    html = removeMetaTag(html, "name", "keywords");
    tagsToInject.push(`<meta name="keywords" content="${keywordsClean}">`);
  }

  // 4. Canonical URL
  if (seo.canonical_url?.trim()) {
    const canonicalClean = escapeHtml(seo.canonical_url.trim());
    html = html.replace(/<link[^>]*rel=["']canonical["'][^>]*>/gi, "");
    tagsToInject.push(`<link rel="canonical" href="${canonicalClean}">`);
  }

  // 5. Robots Meta
  const indexStr = seo.robots_index !== false ? "index" : "noindex";
  const followStr = seo.robots_follow !== false ? "follow" : "nofollow";
  html = removeMetaTag(html, "name", "robots");
  tagsToInject.push(`<meta name="robots" content="${indexStr}, ${followStr}">`);

  // 6. Open Graph Tags
  const ogTitle = seo.og_title?.trim() || seo.seo_title?.trim();
  const ogDesc = seo.og_description?.trim() || seo.meta_description?.trim();
  const ogImg = seo.og_image_url?.trim();

  if (ogTitle) {
    html = removeMetaTag(html, "property", "og:title");
    tagsToInject.push(`<meta property="og:title" content="${escapeHtml(ogTitle)}">`);
  }
  if (ogDesc) {
    html = removeMetaTag(html, "property", "og:description");
    tagsToInject.push(`<meta property="og:description" content="${escapeHtml(ogDesc)}">`);
  }
  if (ogImg) {
    html = removeMetaTag(html, "property", "og:image");
    tagsToInject.push(`<meta property="og:image" content="${escapeHtml(ogImg)}">`);
  }
  html = removeMetaTag(html, "property", "og:type");
  tagsToInject.push(`<meta property="og:type" content="website">`);

  // 7. Twitter Card Tags
  const twCard = seo.twitter_card?.trim() || "summary_large_image";
  const twTitle = seo.twitter_title?.trim() || ogTitle;
  const twDesc = seo.twitter_description?.trim() || ogDesc;
  const twImg = seo.twitter_image_url?.trim() || ogImg;

  html = removeMetaTag(html, "name", "twitter:card");
  tagsToInject.push(`<meta name="twitter:card" content="${escapeHtml(twCard)}">`);
  if (twTitle) {
    html = removeMetaTag(html, "name", "twitter:title");
    tagsToInject.push(`<meta name="twitter:title" content="${escapeHtml(twTitle)}">`);
  }
  if (twDesc) {
    html = removeMetaTag(html, "name", "twitter:description");
    tagsToInject.push(`<meta name="twitter:description" content="${escapeHtml(twDesc)}">`);
  }
  if (twImg) {
    html = removeMetaTag(html, "name", "twitter:image");
    tagsToInject.push(`<meta name="twitter:image" content="${escapeHtml(twImg)}">`);
  }

  // 8. JSON-LD Schema Markup
  if (seo.schema_markup && Object.keys(seo.schema_markup).length > 0) {
    try {
      const schemaString = JSON.stringify(seo.schema_markup, null, 2);
      // Remove existing ld+json scripts if any
      html = html.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "");
      tagsToInject.push(`<script type="application/ld+json">\n${schemaString}\n</script>`);
    } catch (e) {
      console.error("Failed to stringify Schema Markup:", e);
    }
  }

  // 9. Google Analytics ID Injection
  if (seo.google_analytics_id?.trim()) {
    const gaId = seo.google_analytics_id.trim();
    if (/^G-[A-Z0-9]+$/i.test(gaId) || /^UA-\d+-\d+$/i.test(gaId)) {
      tagsToInject.push(`<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${gaId}');
</script>`);
    }
  }

  // 10. Google Tag Manager Injection
  if (seo.google_tag_manager_id?.trim()) {
    const gtmId = seo.google_tag_manager_id.trim();
    if (/^GTM-[A-Z0-9]+$/i.test(gtmId)) {
      tagsToInject.push(`<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');</script>
<!-- End Google Tag Manager -->`);
    }
  }

  // Inject before </head>
  const injectionBlock = tagsToInject.join("\n");
  if (html.includes("</head>")) {
    html = html.replace("</head>", `${injectionBlock}\n</head>`);
  } else {
    html = `${injectionBlock}\n${html}`;
  }

  return html;
}

function removeMetaTag(html: string, attrName: string, attrVal: string): string {
  const reg = new RegExp(`<meta[^>]*${attrName}=["']${attrVal}["'][^>]*>`, "gi");
  return html.replace(reg, "");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
