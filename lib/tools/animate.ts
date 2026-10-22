// Animate scene — biến ảnh tĩnh thành clip có NHÂN VẬT cử động (image-to-video).
//
// Khác hoàn toàn với motion.ts: motion.ts chỉ di chuyển khung hình trên ảnh chết,
// file này sinh lại từng khung hình nên nhân vật mới thật sự động (thở, lay tóc,
// nghiêng người). Bắt buộc phải có model i2v — không có đường vòng bằng ffmpeg.
//
// Provider:
//   "comfy" — ComfyUI chạy trên PC nhà (MIỄN PHÍ, không giới hạn)  ← đích ngắm
//   "fal"   — Fal.ai Wan 2.1 (tốn credit)                          ← chỉ để đối chiếu
//   "off"   — không animate, trả null → runner tự lùi về Ken Burns
//
// Nguyên tắc: lỗi KHÔNG được làm hỏng cả lượt chạy. Mọi thất bại đều trả null
// để scene đó rơi về ảnh tĩnh + chuyển động camera.

import fs from "fs";
import path from "path";
import type { SceneMotion, MotionType } from "./motion";

export type AnimateProvider = "comfy" | "fal" | "off";

export interface AnimateOptions {
  imagePath: string;
  filename: string;
  outDir: string;
  durationSec: number;
  motion?: SceneMotion;
  /** image_prompt của scene — cho model biết trong ảnh có gì */
  sceneHint?: string;
  provider?: AnimateProvider;
  /** tên file workflow trong comfy/workflows/ (không cần đuôi .json) */
  workflow?: string;
}

// ── Dịch motion directive sang ngôn ngữ model i2v hiểu ───────────────────────
// Cùng field "motion" mà AI đã sinh sẵn cho Ken Burns, ở đây thành lời tả camera.
const CAMERA_WORDS: Record<MotionType, string> = {
  none: "locked-off static camera, absolutely no camera movement",
  push_in: "very slow dolly in, camera creeps closer",
  pull_out: "very slow dolly out, camera pulls back to reveal the surroundings",
  pan_left: "camera pans slowly to the left",
  pan_right: "camera pans slowly to the right",
  tilt_up: "camera tilts slowly upward",
  tilt_down: "camera tilts slowly downward",
  drift: "very slow floating camera drift",
  shake: "handheld unstable camera, nervous micro-jitter",
  pulse: "camera breathes gently in and out",
};

/** Chuyển động của NHÂN VẬT — đây mới là thứ Ken Burns không làm được. */
function bodyWords(intensity: number): string {
  if (intensity < 0.25)
    return "extremely subtle character motion: slow shallow breathing, hair and clothing barely stir, occasional slow blink";
  if (intensity < 0.55)
    return "subtle character motion: visible breathing, slight shift of weight, hair and clothing sway gently, natural blinking, small head movement";
  return "clear character motion: breathing, head turns slowly, shoulders move, hair and clothing sway, expressive but natural body language";
}

/** Giữ nét vẽ — quan trọng nhất với manga/webtoon, i2v rất hay làm chảy nét. */
export const PRESERVE_STYLE_NEGATIVE =
  "morphing, melting, warping face, distorted anatomy, extra limbs, extra fingers, " +
  "changing art style, 3d render, photorealistic, blurry linework, smeared ink, " +
  "flickering, text, watermark";

export function motionToPrompt(motion?: SceneMotion, sceneHint?: string): string {
  const type = motion?.type ?? "drift";
  const intensity = motion?.intensity ?? 0.3;
  const parts = [
    sceneHint?.trim(),
    bodyWords(intensity),
    CAMERA_WORDS[type] ?? CAMERA_WORDS.drift,
  ];
  if ((motion?.shake ?? 0) > 0.3 && type !== "shake") parts.push("slight nervous camera tremor");
  // Câu chốt: giữ nguyên tranh gốc, chỉ làm nó động
  parts.push("preserve the original art style, ink linework and composition exactly");
  return parts.filter(Boolean).join(", ");
}

// ── ComfyUI client ────────────────────────────────────────────────────────────
// API thật của ComfyUI:
//   POST /upload/image   (multipart)           → { name, subfolder, type }
//   POST /prompt         { prompt, client_id } → { prompt_id }
//   GET  /history/{id}                         → {} khi chưa xong, có outputs khi xong
//   GET  /view?filename=&subfolder=&type=      → file
//
// Workflow phải ở "API format" (ComfyUI → Workflow → Export (API)). Ta KHÔNG
// hardcode workflow vì tên node đổi theo phiên bản và custom node đang cài;
// thay vào đó đọc file người dùng tự export rồi thay token __IMAGE__, __PROMPT__…

const COMFY_TIMEOUT_MS = 15 * 60 * 1000; // clip i2v chạy vài phút là bình thường
const POLL_MS = 2000;

function comfyBase(): string {
  return (process.env.COMFY_URL || "http://127.0.0.1:8188").replace(/\/+$/, "");
}

async function comfyUploadImage(base: string, imagePath: string): Promise<string> {
  const buf = fs.readFileSync(imagePath);
  const fd = new FormData();
  fd.append("image", new Blob([new Uint8Array(buf)]), path.basename(imagePath));
  fd.append("overwrite", "true");
  const r = await fetch(`${base}/upload/image`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`upload/image ${r.status}`);
  const j = (await r.json()) as { name: string; subfolder?: string };
  return j.subfolder ? `${j.subfolder}/${j.name}` : j.name;
}

function loadWorkflow(name: string): string {
  const file = path.join(process.cwd(), "comfy", "workflows", `${name.replace(/\.json$/, "")}.json`);
  if (!fs.existsSync(file)) throw new Error(`Không thấy workflow: ${file}`);
  return fs.readFileSync(file, "utf8");
}

/** Nhét giá trị vào chuỗi JSON — escape vì token nằm bên trong string của JSON. */
function fillWorkflow(raw: string, vars: Record<string, string | number>): string {
  let out = raw;
  for (const [k, v] of Object.entries(vars)) {
    const safe = typeof v === "number" ? String(v) : JSON.stringify(v).slice(1, -1);
    out = out.split(`__${k}__`).join(safe);
  }
  return out;
}

/** Lần trong outputs của history ra file video đầu tiên. */
function pickOutputFile(
  outputs: Record<string, unknown>
): { filename: string; subfolder: string; type: string } | null {
  const isVid = (f: string) => /\.(mp4|webm|mkv|gif|webp)$/i.test(f);
  let fallback: { filename: string; subfolder: string; type: string } | null = null;
  for (const node of Object.values(outputs ?? {})) {
    for (const arr of Object.values((node ?? {}) as Record<string, unknown>)) {
      if (!Array.isArray(arr)) continue;
      for (const it of arr) {
        const o = it as { filename?: string; subfolder?: string; type?: string };
        if (!o?.filename) continue;
        const hit = { filename: o.filename, subfolder: o.subfolder ?? "", type: o.type ?? "output" };
        if (isVid(o.filename)) return hit;
        fallback ??= hit;
      }
    }
  }
  return fallback;
}

async function runComfy(o: AnimateOptions, outputPath: string): Promise<string> {
  const base = comfyBase();
  const fps = 16; // Wan sinh ở 16fps; ffmpeg lo phần chuẩn hoá về 30
  const frames = Math.max(9, Math.round(o.durationSec * fps) | 1);

  const imageRef = await comfyUploadImage(base, o.imagePath);
  const workflow = fillWorkflow(loadWorkflow(o.workflow ?? "wan-i2v"), {
    IMAGE: imageRef,
    PROMPT: motionToPrompt(o.motion, o.sceneHint),
    NEGATIVE: PRESERVE_STYLE_NEGATIVE,
    FRAMES: frames,
    FPS: fps,
    SEED: Math.floor(Math.random() * 2 ** 31),
  });

  const clientId = `claude-studio-${Date.now()}`;
  const qr = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: JSON.parse(workflow), client_id: clientId }),
  });
  if (!qr.ok) throw new Error(`/prompt ${qr.status}: ${(await qr.text()).slice(0, 300)}`);
  const { prompt_id } = (await qr.json()) as { prompt_id: string };

  const deadline = Date.now() + COMFY_TIMEOUT_MS;
  for (;;) {
    if (Date.now() > deadline) throw new Error("ComfyUI quá thời gian chờ");
    await new Promise((r) => setTimeout(r, POLL_MS));
    const hr = await fetch(`${base}/history/${prompt_id}`);
    if (!hr.ok) continue;
    const hist = (await hr.json()) as Record<
      string,
      { outputs?: Record<string, unknown>; status?: { status_str?: string } }
    >;
    const entry = hist?.[prompt_id];
    if (!entry) continue;
    if (entry.status?.status_str === "error") throw new Error("ComfyUI báo lỗi khi chạy workflow");
    if (!entry.outputs) continue;

    const f = pickOutputFile(entry.outputs);
    if (!f) throw new Error("Workflow chạy xong nhưng output không có file video");
    const q = new URLSearchParams({ filename: f.filename, subfolder: f.subfolder, type: f.type });
    const dl = await fetch(`${base}/view?${q}`);
    if (!dl.ok) throw new Error(`/view ${dl.status}`);
    fs.writeFileSync(outputPath, Buffer.from(await dl.arrayBuffer()));
    return outputPath;
  }
}

// ── Điểm vào ──────────────────────────────────────────────────────────────────
export async function animateScene(o: AnimateOptions): Promise<string | null> {
  const provider = o.provider ?? (process.env.ANIMATE_PROVIDER as AnimateProvider) ?? "off";
  if (provider === "off") return null;
  if (o.motion?.type === "none") return null; // scene cố ý đóng băng thì đừng animate
  if (!fs.existsSync(o.imagePath)) return null;

  fs.mkdirSync(o.outDir, { recursive: true });
  const outputPath = path.join(o.outDir, `${o.filename}.mp4`);
  if (fs.existsSync(outputPath)) return outputPath; // cache: có rồi thì thôi

  try {
    if (provider === "comfy") return await runComfy(o, outputPath);
    if (provider === "fal") {
      const { generateVideoClip } = await import("./videoclip");
      return await generateVideoClip(
        o.imagePath,
        motionToPrompt(o.motion, o.sceneHint),
        o.filename,
        o.outDir
      );
    }
  } catch (e) {
    // Không ném lỗi lên: scene này rơi về ảnh tĩnh + Ken Burns, cả video vẫn chạy xong
    console.error(`[animate] scene ${o.filename} thất bại → lùi về ảnh tĩnh:`, (e as Error).message);
  }
  return null;
}
