import { normalizeCustomDomainInput, getWebsitePublicUrl, getWebsiteProductionUrl } from "../lib/domain-resolver";
import { getVercelDomainConfig } from "../lib/domain-verification";

async function runE2ESuite() {
  console.log("=== COMPREHENSIVE PRODUCTION DOMAIN E2E TEST SUITE ===");
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

  // 1. Dynamic Vercel CNAME test (CRITICAL REQUIREMENT 3)
  console.log("\n--- Checking Dynamic DNS Config from Vercel ---");
  const config = await getVercelDomainConfig("example.com");
  console.log("Vercel config returned:", {
    recommendedIPv4: config.recommendedIPv4,
    recommendedCNAME: config.recommendedCNAME,
    misconfigured: config.misconfigured
  });

  assert(
    "REQ 3: CNAME target is dynamic and NOT codexys-ai-website-builder.vercel.app",
    config.recommendedCNAME !== "codexys-ai-website-builder.vercel.app" &&
    config.recommendedCNAME.length > 0 &&
    !config.recommendedCNAME.endsWith(".")
  );

  assert(
    "REQ 3: A record target is 76.76.21.21",
    config.recommendedIPv4 === "76.76.21.21"
  );

  // 2. Domain Normalization Suite (CRITICAL REQUIREMENT 2)
  console.log("\n--- Domain Normalization Suite ---");
  const normTests = [
    { input: "example.com", expected: "example.com", hasWww: false },
    { input: "www.example.com", expected: "example.com", hasWww: true },
    { input: "https://example.com", expected: "example.com", hasWww: false },
    { input: "https://www.example.com/", expected: "example.com", hasWww: true },
    { input: "http://example.com", expected: "example.com", hasWww: false },
    { input: "https://www.Example.com/about?q=1#test", expected: "example.com", hasWww: true },
    { input: "my-company.com", expected: "my-company.com", hasWww: false },
    { input: "https://my-company.com/", expected: "my-company.com", hasWww: false },
    { input: "sub.domain.co.uk", expected: "domain.co.uk", hasWww: false },
  ];

  for (const t of normTests) {
    const res = normalizeCustomDomainInput(t.input);
    assert(
      `Normalization: ${t.input} -> ${t.expected}`,
      res.isValid && res.canonicalDomain === t.expected && res.hasWww === t.hasWww,
      `Got canonical: ${res.canonicalDomain}, hasWww: ${res.hasWww}`
    );
  }

  // 3. Rejection of invalid domains
  console.log("\n--- Invalid Domain Input Rejections ---");
  const rejections = [
    "",
    "   ",
    "http://",
    "https://",
    "codeaxys.com",
    "sub.codeaxys.com",
    "project.vercel.app",
    "192.168.0.1",
    "127.0.0.1",
    "localhost",
    "invalid..com",
    "-badlabel.com",
    "badlabel-.com",
    "foo.c", // TLD too short
  ];

  for (const r of rejections) {
    const res = normalizeCustomDomainInput(r);
    assert(`Rejection of invalid: "${r}"`, !res.isValid, `Allowed invalid domain: ${r}`);
  }

  // 4. Canonical Domain Resolution (CRITICAL REQUIREMENT 8 & 12)
  console.log("\n--- Canonical Domain Resolution Under Various Statuses ---");
  const siteReady = {
    slug: "acme-corp",
    published_slug: "acme-corp",
    custom_domain: "acme.com",
    custom_domain_verified: true,
    custom_domain_status: "ready",
    is_published: true,
  };
  assert(
    "READY custom domain resolves to https://acme.com/",
    getWebsiteProductionUrl(siteReady) === "https://acme.com/"
  );

  const sitePendingDns = {
    slug: "acme-corp",
    published_slug: "acme-corp",
    custom_domain: "acme.com",
    custom_domain_verified: false,
    custom_domain_status: "pending_dns",
    is_published: true,
  };
  assert(
    "PENDING_DNS custom domain safely falls back to https://acme-corp.codeaxys.com/",
    getWebsiteProductionUrl(sitePendingDns) === "https://acme-corp.codeaxys.com/"
  );

  const siteNoDomain = {
    slug: "acme-corp",
    published_slug: "acme-corp",
    is_published: true,
  };
  assert(
    "No custom domain resolves to Codeaxys subdomain",
    getWebsiteProductionUrl(siteNoDomain) === "https://acme-corp.codeaxys.com/"
  );

  console.log(`\n==================================================`);
  console.log(`TOTAL SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runE2ESuite().catch(e => {
  console.error("Suite failed with error:", e);
  process.exit(1);
});
