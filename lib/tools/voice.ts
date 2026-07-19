import fs from "fs";
import path from "path";

// [voice, speed] — speed âm = đọc chậm rãi, tạo tension
// AceSound voices (chất lượng cao hơn): banmai, thuminh
export const VOICE_STYLES: Record<string, { voice: string; speed: number }> = {
  horror:      { voice: "leminh",   speed: -2 },
  history:     { voice: "leminh",   speed: -1 },
  "huong-noi": { voice: "banmai",   speed: -1 },  // AceSound — tự nhiên, chậm rãi
  "psych2go":  { voice: "banmai",   speed: 0  },  // thân mật, rõ ràng
  news:        { voice: "thuminh",  speed: 0  },
  finance:     { voice: "leminh",   speed: 0  },
  facts:       { voice: "thuminh",  speed: 0  },
  lifestyle:   { voice: "banmai",   speed: 0  },
  kids:        { voice: "banmai",   speed: 0  },
  gaming:      { voice: "giahuy",   speed: 1  },
  travel:      { voice: "banmai",   speed: 0  },
  default:     { voice: "banmai",   speed: 0  },
};

// Chuẩn hóa text cho TTS — chia câu ngắn, thêm pause tự nhiên
function preprocessText(text: string, style: string): string {
  let t = text.trim();

  // Chuẩn hóa dấu câu → pause rõ ràng
  t = t.replace(/([.!?])(\s+)/g, "$1\n");   // xuống dòng sau câu
  t = t.replace(/,\s+/g, ", ");              // giữ nguyên dấu phẩy
  t = t.replace(/\s{2,}/g, " ");

  // Ký tự đặc biệt dễ gây lỗi TTS
  t = t.replace(/"/g, "").replace(/"/g, "").replace(/"/g, "");
  t = t.replace(/–|—/g, ",");
  t = t.replace(/\*/g, "");

  // Với huong-noi: câu quá dài (>50 ký tự) → thêm dấu phẩy ở chỗ hợp lý
  if (style === "huong-noi") {
    t = t.replace(/([a-zA-ZÀ-ỹ]{30,})\s+(mà|nhưng|và|thì|vì|nên|hay|hoặc)\s+/gi, "$1, $2 ");
  }

  return t.trim();
}

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
  const processedText = preprocessText(text, style);

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await generateFPT(processedText, outputPath, voice, speed);
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

