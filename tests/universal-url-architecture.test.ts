import {
  normalizePagePath,
  getWebsitePublicUrl,
  getWebsitePageUrl,
  getWebsitePreviewUrl,
  getWebsiteProductionUrl,
  deriveCanonicalDomainSlug,
  normalizeCustomDomainInput,
} from "../lib/domain-resolver";
import { assemblePublishedWebsite } from "../lib/site-renderer";
import { localizeHtmlLinks, buildLocalPageMap } from "../lib/migration/link-localizer";

function runUniversalUrlTests() {
  console.log("================================================================================");
  console.log("UNIVERSAL CLEAN PUBLIC URL ARCHITECTURE — AUTOMATED REGRESSION SUITE");
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  function assert(testId: string, name: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testId}: ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testId}: ${name} ${details ? "- " + details : ""}`);
      failed++;
    }
  }

  // ==========================================================================
  // SUITE 1: PATH NORMALIZATION (Requirement 11)
  // ==========================================================================
  console.log("\n--- Suite 1: Path Normalization ---");

  assert("1.1", "Empty string normalizes to '/'", normalizePagePath("") === "/");
  assert("1.2", "Root slash normalizes to '/'", normalizePagePath("/") === "/");
  assert("1.3", "Double slash normalizes to '/'", normalizePagePath("//") === "/");
  assert("1.4", "Index normalizes to '/'", normalizePagePath("index") === "/");
  assert("1.5", "index.html normalizes to '/'", normalizePagePath("index.html") === "/");
  assert("1.6", "/index.html normalizes to '/'", normalizePagePath("/index.html") === "/");
  assert("1.7", "/about-us normalizes to '/about-us'", normalizePagePath("/about-us") === "/about-us");
  assert("1.8", "/about-us/ trailing slash stripped to '/about-us'", normalizePagePath("/about-us/") === "/about-us");
  assert("1.9", "about-us without leading slash normalizes to '/about-us'", normalizePagePath("about-us") === "/about-us");
  assert("1.10", "about-us.html normalizes to '/about-us'", normalizePagePath("about-us.html") === "/about-us");
  assert("1.11", "/services/web-design/ nested path normalizes to '/services/web-design'", normalizePagePath("/services/web-design/") === "/services/web-design");
  assert("1.12", "/blog/example-post normalizes to '/blog/example-post'", normalizePagePath("/blog/example-post") === "/blog/example-post");
  assert("1.13", "Internal /site/brand/ stripped to '/'", normalizePagePath("/site/brand/") === "/");
  assert("1.14", "Internal /site/brand/about-us stripped to '/about-us'", normalizePagePath("/site/brand/about-us") === "/about-us");
  assert("1.15", "Internal /site/brand/blog/post-1 stripped to '/blog/post-1'", normalizePagePath("/site/brand/blog/post-1") === "/blog/post-1");
  assert("1.16", "Query param preserved on root: '/?preview=true'", normalizePagePath("/?preview=true") === "/?preview=true");
  assert("1.17", "Query param preserved on subpath: '/about-us?preview=true#team'", normalizePagePath("/about-us?preview=true#team") === "/about-us?preview=true#team");
  assert("1.18", "Duplicate slashes collapsed: '///contact///'", normalizePagePath("///contact///") === "/contact");

  // ==========================================================================
  // SUITE 2: CANONICAL PUBLIC HOMEPAGE (Requirements 1, 3, 10)
  // ==========================================================================
  console.log("\n--- Suite 2: Canonical Public Homepage ---");

  const siteSimple = { slug: "brandname", published_slug: "brandname", is_published: true };
  const siteHyphen = { slug: "my-company", published_slug: "my-company", is_published: true };
  const siteMultiWord = { slug: "abc-consulting", published_slug: "abc-consulting", is_published: true };

  assert(
    "2.1",
    "Simple domain homepage is https://brandname.codeaxys.com/",
    getWebsitePublicUrl(siteSimple) === "https://brandname.codeaxys.com/"
  );
  assert(
    "2.2",
    "Hyphenated domain homepage is https://my-company.codeaxys.com/",
    getWebsitePublicUrl(siteHyphen) === "https://my-company.codeaxys.com/"
  );
  assert(
    "2.3",
    "Multi-word domain homepage is https://abc-consulting.codeaxys.com/",
    getWebsitePublicUrl(siteMultiWord) === "https://abc-consulting.codeaxys.com/"
  );
  assert(
    "2.4",
    "Empty path or '/' returns homepage https://brandname.codeaxys.com/",
    getWebsitePageUrl(siteSimple, "/") === "https://brandname.codeaxys.com/" &&
    getWebsitePageUrl(siteSimple, "") === "https://brandname.codeaxys.com/" &&
    getWebsitePageUrl(siteSimple, "index.html") === "https://brandname.codeaxys.com/"
  );

  // ==========================================================================
  // SUITE 3: INTERNAL PAGE CLEAN PUBLIC URLS (Requirements 1, 2, 4)
  // ==========================================================================
  console.log("\n--- Suite 3: Internal Page Clean Public URLs ---");

  assert(
    "3.1",
    "About Us page is https://brandname.codeaxys.com/about-us",
    getWebsitePageUrl(siteSimple, "/about-us") === "https://brandname.codeaxys.com/about-us"
  );
  assert(
    "3.2",
    "Services page is https://brandname.codeaxys.com/services",
    getWebsitePageUrl(siteSimple, "services") === "https://brandname.codeaxys.com/services"
  );
  assert(
    "3.3",
    "Contact Us page is https://brandname.codeaxys.com/contact-us",
    getWebsitePageUrl(siteSimple, "/contact-us/") === "https://brandname.codeaxys.com/contact-us"
  );
  assert(
    "3.4",
    "Blog index is https://brandname.codeaxys.com/blog",
    getWebsitePageUrl(siteSimple, "/blog") === "https://brandname.codeaxys.com/blog"
  );
  assert(
    "3.5",
    "Nested blog post is https://brandname.codeaxys.com/blog/example-post",
    getWebsitePageUrl(siteSimple, "/blog/example-post") === "https://brandname.codeaxys.com/blog/example-post"
  );
  assert(
    "3.6",
    "Public page URLs NEVER contain '/site/'",
    !getWebsitePageUrl(siteSimple, "/about-us").includes("/site/") &&
    !getWebsitePageUrl(siteSimple, "/services").includes("/site/") &&
    !getWebsitePageUrl(siteSimple, "/blog/example-post").includes("/site/")
  );

  // ==========================================================================
  // SUITE 4: MIGRATED WEBSITES (Requirements 5, 13)
  // ==========================================================================
  console.log("\n--- Suite 4: Migrated Websites ---");

  // Test .in domain migration
  const slugNeopraxis = deriveCanonicalDomainSlug("https://www.neopraxis.in");
  const siteNeopraxis = { slug: slugNeopraxis, published_slug: slugNeopraxis, is_published: true };
  assert("4.1", "neopraxis.in slug derives to 'neopraxis'", slugNeopraxis === "neopraxis");
  assert(
    "4.2",
    "Migrated .in website homepage is https://neopraxis.codeaxys.com/",
    getWebsitePublicUrl(siteNeopraxis) === "https://neopraxis.codeaxys.com/"
  );
  assert(
    "4.3",
    "Migrated .in internal page is https://neopraxis.codeaxys.com/about-us",
    getWebsitePageUrl(siteNeopraxis, "about-us") === "https://neopraxis.codeaxys.com/about-us"
  );

  // Test .com domain migration
  const slugSaipro = deriveCanonicalDomainSlug("https://saiprosteel.com");
  const siteSaipro = { slug: slugSaipro, published_slug: slugSaipro, is_published: true };
  assert("4.4", "saiprosteel.com slug derives to 'saiprosteel'", slugSaipro === "saiprosteel");
  assert(
    "4.5",
    "Migrated .com website homepage is https://saiprosteel.codeaxys.com/",
    getWebsitePublicUrl(siteSaipro) === "https://saiprosteel.codeaxys.com/"
  );
  assert(
    "4.6",
    "Migrated .com internal page is https://saiprosteel.codeaxys.com/products",
    getWebsitePageUrl(siteSaipro, "/products/") === "https://saiprosteel.codeaxys.com/products"
  );

  // Test link localization during migration produces clean paths (no /site/)
  const mockPages = [
    { path: "index.html", original_url: "https://neopraxis.in/" },
    { path: "about-us.html", original_url: "https://neopraxis.in/about-us/" },
    { path: "services.html", original_url: "https://neopraxis.in/services/" },
  ];
  const { pageMap } = buildLocalPageMap(mockPages, "https://neopraxis.in");

  assert("4.7", "Page map maps index to '/'", pageMap.get("index") === "/");
  assert("4.8", "Page map maps about-us to '/about-us'", pageMap.get("about-us") === "/about-us");
  assert("4.9", "Page map maps services to '/services'", pageMap.get("services") === "/services");

  const originalHtml = `
    <nav>
      <a href="https://neopraxis.in/">Home</a>
      <a href="https://neopraxis.in/about-us/">About Us</a>
      <a href="https://neopraxis.in/services/">Services</a>
    </nav>
  `;
  const localized = localizeHtmlLinks(originalHtml, pageMap, ["neopraxis.in", "www.neopraxis.in"]);

  assert(
    "4.10",
    "Migrated HTML links are rewritten to clean root-relative paths without /site/",
    localized.html.includes('href="/"') &&
    localized.html.includes('href="/about-us"') &&
    localized.html.includes('href="/services"') &&
    !localized.html.includes("/site/")
  );

  // ==========================================================================
  // SUITE 5: AI-GENERATED WEBSITES (Requirements 6, 13)
  // ==========================================================================
  console.log("\n--- Suite 5: AI-Generated Websites ---");

  const siteAIGen = { slug: "modern-dental-clinic", published_slug: "modern-dental-clinic", is_published: true };
  assert(
    "5.1",
    "AI-generated website homepage is https://modern-dental-clinic.codeaxys.com/",
    getWebsitePublicUrl(siteAIGen) === "https://modern-dental-clinic.codeaxys.com/"
  );
  assert(
    "5.2",
    "AI-generated website booking page is https://modern-dental-clinic.codeaxys.com/book-appointment",
    getWebsitePageUrl(siteAIGen, "/book-appointment") === "https://modern-dental-clinic.codeaxys.com/book-appointment"
  );
  assert(
    "5.3",
    "AI generation and Migration share the exact same resolver",
    getWebsitePublicUrl(siteAIGen).endsWith(".codeaxys.com/") &&
    getWebsitePublicUrl(siteNeopraxis).endsWith(".codeaxys.com/")
  );

  // ==========================================================================
  // SUITE 6: PREVIEW MODE (Requirement 8)
  // ==========================================================================
  console.log("\n--- Suite 6: Preview Mode ---");

  const draftSite = { slug: "draft-concept", published_slug: null, is_published: false };
  const previewHome = getWebsitePreviewUrl(draftSite);
  const previewPage = getWebsitePreviewUrl(draftSite, { subpath: "/about-us" });

  assert(
    "6.1",
    "Preview homepage URL is https://draft-concept.codeaxys.com/?preview=true",
    previewHome === "https://draft-concept.codeaxys.com/?preview=true",
    `Got: ${previewHome}`
  );
  assert(
    "6.2",
    "Preview internal page URL is https://draft-concept.codeaxys.com/about-us?preview=true",
    previewPage === "https://draft-concept.codeaxys.com/about-us?preview=true",
    `Got: ${previewPage}`
  );
  assert(
    "6.3",
    "Preview URLs NEVER leak /site/ in public subdomains",
    !previewHome.includes("/site/") && !previewPage.includes("/site/")
  );

  // ==========================================================================
  // SUITE 7: CUSTOM DOMAINS (Requirements 1, 7, 10)
  // ==========================================================================
  console.log("\n--- Suite 7: Custom Domains ---");

  const customSite = {
    slug: "mycorp",
    published_slug: "mycorp",
    custom_domain: "my-company.com",
    custom_domain_verified: true,
    custom_domain_status: "ready",
    is_published: true,
  };

  assert(
    "7.1",
    "Verified custom domain homepage is https://my-company.com/",
    getWebsitePublicUrl(customSite) === "https://my-company.com/"
  );
  assert(
    "7.2",
    "Verified custom domain page is https://my-company.com/about-us",
    getWebsitePageUrl(customSite, "about-us") === "https://my-company.com/about-us"
  );
  assert(
    "7.3",
    "Verified custom domain blog is https://my-company.com/blog/announcement",
    getWebsitePageUrl(customSite, "/blog/announcement") === "https://my-company.com/blog/announcement"
  );

  // ==========================================================================
  // SUITE 8: ASSEMBLE PUBLISHED WEBSITE (Requirements 2, 4)
  // ==========================================================================
  console.log("\n--- Suite 8: Assembled HTML & Client Interceptor Removal ---");

  const renderedHtml = assemblePublishedWebsite({
    htmlContent: `
      <header>
        <a href="/" id="logo">Logo</a>
        <nav>
          <a href="/about-us">About</a>
          <a href="/services">Services</a>
          <a href="/contact-us">Contact</a>
        </nav>
      </header>
      <main><h1>Welcome</h1></main>
      <footer><a href="/privacy-policy">Privacy</a></footer>
    `,
    cssContent: "body { margin: 0; }",
    jsContent: "console.log('init');",
    slug: "brandname",
  });

  assert(
    "8.1",
    "Assembled HTML preserves clean logo link '/'",
    renderedHtml.includes('href="/"')
  );
  assert(
    "8.2",
    "Assembled HTML preserves clean navigation links '/about-us', '/services', '/contact-us'",
    renderedHtml.includes('href="/about-us"') &&
    renderedHtml.includes('href="/services"') &&
    renderedHtml.includes('href="/contact-us"')
  );
  assert(
    "8.3",
    "Assembled HTML DOES NOT contain codeaxys-link-interceptor script",
    !renderedHtml.includes("codeaxys-link-interceptor") &&
    !renderedHtml.includes("mnc?conline")
  );
  assert(
    "8.4",
    "Assembled HTML DOES NOT contain any client-side /site/ redirects",
    !renderedHtml.includes("window.location.href = '/site/'")
  );

  // ==========================================================================
  // SUITE 9: GENERIC DOMAIN SLUG DERIVATIONS (Requirement 13)
  // ==========================================================================
  console.log("\n--- Suite 9: Generic Domain Slug Derivations (No Hardcoding) ---");

  const domainTests = [
    { input: "example.com", expected: "example" },
    { input: "www.example.com", expected: "example" },
    { input: "https://my-company.com/", expected: "my-company" },
    { input: "https://abc-consulting.in", expected: "abc-consulting" },
    { input: "https://www.greenvalleyhospital.com/contact", expected: "greenvalleyhospital" },
    { input: "https://subdomain.co.uk", expected: "subdomain" },
    { input: "https://saiprosteel.qa", expected: "saiprosteel" },
    { input: "https://www.neopraxis.in/about", expected: "neopraxis" },
  ];

  domainTests.forEach((d, idx) => {
    const derived = deriveCanonicalDomainSlug(d.input);
    assert(
      `9.${idx + 1}`,
      `Derive slug: "${d.input}" -> "${d.expected}"`,
      derived === d.expected,
      `Got: ${derived}`
    );
  });

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log("\n================================================================================");
  console.log(`TOTAL REGRESSION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runUniversalUrlTests();
