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

async function testPinkColorFlow() {
  const history: AssistantChatMessage[] = [];

  console.log("\n--- Turn 1: Business Request ---");
  const u1 = "i need saree showroom website";
  const r1 = await generateAssistantReply(history, u1);
  console.log("Customer:", u1);
  console.log("Agent   :", r1.text);
  history.push({ role: "user", content: u1 }, { role: "assistant", content: r1.text });

  console.log("\n--- Turn 2: Business Name ---");
  const u2 = "Pink Petals";
  const r2 = await generateAssistantReply(history, u2);
  console.log("Customer:", u2);
  console.log("Agent   :", r2.text);
  history.push({ role: "user", content: u2 }, { role: "assistant", content: r2.text });

  console.log("\n--- Turn 3: Logo Status ---");
  const u3 = "Logo ഉണ്ട്";
  const r3 = await generateAssistantReply(history, u3);
  console.log("Customer:", u3);
  console.log("Agent   :", r3.text);
  history.push({ role: "user", content: u3 }, { role: "assistant", content: r3.text });

  console.log("\n--- Turn 4: User says 'pink' ---");
  const u4 = "pink";
  const r4 = await generateAssistantReply(history, u4);
  console.log("Customer:", u4);
  console.log("Agent   :", r4.text);
}

testPinkColorFlow().catch(console.error);
