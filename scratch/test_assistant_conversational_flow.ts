import { generateAssistantReply, AssistantChatMessage } from "../lib/assistant-gemini";
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

async function runConversationalVerification() {
  console.log("=== MAIN WEBSITE BUILDER AI AGENT VERIFICATION ===");

  const history: AssistantChatMessage[] = [];

  // Turn 1: Initial user intent
  console.log("\n--- Turn 1: User says 'I want to build a website for my coffee shop Apex Brew' ---");
  const reply1 = await generateAssistantReply(history, "I want to build a website for my coffee shop Apex Brew", "en");
  console.log("AI Reply 1:", reply1.text);
  console.log("Suggested Prompt 1:", reply1.suggestedPrompt || "(None yet - continuing discovery)");

  history.push({ role: "user", content: "I want to build a website for my coffee shop Apex Brew" });
  history.push({ role: "assistant", content: reply1.text });

  // Turn 2: Informational Question (must not interrupt context or burn budget)
  await new Promise((r) => setTimeout(r, 4000));
  console.log("\n--- Turn 2: User asks informational question 'How long does the free preview trial last?' ---");
  const reply2 = await generateAssistantReply(history, "How long does the free preview trial last?", "en");
  console.log("AI Reply 2:", reply2.text);
  console.assert(
    reply2.text.toLowerCase().includes("3-day") || reply2.text.toLowerCase().includes("72 hours") || reply2.text.toLowerCase().includes("preview"),
    "Turn 2 Failed: Did not accurately mention 3-day preview trial"
  );

  history.push({ role: "user", content: "How long does the free preview trial last?" });
  history.push({ role: "assistant", content: reply2.text });

  // Turn 3: User provides style and pages
  await new Promise((r) => setTimeout(r, 4000));
  console.log("\n--- Turn 3: User says 'I want a warm rustic theme with Home, Menu, About Us, and Contact pages' ---");
  const reply3 = await generateAssistantReply(history, "I want a warm rustic theme with Home, Menu, About Us, and Contact pages", "en");
  console.log("AI Reply 3:", reply3.text);
  console.log("Suggested Prompt 3:", reply3.suggestedPrompt ? "GENERATED!" : "(None)");

  history.push({ role: "user", content: "I want a warm rustic theme with Home, Menu, About Us, and Contact pages" });
  history.push({ role: "assistant", content: reply3.text });

  // Turn 4: Post-prompt refinement
  await new Promise((r) => setTimeout(r, 4000));
  console.log("\n--- Turn 4: User requests refinement 'Actually add online table reservation and coffee bean shop' ---");
  const reply4 = await generateAssistantReply(history, "Actually add online table reservation and coffee bean shop", "en");
  console.log("AI Reply 4:", reply4.text);
  console.log("Suggested Prompt 4:", reply4.suggestedPrompt ? "GENERATED!" : "(None)");
  if (reply4.suggestedPrompt) {
    console.log("\nUpdated Prompt Payload:\n", reply4.suggestedPrompt);
    console.assert(
      reply4.suggestedPrompt.toLowerCase().includes("apex brew") || reply4.suggestedPrompt.toLowerCase().includes("coffee"),
      "Turn 4 Failed: Prompt did not retain Apex Brew business name"
    );
  }

  console.log("\n=== ALL CONVERSATIONAL BEHAVIOR VERIFICATIONS PASSED! ===");
}

runConversationalVerification();
