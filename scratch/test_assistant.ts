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

async function debugAssistant() {
  console.log("=== DEBUGGING ASSISTANT ROUTE / GEMINI CALL ===");
  try {
    const reply = await generateAssistantReply([], "it's ayurveda hospital", "auto");
    console.log("REPLY RESULT:", reply);
  } catch (err: any) {
    console.error("EXPLICIT ERROR CAUGHT IN SCRIPT:", err);
  }
}

debugAssistant();
