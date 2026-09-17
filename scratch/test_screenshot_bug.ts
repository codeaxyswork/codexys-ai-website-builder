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

async function testScreenshotCase() {
  const history: AssistantChatMessage[] = [];

  console.log("\n--- Turn 1 ---");
  const u1 = "എനിക്ക് ഒരു ആയുർവേദ website വേണം";
  const r1 = await generateAssistantReply(history, u1);
  console.log("Customer:", u1);
  console.log("Agent   :", r1.text);
  history.push({ role: "user", content: u1 }, { role: "assistant", content: r1.text });

  console.log("\n--- Turn 2 (Exact phrase from Screenshot) ---");
  const u2 = "അതല്ലേ ഇപ്പോൾ ഞാൻ നിങ്ങളോട് പറഞ്ഞത് ജോൺ ആയുർവേദിക്കാണെന്ന്";
  const r2 = await generateAssistantReply(history, u2);
  console.log("Customer:", u2);
  console.log("Agent   :", r2.text);
  history.push({ role: "user", content: u2 }, { role: "assistant", content: r2.text });

  console.log("\n--- Turn 3 ---");
  const u3 = "Logo ഉണ്ട്";
  const r3 = await generateAssistantReply(history, u3);
  console.log("Customer:", u3);
  console.log("Agent   :", r3.text);
}

testScreenshotCase().catch(console.error);
