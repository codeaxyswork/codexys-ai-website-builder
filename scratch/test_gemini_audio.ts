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

async function testGeminiAudioModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No GEMINI_API_KEY found in process.env or .env.local");
    return;
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const testModels = ["gemini-3.5-transcribe", "gemini-2.5-flash", "gemini-3.6-flash", "gemini-1.5-flash"];

  const wavHeader = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
    0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00,
    0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00
  ]);
  const base64Audio = wavHeader.toString("base64");

  for (const modelName of testModels) {
    try {
      console.log(`Testing model: ${modelName}...`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          "Transcribe the audio accurately. If audio is silent or contains no speech, respond with SILENT.",
          {
            inlineData: {
              mimeType: "audio/wav",
              data: base64Audio,
            },
          },
        ],
      });
      console.log(`Model ${modelName} SUCCESS:`, response.text?.trim());
    } catch (err: any) {
      console.log(`Model ${modelName} FAILED:`, err?.message || err);
    }
  }
}

testGeminiAudioModels();
