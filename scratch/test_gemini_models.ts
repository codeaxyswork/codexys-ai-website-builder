import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

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

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

async function checkModels() {
  const testModels = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.5-pro",
    "gemini-3.6-flash",
    "gemini-3.1-pro-preview",
    "gemini-2.0-flash-exp",
    "gemini-1.5-pro"
  ];

  for (const m of testModels) {
    try {
      const res = await ai.models.generateContent({
        model: m,
        contents: ["Hello"],
      });
      console.log(`Model [${m}]: SUCCESS -> ${res.text?.slice(0, 30)}`);
    } catch (e: any) {
      console.log(`Model [${m}]: FAILED -> ${e.status || e.message}`);
    }
  }
}

checkModels();
