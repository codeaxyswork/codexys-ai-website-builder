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

async function testTranscribe() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;
  const ai = new GoogleGenAI({ apiKey });

  // Test models: gemini-3.5-transcribe, gemini-3.5-flash, gemini-3.6-flash
  const candidateModels = ["gemini-3.5-transcribe", "gemini-3.5-flash", "gemini-3.6-flash"];

  // 1 second 44.1kHz mono 16-bit PCM silent WAV audio blob
  const sampleRate = 44100;
  const numSamples = sampleRate * 1;
  const pcmData = Buffer.alloc(numSamples * 2); // 16-bit silence (zeros)

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmData.length, 40);

  const wavBuffer = Buffer.concat([header, pcmData]);
  const base64Audio = wavBuffer.toString("base64");

  for (const modelName of candidateModels) {
    try {
      console.log(`Testing model: ${modelName}...`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            inlineData: {
              mimeType: "audio/wav",
              data: base64Audio,
            },
          },
          "Transcribe the audio accurately verbatim. If silent, respond with SILENT.",
        ],
      });
      console.log(`[SUCCESS] ${modelName}:`, response.text?.trim());
      break;
    } catch (e: any) {
      console.log(`[FAIL] ${modelName}:`, e?.message || e);
    }
  }
}

testTranscribe();
