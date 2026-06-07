import fs from "fs";
import path from "path";

// [voice, speed] — speed âm = đọc chậm rãi, tạo tension; horror/history đọc chậm để lôi cuốn
export const VOICE_STYLES: Record<string, { voice: string; speed: number }> = {
  horror:    { voice: "minhquang", speed: -1 },
  history:   { voice: "leminh",    speed: -1 },
  news:      { voice: "minhquang", speed: 0 },
  finance:   { voice: "leminh",    speed: 0 },
  facts:     { voice: "lannhi",    speed: 0 },
  lifestyle: { voice: "banmai",    speed: 0 },
  kids:      { voice: "banmai",    speed: 0 },
  gaming:    { voice: "giahuy",    speed: 0 },
  travel:    { voice: "ngoclam",   speed: 0 },
  default:   { voice: "lannhi",    speed: 0 },
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
  const { voice, speed } = VOICE_STYLES[style] ?? VOICE_STYLES.default;

  // Thử tối đa 3 lần — mỗi lần gửi request MỚI (URL cũ đôi khi treo vĩnh viễn)
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await generateFPT(text, outputPath, voice, speed);
    } catch (e) {
      lastErr = e;
      console.warn(`FPT.AI attempt ${attempt}/3 failed:`, e instanceof Error ? e.message : e);
    }
  }
  throw new Error(`FPT.AI thất bại sau 3 lần thử: ${lastErr instanceof Error ? lastErr.message : lastErr}`);
}

async function generateFPT(text: string, outputPath: string, voice: string, speed: number): Promise<string> {
  const response = await fetch(`https://api.fpt.ai/hmi/tts/v5?voice=${voice}&speed=${speed}&quality=premium`, {
    method: "POST",
    headers: {
      "api-key": process.env.FPT_API_KEY!,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: text,
  });

  if (!response.ok) throw new Error(`FPT.AI error: ${response.status} ${await response.text()}`);

  const data = await response.json();
  if (!data.async) throw new Error("FPT.AI: no audio URL returned");

  // Poll tối đa 15 lần, cách nhau 2s (tổng 30s)
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    let audioRes: Response;
    try {
      audioRes = await fetch(data.async);
    } catch {
      continue;
    }
    if (audioRes.ok) {
      const buffer = Buffer.from(await audioRes.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      return outputPath;
    }
  }
  throw new Error(`audio not ready after 30s (URL: ${data.async})`);
}

