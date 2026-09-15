export interface BlogPostRenderInput {
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    content?: string | null;
    status: string;
    featured_image?: string | null;
    author?: string | null;
    category?: string | null;
    tags?: string[];
    seo_title?: string | null;
    meta_description?: string | null;
    focus_keyword?: string | null;
    canonical_url?: string | null;
    og_title?: string | null;
    og_description?: string | null;
    og_image?: string | null;
    robots_config?: string | null;
    published_at?: string | null;
  };
  websiteTitle: string;
  publishedSlug?: string | null;
}

export function renderBlogPostHTML(input: BlogPostRenderInput): string {
  const { post, websiteTitle, publishedSlug } = input;

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const baseUrl = `${protocol}://${appDomain}`;
  const canonical = post.canonical_url || (publishedSlug ? `${baseUrl}/site/${publishedSlug}/blog/${post.slug}` : "");

  const pageTitle = post.seo_title || post.title;
  const metaDesc = post.meta_description || post.excerpt || `Read ${post.title} on ${websiteTitle}`;
  const ogTitle = post.og_title || pageTitle;
  const ogDesc = post.og_description || metaDesc;
  const ogImg = post.og_image || post.featured_image || "";
  const robots = post.robots_config || "index, follow";

  const publishedDateFormatted = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(pageTitle)} | ${escapeHTML(websiteTitle)}</title>
  <meta name="description" content="${escapeHTML(metaDesc)}">
  <meta name="robots" content="${escapeHTML(robots)}">
  ${canonical ? `<link rel="canonical" href="${escapeHTML(canonical)}">` : ""}

  <!-- Open Graph / Social -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHTML(ogTitle)}">
  <meta property="og:description" content="${escapeHTML(ogDesc)}">
  ${ogImg ? `<meta property="og:image" content="${escapeHTML(ogImg)}">` : ""}
  ${canonical ? `<meta property="og:url" content="${escapeHTML(canonical)}">` : ""}

  <!-- Fonts & Baseline Styles -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --primary: #9333ea;
      --primary-dark: #7e22ce;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      padding: 0;
      margin: 0;
    }

    header.site-header {
      background: #ffffff;
      border-bottom: 1px solid var(--border);
      padding: 1.25rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .brand-title {
      font-weight: 800;
      font-size: 1.125rem;
      color: var(--text);
      text-decoration: none;
    }
    .back-link {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--primary);
      text-decoration: none;
    }
    .back-link:hover { text-decoration: underline; }

    main.container {
      max-width: 800px;
      margin: 2.5rem auto;
      padding: 0 1.5rem 4rem 1.5rem;
    }

    .meta-badge-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
    .badge {
      background: #f3e8ff;
      color: #7e22ce;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .date-text {
      font-size: 0.8125rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    h1.post-title {
      font-size: 2.25rem;
      font-weight: 800;
      line-height: 1.25;
      margin-bottom: 1.25rem;
      color: var(--text);
      letter-spacing: -0.02em;
    }

    .author-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    .avatar-circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #e9d5ff;
      color: #7e22ce;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.875rem;
    }
    .author-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text);
    }

    .featured-image-box {
      width: 100%;
      max-height: 450px;
      border-radius: 1rem;
      overflow: hidden;
      margin-bottom: 2.5rem;
      border: 1px solid var(--border);
      background: #e2e8f0;
    }
    .featured-image-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .post-content {
      font-size: 1.0625rem;
      color: #334155;
    }
    .post-content h2 { font-size: 1.5rem; font-weight: 700; margin: 2rem 0 1rem 0; color: var(--text); }
    .post-content h3 { font-size: 1.25rem; font-weight: 700; margin: 1.5rem 0 0.75rem 0; color: var(--text); }
    .post-content p { margin-bottom: 1.25rem; }
    .post-content ul, .post-content ol { margin: 0 0 1.25rem 1.5rem; }
    .post-content li { margin-bottom: 0.5rem; }
    .post-content blockquote {
      border-left: 4px solid var(--primary);
      padding: 0.75rem 1.25rem;
      background: #faf5ff;
      border-radius: 0 0.5rem 0.5rem 0;
      margin-bottom: 1.5rem;
      font-style: italic;
      color: #581c87;
    }
    .post-content img {
      max-width: 100%;
      border-radius: 0.75rem;
      margin: 1.5rem 0;
    }

    footer.site-footer {
      border-top: 1px solid var(--border);
      padding: 2rem;
      text-align: center;
      font-size: 0.8125rem;
      color: var(--text-muted);
      background: #ffffff;
    }
  </style>
</head>
<body>

  <header class="site-header">
    <a href="${publishedSlug ? `/site/${publishedSlug}` : "/"}" class="brand-title">${escapeHTML(websiteTitle)}</a>
    <a href="${publishedSlug ? `/site/${publishedSlug}` : "/"}" class="back-link">← Back to Home</a>
  </header>

  <main class="container">
    <article>
      <div class="meta-badge-row">
        <span class="badge">${escapeHTML(post.category || "General")}</span>
        <span class="date-text">${publishedDateFormatted}</span>
      </div>

      <h1 class="post-title">${escapeHTML(post.title)}</h1>

      <div class="author-row">
        <div class="avatar-circle">${escapeHTML((post.author || "A")[0].toUpperCase())}</div>
        <div class="author-name">By ${escapeHTML(post.author || "Admin")}</div>
      </div>

      ${post.featured_image ? `
        <div class="featured-image-box">
          <img src="${escapeHTML(post.featured_image)}" alt="${escapeHTML(post.title)}" />
        </div>
      ` : ""}

      <div class="post-content">
        ${post.content || `<p>${escapeHTML(post.excerpt || "")}</p>`}
      </div>
    </article>
  </main>

  <footer class="site-footer">
    <p>© ${new Date().getFullYear()} ${escapeHTML(websiteTitle)}. Powered by Codeaxys AI Website Builder.</p>
  </footer>

</body>
</html>`;
}

function escapeHTML(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
