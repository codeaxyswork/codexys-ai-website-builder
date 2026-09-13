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

async function testRealGeminiTranscription() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API key");
    return;
  }

  const ai = new GoogleGenAI({ apiKey });

  // 1-second 16-bit PCM silent WAV audio header + data
  const sampleRate = 16000;
  const numSamples = sampleRate * 1;
  const pcmData = Buffer.alloc(numSamples * 2);

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmData.length, 40);

  const wavBuffer = Buffer.concat([header, pcmData]);
  const base64Audio = wavBuffer.toString("base64");

  const systemPrompt = `You are an expert verbatim speech-to-text audio transcription engine for Codeaxys AI.
Produce verbatim transcription only. Preserve native scripts (Malayalam, Hindi, Tamil), Manglish, and code-switched English terms (Codeaxys, website, WhatsApp, contact form, etc.). If silent, return empty.`;

  const candidateModels = [
    "gemini-3.5-transcribe",
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-2.5-flash",
  ];

  for (const modelName of candidateModels) {
    try {
      console.log(`[TEST Endpoint Simulation] Requesting model ${modelName}...`);
      const res = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            inlineData: {
              mimeType: "audio/wav",
              data: base64Audio,
            },
          },
          systemPrompt,
        ],
      });

      console.log(`[SUCCESS] Model ${modelName} returned text: "${res.text || ""}"`);
      break;
    } catch (e: any) {
      console.warn(`[FAIL] Model ${modelName}:`, e?.message || e);
    }
  }
}

testRealGeminiTranscription();
