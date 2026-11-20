/**
 * Bước 2 — dựng video: đóng gói src/ bằng Remotion, đưa kịch bản + timeline (từ tts.mjs) vào, xuất MP4 dọc 1080×1920.
 *
 *   node render.mjs scripts/01-zalo-don-hang.json            → output/ai-tips/<id>.mp4
 *   node render.mjs scripts/01-zalo-don-hang.json --still     → chỉ chụp 1 khung giữa mỗi cảnh (xem nhanh bố cục)
 *   node render.mjs scripts/<id>.json --uoc --xem → XEM TRƯỚC khi chưa có giọng: timeline ước tính từ lời (3,7 chữ/s), không tiếng;
 *                                                  xuất bia.png + xem-dau.mp4 (bìa + 3 s cảnh 2) + xem-cuoi.mp4 (5 s cuối) + khung từng cảnh
 * Chạy tts.mjs trước (cần public/<id>/voice.mp3 + timeline.json) — trừ khi --uoc.
 */
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const scriptPath = path.resolve(process.argv[2] ?? "");
const stillOnly = process.argv.includes("--still");
const uoc = process.argv.includes("--uoc"); // timeline ước tính + im lặng (xem trước bố cục / nhịp khi giọng chưa làm)
const xem = process.argv.includes("--xem");
// Cổng riêng: 3000 hay bị app Next.js của studio chiếm → Remotion mở nhầm trang (ERR_EMPTY_RESPONSE).
const PORT = Number(process.env.REMOTION_PORT || 3456);
if (!fs.existsSync(scriptPath)) { console.error("Cách dùng: node render.mjs scripts/<file>.json [--still]"); process.exit(1); }

const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const tlPath = path.join(HERE, "public", script.id, "timeline.json");
if (!uoc && !fs.existsSync(tlPath)) { console.error(`Chưa có giọng đọc: chạy  node tts.mjs ${process.argv[2]}  trước`); process.exit(1); }
/** Timeline ước tính: đọc ~3,7 chữ/giây (đo từ giọng Quỳnh Anh tuần 5), nghỉ 0,25 s giữa câu, 0,5 s giữa cảnh. */
function uocTimeline() {
  let t = 0.3;
  const scenes = script.scenes.map((sc, index) => {
    const start = index === 0 ? 0 : t;
    const caus = sc.vo.split(/(?<=[.!?])\s+/).filter(Boolean).map((text) => {
      const n = text.split(/\s+/).length, d = n / 3.7, a = t;
      t += d + 0.25;
      return { text, start: a, end: a + d, words: text.split(/\s+/).map((_, k) => ({ start: a + (k * d) / n, end: a + ((k + 1) * d) / n })) };
    });
    t += 0.5;
    return { index, start, end: t, caus };
  });
  return { fps: 30, scenes, total: t + 0.4 };
}
const timeline = uoc ? uocTimeline() : JSON.parse(fs.readFileSync(tlPath, "utf8"));
const inputProps = { script, timeline, silent: uoc };

const outDir = path.join(HERE, "..", "output", "ai-tips", script.id);
fs.mkdirSync(outDir, { recursive: true });

console.log("Đóng gói…");
const serveUrl = await bundle({ entryPoint: path.join(HERE, "src", "index.ts"), publicDir: path.join(HERE, "public") });
const composition = await selectComposition({ serveUrl, id: "AiTip", inputProps, port: PORT });

// Ảnh bìa (bia.png) — luôn xuất kèm, dùng làm ảnh đại diện khi đăng. Lấy giữa cảnh bìa nếu có, không thì khung đầu.
{
  const s0 = timeline.scenes[0];
  // bìa: cảnh "cover" lấy khung giữa; cảnh "b-title" (bảng trắng, chữ vẽ dần) lấy khung gần cuối khi chữ đã viết xong
  const t0 = script.scenes[0]?.type ?? "";
  const frame = /cover$/.test(t0) ? Math.round(((s0.start + s0.end) / 2) * timeline.fps) : t0 === "b-title" ? Math.round((s0.end - 0.3) * timeline.fps) : 0;
  await renderStill({ serveUrl, composition, inputProps, frame, output: path.join(outDir, "bia.png"), port: PORT });
  console.log("  bia.png");
}

if (xem) {
  // bản xem trước gửi Quang duyệt: đầu (bìa + 3 s cảnh kế) và 5 s cuối
  const fps = timeline.fps, last = composition.durationInFrames - 1;
  const dauTo = Math.min(last, Math.round(((timeline.scenes[1]?.start ?? 5) + 3) * fps));
  for (const [ten, range] of [["xem-dau", [0, dauTo]], ["xem-cuoi", [Math.max(0, last - 5 * fps), last]]]) {
    await renderMedia({ serveUrl, composition, inputProps, port: PORT, codec: "h264", crf: 22, frameRange: range, outputLocation: path.join(outDir, `${ten}.mp4`), muted: uoc });
    console.log(`  ${ten}.mp4`);
  }
}
if (stillOnly || xem) {
  for (const [i, s] of timeline.scenes.entries()) {
    // bảng trắng: lấy khung gần cuối cảnh (nét đã vẽ đủ) thay vì giữa cảnh
    const at = script.theme === "board" || script.theme === "bantin" ? s.end - 0.4 : (s.start + s.end) / 2;
    const frame = Math.min(composition.durationInFrames - 1, Math.round(at * timeline.fps));
    const out = path.join(outDir, `khung-${String(i + 1).padStart(2, "0")}-${script.scenes[i].type}.png`);
    await renderStill({ serveUrl, composition, inputProps, frame, output: out, port: PORT });
    console.log(`  ${path.basename(out)}`);
  }
} else if (uoc) {
  console.log("--uoc chỉ để xem trước (không có giọng) — không xuất bản nộp.");
} else {
  const out = path.join(outDir, `${script.id}.mp4`);
  let last = -1;
  await renderMedia({
    serveUrl, composition, inputProps, port: PORT, codec: "h264", outputLocation: out, crf: 20, audioBitrate: "192k",
    onProgress: ({ progress }) => { const p = Math.floor(progress * 20); if (p !== last) { last = p; process.stdout.write(`  ${p * 5}%\n`); } },
  });
  // Gắn bia.png làm ảnh bìa nhúng trong MP4 (attached_pic): Windows Explorer / trình phát lấy ảnh này làm hình
  // thu nhỏ, thay vì tự chọn một khung giữa video (Quang 20/10: "sao bìa vẫn chưa đổi").
  const tam = out.replace(/\.mp4$/, ".tam.mp4");
  execFileSync(process.env.FFMPEG || "ffmpeg", ["-y", "-v", "error", "-i", out, "-i", path.join(outDir, "bia.png"),
    "-map", "0", "-map", "1", "-c", "copy", "-c:v:1", "png", "-disposition:v:1", "attached_pic", tam]);
  fs.renameSync(tam, out);
  console.log(`Xong: ${out}`);
  // Bản nộp cuộc thi đặt tên theo cú pháp BTC: "Mã nhân viên_Chủ đề ứng dụng AI" (trường `nop` trong kịch bản).
  if (script.nop) {
    const nop = path.join(outDir, `${script.nop}.mp4`);
    fs.copyFileSync(out, nop);
    console.log(`Bản nộp: ${nop}`);
  }
}
