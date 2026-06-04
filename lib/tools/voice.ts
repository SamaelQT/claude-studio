import fs from "fs";
import path from "path";

// FPT.AI voices — tiếng Việt tự nhiên
export const VOICE_STYLES: Record<string, { voice: string; description: string }> = {
  // Giọng Nam
  horror:    { voice: "minhquang", description: "Nam Bắc, trầm, huyền bí — kênh kinh dị" },
  history:   { voice: "leminh",    description: "Nam Nam, ấm, nghiêm túc — kênh lịch sử" },
  news:      { voice: "minhquang", description: "Nam Bắc, rõ ràng — kênh tin tức" },
  finance:   { voice: "leminh",    description: "Nam Nam, chuyên nghiệp — kênh tài chính" },
  // Giọng Nữ
  facts:     { voice: "lannhi",    description: "Nữ Bắc, rõ, nhanh — kênh facts/edu" },
  lifestyle: { voice: "banmai",    description: "Nữ Nam, nhẹ nhàng — kênh lifestyle" },
  kids:      { voice: "banmai",    description: "Nữ Nam, dễ thương — kênh thiếu nhi" },
  // Giọng trẻ
  gaming:    { voice: "giahuy",    description: "Nam Nam, trẻ, năng động — kênh gaming" },
  travel:    { voice: "ngoclam",   description: "Nữ Nam, tươi sáng — kênh du lịch" },
  default:   { voice: "lannhi",    description: "Nữ Bắc, rõ ràng — mặc định" },
};

export async function generateVoice(
  text: string,
  filename: string,
  style: string = "default"
): Promise<string> {
  const outputPath = path.join(process.cwd(), "output", "voices", `${filename}.mp3`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const voice = VOICE_STYLES[style]?.voice ?? VOICE_STYLES.default.voice;

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

  // FPT.AI v5 là async — poll tối đa 10 lần, mỗi lần cách 2s
  let audioRes: Response | null = null;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(data.async);
    if (res.ok) { audioRes = res; break; }
  }
  if (!audioRes) throw new Error("FPT.AI: audio not ready after polling");

  const buffer = Buffer.from(await audioRes!.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
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
