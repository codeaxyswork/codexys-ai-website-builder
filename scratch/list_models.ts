import { GoogleGenAI } from "@google/genai";
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

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;
  const ai = new GoogleGenAI({ apiKey });
  try {
    const res = await ai.models.list();
    console.log("AVAILABLE MODELS:");
    for await (const m of res) {
      console.log("-", m.name);
    }
  } catch (e: any) {
    console.error("List models error:", e?.message || e);
  }
}

listModels();
