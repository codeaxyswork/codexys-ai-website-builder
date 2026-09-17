import fs from "fs";
import path from "path";

try {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf8");
    envConfig.split("\n").forEach((line) => {
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

import { generateAssistantReply, AssistantChatMessage } from "../lib/assistant-gemini";

async function testFullCarShowroomConversation() {
  const history: AssistantChatMessage[] = [];

  console.log("\n==========================================");
  console.log("TURN 1: Customer asks for Car Showroom website");
  console.log("==========================================");
  const user1 = "എനിക്ക് ഒരു കാർ ഷോറൂമിന്റെ website വേണം";
  const res1 = await generateAssistantReply(history, user1);
  console.log("Customer:", user1);
  console.log("Agent   :", res1.text);
  history.push({ role: "user", content: user1 });
  history.push({ role: "assistant", content: res1.text });

  console.log("\n==========================================");
  console.log("TURN 2: Customer gives Business Name");
  console.log("==========================================");
  const user2 = "Velocity Motors എന്നാണ് പേര്";
  const res2 = await generateAssistantReply(history, user2);
  console.log("Customer:", user2);
  console.log("Agent   :", res2.text);
  history.push({ role: "user", content: user2 });
  history.push({ role: "assistant", content: res2.text });

  console.log("\n==========================================");
  console.log("TURN 3: Customer says 'Logo ഉണ്ട്'");
  console.log("==========================================");
  const user3 = "Logo ഉണ്ട്";
  const res3 = await generateAssistantReply(history, user3);
  console.log("Customer:", user3);
  console.log("Agent   :", res3.text);
  history.push({ role: "user", content: user3 });
  history.push({ role: "assistant", content: res3.text });

  console.log("\n==========================================");
  console.log("TURN 4: Customer says 'Black and gold ആണ്'");
  console.log("==========================================");
  const user4 = "Black and gold ആണ്";
  const res4 = await generateAssistantReply(history, user4);
  console.log("Customer:", user4);
  console.log("Agent   :", res4.text);
  history.push({ role: "user", content: user4 });
  history.push({ role: "assistant", content: res4.text });

  console.log("\n==========================================");
  console.log("TURN 5: Customer lists featured cars");
  console.log("==========================================");
  const user5 = "BMW, Mercedes, Audi ആണ് പ്രധാനമായി";
  const res5 = await generateAssistantReply(history, user5);
  console.log("Customer:", user5);
  console.log("Agent   :", res5.text);
  console.log("Prompt  :", res5.suggestedPrompt);
  history.push({ role: "user", content: user5 });
  history.push({ role: "assistant", content: res5.text });

  console.log("\n==========================================");
  console.log("TURN 6: Customer asks 'Can you create the prompt for me?'");
  console.log("==========================================");
  const user6 = "Can you create the prompt for me?";
  const res6 = await generateAssistantReply(history, user6);
  console.log("Customer:", user6);
  console.log("Agent   :", res6.text);
  console.log("Prompt  :", res6.suggestedPrompt);
}

testFullCarShowroomConversation().catch(console.error);
