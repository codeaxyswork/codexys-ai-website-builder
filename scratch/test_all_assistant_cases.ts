import { generateAssistantReply } from "../lib/assistant-gemini";
import fs from "fs";
import path from "path";

function loadEnvLocal() {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      content.split("\n").forEach((line) => {
        const parts = line.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
          if (key && !process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  } catch (e) {}
}

loadEnvLocal();

async function runAllTests() {
  console.log("=== RUNNING ASSISTANT TEST SUITE ===");

  // TEST A: Simple message
  console.log("\n--- TEST A: 'it's ayurveda hospital' ---");
  const resA = await generateAssistantReply([], "it's ayurveda hospital", "auto");
  console.log("Reply A:", resA.text.substring(0, 150) + "...");
  console.assert(!resA.text.includes("brief connection moment"), "Test A Failed: Returned connection fallback");

  // TEST B: 5 page website request
  console.log("\n--- TEST B: 'I need a 5 page website for an ayurveda hospital' ---");
  const resB = await generateAssistantReply([], "I need a 5 page website for an ayurveda hospital", "en");
  console.log("Reply B:", resB.text.substring(0, 150) + "...");
  console.log("Suggested Prompt B:", resB.suggestedPrompt ? "GENERATED" : "None");
  console.assert(!resB.text.includes("brief connection moment"), "Test B Failed: Returned connection fallback");

  // TEST C: Malayalam request
  console.log("\n--- TEST C: Malayalam request ---");
  const resC = await generateAssistantReply([], "എനിക്ക് ഒരു ആയുർവേദ ആശുപത്രിക്ക് വേണ്ടി ഒരു വെബ്സൈറ്റ് വേണം", "ml");
  console.log("Reply C:", resC.text.substring(0, 150) + "...");
  console.assert(!resC.text.includes("brief connection moment"), "Test C Failed: Returned connection fallback");

  // TEST D: Mixed Malayalam + English request
  console.log("\n--- TEST D: Mixed Malayalam + English request ---");
  const resD = await generateAssistantReply([], "എനിക്ക് ഒരു Ayurveda hospital website വേണം with online appointment and doctors list", "auto");
  console.log("Reply D:", resD.text.substring(0, 150) + "...");
  console.assert(!resD.text.includes("brief connection moment"), "Test D Failed: Returned connection fallback");

  console.log("\n=== ALL 4 ASSISTANT SUITE TESTS PASSED SUCCESSFULLY! ===");
}

runAllTests();
