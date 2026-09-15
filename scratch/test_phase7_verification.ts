import { analyzeInternalLinks, PageInput, BlogPostInput } from "../lib/internal-linking-engine";

async function runPhase7Verification() {
  console.log("=== Phase 7 Internal Linking Engine Verification ===");

  const mockPages: PageInput[] = [
    {
      path: "index.html",
      htmlContent: `<html><head><title>Home Page</title></head><body><h1>Welcome to Codeaxys AI</h1><a href="/services">Our Services</a> <a href="/blog/seo-guide-2026">SEO Guide</a></body></html>`,
      title: "Home Page",
      focus_keywords: ["ai website builder", "codeaxys"],
    },
    {
      path: "services",
      htmlContent: `<html><head><title>Services</title></head><body><h1>Our Web Design Services</h1><a href="/">Home</a></body></html>`,
      title: "Services",
      focus_keywords: ["services", "web design"],
    },
    {
      path: "pricing",
      htmlContent: `<html><head><title>Pricing Plans</title></head><body><h1>Pricing</h1><a href="/broken-page-path">Broken Link Test</a></body></html>`,
      title: "Pricing Plans",
      focus_keywords: ["pricing", "subscriptions"],
    },
  ];

  const mockBlogPosts: BlogPostInput[] = [
    {
      title: "SEO Guide 2026",
      slug: "seo-guide-2026",
      content: `<p>Learn how to use Codeaxys Services to build websites.</p>`,
      excerpt: "Comprehensive 2026 SEO Guide",
      status: "published",
      focus_keyword: "seo guide",
    },
    {
      title: "Draft Secrets",
      slug: "draft-secrets",
      content: `<p>Unpublished draft article</p>`,
      status: "draft",
    },
  ];

  const result = analyzeInternalLinks(mockPages, mockBlogPosts);

  console.log("\n1. Testing Link Graph Construction...");
  if (result.summary.total_pages === 3 && result.summary.total_published_blogs === 1) {
    console.log("  ✓ Correct count of registered pages and published blog posts.");
  } else {
    throw new Error(`Node registration failed! (Pages: ${result.summary.total_pages}, Blogs: ${result.summary.total_published_blogs})`);
  }

  // Verify draft blog post exclusion
  if (!result.link_graph.nodes["blog/draft-secrets"]) {
    console.log("  ✓ Draft blog posts successfully excluded from public link graph.");
  } else {
    throw new Error("Draft blog post was erroneously included in link graph!");
  }

  console.log("\n2. Testing In-Degree & Out-Degree Link Metrics...");
  const homeNode = result.link_graph.nodes["index.html"];
  if (homeNode && homeNode.outDegree === 2) {
    console.log("  ✓ Outbound link extraction verified (index.html -> 2 links).");
  } else {
    throw new Error(`Outbound link extraction failed for index.html (outDegree: ${homeNode?.outDegree})`);
  }

  console.log("\n3. Testing Broken Internal Link Detection...");
  if (result.summary.broken_links_count === 1 && result.link_graph.broken_links[0]?.rawHref === "/broken-page-path") {
    console.log("  ✓ Broken internal link correctly detected (/broken-page-path).");
  } else {
    throw new Error("Broken internal link detection failed!");
  }

  console.log("\n4. Testing Orphan Page & Weak Link Detection...");
  const pricingNode = result.link_graph.nodes["pricing"];
  if (pricingNode && pricingNode.isOrphan) {
    console.log("  ✓ Orphan page correctly identified ('pricing' has 0 inbound links).");
  } else {
    throw new Error("Orphan page detection failed for 'pricing'!");
  }

  console.log("\n5. Testing Opportunity Generator...");
  if (result.opportunities.length > 0) {
    console.log(`  ✓ Generated ${result.opportunities.length} deterministic internal linking opportunities.`);
  } else {
    throw new Error("Opportunity generator returned no results!");
  }

  console.log("\n6. Testing Internal Link Health Score...");
  if (result.internal_link_score >= 0 && result.internal_link_score <= 100) {
    console.log(`  ✓ Internal Link Health Score calculated cleanly: ${result.internal_link_score}/100.`);
  } else {
    throw new Error(`Invalid Internal Link Health Score: ${result.internal_link_score}`);
  }

  console.log("\n=== Phase 7 Verification Completed Successfully ===");
}

runPhase7Verification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
