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
const ai = new GoogleGenAI({ apiKey });

const modelsToTest = [
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash-002",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro-002",
  "gemini-2.0-flash-lite-preview-02-05",
  "gemini-2.0-pro-exp-02-05",
  "gemini-2.0-flash-thinking-exp-01-21",
  "gemini-3.6-flash",
  "gemini-3.5-flash"
];

async function testAll() {
  for (const m of modelsToTest) {
    try {
      const res = await ai.models.generateContent({
        model: m,
        contents: ["Hi"],
      });
      console.log(`✅ ${m}: ${res.text?.trim()}`);
    } catch (err: any) {
      console.log(`❌ ${m}: ${err.status} - ${err.message?.split('\n')[0]}`);
    }
  }
}

testAll().catch(console.error);
