/**
 * Bước 1 — giọng đọc: đọc lời thoại TỪNG CẢNH trong 1 lần bằng Edge TTS (ngữ điệu liền mạch, không "cứng"
 * như đọc rời từng câu — Quang 20/10), lấy mốc thời gian từng câu từ SentenceBoundary của Edge, chia thành
 * câu phụ đề ≤14 từ, ghép các cảnh thành 1 file voice.mp3 + timeline.json.
 *
 *   node tts.mjs scripts/01-zalo-don-hang.json
 * Kết quả: public/<id>/voice.mp3 + public/<id>/timeline.json (render.mjs đọc tiếp).
 * Cảnh đã đọc được lưu cache theo giọng + nội dung → sửa 1 cảnh chỉ đọc lại cảnh đó.
 * Giọng mặc định (kịch bản không ghi `voice`): VieNeu-TTS "Mai Anh" chạy local, nhanh ×1.08 (Quang chọn 28/10) — xem vieneu_tts.py.
 * Kịch bản ghi `voice` Edge (VD Vivienne đa ngôn ngữ +8%, mẫu E1 20/10) thì vẫn đọc bằng Edge như cũ.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const GAP_CANH = 0.3;   // nghỉ khi sang cảnh mới
const DAU = 0.3;        // khoảng lặng đầu video
const DUOI = 1.4;       // giữ cảnh kết sau câu cuối
const TICK = 1e-7;      // Edge trả Offset/Duration theo đơn vị 100 ns

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

/** Đọc 1 đoạn, trả về mp3 + danh sách câu Edge đọc [{text, start, end}] (giây, tính từ đầu file). */
async function doc(text, voice, rate, pitch) {
  for (let lan = 1; lan <= 6; lan++) {
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, { voiceLocale: "vi-VN", sentenceBoundaryEnabled: true, wordBoundaryEnabled: true });
      const { audioStream, metadataStream } = tts.toStream(text, { rate, pitch });
      const chunks = [];
      const cau = [];
      const words = [];   // mốc từng chữ → phụ đề tô đúng chữ đang đọc (thay ước lượng theo ký tự)
      metadataStream?.on("data", (c) => {
        for (const m of JSON.parse(c.toString()).Metadata ?? []) {
          const s = m.Data.Offset * TICK;
          if (m.Type === "WordBoundary") { words.push({ start: s, end: s + m.Data.Duration * TICK }); continue; }
          if (m.Type !== "SentenceBoundary") continue;
          cau.push({ text: m.Data.text?.Text ?? "", start: s, end: s + m.Data.Duration * TICK });
        }
      });
      await new Promise((ok, loi) => {
        const t = setTimeout(() => loi(new Error("Edge TTS quá 60s")), 60_000);
        audioStream.on("data", (c) => chunks.push(c));
        audioStream.on("end", () => { clearTimeout(t); ok(); });
        audioStream.on("error", (e) => { clearTimeout(t); loi(e); });
      });
      const buf = Buffer.concat(chunks);
      if (!buf.length || !cau.length) throw new Error("thiếu âm thanh hoặc mốc câu");
      return { buf, cau, words };
    } catch (e) {
      console.warn(`  Edge TTS lần ${lan}/6 lỗi: ${e.message}`);
      if (lan === 6) throw e;
      await new Promise((r) => setTimeout(r, (String(e.message).includes("429") ? 15000 : 2000) * lan));
    } finally {
      tts.close?.();
    }
  }
}

/**
 * Gán mốc cho từng câu phụ đề: mỗi câu Edge chiếm [start, end]; ký tự trong câu đó rải đều theo thời gian.
 * Câu phụ đề (có thể là nửa câu Edge, khi câu dài bị tách theo dấu phẩy) lấy mốc tại ký tự đầu/cuối của nó.
 */
function ganMoc(vo, phuDe, edge) {
  const moc = [];   // [{a, b, start, end}] — khoảng ký tự trong vo ứng với từng câu Edge
  let tu = 0;
  for (const c of edge) {
    const t = c.text.trim();
    let a = t ? vo.indexOf(t, tu) : -1;
    if (a < 0) a = tu;
    const b = a + (t.length || 1);
    moc.push({ a, b, start: c.start, end: c.end });
    tu = b;
  }
  moc[moc.length - 1].b = Math.max(moc[moc.length - 1].b, vo.length);
  const tai = (i) => {
    const m = moc.find((x) => i <= x.b) ?? moc[moc.length - 1];
    const r = Math.min(1, Math.max(0, (i - m.a) / Math.max(1, m.b - m.a)));
    return m.start + r * (m.end - m.start);
  };
  let k = 0;
  return phuDe.map((text) => {
    const a = Math.max(k, vo.indexOf(text, k));
    k = a + text.length;
    return { text, start: tai(a), end: tai(k) };
  });
}

const scriptPath = path.resolve(process.argv[2] ?? "");
if (!fs.existsSync(scriptPath)) { console.error("Cách dùng: node tts.mjs scripts/<file>.json"); process.exit(1); }
const kb = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const outDir = path.join(HERE, "public", kb.id);
const cacheDir = path.join(HERE, ".cache", "tts-canh");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(cacheDir, { recursive: true });

const voice = kb.voice || "fr-FR-VivienneMultilingualNeural";
const rate = kb.rate || "+15%";
const pitch = kb.pitch || "+8%";
const timeline = { fps: 30, scenes: [], total: 0 };
// Cách đọc riêng cho từ khó (trường `phatAm` của kịch bản, VD {"email": "i-meo"}): chỉ đổi chữ GỬI ĐI ĐỌC, phụ đề vẫn
// lấy nguyên `vo`. Edge miễn phí không nhận thẻ <lang> (thử 21/10: ngắt luồng), nên không bọc được từ tiếng Anh;
// giọng đa ngôn ngữ đọc từ tiếng Anh như phiên âm Việt kiểu lạ (Quang 20/10: "agent") → viết sẵn cách người Việt nói.
const PHAT_AM = kb.phatAm ?? {};
const docTiengAnh = (vo) => Object.entries(PHAT_AM).reduce((t, [w, doc]) => t.replace(new RegExp(`(?<!\\p{L})${w}(?!\\p{L})`, "giu"), doc), vo);
// Giọng VieNeu-TTS chạy local — mặc định cho kịch bản mới từ 28/10 (Quang chọn "Mai Anh", nói nhanh hơn chút; đọc đúng từ
// tiếng Anh nên không cần `phatAm`). Kịch bản cũ có `voice` Edge thì giữ Edge để render lại không đổi giọng.
// Thẻ cảm xúc VieNeu [cười] [thở dài] [hắng giọng] viết thẳng trong `vo`: chỉ VieNeu đọc, phụ đề và Edge bỏ đi.
// 29/10: chuyển sang VieNeu bản mới (pip 3.8.3, model v4, CPU fp32) ở venv riêng `D:\cache\venv-vieneu4`; Quang nghe thấy "Ngọc Huyền"
// và "Hải Đăng" ổn hơn — mặc định Ngọc Huyền. Không có venv đó thì rơi về `py -3.12` (VieNeu 3.3.0 của FRIDAY).
const engine = kb.engine ?? (kb.voice ? "edge" : "vieneu");
const VN_VENV = process.env.VIENEU_PY || "D:/cache/venv-vieneu4/Scripts/python.exe";
const vnPy = fs.existsSync(VN_VENV) ? [VN_VENV, ["-I", "-S"]] : ["py", ["-3.12", "-I", "-S"]];
const vnVoice = kb.vieneuVoice || (fs.existsSync(VN_VENV) ? "Ngọc Huyền" : "Mai Anh");
const vnTemp = kb.temperature ?? 0.6;
const vnTempo = kb.tempo ?? 1.08;
const boThe = (s) => s.replace(/\s*\[[^\]]+\]/g, "").replace(/\s{2,}/g, " ").trim();
const loiDoc = (vo) => (engine === "vieneu" ? vo : docTiengAnh(boThe(vo)));
const keyCanh = (noi) => crypto.createHash("sha1")
  .update(engine === "vieneu" ? `vieneu|${vnPy[0]}|${vnVoice}|${vnTemp}|${vnTempo}|${noi}` : `${voice}|${rate}|${pitch}|${noi}`)
  .digest("hex").slice(0, 16);
const duoi = engine === "vieneu" ? "wav" : "mp3";
if (engine === "vieneu") {
  // Đọc gộp mọi cảnh chưa có trong cache bằng MỘT tiến trình Python (nạp model 1 lần).
  const items = kb.scenes.filter((sc) => sc.vo).map((sc) => {
    const k = keyCanh(loiDoc(sc.vo));
    return { text: loiDoc(sc.vo), wav: path.join(cacheDir, `${k}.wav`), meta: path.join(cacheDir, `${k}.json`) };
  }).filter((it) => !fs.existsSync(it.wav) || !fs.existsSync(it.meta));
  if (items.length) {
    const jobF = path.join(cacheDir, "vieneu-job.json");
    fs.writeFileSync(jobF, JSON.stringify({ voice: vnVoice, temperature: vnTemp, tempo: vnTempo, gap: 0.18, items }));
    console.log(`VieNeu "${vnVoice}" ×${vnTempo}: đọc ${items.length} cảnh (lần đầu nạp model ~15–70 s)…`);
    execFileSync(vnPy[0], [...vnPy[1], path.join(HERE, "vieneu_tts.py"), jobF],
      { stdio: "inherit", env: { ...process.env, HF_HUB_DISABLE_SYMLINKS_WARNING: "1" } });
    fs.rmSync(jobF, { force: true });
  }
}
const ghep = [];   // danh sách [file | null, giây lặng sau]
let t = DAU;

for (const [i, sc] of kb.scenes.entries()) {
  const start = t;
  if (!sc.vo) {
    // Cảnh không lời (VD bìa): giữ đúng `dur` giây, chèn khoảng lặng tương ứng vào file giọng.
    const d = Number(sc.dur ?? 1.2);
    ghep.push([null, d]);
    t += d;
    timeline.scenes.push({ index: i, start, end: t, caus: [] });
    continue;
  }
  const noi = loiDoc(sc.vo);
  const noiSach = boThe(noi);   // chữ dùng để gán mốc phụ đề (không có thẻ cảm xúc)
  const key = keyCanh(noi);
  const raw = path.join(cacheDir, `${key}.${duoi}`);
  const metaF = path.join(cacheDir, `${key}.json`);
  const cat = path.join(cacheDir, `${key}.cat.wav`);
  if (engine === "vieneu" && (!fs.existsSync(raw) || !fs.existsSync(metaF))) throw new Error(`VieNeu chưa đọc được cảnh ${i + 1}`);
  if (!fs.existsSync(raw) || !fs.existsSync(metaF)) {
    process.stdout.write(`  đọc cảnh ${i + 1}: ${sc.vo.slice(0, 50)}…\n`);
    const { buf, cau, words } = await doc(noi, voice, rate, pitch);
    fs.writeFileSync(raw, buf);
    fs.writeFileSync(metaF, JSON.stringify({ cau, words }));
    await new Promise((r) => setTimeout(r, 1500));   // Edge hay trả 429 nếu gọi dồn dập
  }
  const meta = JSON.parse(fs.readFileSync(metaF, "utf8"));
  const edge = Array.isArray(meta) ? meta : meta.cau;   // cache cũ chỉ có mốc câu
  const tuEdge = Array.isArray(meta) ? [] : meta.words;
  // Cắt đúng từ đầu câu đầu đến cuối câu cuối (bỏ lặng Edge chèn sẵn) — khoảng nghỉ giữa các câu trong cảnh giữ tự nhiên.
  const cutA = Math.max(0, edge[0].start - 0.03);
  const cutB = edge[edge.length - 1].end + 0.08;
  if (!fs.existsSync(cat)) execFileSync(FFMPEG, ["-y", "-v", "error", "-i", raw, "-ss", cutA.toFixed(3), "-to", cutB.toFixed(3), "-ar", "48000", cat]);
  const dLen = cutB - cutA;
  // Mốc tính trên câu đã đổi cách đọc (khớp chữ Edge trả về); chữ phụ đề lấy câu tương ứng của `vo` gốc (cùng số câu).
  const pdGoc = chiaCau(boThe(sc.vo));
  const caus = ganMoc(noiSach, chiaCau(noiSach), edge).map((c, j) => ({
    text: pdGoc[j] ?? c.text, start: t + Math.max(0, c.start - cutA), end: t + Math.min(dLen, c.end - cutA),
    words: tuEdge.filter((w) => w.start >= c.start - 0.02 && w.start < c.end - 0.02).map((w) => ({ start: t + w.start - cutA, end: t + w.end - cutA })),
  }));
  ghep.push([cat, GAP_CANH]);
  t += dLen + GAP_CANH;
  timeline.scenes.push({ index: i, start, end: t, caus });
}
timeline.total = t + DUOI;

// Ghép: khoảng lặng đầu + từng cảnh + khoảng lặng sau mỗi cảnh (filter concat, đổi về 48 kHz stereo)
const args = ["-y", "-v", "error", "-f", "lavfi", "-t", String(DAU), "-i", "anullsrc=r=48000:cl=stereo"];
let n = 1;
for (const [f, nghi] of ghep) {
  if (f) { args.push("-i", f); n++; }   // f = null: cảnh không lời, chỉ có khoảng lặng
  args.push("-f", "lavfi", "-t", String(nghi), "-i", "anullsrc=r=48000:cl=stereo");
  n++;
}
const chuan = Array.from({ length: n }, (_, k) => `[${k}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a${k}]`);
const noi = Array.from({ length: n }, (_, k) => `[a${k}]`).join("");
let filter = `${chuan.join(";")};${noi}concat=n=${n}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
if (kb.music === "pad") {
  // Nhạc nền tự tổng hợp (không cần file nhạc): 2 hợp âm La thứ ↔ Fa trưởng hoà dần vào nhau, lọc mềm + vang nhẹ,
  // tự nhỏ xuống khi có lời (sidechain). Lấp các khoảng im lặng tuyệt đối giữa câu — chỗ khiến giọng nghe "máy"
  // (so với video anh Hiếu: nền luôn có nhạc ~-40 dB, 20/10).
  const T = timeline.total.toFixed(2);
  const w = "(0.5+0.5*sin(2*PI*t/16))";
  const am = "(sin(2*PI*220*t)+0.8*sin(2*PI*261.63*t)+0.7*sin(2*PI*329.63*t)+0.5*sin(2*PI*110*t))";
  const fa = "(sin(2*PI*174.61*t)+0.8*sin(2*PI*220*t)+0.7*sin(2*PI*261.63*t)+0.5*sin(2*PI*87.31*t))";
  args.push("-f", "lavfi", "-t", T, "-i", `aevalsrc='0.12*(${w}*${am}+(1-${w})*${fa})*(0.85+0.15*sin(2*PI*t/3))':s=48000:c=stereo`);
  const pad = n;
  filter = `${chuan.join(";")};${noi}concat=n=${n}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11,asplit[v1][v2];`
    + `[${pad}:a]lowpass=f=1400,aecho=0.8:0.7:120|260:0.3|0.2,volume=0.22,afade=t=in:d=1.5,afade=t=out:st=${(timeline.total - 2.5).toFixed(2)}:d=2.5[pd];`
    + `[pd][v2]sidechaincompress=threshold=0.03:ratio=5:attack=30:release=500[pk];`
    + `[v1][pk]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.89[out]`;
}
args.push("-filter_complex", filter, "-map", "[out]", "-ar", "48000", "-c:a", "libmp3lame", "-b:a", "160k", path.join(outDir, "voice.mp3"));
execFileSync(FFMPEG, args);

fs.writeFileSync(path.join(outDir, "timeline.json"), JSON.stringify(timeline, null, 2));
const soCau = timeline.scenes.reduce((s, x) => s + x.caus.length, 0);
console.log(`Xong: ${kb.scenes.length} cảnh, ${soCau} câu phụ đề, ${timeline.total.toFixed(1)}s → public/${kb.id}/`);
process.exit(0);   // msedge-tts có thể còn giữ socket → thoát hẳn
