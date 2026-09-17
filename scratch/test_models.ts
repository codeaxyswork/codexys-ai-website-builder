import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

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

const apiKey = process.env.GEMINI_API_KEY || "";
console.log("Using API Key ending in:", apiKey.slice(-6));

const ai = new GoogleGenAI({ apiKey });

const testModels = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash-lite",
  "gemini-1.5-pro",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-pro-preview"
];

async function checkModels() {
  for (const modelName of testModels) {
    try {
      const res = await ai.models.generateContent({
        model: modelName,
        contents: ["Say hello in one word."],
      });
      console.log(`✅ [${modelName}] SUCCEEDED:`, res.text?.trim());
    } catch (err: any) {
      console.log(`❌ [${modelName}] FAILED:`, err.status || err.message?.slice(0, 100));
    }
  }
}

checkModels().catch(console.error);
