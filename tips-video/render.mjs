/**
 * Bước 2 — dựng video: đóng gói src/ bằng Remotion, đưa kịch bản + timeline (từ tts.mjs) vào, xuất MP4 dọc 1080×1920.
 *
 *   node render.mjs scripts/01-zalo-don-hang.json            → output/ai-tips/<id>.mp4
 *   node render.mjs scripts/01-zalo-don-hang.json --still     → chỉ chụp 1 khung giữa mỗi cảnh (xem nhanh bố cục)
 * Chạy tts.mjs trước (cần public/<id>/voice.mp3 + timeline.json).
 */
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const scriptPath = path.resolve(process.argv[2] ?? "");
const stillOnly = process.argv.includes("--still");
if (!fs.existsSync(scriptPath)) { console.error("Cách dùng: node render.mjs scripts/<file>.json [--still]"); process.exit(1); }

const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const tlPath = path.join(HERE, "public", script.id, "timeline.json");
if (!fs.existsSync(tlPath)) { console.error(`Chưa có giọng đọc: chạy  node tts.mjs ${process.argv[2]}  trước`); process.exit(1); }
const timeline = JSON.parse(fs.readFileSync(tlPath, "utf8"));
const inputProps = { script, timeline };

const outDir = path.join(HERE, "..", "output", "ai-tips", script.id);
fs.mkdirSync(outDir, { recursive: true });

console.log("Đóng gói…");
const serveUrl = await bundle({ entryPoint: path.join(HERE, "src", "index.ts"), publicDir: path.join(HERE, "public") });
const composition = await selectComposition({ serveUrl, id: "AiTip", inputProps });

if (stillOnly) {
  for (const [i, s] of timeline.scenes.entries()) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round(((s.start + s.end) / 2) * timeline.fps));
    const out = path.join(outDir, `khung-${String(i + 1).padStart(2, "0")}-${script.scenes[i].type}.png`);
    await renderStill({ serveUrl, composition, inputProps, frame, output: out });
    console.log(`  ${path.basename(out)}`);
  }
} else {
  const out = path.join(outDir, `${script.id}.mp4`);
  let last = -1;
  await renderMedia({
    serveUrl, composition, inputProps, codec: "h264", outputLocation: out, crf: 20, audioBitrate: "192k",
    onProgress: ({ progress }) => { const p = Math.floor(progress * 20); if (p !== last) { last = p; process.stdout.write(`  ${p * 5}%\n`); } },
  });
  console.log(`Xong: ${out}`);
}
