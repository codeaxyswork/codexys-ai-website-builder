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

async function testColorVariations() {
  const testColors = [
    "pink",
    "red and white",
    "blue",
    "I don't have any preferred colors"
  ];

  for (const colorInput of testColors) {
    console.log(`\n==========================================`);
    console.log(`TESTING COLOR INPUT: "${colorInput}"`);
    console.log(`==========================================`);

    const history: AssistantChatMessage[] = [
      { role: "user", content: "i need saree showroom website" },
      { role: "assistant", content: "Absolutely! I can help you plan a professional saree showroom website. First, what is the name of your business or brand?" },
      { role: "user", content: "Silk & Saree" },
      { role: "assistant", content: "Great! Do you already have a logo for Silk & Saree, or would you like me to help plan one?" },
      { role: "user", content: "Yes" },
      { role: "assistant", content: "Perfect! Do you have preferred brand colors for Silk & Saree (e.g., Black & Gold, Dark Luxury, Clean White & Blue), or would you like me to suggest a color scheme?" }
    ];

    const reply = await generateAssistantReply(history, colorInput);
    console.log(`Customer: "${colorInput}"`);
    console.log(`Agent   : "${reply.text}"`);

    // Verify Black & Gold is NOT mentioned unless requested
    if (colorInput !== "Black & Gold" && reply.text.toLowerCase().includes("black & gold")) {
      console.error(`❌ ERROR: Response contained 'Black & Gold' for input '${colorInput}'!`);
    } else {
      console.log(`✅ SUCCESS: Response properly handled '${colorInput}' without defaulting to Black & Gold!`);
    }
  }
}

testColorVariations().catch(console.error);
