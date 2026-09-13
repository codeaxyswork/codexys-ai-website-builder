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

async function traceRealFallbackExecution() {
  console.log("=== EXPLICIT FALLBACK TRACE EXECUTION ===");
  const { apiKey, model } = getGeminiConfig();
  const ai = new GoogleGenAI({ apiKey });

  const candidateModels = Array.from(new Set([model, "gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash"]));

  console.log("PRIMARY REQUESTED MODEL:", model || "gemini-3.6-flash");
  console.log("FULL CANDIDATE FALLBACK SEQUENCE:", candidateModels);

  const promptPayload = "Customer: it's ayurveda hospital\nCodeaxys AI:";

  let usedModel = "";
  let finalResponseText = "";

  for (const currentModel of candidateModels) {
    try {
      console.log(`[ATTEMPT 1] Calling model: ${currentModel}...`);
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: [promptPayload],
      });
      usedModel = currentModel;
      finalResponseText = response.text || "";
      console.log(`[SUCCESS] Model '${currentModel}' generated response successfully!`);
      break;
    } catch (err: any) {
      console.log(`[CAUGHT ERROR] Model '${currentModel}' failed with HTTP status/message:`);
      console.log(`  -> ${err?.message || err}`);
    }
  }

  console.log("\n=== FINAL TRACE REPORT ===");
  console.log("REQUESTED PRIMARY MODEL:", model || "gemini-3.6-flash");
  console.log("ACTUAL SUCCESSFUL MODEL USED:", usedModel);
  console.log("IS FALLBACK USED?", usedModel !== (model || "gemini-3.6-flash") ? "YES" : "NO");
  console.log("FINAL RESPONSE TEXT SAMPLE:", finalResponseText.substring(0, 200) + "...");
}

traceRealFallbackExecution();
