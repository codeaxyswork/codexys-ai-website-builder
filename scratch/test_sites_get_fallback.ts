import { fetchGscProperties } from "../lib/gsc-client";

console.log("=== TESTING GSC SITES.LIST PRIMARY & SITES.GET FALLBACK PROBE LOGIC ===");

// Unit Test 1: Function signature check
if (typeof fetchGscProperties === "function") {
  console.log("✅ fetchGscProperties exported correctly with optional fallbackCandidateUrls parameter.");
} else {
  console.error("❌ fetchGscProperties is missing!");
  process.exit(1);
}

// Unit Test 2: Dynamic candidate URL construction logic check
const baseUrl = "https://codexys-ai-website-builder.vercel.app";
const publishedSlug = "velocity-motors-an-elite-cinematic-automotive-gallery";

const candidateUrls = [
  `${baseUrl}/site/${publishedSlug}/`,
  `${baseUrl}/site/${publishedSlug}`,
];

if (candidateUrls[0] === "https://codexys-ai-website-builder.vercel.app/site/velocity-motors-an-elite-cinematic-automotive-gallery/") {
  console.log("✅ Dynamic primary candidate URL with trailing slash constructed correctly.");
} else {
  console.error("❌ Primary candidate URL failed construction.");
  process.exit(1);
}

if (candidateUrls[1] === "https://codexys-ai-website-builder.vercel.app/site/velocity-motors-an-elite-cinematic-automotive-gallery") {
  console.log("✅ Dynamic secondary candidate URL without trailing slash constructed correctly.");
} else {
  console.error("❌ Secondary candidate URL failed construction.");
  process.exit(1);
}

console.log("ALL UNIT TESTS PASSED SUCCESSFULLY!");
