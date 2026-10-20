/**
 * Bước 1 — giọng đọc: chia lời thoại từng cảnh thành các câu phụ đề, đọc từng câu bằng Edge TTS
 * (giọng nữ Hoài My mặc định), đo độ dài bằng ffprobe, ghép thành 1 file voice.mp3 + timeline.json.
 * Đọc TỪNG CÂU riêng nên biết chính xác câu nào chạy từ giây nào → phụ đề và cảnh khớp giọng,
 * không cần dịch vụ trả mốc thời gian (đổi sang FPT / VieNeu sau cũng chạy y vậy).
 *
 *   node tts.mjs scripts/01-zalo-don-hang.json
 * Kết quả: public/<id>/voice.mp3 + public/<id>/timeline.json (render.mjs đọc tiếp).
 * Câu đã đọc được lưu cache theo nội dung → sửa 1 câu chỉ đọc lại câu đó.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const FFPROBE = process.env.FFPROBE || "ffprobe";
const GAP_CAU = 0.2;    // nghỉ giữa 2 câu (đã cắt lặng sẵn của Edge nên đây là toàn bộ khoảng nghỉ)
const GAP_CANH = 0.3;   // nghỉ khi sang cảnh mới
const DAU = 0.3;        // khoảng lặng đầu video
const DUOI = 1.4;       // giữ cảnh kết sau câu cuối

/** Chia lời thoại thành câu phụ đề ≤ ~14 từ: tách theo . ? ! rồi theo dấu phẩy nếu còn dài. */
export function chiaCau(vo) {
  const cau = vo.match(/[^.?!]+[.?!]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  const out = [];
  for (const c of cau) {
    if (c.split(/\s+/).length <= 14) { out.push(c); continue; }
    let buf = "";
    for (const phan of c.split(/(?<=,)\s+/)) {
      if (buf && (buf + " " + phan).split(/\s+/).length > 14) { out.push(buf); buf = phan; }
      else buf = buf ? `${buf} ${phan}` : phan;
    }
    if (buf) out.push(buf);
  }
  return out;
}

async function doc(text, file, voice, rate) {
  for (let lan = 1; lan <= 4; lan++) {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text, { rate });
      const chunks = [];
      await new Promise((ok, loi) => {
        const t = setTimeout(() => loi(new Error("Edge TTS quá 45s")), 45_000);
        audioStream.on("data", (c) => chunks.push(c));
        audioStream.on("end", () => { clearTimeout(t); ok(); });
        audioStream.on("error", (e) => { clearTimeout(t); loi(e); });
      });
      const buf = Buffer.concat(chunks);
      if (!buf.length) throw new Error("file rỗng");
      fs.writeFileSync(file, buf);
      tts.close?.();
      return;
    } catch (e) {
      console.warn(`  Edge TTS lần ${lan}/4 lỗi: ${e.message}`);
      if (lan === 4) throw e;
      await new Promise((r) => setTimeout(r, 1500 * lan));
    }
  }
}

const doDai = (f) => Number(execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());

const scriptPath = path.resolve(process.argv[2] ?? "");
if (!fs.existsSync(scriptPath)) { console.error("Cách dùng: node tts.mjs scripts/<file>.json"); process.exit(1); }
const kb = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const outDir = path.join(HERE, "public", kb.id);
const cacheDir = path.join(HERE, ".cache", "tts");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(cacheDir, { recursive: true });

const voice = kb.voice || "vi-VN-HoaiMyNeural";
const rate = kb.rate || "+0%";
const timeline = { fps: 30, scenes: [], total: 0 };
const ghep = [];   // danh sách [file, giây lặng sau]
let t = DAU;

for (const [i, sc] of kb.scenes.entries()) {
  const start = t;
  const caus = [];
  if (!sc.vo) {
    // Cảnh không lời (VD bìa): giữ đúng `dur` giây, chèn khoảng lặng tương ứng vào file giọng.
    const d = Number(sc.dur ?? 1.2);
    ghep.push([null, d]);
    t += d;
    timeline.scenes.push({ index: i, start, end: t, caus });
    continue;
  }
  for (const [j, text] of chiaCau(sc.vo).entries()) {
    const key = crypto.createHash("sha1").update(`${voice}|${rate}|${text}`).digest("hex").slice(0, 16);
    const raw = path.join(cacheDir, `${key}.mp3`);
    const f = path.join(cacheDir, `${key}.cat.wav`);   // bản đã cắt lặng đầu/cuối
    if (!fs.existsSync(raw)) { process.stdout.write(`  đọc: ${text.slice(0, 50)}…\n`); await doc(text, raw, voice, rate); }
    if (!fs.existsSync(f)) {
      // Edge TTS chèn sẵn ~0,1–0,2s lặng ở đầu và cuối mỗi câu → cộng dồn thành cảm giác "delay" (Quang 20/10).
      const cat = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03";
      execFileSync(FFMPEG, ["-y", "-v", "error", "-i", raw, "-af", `${cat},areverse,${cat},areverse`, "-ar", "48000", f]);
    }
    const d = doDai(f);
    caus.push({ text, start: t, end: t + d });
    const nghi = j === chiaCau(sc.vo).length - 1 ? GAP_CANH : GAP_CAU;
    ghep.push([f, nghi]);
    t += d + nghi;
  }
  timeline.scenes.push({ index: i, start, end: t, caus });
}
timeline.total = t + DUOI;

// Ghép: khoảng lặng đầu + từng câu + khoảng lặng sau mỗi câu (filter concat, đổi về 48 kHz stereo)
const args = ["-y", "-v", "error", "-f", "lavfi", "-t", String(DAU), "-i", "anullsrc=r=48000:cl=stereo"];
let n = 1;
for (const [f, nghi] of ghep) {
  if (f) { args.push("-i", f); n++; }   // f = null: cảnh không lời, chỉ có khoảng lặng
  args.push("-f", "lavfi", "-t", String(nghi), "-i", "anullsrc=r=48000:cl=stereo");
  n++;
}
const chuan = Array.from({ length: n }, (_, k) => `[${k}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a${k}]`);
const noi = Array.from({ length: n }, (_, k) => `[a${k}]`).join("");
const filter = `${chuan.join(";")};${noi}concat=n=${n}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
args.push("-filter_complex", filter, "-map", "[out]", "-ar", "48000", "-c:a", "libmp3lame", "-b:a", "160k", path.join(outDir, "voice.mp3"));
execFileSync(FFMPEG, args);

fs.writeFileSync(path.join(outDir, "timeline.json"), JSON.stringify(timeline, null, 2));
console.log(`Xong: ${kb.scenes.length} cảnh, ${ghep.filter(([f]) => f).length} câu, ${timeline.total.toFixed(1)}s → public/${kb.id}/`);
