import { injectSEOIntoHTML } from "../lib/seo-injector";
import { assemblePublishedWebsite } from "../lib/site-renderer";

console.log("=== TESTING GOOGLE SEARCH CONSOLE VERIFICATION TAG INJECTION ===");

// 1. Velocity Motors site with GSC verification token
const velocityMotorsSeo = {
  seo_title: "Velocity Motors | Elite Cinematic Automotive Gallery",
  google_site_verification_token: "ODXf_Oowi3i3g-gHB_PaUZ6IvHCXfUMRVCUC_G14qBk",
};

const rawHtml = `<!DOCTYPE html><html><head><title>Velocity Motors</title></head><body><h1>Velocity Motors</h1></body></html>`;

const renderedVelocityMotors = assemblePublishedWebsite({
  htmlContent: rawHtml,
  seoSettings: velocityMotorsSeo,
});

const expectedTag = `<meta name="google-site-verification" content="ODXf_Oowi3i3g-gHB_PaUZ6IvHCXfUMRVCUC_G14qBk">`;

if (renderedVelocityMotors.includes(expectedTag)) {
  console.log("✅ Velocity Motors GSC Verification Meta Tag successfully injected into <head>!");
} else {
  console.error("❌ Velocity Motors GSC Verification Meta Tag MISSING!");
  console.log(renderedVelocityMotors);
  process.exit(1);
}

// 2. Per-website Isolation Test: Customer B site with different token
const customerBSeo = {
  seo_title: "Customer B Bakery",
  google_site_verification_token: "DIFFERENT_CUSTOMER_B_TOKEN_12345",
};

const renderedCustomerB = assemblePublishedWebsite({
  htmlContent: rawHtml,
  seoSettings: customerBSeo,
});

if (renderedCustomerB.includes("DIFFERENT_CUSTOMER_B_TOKEN_12345") && !renderedCustomerB.includes("ODXf_Oowi3i3g-gHB_PaUZ6IvHCXfUMRVCUC_G14qBk")) {
  console.log("✅ Per-website isolation verified: Customer B receives ONLY Customer B's token.");
} else {
  console.error("❌ Per-website isolation failed!");
  process.exit(1);
}

// 3. Customer C site with NO verification token
const customerCSeo = {
  seo_title: "Customer C Studio",
  google_site_verification_token: null,
};

const renderedCustomerC = assemblePublishedWebsite({
  htmlContent: rawHtml,
  seoSettings: customerCSeo,
});

if (!renderedCustomerC.includes("google-site-verification")) {
  console.log("✅ No token configured: No google-site-verification meta tag rendered.");
} else {
  console.error("❌ Unexpected google-site-verification meta tag rendered!");
  process.exit(1);
}

console.log("ALL TESTS PASSED SUCCESSFULLY!");
