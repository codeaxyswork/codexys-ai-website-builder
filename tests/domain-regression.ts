import { normalizeCustomDomainInput, getWebsitePublicUrl, getWebsiteProductionUrl } from "../lib/domain-resolver";

function runTests() {
  console.log("=== RUNNING SECTION 22 REGRESSION TESTS ===");
  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${details ? "- " + details : ""}`);
      failed++;
    }
  }

  // TEST 1: example.com
  const t1 = normalizeCustomDomainInput("example.com");
  assert("TEST 1: example.com", t1.isValid && t1.canonicalDomain === "example.com" && t1.hasWww === false);

  // TEST 2: www.example.com
  const t2 = normalizeCustomDomainInput("www.example.com");
  assert("TEST 2: www.example.com", t2.isValid && t2.canonicalDomain === "example.com" && t2.hasWww === true);

  // TEST 3: https://example.com/
  const t3 = normalizeCustomDomainInput("https://example.com/");
  assert("TEST 3: https://example.com/", t3.isValid && t3.canonicalDomain === "example.com");

  // TEST 4: Hyphenated domain: my-company.com
  const t4 = normalizeCustomDomainInput("https://www.My-Company.com/contact?foo=bar#target");
  assert("TEST 4: my-company.com", t4.isValid && t4.canonicalDomain === "my-company.com");

  // TEST 5 & 6: Canonical URL with unverified vs verified custom domain
  const unverifiedSite = {
    slug: "site-a",
    published_slug: "site-a",
    custom_domain: "company-a.com",
    custom_domain_verified: false,
    custom_domain_status: "pending_dns",
    is_published: true,
  };
  const urlUnverified = getWebsitePublicUrl(unverifiedSite);
  assert(
    "TEST 5: Unverified domain falls back to Codeaxys subdomain",
    urlUnverified === "https://site-a.codeaxys.com/",
    `Got: ${urlUnverified}`
  );

  const verifiedSite = {
    slug: "site-a",
    published_slug: "site-a",
    custom_domain: "company-a.com",
    custom_domain_verified: true,
    custom_domain_status: "ready",
    is_published: true,
  };
  const urlVerified = getWebsitePublicUrl(verifiedSite);
  assert(
    "TEST 6: Verified domain resolves to https://company-a.com/",
    urlVerified === "https://company-a.com/",
    `Got: ${urlVerified}`
  );

  // TEST 7: Invalid domain input rejection
  const invalid1 = normalizeCustomDomainInput("codeaxys.com");
  assert("TEST 7a: Reject platform domain", !invalid1.isValid);

  const invalid2 = normalizeCustomDomainInput("192.168.1.1");
  assert("TEST 7b: Reject IP address", !invalid2.isValid);

  const invalid3 = normalizeCustomDomainInput("bad_domain.com");
  assert("TEST 7c: Reject invalid characters", !invalid3.isValid);

  // TEST 8: getWebsiteProductionUrl with subpaths
  const subpathUrl = getWebsitePublicUrl(verifiedSite, { subpath: "pricing" });
  assert(
    "TEST 8: Subpath canonical URL",
    subpathUrl === "https://company-a.com/pricing",
    `Got: ${subpathUrl}`
  );

  // TEST 9: Fallback published website without custom domain
  const standardSite = {
    slug: "saiprosteel",
    published_slug: "saiprosteel",
    is_published: true,
  };
  const prodUrl = getWebsiteProductionUrl(standardSite);
  assert(
    "TEST 9: Codeaxys subdomain canonical production URL",
    prodUrl === "https://saiprosteel.codeaxys.com/",
    `Got: ${prodUrl}`
  );

  // TEST 10: Multi-part ccTLD (e.g. .co.uk)
  const t10 = normalizeCustomDomainInput("https://www.brand.co.uk/services");
  assert(
    "TEST 10: Multi-part ccTLD extraction",
    t10.isValid && t10.canonicalDomain === "brand.co.uk",
    `Got: ${t10.canonicalDomain}`
  );

  console.log(`\nRegression Test Summary: ${passed} Passed, ${failed} Failed`);
}

runTests();
