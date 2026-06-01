import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import fs from "fs";
import path from "path";

// ElevenLabs: dùng trước, nếu hết quota thì fallback Kokoro
export async function generateVoice(
  text: string,
  filename: string,
  provider: "elevenlabs" | "kokoro" = "elevenlabs"
): Promise<string> {
  const outputPath = path.join(process.cwd(), "output", "voices", `${filename}.mp3`);

  if (provider === "elevenlabs") {
    try {
      return await generateElevenLabs(text, outputPath);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("quota") || msg.includes("limit") || msg.includes("401")) {
        console.warn("ElevenLabs quota hit, fallback to Kokoro");
        return await generateKokoro(text, outputPath);
      }
      throw e;
    }
  }

  return await generateKokoro(text, outputPath);
}

async function generateElevenLabs(text: string, outputPath: string): Promise<string> {
  const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! });
  const audioStream = await client.textToSpeech.convert("JBFqnCBsd6RMkjVDRZzb", {
    text,
    modelId: "eleven_multilingual_v2",
    voiceSettings: { stability: 0.5, similarityBoost: 0.75 },
  });

  const chunks: Buffer[] = [];
  for await (const chunk of audioStream as unknown as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  fs.writeFileSync(outputPath, Buffer.concat(chunks));
  return outputPath;
}

async function generateKokoro(text: string, outputPath: string): Promise<string> {
  const kokoroUrl = process.env.KOKORO_URL || "http://localhost:8880";
  const response = await fetch(`${kokoroUrl}/v1/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "kokoro", input: text, voice: "af_heart", response_format: "mp3" }),
  });
  if (!response.ok) throw new Error(`Kokoro error: ${response.statusText}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}
