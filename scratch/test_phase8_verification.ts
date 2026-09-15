import { analyzeLocalSEO, generateLocalBusinessSchema, LocalBusinessProfile, PageContentInput } from "../lib/local-seo-engine";

async function runPhase8Verification() {
  console.log("=== Phase 8 Local SEO Engine Verification ===");

  const mockProfile: LocalBusinessProfile = {
    business_name: "Codeaxys Web Agency",
    business_type: "ProfessionalService",
    primary_category: "Web Design Agency",
    phone: "+1 (512) 555-0199",
    address_line1: "100 Congress Ave",
    city: "Austin",
    state_region: "TX",
    postal_code: "78701",
    country: "US",
    business_description: "Top-rated digital agency in Austin, TX offering AI web design services.",
    website_url: "https://codeaxys.site",
    latitude: 30.2672,
    longitude: -97.7431,
    price_range: "$$",
    gbp_profile_url: "https://maps.google.com/?cid=123456",
  };

  const mockPages: PageContentInput[] = [
    {
      path: "index.html",
      htmlContent: `<html><head><title>Codeaxys Web Agency - Austin Web Design</title></head><body><h1>Austin Web Design & AI Solutions</h1><p>Call Codeaxys Web Agency at +1 (512) 555-0199. Located in Austin, TX.</p></body></html>`,
      title: "Codeaxys Web Agency - Austin Web Design",
      focus_keywords: ["austin web design", "codeaxys"],
    },
    {
      path: "services",
      htmlContent: `<html><head><title>Web Development Services in Austin</title></head><body><h1>Services offered in Austin, TX</h1><p>Contact Codeaxys Web Agency.</p></body></html>`,
      title: "Web Development Services in Austin",
    },
  ];

  // 1. Verify Local Business Schema Generator
  console.log("\n1. Testing LocalBusiness JSON-LD Schema Generator...");
  const schemaObj = generateLocalBusinessSchema(mockProfile);

  if (schemaObj && schemaObj["@type"] === "ProfessionalService" && schemaObj.name === "Codeaxys Web Agency") {
    console.log("  ✓ Correct schema @type (ProfessionalService) and business name.");
  } else {
    throw new Error("Schema generation failed for ProfessionalService!");
  }

  if (schemaObj?.address?.addressLocality === "Austin" && schemaObj?.telephone === "+1 (512) 555-0199") {
    console.log("  ✓ PostalAddress locality and telephone correctly mapped.");
  } else {
    throw new Error("Schema PostalAddress or telephone mapping failed!");
  }

  if (schemaObj?.geo?.latitude === 30.2672 && schemaObj?.geo?.longitude === -97.7431) {
    console.log("  ✓ GeoCoordinates (lat/lng) correctly mapped.");
  } else {
    throw new Error("Schema GeoCoordinates mapping failed!");
  }

  // 2. Verify Local SEO Analysis Engine
  console.log("\n2. Testing Deterministic Local SEO Analysis Engine...");
  const analysis = analyzeLocalSEO(mockProfile, mockPages);

  if (analysis.nap_health.name_status === "consistent") {
    console.log("  ✓ Business Name NAP consistency verified.");
  } else {
    throw new Error(`Business Name NAP check failed! (status: ${analysis.nap_health.name_status})`);
  }

  if (analysis.nap_health.phone_status === "consistent") {
    console.log("  ✓ Phone Number NAP consistency verified.");
  } else {
    throw new Error(`Phone Number NAP check failed! (status: ${analysis.nap_health.phone_status})`);
  }

  if (analysis.nap_health.address_status === "consistent") {
    console.log("  ✓ City/Address NAP consistency verified.");
  } else {
    throw new Error(`Address NAP check failed! (status: ${analysis.nap_health.address_status})`);
  }

  console.log("\n3. Testing Local Keyword & Location Signals...");
  if (analysis.local_keyword_health.pages_with_location_terms === 2) {
    console.log("  ✓ Location signals ('Austin') detected across all 2 audited pages.");
  } else {
    throw new Error(`Location keyword detection failed! (pagesWithLocation: ${analysis.local_keyword_health.pages_with_location_terms})`);
  }

  console.log("\n4. Testing Local SEO Health Score...");
  if (analysis.local_seo_score >= 80 && analysis.local_seo_score <= 100) {
    console.log(`  ✓ Local SEO Health Score calculated cleanly: ${analysis.local_seo_score}/100.`);
  } else {
    throw new Error(`Invalid Local SEO Health Score: ${analysis.local_seo_score}`);
  }

  console.log("\n=== Phase 8 Verification Completed Successfully ===");
}

runPhase8Verification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
