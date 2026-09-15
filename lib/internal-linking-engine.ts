import * as cheerio from "cheerio";

export interface InternalLinkNode {
  path: string;
  title: string;
  type: "page" | "blog";
  inDegree: number;
  outDegree: number;
  inboundLinks: Array<{ sourcePath: string; anchorText: string }>;
  outboundLinks: Array<{ targetPath: string; anchorText: string; isInternal: boolean }>;
  isOrphan: boolean;
  isWeaklyLinked: boolean;
}

export interface InternalLinkEdge {
  sourcePath: string;
  targetPath: string;
  anchorText: string;
  isInternal: boolean;
  isBroken?: boolean;
}

export interface InternalLinkOpportunity {
  id: string;
  type: "orphan_fix" | "weak_coverage" | "blog_to_page" | "page_to_blog" | "cross_blog";
  sourcePath: string;
  sourceTitle: string;
  destinationPath: string;
  destinationTitle: string;
  suggestedAnchor: string;
  reason: string;
  priority: "critical" | "warning" | "opportunity";
  instruction: string;
}

export interface InternalLinkAnalysisResult {
  internal_link_score: number;
  summary: {
    total_pages: number;
    total_published_blogs: number;
    total_internal_links: number;
    total_external_links: number;
    broken_links_count: number;
    orphan_pages_count: number;
    weakly_linked_count: number;
  };
  link_graph: {
    nodes: Record<string, InternalLinkNode>;
    edges: InternalLinkEdge[];
    broken_links: Array<{ sourcePath: string; rawHref: string; anchorText: string }>;
  };
  opportunities: InternalLinkOpportunity[];
  last_analyzed_at: string;
}

export interface PageInput {
  path: string;
  htmlContent: string;
  title?: string | null;
  focus_keywords?: string[] | null;
}

export interface BlogPostInput {
  title: string;
  slug: string;
  content?: string | null;
  excerpt?: string | null;
  category?: string | null;
  tags?: string[] | null;
  focus_keyword?: string | null;
  status: string;
}

/**
 * Executes a pure deterministic internal link analysis over website pages and published blog posts.
 * Costs 0 AI credits.
 */
export function analyzeInternalLinks(
  pages: PageInput[],
  blogPosts: BlogPostInput[] = []
): InternalLinkAnalysisResult {
  const publishedBlogs = (blogPosts || []).filter((b) => b.status === "published");

  // 1. Register all valid nodes
  const nodes: Record<string, InternalLinkNode> = {};
  const validPathsSet = new Set<string>();

  // Register website pages
  pages.forEach((p) => {
    const norm = normalizePath(p.path);
    validPathsSet.add(norm);
    const $ = cheerio.load(p.htmlContent || "");
    const title = p.title || $("title").first().text().trim() || $("h1").first().text().trim() || norm;

    nodes[norm] = {
      path: norm,
      title,
      type: "page",
      inDegree: 0,
      outDegree: 0,
      inboundLinks: [],
      outboundLinks: [],
      isOrphan: false,
      isWeaklyLinked: false,
    };
  });

  // Register published blog articles
  publishedBlogs.forEach((b) => {
    const blogPath = normalizePath(`blog/${b.slug}`);
    validPathsSet.add(blogPath);

    nodes[blogPath] = {
      path: blogPath,
      title: b.title,
      type: "blog",
      inDegree: 0,
      outDegree: 0,
      inboundLinks: [],
      outboundLinks: [],
      isOrphan: false,
      isWeaklyLinked: false,
    };
  });

  const edges: InternalLinkEdge[] = [];
  const brokenLinks: Array<{ sourcePath: string; rawHref: string; anchorText: string }> = [];

  let totalInternalLinks = 0;
  let totalExternalLinks = 0;

  // 2. Parse Links from Page HTML
  pages.forEach((p) => {
    const sourceNorm = normalizePath(p.path);
    const $ = cheerio.load(p.htmlContent || "");

    $("a[href]").each((_, el) => {
      const rawHref = $(el).attr("href")?.trim();
      const anchorText = $(el).text().trim() || "Link";
      if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("javascript:") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) return;

      if (rawHref.startsWith("http://") || rawHref.startsWith("https://")) {
        totalExternalLinks++;
        if (nodes[sourceNorm]) {
          nodes[sourceNorm].outboundLinks.push({ targetPath: rawHref, anchorText, isInternal: false });
          nodes[sourceNorm].outDegree++;
        }
      } else {
        totalInternalLinks++;
        const targetNorm = normalizePath(rawHref);

        if (validPathsSet.has(targetNorm)) {
          edges.push({ sourcePath: sourceNorm, targetPath: targetNorm, anchorText, isInternal: true });
          if (nodes[sourceNorm]) {
            nodes[sourceNorm].outboundLinks.push({ targetPath: targetNorm, anchorText, isInternal: true });
            nodes[sourceNorm].outDegree++;
          }
          if (nodes[targetNorm] && targetNorm !== sourceNorm) {
            nodes[targetNorm].inboundLinks.push({ sourcePath: sourceNorm, anchorText });
            nodes[targetNorm].inDegree++;
          }
        } else {
          // Internal link pointing to unindexed or non-existent path -> Broken link
          brokenLinks.push({ sourcePath: sourceNorm, rawHref, anchorText });
          edges.push({ sourcePath: sourceNorm, targetPath: targetNorm, anchorText, isInternal: true, isBroken: true });
          if (nodes[sourceNorm]) {
            nodes[sourceNorm].outboundLinks.push({ targetPath: targetNorm, anchorText, isInternal: true });
            nodes[sourceNorm].outDegree++;
          }
        }
      }
    });
  });

  // 3. Parse Links from Published Blog Articles
  publishedBlogs.forEach((b) => {
    const sourceNorm = normalizePath(`blog/${b.slug}`);
    const $ = cheerio.load(b.content || "");

    $("a[href]").each((_, el) => {
      const rawHref = $(el).attr("href")?.trim();
      const anchorText = $(el).text().trim() || "Link";
      if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("javascript:") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) return;

      if (rawHref.startsWith("http://") || rawHref.startsWith("https://")) {
        totalExternalLinks++;
        if (nodes[sourceNorm]) {
          nodes[sourceNorm].outboundLinks.push({ targetPath: rawHref, anchorText, isInternal: false });
          nodes[sourceNorm].outDegree++;
        }
      } else {
        totalInternalLinks++;
        const targetNorm = normalizePath(rawHref);

        if (validPathsSet.has(targetNorm)) {
          edges.push({ sourcePath: sourceNorm, targetPath: targetNorm, anchorText, isInternal: true });
          if (nodes[sourceNorm]) {
            nodes[sourceNorm].outboundLinks.push({ targetPath: targetNorm, anchorText, isInternal: true });
            nodes[sourceNorm].outDegree++;
          }
          if (nodes[targetNorm] && targetNorm !== sourceNorm) {
            nodes[targetNorm].inboundLinks.push({ sourcePath: sourceNorm, anchorText });
            nodes[targetNorm].inDegree++;
          }
        } else {
          brokenLinks.push({ sourcePath: sourceNorm, rawHref, anchorText });
          edges.push({ sourcePath: sourceNorm, targetPath: targetNorm, anchorText, isInternal: true, isBroken: true });
          if (nodes[sourceNorm]) {
            nodes[sourceNorm].outboundLinks.push({ targetPath: targetNorm, anchorText, isInternal: true });
            nodes[sourceNorm].outDegree++;
          }
        }
      }
    });
  });

  // 4. Calculate Orphan and Weakly Linked States
  let orphanCount = 0;
  let weakCount = 0;

  Object.values(nodes).forEach((node) => {
    // Root homepage is not considered orphaned
    if (node.path !== "index.html" && node.inDegree === 0) {
      node.isOrphan = true;
      orphanCount++;
    } else if (node.path !== "index.html" && node.inDegree === 1) {
      node.isWeaklyLinked = true;
      weakCount++;
    }
  });

  // 5. Deterministic Opportunity Detection
  const opportunities: InternalLinkOpportunity[] = [];
  const oppSet = new Set<string>();

  // A. Orphan Page Fix Opportunities
  Object.values(nodes).forEach((targetNode) => {
    if (targetNode.isOrphan) {
      // Find suitable source node
      const targetKeyword = (targetNode.title || targetNode.path).toLowerCase();
      const suitableSource = Object.values(nodes).find((src) => {
        if (src.path === targetNode.path) return false;
        if (src.type === "page" && src.path === "index.html") return true; // Homepage is default candidate
        return false;
      });

      if (suitableSource) {
        const oppKey = `${suitableSource.path}->${targetNode.path}`;
        if (!oppSet.has(oppKey)) {
          oppSet.add(oppKey);
          opportunities.push({
            id: `opp-orphan-${targetNode.path.replace(/\//g, "-")}`,
            type: "orphan_fix",
            sourcePath: suitableSource.path,
            sourceTitle: suitableSource.title,
            destinationPath: targetNode.path,
            destinationTitle: targetNode.title,
            suggestedAnchor: targetNode.title,
            reason: `"${targetNode.title}" has zero inbound internal links. Add an internal link from ${suitableSource.title} to resolve orphan page isolation.`,
            priority: "critical",
            instruction: `Add internal link from ${suitableSource.path} to ${targetNode.path} with anchor text "${targetNode.title}".`,
          });
        }
      }
    }
  });

  // B. Blog -> Service / Page Linking Opportunities
  publishedBlogs.forEach((blog) => {
    const blogPath = normalizePath(`blog/${blog.slug}`);
    const blogText = `${blog.title} ${blog.excerpt || ""} ${blog.content || ""}`.toLowerCase();

    pages.forEach((page) => {
      const pageNorm = normalizePath(page.path);
      if (pageNorm === "index.html") return;

      const pageTitle = (page.title || pageNorm).toLowerCase();
      const keywords = (page.focus_keywords || []).map((k) => k.toLowerCase());

      // Check if blog content mentions page title or keyword and does NOT currently link to page
      const mentionsPage = blogText.includes(pageTitle) || keywords.some((k) => k.length > 3 && blogText.includes(k));
      const alreadyLinks = nodes[blogPath]?.outboundLinks.some((l) => l.targetPath === pageNorm);

      if (mentionsPage && !alreadyLinks) {
        const oppKey = `${blogPath}->${pageNorm}`;
        if (!oppSet.has(oppKey)) {
          oppSet.add(oppKey);
          opportunities.push({
            id: `opp-b2p-${blog.slug}-${pageNorm.replace(/\//g, "-")}`,
            type: "blog_to_page",
            sourcePath: blogPath,
            sourceTitle: blog.title,
            destinationPath: pageNorm,
            destinationTitle: page.title || pageNorm,
            suggestedAnchor: page.title || pageNorm,
            reason: `Blog article "${blog.title}" discusses topics related to "${page.title || pageNorm}". Adding a contextual internal link passes authority.`,
            priority: "opportunity",
            instruction: `Add internal link from blog article ${blogPath} to website page ${pageNorm} with anchor text "${page.title || pageNorm}".`,
          });
        }
      }
    });
  });

  // C. Page -> Blog Linking Opportunities
  pages.forEach((page) => {
    const pageNorm = normalizePath(page.path);
    const pageText = `${page.title || ""} ${page.htmlContent || ""}`.toLowerCase();

    publishedBlogs.forEach((blog) => {
      const blogPath = normalizePath(`blog/${blog.slug}`);
      const blogTitleLower = blog.title.toLowerCase();

      const mentionsBlog = pageText.includes(blogTitleLower);
      const alreadyLinks = nodes[pageNorm]?.outboundLinks.some((l) => l.targetPath === blogPath);

      if (mentionsBlog && !alreadyLinks) {
        const oppKey = `${pageNorm}->${blogPath}`;
        if (!oppSet.has(oppKey)) {
          oppSet.add(oppKey);
          opportunities.push({
            id: `opp-p2b-${pageNorm.replace(/\//g, "-")}-${blog.slug}`,
            type: "page_to_blog",
            sourcePath: pageNorm,
            sourceTitle: page.title || pageNorm,
            destinationPath: blogPath,
            destinationTitle: blog.title,
            suggestedAnchor: blog.title,
            reason: `Page "${page.title || pageNorm}" references the blog topic "${blog.title}". Linking to the full article improves engagement.`,
            priority: "opportunity",
            instruction: `Add internal link from ${pageNorm} to blog article ${blogPath} with anchor text "${blog.title}".`,
          });
        }
      }
    });
  });

  // D. Weak Coverage Fix Opportunities
  Object.values(nodes).forEach((node) => {
    if (node.isWeaklyLinked && opportunities.length < 15) {
      const suitableSrc = Object.values(nodes).find((s) => s.path !== node.path && !nodes[s.path]?.outboundLinks.some((l) => l.targetPath === node.path));
      if (suitableSrc) {
        const oppKey = `${suitableSrc.path}->${node.path}`;
        if (!oppSet.has(oppKey)) {
          oppSet.add(oppKey);
          opportunities.push({
            id: `opp-weak-${node.path.replace(/\//g, "-")}`,
            type: "weak_coverage",
            sourcePath: suitableSrc.path,
            sourceTitle: suitableSrc.title,
            destinationPath: node.path,
            destinationTitle: node.title,
            suggestedAnchor: node.title,
            reason: `"${node.title}" currently only has 1 incoming link. Adding an additional link from ${suitableSrc.title} strengthens ranking potential.`,
            priority: "warning",
            instruction: `Add internal link from ${suitableSrc.path} to ${node.path} with anchor text "${node.title}".`,
          });
        }
      }
    }
  });

  // 6. Calculate Internal Link Health Score (0-100)
  let baseScore = 100;
  const orphanPenalty = Math.min(40, orphanCount * 15);
  const brokenPenalty = Math.min(30, brokenLinks.length * 10);
  const weakPenalty = Math.min(20, weakCount * 5);

  let internalLinkScore = baseScore - orphanPenalty - brokenPenalty - weakPenalty;
  const totalNodes = Object.keys(nodes).length;
  if (totalNodes > 1 && totalInternalLinks / totalNodes >= 2) {
    internalLinkScore += 5; // Cross-linking bonus
  }

  internalLinkScore = Math.min(100, Math.max(0, internalLinkScore));

  return {
    internal_link_score: internalLinkScore,
    summary: {
      total_pages: pages.length,
      total_published_blogs: publishedBlogs.length,
      total_internal_links: totalInternalLinks,
      total_external_links: totalExternalLinks,
      broken_links_count: brokenLinks.length,
      orphan_pages_count: orphanCount,
      weakly_linked_count: weakCount,
    },
    link_graph: {
      nodes,
      edges,
      broken_links: brokenLinks,
    },
    opportunities: opportunities.slice(0, 20),
    last_analyzed_at: new Date().toISOString(),
  };
}

function normalizePath(p: string): string {
  if (!p) return "index.html";
  let clean = p.trim().toLowerCase();
  if (clean.startsWith("/")) clean = clean.slice(1);
  if (clean === "" || clean === "index") return "index.html";
  return clean;
}
