import fs from "fs";
import path from "path";

// Catalog giọng FPT.AI TTS v5 — dùng cho voice picker trên UI
export interface VoiceOption {
  id: string;
  name: string;
  gender: "nữ" | "nam";
  region: "Bắc" | "Trung" | "Nam";
  premium: boolean;
  note: string;
  provider: "fpt" | "edge" | "vieneu";
  /** Nguồn có giới hạn lượt free không */
  limited: boolean;
}

// ── VieNeu-TTS chạy local (48kHz) ─────────────────────────────────────────────
// Giọng được huấn luyện sẵn theo 4 phong cách: tin tức / tự nhiên / kể chuyện / đọc truyện,
// nên không phải bẻ méo một giọng phẳng bằng rate/pitch như Edge.
// id có tiền tố "vieneu:" để generateVoice biết định tuyến sang server local.
export const VIENEU_URL = process.env.VIENEU_URL || "http://127.0.0.1:8899";

type VN = [name: string, gender: "nam" | "nữ", region: "Bắc" | "Trung" | "Nam", style: string];
const VIENEU_RAW: VN[] = [
  ["Thanh Bình", "nam", "Bắc",   "kể chuyện"],
  ["Thái Sơn",   "nam", "Nam",   "kể chuyện"],
  ["Đức Trí",    "nam", "Nam",   "đọc truyện"],
  ["Phạm Tuyên", "nam", "Bắc",   "tự nhiên"],
  ["Xuân Vĩnh",  "nam", "Nam",   "tự nhiên"],
  ["Quang Sơn",  "nam", "Trung", "tự nhiên"],
  ["Minh Đức",   "nam", "Bắc",   "tin tức"],
  ["Minh Triết", "nam", "Nam",   "tin tức"],
  ["Adam",       "nam", "Nam",   "tự nhiên"],
  ["Ngọc Linh",  "nữ",  "Bắc",   "kể chuyện"],
  ["Thục Đoan",  "nữ",  "Nam",   "kể chuyện"],
  ["Quỳnh Anh",  "nữ",  "Bắc",   "đọc truyện"],
  ["Mỹ Duyên",   "nữ",  "Nam",   "đọc truyện"],
  ["Kim Thanh",  "nữ",  "Nam",   "đọc truyện"],
  ["Trúc Ly",    "nữ",  "Bắc",   "tự nhiên"],
  ["Đoan Trang", "nữ",  "Bắc",   "tự nhiên"],
  ["Ngọc Trân",  "nữ",  "Trung", "tự nhiên"],
  ["Ngọc Huyền", "nữ",  "Bắc",   "tự nhiên"],
  ["Mai Anh",    "nữ",  "Bắc",   "tin tức"],
  ["Thùy Dung",  "nữ",  "Nam",   "tin tức"],
];

/** Biến voice id thành phần tên file an toàn.
 *  Cần thiết vì id VieNeu chứa dấu ':' (Windows cấm — sẽ tạo NTFS alternate data stream
 *  khiến file 0 byte) và dấu tiếng Việt. VD "vieneu:Thanh Bình" → "vieneu_ThanhBinh". */
export function voiceFileTag(voiceId: string): string {
  return voiceId
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // bỏ dấu
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/:/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

export const VIENEU_VOICES: VoiceOption[] = VIENEU_RAW.map(([name, gender, region, style]) => ({
  id: `vieneu:${name}`,
  name,
  gender,
  region,
  premium: true,
  provider: "vieneu" as const,
  limited: false,
  note: `48kHz — phong cách ${style}`,
}));

export const FPT_VOICES: VoiceOption[] = [
  // ── VieNeu local — chất lượng cao nhất, cần bật server (xem vieneu/server.py) ──
  ...VIENEU_VOICES,
  // ── Microsoft Edge — free hoàn toàn, không cần key, không giới hạn lượt ──
  { id: "vi-VN-NamMinhNeural", name: "Nam Minh", gender: "nam", region: "Bắc", premium: true, provider: "edge", limited: false,
    note: "Neural — trầm, tự nhiên, hợp kể chuyện tối" },
  { id: "vi-VN-HoaiMyNeural",  name: "Hoài My",  gender: "nữ",  region: "Bắc", premium: true, provider: "edge", limited: false,
    note: "Neural — ấm, rõ, đọc dài không mệt tai" },
  // ── FPT.AI — chất lượng tốt nhưng free tier giới hạn lượt (hay lỗi 429) ──
  { id: "banmai",  name: "Ban Mai",  gender: "nữ",  region: "Bắc",   premium: true,  provider: "fpt", limited: true, note: "AceSound — tự nhiên, ấm, kể chuyện tốt" },
  { id: "thuminh", name: "Thu Minh", gender: "nữ",  region: "Bắc",   premium: true,  provider: "fpt", limited: true, note: "AceSound — giọng MC, rành mạch" },
  { id: "leminh",  name: "Lê Minh",  gender: "nam", region: "Bắc",   premium: false, provider: "fpt", limited: true, note: "Trầm, hợp horror / kể chuyện tối" },
  { id: "giahuy",  name: "Gia Huy",  gender: "nam", region: "Trung", premium: false, provider: "fpt", limited: true, note: "Trẻ, năng động" },
  { id: "myan",    name: "Mỹ An",    gender: "nữ",  region: "Trung", premium: false, provider: "fpt", limited: true, note: "Nhẹ nhàng, thủ thỉ" },
  { id: "linhsan", name: "Linh San", gender: "nữ",  region: "Nam",   premium: false, provider: "fpt", limited: true, note: "Miền Nam, thân thiện" },
  { id: "lannhi",  name: "Lan Nhi",  gender: "nữ",  region: "Nam",   premium: false, provider: "fpt", limited: true, note: "Bản cũ — chất lượng thấp hơn" },
];

// [voice, speed] — speed âm = đọc chậm rãi, tạo tension
// AceSound voices (chất lượng cao hơn): banmai, thuminh
export const VOICE_STYLES: Record<string, { voice: string; speed: number }> = {
  // Mặc định dùng giọng Edge (free, không giới hạn lượt) — FPT vẫn chọn được trên UI.
  // speed để 0: nhịp chậm/nhanh giờ do preset cảm xúc quyết định. Trước đây kênh mang
  // sẵn speed -2, cộng với cảm xúc thành -25% → giọng bị kéo giãn, è và vỡ tiếng.
  // Mặc định là giọng VieNeu (48kHz, có phong cách riêng). Nếu server chưa bật,
  // generateVoice báo lỗi kèm hướng dẫn — người dùng chọn giọng Edge là chạy được ngay.
  horror:      { voice: "vieneu:Thanh Bình", speed: 0 },
  // runner truyền style = channel id → phải có key trùng channel, nếu không rơi về default
  wansee:      { voice: "vieneu:Thanh Bình", speed: 0 },
  history:     { voice: "vieneu:Đức Trí",    speed: 0 },
  "huong-noi": { voice: "vieneu:Trúc Ly",    speed: 0 },
  "psych2go":  { voice: "vieneu:Ngọc Huyền", speed: 0 },
  news:        { voice: "vieneu:Mai Anh",    speed: 0 },
  finance:     { voice: "vieneu:Minh Đức",   speed: 0 },
  facts:       { voice: "vieneu:Mai Anh",    speed: 0 },
  lifestyle:   { voice: "vieneu:Trúc Ly",    speed: 0 },
  kids:        { voice: "vieneu:Ngọc Linh",  speed: 0 },
  gaming:      { voice: "vieneu:Xuân Vĩnh",  speed: 0 },
  travel:      { voice: "vieneu:Ngọc Trân",  speed: 0 },
  default:     { voice: "vieneu:Trúc Ly",    speed: 0 },
};

// ── Cảm xúc theo scene ────────────────────────────────────────────────────────
// Edge free chỉ cho chỉnh rate/pitch/volume (đã test: thẻ <break> và
// mstts:express-as đều bị chặn). Khoảng lặng xử lý riêng bằng ffmpeg ở video.ts.
export interface EmotionPreset {
  id: string;
  name: string;
  note: string;
  rate: number;    // % cộng thêm vào tốc độ
  pitch: number;   // % cao độ
  volume: number;  // % âm lượng
  padBefore: number; // giây lặng chèn TRƯỚC câu
  padAfter: number;  // giây lặng chèn SAU câu
}

// Hiệu chỉnh lại quanh mốc người dùng chấp nhận được: chỉ hạ pitch ~10%, giữ tốc độ gần
// mặc định. Các preset cũ (rate -25%, volume -30%) nghe quá chậm và bị nhiễu, vì hạ
// volume rồi loudnorm kéo ngược lên sẽ khuếch đại luôn nhiễu nền.
// volume ở đây áp SAU loudnorm (xem video.ts) nên không còn gây nhiễu.
export const EMOTIONS: EmotionPreset[] = [
  // Người kể chuyện: đọc nhanh hơn (lời dẫn, không phải kịch tính), nhỏ hơn nhân vật
  // để nằm dưới họ, gần như không nghỉ giữa câu, và luôn khô tiếng (xem space ở video.ts).
  { id: "narration", name: "Người kể chuyện", note: "nhanh, lùi xuống dưới nhân vật, khô tiếng", rate: 7, pitch: -3, volume: -5.5, padBefore: 0, padAfter: 0.15 },
  { id: "neutral", name: "Trung tính",  note: "đều đặn, không nhấn",            rate: 0,  pitch: -6,  volume: 0,  padBefore: 0,    padAfter: 0.2 },
  { id: "tense",   name: "Căng thẳng", note: "trầm hơn chút, chậm nhẹ",        rate: -5, pitch: -10, volume: 0,  padBefore: 0.15, padAfter: 0.3 },
  { id: "whisper", name: "Thì thầm",   note: "trầm, nhỏ nhẹ, sát tai",         rate: -8, pitch: -12, volume: -6, padBefore: 0.2,  padAfter: 0.35 },
  { id: "fear",    name: "Sợ hãi",     note: "hơi cao, hơi gấp",               rate: 2,  pitch: 5,   volume: 0,  padBefore: 0.1,  padAfter: 0.25 },
  { id: "panic",   name: "Hoảng loạn", note: "nhanh, cao, dồn dập",            rate: 10, pitch: 9,   volume: 2,  padBefore: 0,    padAfter: 0.12 },
  { id: "sad",     name: "Nghẹn ngào", note: "chậm nhẹ, trầm xuống",           rate: -8, pitch: -8,  volume: -3, padBefore: 0.2,  padAfter: 0.4 },
  { id: "angry",   name: "Gằn giọng",  note: "trầm, dằn từng chữ",             rate: -4, pitch: -9,  volume: 3,  padBefore: 0.12, padAfter: 0.2 },
  { id: "warm",    name: "Ấm áp",      note: "dịu, gần gũi",                   rate: -4, pitch: -4,  volume: 0,  padBefore: 0.1,  padAfter: 0.25 },
];

export function getEmotion(id?: string): EmotionPreset {
  return EMOTIONS.find(e => e.id === id) ?? EMOTIONS[0];
}

// Chuẩn hóa text cho TTS — giữ nhịp ngắt do người viết cố ý đặt
function preprocessText(text: string, style: string): string {
  let t = text.trim();

  // Dấu gạch ngang là nhịp ngắt kịch tính → đổi thành dấu chấm để TTS nghỉ dài
  // và hạ giọng, thay vì dấu phẩy chỉ nghỉ rất ngắn.
  t = t.replace(/\s*[–—]\s*/g, ". ");

  // "..." là nhịp lửng cố ý — chuẩn hoá về ký tự ellipsis để TTS đọc đúng
  t = t.replace(/\.{3,}/g, "… ");

  t = t.replace(/,\s+/g, ", ");
  t = t.replace(/\s{2,}/g, " ");

  // Ký tự dễ gây lỗi TTS
  t = t.replace(/["""]/g, "");
  t = t.replace(/\*/g, "");

  // Với huong-noi: câu quá dài → thêm dấu phẩy ở chỗ hợp lý cho dễ thở
  if (style === "huong-noi") {
    t = t.replace(/([a-zA-ZÀ-ỹ]{30,})\s+(mà|nhưng|và|thì|vì|nên|hay|hoặc)\s+/gi, "$1, $2 ");
  }

  return t.trim();
}

export async function generateVoice(
  text: string,
  filename: string,
  style: string = "default",
  outDir?: string,
  override?: { voice?: string; speed?: number; emotion?: string }
): Promise<string> {
  const dir = outDir ?? path.join(process.cwd(), "output", "voices");
  fs.mkdirSync(dir, { recursive: true });
  const outputPath = path.join(dir, `${filename}.mp3`);
  const preset = VOICE_STYLES[style] ?? VOICE_STYLES.default;
  // UI chọn giọng → override preset của channel
  const voice = override?.voice || preset.voice;
  const speed = override?.speed ?? preset.speed;
  const emotion = getEmotion(override?.emotion);
  const processedText = preprocessText(text, style);

  // Giọng VieNeu chạy local — chất lượng cao nhất, cần server bật sẵn
  if (voice.startsWith("vieneu:")) {
    return generateVieNeu(processedText, outputPath, voice.slice(7), speed, emotion);
  }

  // Giọng Edge (id dạng "vi-VN-…Neural") — miễn phí, không rate limit
  if (voice.startsWith("vi-VN-")) {
    return generateEdge(processedText, outputPath, voice, speed, emotion);
  }

  // FPT.AI — free tier hay dính 429, nên chờ tăng dần giữa các lần thử
  const BACKOFF_MS = [0, 4000, 12000];
  let lastErr: unknown;
  for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
    if (BACKOFF_MS[attempt] > 0) await new Promise(r => setTimeout(r, BACKOFF_MS[attempt]));
    try {
      return await generateFPT(processedText, outputPath, voice, speed);
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`FPT.AI attempt ${attempt + 1}/${BACKOFF_MS.length} failed:`, msg);
      // Hết quota free thì thử lại cũng vô ích — báo lỗi rõ ràng ngay
      if (msg.includes("429") || msg.includes("rate limit")) {
        throw new Error(
          `FPT.AI hết lượt free (429). Chuyển sang giọng Edge (Nam Minh / Hoài My) — miễn phí, không giới hạn.`
        );
      }
    }
  }
  throw new Error(`FPT.AI thất bại sau ${BACKOFF_MS.length} lần thử: ${lastErr instanceof Error ? lastErr.message : lastErr}`);
}

// ── VieNeu-TTS chạy local ─────────────────────────────────────────────────────
// Server trả WAV 48kHz; pipeline dùng .mp3 nên chuyển ngay bằng ffmpeg-static.
async function generateVieNeu(
  text: string, outputPath: string, voice: string, speed: number, emotion: EmotionPreset
): Promise<string> {
  // VieNeu không có tham số tốc độ; nhịp chậm/nhanh điều bằng lượng khoảng lặng
  // giữa các cụm từ. speed âm + cảm xúc chậm → nghỉ nhiều hơn.
  const pace = speed * 10 + emotion.rate;      // âm = chậm
  const silence_p = Math.max(0.05, Math.min(0.4, 0.15 - pace * 0.004));

  let res: Response;
  try {
    res = await fetch(`${VIENEU_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice, silence_p }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (e) {
    throw new Error(
      `Không kết nối được VieNeu ở ${VIENEU_URL}. Bật server bằng: ` +
      `python vieneu/server.py — hoặc chọn giọng Edge để chạy không cần server. ` +
      `(${e instanceof Error ? e.message : e})`
    );
  }

  if (!res.ok) throw new Error(`VieNeu lỗi ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const wavBuf = Buffer.from(await res.arrayBuffer());
  if (wavBuf.length === 0) throw new Error("VieNeu trả về file rỗng");

  const wavPath = outputPath.replace(/\.mp3$/, ".wav");
  fs.writeFileSync(wavPath, wavBuf);

  // WAV → MP3 (giữ 48kHz, 192kbps)
  const ffmpegStatic = (await import("ffmpeg-static")).default as unknown as string;
  const { execFile } = await import("child_process");
  await new Promise<void>((resolve, reject) => {
    execFile(
      ffmpegStatic.replace(/\\/g, "/"),
      ["-y", "-i", wavPath.replace(/\\/g, "/"), "-c:a", "libmp3lame", "-b:a", "192k",
       outputPath.replace(/\\/g, "/")],
      (err) => (err ? reject(err) : resolve())
    );
  });
  fs.unlinkSync(wavPath);
  return outputPath;
}

// ── Microsoft Edge TTS — free, không cần API key ───────────────────────────────
// Endpoint free rớt kết nối khi mở nhiều WebSocket cùng lúc (runner chạy 3 scene
// song song → thường 1 scene hỏng). Xếp hàng tuần tự: chậm hơn vài giây nhưng chắc chắn.
let edgeQueue: Promise<unknown> = Promise.resolve();
function queueEdge<T>(fn: () => Promise<T>): Promise<T> {
  const run = edgeQueue.then(fn, fn);
  edgeQueue = run.catch(() => {});
  return run;
}

async function generateEdge(
  text: string, outputPath: string, voice: string, speed: number, emotion: EmotionPreset
): Promise<string> {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");

  // Tốc độ nền của vai (thang -3..+3) cộng với điều chỉnh của cảm xúc
  // Giới hạn an toàn: kéo giãn quá mạnh làm giọng neural bị è và vỡ tiếng.
  // Tốc độ của vai và của cảm xúc cộng dồn được, nhưng tổng phải nằm trong ngưỡng này.
  const clampRate = (n: number) => Math.max(-15, Math.min(15, Math.round(n)));
  const clampPitch = (n: number) => Math.max(-12, Math.min(12, Math.round(n)));
  const fmt = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;
  const rate = fmt(clampRate(speed * 10 + emotion.rate));
  const pitch = fmt(clampPitch(emotion.pitch));
  // KHÔNG hạ volume ở đây: TTS xuất nhỏ rồi loudnorm kéo lên sẽ khuếch đại nhiễu nền.
  // Sắc thái to/nhỏ xử lý sau chuẩn hoá, trong video.ts.

  return queueEdge(async () => {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const tts = new MsEdgeTTS();
        // 96kbps thay vì 48kbps — gấp đôi bitrate, không tốn thêm gì
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
        const { audioStream } = await tts.toStream(text, { rate, pitch });

        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Edge TTS timeout sau 45s")), 45_000);
          const done = (fn: () => void) => { clearTimeout(timer); fn(); };
          audioStream.on("data", (c: Buffer) => chunks.push(c));
          audioStream.on("end", () => done(resolve));
          audioStream.on("error", (e: Error) => done(() => reject(e)));
        });

        const buf = Buffer.concat(chunks);
        if (buf.length === 0) throw new Error("Edge TTS trả về file rỗng");
        fs.writeFileSync(outputPath, buf);
        return outputPath;
      } catch (e) {
        lastErr = e;
        console.warn(`Edge TTS attempt ${attempt}/4 (${voice}):`, e instanceof Error ? e.message : e);
        if (attempt < 4) await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
    throw new Error(`Edge TTS thất bại sau 4 lần thử: ${lastErr instanceof Error ? lastErr.message : lastErr}`);
  });
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

