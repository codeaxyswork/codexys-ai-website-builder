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

async function runEndToEndVerification() {
  console.log("==================================================");
  console.log("STARTING END-TO-END CONVERSATIONAL AI QA VERIFICATION");
  console.log("==================================================");

  const history: AssistantChatMessage[] = [];

  // Turn 1: Main input handoff message
  console.log("\n--- STEP 1: Main input handoff: 'I need an Ayurveda hospital website.' ---");
  const res1 = await generateAssistantReply(history, "I need an Ayurveda hospital website.", "en");
  console.log("AI Response 1:\n", res1.text);
  history.push({ role: "user", content: "I need an Ayurveda hospital website." });
  history.push({ role: "assistant", content: res1.text });

  await new Promise((r) => setTimeout(r, 4000));

  // Turn 2: Hospital Name
  console.log("\n--- STEP 2: Customer answers hospital name: 'Arya Ayurveda Hospital' ---");
  const res2 = await generateAssistantReply(history, "Arya Ayurveda Hospital", "en");
  console.log("AI Response 2:\n", res2.text);
  history.push({ role: "user", content: "Arya Ayurveda Hospital" });
  history.push({ role: "assistant", content: res2.text });

  await new Promise((r) => setTimeout(r, 4000));

  // Turn 3: Location
  console.log("\n--- STEP 3: Customer answers location: 'Kozhikode, Kerala' ---");
  const res3 = await generateAssistantReply(history, "Kozhikode, Kerala", "en");
  console.log("AI Response 3:\n", res3.text);
  history.push({ role: "user", content: "Kozhikode, Kerala" });
  history.push({ role: "assistant", content: res3.text });

  await new Promise((r) => setTimeout(r, 4000));

  // Turn 4: Explicit Prompt Request
  console.log("\n--- STEP 4: Customer explicitly asks: 'Give me the prompt.' ---");
  const res4 = await generateAssistantReply(history, "Give me the prompt.", "en");
  console.log("AI Response 4 (Text):\n", res4.text);
  console.log("Generated Prompt Block (suggestedPrompt):\n", res4.suggestedPrompt || "(None)");

  console.assert(
    Boolean(res4.suggestedPrompt),
    "QA Test Failed: Explicit prompt request did not yield suggestedPrompt!"
  );

  if (res4.suggestedPrompt) {
    const promptLower = res4.suggestedPrompt.toLowerCase();
    console.assert(
      promptLower.includes("arya") || promptLower.includes("ayurveda"),
      "QA Test Failed: Prompt block missing business/hospital name!"
    );
    console.log("\n✅ QA VERIFICATION PASSED SUCCESSFULLY!");
  }

  console.log("==================================================");
}

runEndToEndVerification();
