import fs from "fs";
import path from "path";

export const VOICE_STYLES: Record<string, string> = {
  horror:    "minhquang",
  history:   "leminh",
  news:      "minhquang",
  finance:   "leminh",
  facts:     "lannhi",
  lifestyle: "banmai",
  kids:      "banmai",
  gaming:    "giahuy",
  travel:    "ngoclam",
  default:   "lannhi",
};

export async function generateVoice(
  text: string,
  filename: string,
  style: string = "default",
  outDir?: string
): Promise<string> {
  const dir = outDir ?? path.join(process.cwd(), "output", "voices");
  fs.mkdirSync(dir, { recursive: true });
  const outputPath = path.join(dir, `${filename}.mp3`);
  const voice = VOICE_STYLES[style] ?? VOICE_STYLES.default;

  try {
    return await generateFPT(text, outputPath, voice);
  } catch (e) {
    console.warn("FPT.AI failed, fallback ElevenLabs:", e);
    return await generateElevenLabs(text, outputPath);
  }
}

async function generateFPT(text: string, outputPath: string, voice: string): Promise<string> {
  const response = await fetch(`https://api.fpt.ai/hmi/tts/v5?voice=${voice}&speed=&quality=premium`, {
    method: "POST",
    headers: {
      "api-key": process.env.FPT_API_KEY!,
      "Content-Type": "application/json",
    },
    body: text,
  });

  if (!response.ok) throw new Error(`FPT.AI error: ${response.status} ${await response.text()}`);

  const data = await response.json();
  if (!data.async) throw new Error("FPT.AI: no audio URL returned");

  // Thử download ngay — FPT.AI short clips thường sẵn sàng ngay lập tức
  // Nếu chưa sẵn thì retry tối đa 5 lần, cách 1.5s
  for (let i = 0; i < 5; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1500));
    const audioRes = await fetch(data.async);
    if (audioRes.ok) {
      const buffer = Buffer.from(await audioRes.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      return outputPath;
    }
  }
  throw new Error("FPT.AI: audio not ready after retries");
}

async function generateElevenLabs(text: string, outputPath: string): Promise<string> {
  if (!process.env.ELEVENLABS_API_KEY) throw new Error("No ElevenLabs key");

  const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb", {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!response.ok) throw new Error(`ElevenLabs error: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}
