import { GoogleGenAI } from "@google/genai";
import { getGeminiConfig } from "../lib/gemini";
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

async function testFallbackModels() {
  const { apiKey, model } = getGeminiConfig();
  const ai = new GoogleGenAI({ apiKey });

  const candidateModels = Array.from(new Set([model, "gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.6-flash"]));
  console.log("CANDIDATE MODELS TO TRY:", candidateModels);

  const promptPayload = "Customer: it's ayurveda hospital\nCodeaxys AI:";

  for (const currentModel of candidateModels) {
    try {
      console.log(`[TEST] Attempting assistant with model: ${currentModel}...`);
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: [promptPayload],
      });
      console.log(`[SUCCESS] Model ${currentModel} response:`, response.text);
      break;
    } catch (err: any) {
      console.warn(`[FAIL] Model ${currentModel}:`, err?.message || err);
    }
  }
}

testFallbackModels();
