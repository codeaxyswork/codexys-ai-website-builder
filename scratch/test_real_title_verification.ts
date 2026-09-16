import { deriveWebsiteTitle } from "../lib/website-title-helper";
import { WebsitePlan, GeneratedFile } from "../lib/types";

console.log("=================================================");
console.log("FINAL WEBSITE NAME VERIFICATION SUITE");
console.log("=================================================\n");

let passCount = 0;
let failCount = 0;

function assertTitle(testName: string, actual: string, expected: string) {
  const passed = actual === expected;
  if (passed) {
    passCount++;
    console.log(`✅ [PASS] ${testName}`);
    console.log(`   Expected: "${expected}"`);
    console.log(`   Actual:   "${actual}"\n`);
  } else {
    failCount++;
    console.log(`❌ [FAIL] ${testName}`);
    console.log(`   Expected: "${expected}"`);
    console.log(`   Actual:   "${actual}"\n`);
  }
}

// ---------------------------------------------------------
// Example 1: Velocity Motors
// Prompt: "Create a premium luxury website for Velocity Motors, a hypercar showroom."
// Expected website name: "Velocity Motors"
// ---------------------------------------------------------
const prompt1 = "Create a premium luxury website for Velocity Motors, a hypercar showroom.";

// Case 1A: AI returns brandIdentity = "Velocity Motors"
const plan1A: WebsitePlan = {
  websiteType: "Hypercar Showroom",
  brandIdentity: "Velocity Motors",
  designDirection: "Luxury Dark Cyberpunk",
  colorPalette: [],
  typographyDirection: "Inter",
  layoutStrategy: "Grid",
  sections: [],
};
assertTitle(
  "Example 1A: Velocity Motors (AI plan has exact brandIdentity)",
  deriveWebsiteTitle(plan1A, [], prompt1),
  "Velocity Motors"
);

// Case 1B: AI plan brandIdentity is corrupted/prompt-like ("Create a premium luxury website for Velocity Motors..."), but HTML title tag has "Velocity Motors - Luxury Hypercars"
const plan1B: WebsitePlan = {
  websiteType: "Hypercar Showroom",
  brandIdentity: "Create a premium luxury website for Velocity Motors, a hypercar showroom.",
  designDirection: "Luxury Dark",
  colorPalette: [],
  typographyDirection: "Inter",
  layoutStrategy: "Grid",
  sections: [],
};
const files1B: GeneratedFile[] = [
  {
    path: "index.html",
    content: "<!DOCTYPE html><html><head><title>Velocity Motors - Elite Hypercar Showroom</title></head><body></body></html>",
  },
];
assertTitle(
  "Example 1B: Velocity Motors (AI brandIdentity corrupted with prompt, fallback to HTML title)",
  deriveWebsiteTitle(plan1B, files1B, prompt1),
  "Velocity Motors"
);

// Case 1C: AI plan brandIdentity is corrupted, HTML title has pipe "| Velocity Motors"
const files1C: GeneratedFile[] = [
  {
    path: "index.html",
    content: "<!DOCTYPE html><html><head><title>Velocity Motors | Premier Hypercar Showroom</title></head><body></body></html>",
  },
];
assertTitle(
  "Example 1C: Velocity Motors (HTML title with pipe '| Velocity Motors')",
  deriveWebsiteTitle(plan1B, files1C, prompt1),
  "Velocity Motors"
);


// ---------------------------------------------------------
// Example 2: ABC Dental Clinic
// Prompt: "Build a modern website for ABC Dental Clinic."
// Expected: "ABC Dental Clinic"
// ---------------------------------------------------------
const prompt2 = "Build a modern website for ABC Dental Clinic.";
const plan2: WebsitePlan = {
  websiteType: "Dental Clinic",
  brandIdentity: "ABC Dental Clinic",
  designDirection: "Modern Clean Medical",
  colorPalette: [],
  typographyDirection: "Roboto",
  layoutStrategy: "Clean",
  sections: [],
};
assertTitle(
  "Example 2: ABC Dental Clinic (AI returns exact brandIdentity)",
  deriveWebsiteTitle(plan2, [], prompt2),
  "ABC Dental Clinic"
);

// ---------------------------------------------------------
// Example 3: Green Valley Resort
// Prompt: "I need a professional website for Green Valley Resort."
// Expected: "Green Valley Resort"
// ---------------------------------------------------------
const prompt3 = "I need a professional website for Green Valley Resort.";
const plan3: WebsitePlan = {
  websiteType: "Luxury Resort",
  brandIdentity: "Green Valley Resort",
  designDirection: "Serene Nature Luxury",
  colorPalette: [],
  typographyDirection: "Outfit",
  layoutStrategy: "Full Width",
  sections: [],
};
assertTitle(
  "Example 3: Green Valley Resort (AI returns exact brandIdentity)",
  deriveWebsiteTitle(plan3, [], prompt3),
  "Green Valley Resort"
);


// ---------------------------------------------------------
// ADDITIONAL SAFETY CRITERIA VERIFICATION
// ---------------------------------------------------------

// Check 1: Raw voice transcript cannot become website name
const voicePrompt = "see I don't first of all I don't want any kind of a Malayalam text on my site make it English";
const planVoice: WebsitePlan = {
  websiteType: "Corporate Business",
  brandIdentity: "see I don't first of all I don't want any kind of a Malayalam text on my site make it English",
  designDirection: "Minimal",
  colorPalette: [],
  typographyDirection: "Inter",
  layoutStrategy: "Standard",
  sections: [],
};
const filesVoice: GeneratedFile[] = [
  {
    path: "index.html",
    content: "<html><head><title>Apex Solutions | Executive Services</title></head><body></body></html>",
  },
];
assertTitle(
  "Safety Check 1: Voice transcript rejected as name, derived from HTML title tag",
  deriveWebsiteTitle(planVoice, filesVoice, voicePrompt),
  "Apex Solutions"
);

// Check 2: Long generation prompt (> 45 chars) cannot become website name
const longPrompt = "Create an ultra-modern high-converting SaaS landing page for CloudMetrics AI analytics platform with blue theme";
const planLongPrompt: WebsitePlan = {
  websiteType: "SaaS Analytics",
  brandIdentity: "Create an ultra-modern high-converting SaaS landing page for CloudMetrics AI analytics platform with blue theme",
  designDirection: "Modern SaaS",
  colorPalette: [],
  typographyDirection: "Inter",
  layoutStrategy: "Modern",
  sections: [],
};
assertTitle(
  "Safety Check 2: Long prompt (>45 chars) rejected, falls back to websiteType ('SaaS Analytics')",
  deriveWebsiteTitle(planLongPrompt, [], longPrompt),
  "SaaS Analytics"
);

// Check 3: If AI already returns a proper brandIdentity ("CloudMetrics AI"), it is preserved
const planProperBrand: WebsitePlan = {
  websiteType: "SaaS Analytics",
  brandIdentity: "CloudMetrics AI",
  designDirection: "Modern SaaS",
  colorPalette: [],
  typographyDirection: "Inter",
  layoutStrategy: "Modern",
  sections: [],
};
assertTitle(
  "Safety Check 3: Proper brandIdentity preserved",
  deriveWebsiteTitle(planProperBrand, [], longPrompt),
  "CloudMetrics AI"
);

// Check 4: websiteType is used ONLY as fallback, NOT as preferred name when brand is available
assertTitle(
  "Safety Check 5: websiteType ('Hypercar Showroom') is NOT used when brandIdentity ('Velocity Motors') exists",
  deriveWebsiteTitle(plan1A, [], prompt1),
  "Velocity Motors"
);

console.log("=================================================");
console.log(`FINAL RESULT: ${passCount} PASSED, ${failCount} FAILED out of ${passCount + failCount} tests.`);
console.log("=================================================");

if (failCount > 0) {
  process.exit(1);
}
