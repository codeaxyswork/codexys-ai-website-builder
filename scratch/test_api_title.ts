import { deriveWebsiteTitle } from "../lib/website-title-helper";

console.log("==========================================");
console.log("FINAL SYSTEM TITLE CLEANING VERIFICATION");
console.log("==========================================");

const rawDbTitle = "see I don't first of all I don't want any kind of a Malay...";
const promptText = "Create a premium luxury car showroom website called Velocity Motors.";
const plan = {
  brandIdentity: "see I don't first of all I don't want any kind of a Malayalam text...",
  websiteType: "Custom Website",
  designDirection: "Modern",
  colorPalette: [],
  typographyDirection: "Inter",
  layoutStrategy: "Clean",
  sections: [],
};
const files = [
  { path: "index.html", content: "<!DOCTYPE html><html><head><title>Velocity Motors - Elite Hypercar Showroom</title></head></html>" }
];

const derived = deriveWebsiteTitle(plan, files, promptText);
console.log(`Raw Database Title:  "${rawDbTitle}"`);
console.log(`Derived Clean Title: "${derived}"`);

const isTitleClean = rawDbTitle && rawDbTitle.length <= 45 && !rawDbTitle.toLowerCase().includes("see i don't") && !rawDbTitle.toLowerCase().includes("create a");
const finalOutput = isTitleClean ? rawDbTitle : derived;

console.log(`Final API & UI Title Rendered: "${finalOutput}"`);
console.log("==========================================");
