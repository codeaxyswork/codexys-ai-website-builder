import { deriveWebsiteTitle } from "../lib/website-title-helper";
import { WebsitePlan, GeneratedFile } from "../lib/types";

function runTests() {
  console.log("=== TESTING WEBSITE TITLE HELPER ===");

  // Test 1: Clean brandIdentity provided
  const plan1: WebsitePlan = {
    websiteType: "Luxury Car Showroom",
    brandIdentity: "Velocity Motors",
    designDirection: "",
    colorPalette: [],
    typographyDirection: "",
    layoutStrategy: "",
    sections: [],
  };
  const t1 = deriveWebsiteTitle(plan1, [], "Create a luxury hypercar showroom website");
  console.log("Test 1 (Clean brandIdentity):", t1 === "Velocity Motors" ? "PASS" : `FAIL (${t1})`);

  // Test 2: Voice prompt stored as brandIdentity, HTML <title> contains actual business name
  const plan2: WebsitePlan = {
    websiteType: "Fitness Center",
    brandIdentity: "see I don't first of all I don't want any kind of a Malayalam text on my website",
    designDirection: "",
    colorPalette: [],
    typographyDirection: "",
    layoutStrategy: "",
    sections: [],
  };
  const files2: GeneratedFile[] = [
    { path: "index.html", content: "<!DOCTYPE html><html><head><title>Apex Fitness Gym - World Class Training</title></head><body></body></html>" }
  ];
  const t2 = deriveWebsiteTitle(plan2, files2, "see I don't first of all I don't want any kind of a Malayalam text...");
  console.log("Test 2 (Prompt brandIdentity + HTML title):", t2 === "Apex Fitness Gym" ? "PASS" : `FAIL (${t2})`);

  // Test 3: Prompt brandIdentity + No HTML title -> Fallback to websiteType
  const plan3: WebsitePlan = {
    websiteType: "Luxury Dental Clinic",
    brandIdentity: "please build a website for my dental clinic with cyan theme",
    designDirection: "",
    colorPalette: [],
    typographyDirection: "",
    layoutStrategy: "",
    sections: [],
  };
  const t3 = deriveWebsiteTitle(plan3, [], "please build a website for my dental clinic with cyan theme");
  console.log("Test 3 (Prompt brandIdentity -> websiteType):", t3 === "Luxury Dental Clinic" ? "PASS" : `FAIL (${t3})`);

  // Test 4: Default fallback
  const t4 = deriveWebsiteTitle(null, [], "");
  console.log("Test 4 (Default fallback):", t4 === "My AI Website" ? "PASS" : `FAIL (${t4})`);
}

runTests();
