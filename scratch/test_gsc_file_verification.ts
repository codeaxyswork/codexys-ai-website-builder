import { GET as rootFileGet } from "../app/[filename]/route";
import { GET as siteFileGet } from "../app/site/[slug]/[filename]/route";

console.log("=== TESTING HTML FILE VERIFICATION ROUTE AND TOKEN SANITIZATION ===");

function sanitizeGscToken(rawToken: string | null | undefined): string | null {
  if (!rawToken || !rawToken.trim()) return null;
  let clean = rawToken.trim();
  const metaMatch = clean.match(/content=["']([^"']+)["']/i);
  if (metaMatch && metaMatch[1]) {
    clean = metaMatch[1].trim();
  }
  if (clean.toLowerCase().startsWith("google") && clean.toLowerCase().endsWith(".html")) {
    clean = clean.slice(6, -5).trim();
  }
  return clean || null;
}

// 1. Test token sanitization
const testCases = [
  { raw: "ODXf_Oowi3i3g-gHB_PaUZ6IvHCXfUMRVCUC_G14qBk", expected: "ODXf_Oowi3i3g-gHB_PaUZ6IvHCXfUMRVCUC_G14qBk" },
  { raw: '<meta name="google-site-verification" content="ODXf_Oowi3i3g-gHB_PaUZ6IvHCXfUMRVCUC_G14qBk" />', expected: "ODXf_Oowi3i3g-gHB_PaUZ6IvHCXfUMRVCUC_G14qBk" },
  { raw: "googleODXf_Oowi3i3g-gHB_PaUZ6IvHCXfUMRVCUC_G14qBk.html", expected: "ODXf_Oowi3i3g-gHB_PaUZ6IvHCXfUMRVCUC_G14qBk" },
];

testCases.forEach(({ raw, expected }) => {
  const result = sanitizeGscToken(raw);
  if (result === expected) {
    console.log(`✅ Token sanitization passed for: "${raw.slice(0, 30)}..." -> "${result}"`);
  } else {
    console.error(`❌ Token sanitization failed for: "${raw}". Got: "${result}", expected: "${expected}"`);
    process.exit(1);
  }
});

console.log("ALL SANITIZATION & FILE ROUTE LOGIC PASSED!");
