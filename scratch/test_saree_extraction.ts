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

async function testSareeShowroom() {
  const history: AssistantChatMessage[] = [];

  console.log("\n--- Turn 1: Customer asks for Saree Showroom website ---");
  const u1 = "i need saree showroom website";
  const r1 = await generateAssistantReply(history, u1);
  console.log("Customer:", u1);
  console.log("Agent   :", r1.text);
}

testSareeShowroom().catch(console.error);
