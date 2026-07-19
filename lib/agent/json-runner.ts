// Pipeline: image + voice + video từ JSON script
// Free image providers only (Pollinations → HuggingFace → Cloudflare)

import fs from "fs";
import path from "path";

// ── Style DNA loader ───────────────────────────────────────────────────────────
export interface StyleDNA {
  id: string;
  name: string;
  channel: string;
  description: string;
  prompt_prefix: string;
  scene_layer?: string;
  negative?: string;
  guidance_scale?: number;
  voice?: string;
  voice_speed?: number;
  preview_prompt?: string;
}

export function loadStyle(channel: string, styleId: string): StyleDNA | null {
  try {
    const filePath = path.join(process.cwd(), "styles", channel, `${styleId}.json`);
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as StyleDNA;
  } catch {
    return null;
  }
}

export function listStyles(channel: string): StyleDNA[] {
  try {
    const dir = path.join(process.cwd(), "styles", channel);
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
    return files.map(f => {
      const raw = fs.readFileSync(path.join(dir, f), "utf-8");
      return JSON.parse(raw) as StyleDNA;
    });
  } catch {
    return [];
  }
}

// ── Legacy image style prompts (fallback nếu không có style JSON) ──────────────
const LEGACY_STYLES: Record<string, string> = {
  horror:
    "manga panel, black and white ink illustration, Junji Ito style, dense crosshatch shading, high contrast monochrome, single blood red accent only, psychological horror atmosphere, ONE subtle visual error in the scene, horror manga page, detailed ink linework",
  introvert_sad:
    "flat 2D webtoon illustration, clean simple linework, soft cel-shading, Korean slice-of-life style, muted cool blue-gray palette, melancholic quiet scene, relatable everyday moment",
  introvert_fun:
    "flat 2D webtoon illustration, warm pastel palette, cozy aesthetic, clean linework, soft cel-shading, comfortable everyday scene",
};

export const PREVIEW_SCENES: Record<string, string> = {
  "wansee/manga-horror":    "apartment hallway at night, single fluorescent light, shadow beneath door has too many legs",
  "wansee/webtoon-horror":  "young woman in kitchen at 3am, refrigerator light, second shadow on wall she has not noticed",
  "wansee/psychological":   "empty school hallway fluorescent lights, lockers stretching too far, faces hidden in wall texture",
  "huong-noi/soft-light":   "girl sitting alone at cafe window at night, rainy glass, warm lamp, looking at phone",
};

export async function generatePreviewImage(
  channel: string,
  styleId: string,
  sceneDesc: string,
  extraNotes: string,
): Promise<{ filePath: string } | { error: string }> {
  const style = loadStyle(channel, styleId);
  const prompt_prefix = style?.prompt_prefix ?? LEGACY_STYLES[styleId] ?? LEGACY_STYLES.horror;
  const prompt = [prompt_prefix, sceneDesc, extraNotes].filter(Boolean).join(". ");
  const filename = `preview__${channel}__${styleId}__${Date.now()}`;

  const previewDir = path.join(process.cwd(), "output", channel, "_previews");
  fs.mkdirSync(previewDir, { recursive: true });

  const res = await fetch("/api/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool: "generate_image", input: { prompt, filename, style: channel, outDir: previewDir } }),
  }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

  if (!res.success) return { error: res.error };
  return { filePath: res.data.filePath };
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface SceneInput {
  n: number;
  image_prompt: string;
  voice_text?: string;
  main_text?: string;
  punchline?: string;
  duration?: number;
}

export interface ScriptJSON {
  project_name: string;
  channel: string;           // "wansee" | "huong-noi" | ...
  style_id: string;          // "manga-horror" | "soft-light" | ...
  style?: string;            // legacy compat
  character_sheet?: string;
  scenes: SceneInput[];
  formats?: string[];
}

export type RunEvent =
  | { type: "scene_start"; n: number; total: number }
  | { type: "image_done"; n: number; path: string }
  | { type: "image_error"; n: number; error: string }
  | { type: "voice_done"; n: number; path: string }
  | { type: "voice_error"; n: number; error: string; fallback: "silent" }
  | { type: "assemble_start" }
  | { type: "assemble_done"; files: Record<string, string> }
  | { type: "assemble_error"; error: string }
  | { type: "done" };

export interface MusicConfig {
  mode: "auto" | "manual" | "lyric" | "beat" | "whisper";
  auto?: { musicPath: string; startOffset: number; volume: number; fadeIn: number; fadeOut: number };
  manual?: Array<{ musicPath: string; musicStart: number; videoStart: number; videoEnd: number; volume: number }>;
  // lyric/beat/whisper: timestamps được tính trước và truyền vào dưới dạng manual cues
}

// ── Main runner ────────────────────────────────────────────────────────────────
export async function runFromJSON(
  script: ScriptJSON,
  onEvent: (e: RunEvent) => void,
  signal?: AbortSignal,
  music?: MusicConfig,
  styleIdOverride?: string,
  styleExtra?: string,
  sceneDuration?: number,
) {
  const { project_name, scenes, formats = ["youtube"] } = script;
  const channel = script.channel ?? (script.style?.startsWith("horror") ? "wansee" : "huong-noi");
  const styleId = styleIdOverride ?? script.style_id ?? script.style ?? "manga-horror";

  // Load style DNA
  const styleDNA = loadStyle(channel, styleId);
  const promptPrefix = styleDNA
    ? [styleDNA.prompt_prefix, styleDNA.scene_layer].filter(Boolean).join(". ")
    : (LEGACY_STYLES[styleId] ?? LEGACY_STYLES.horror);

  const imageStylePrefix = styleExtra ? `${promptPrefix}. Additional: ${styleExtra}` : promptPrefix;
  const voiceStyle = styleDNA?.voice ? (styleDNA.id ?? channel) : channel;
  const isNoVoice = channel === "huong-noi" || styleId.includes("introvert");
  const defaultDuration = sceneDuration ?? 5;
  const total = scenes.length;

  const sceneResults: Array<{
    imagePath: string;
    voicePath: string;
    voiceText: string;
    mainText?: string;
    punchline?: string;
    duration?: number;
    voiceFailed?: boolean;
  } | null> = Array(total).fill(null);

  const CONCURRENCY = 3;

  for (let i = 0; i < total; i += CONCURRENCY) {
    if (signal?.aborted) return;
    const batch = scenes.slice(i, i + CONCURRENCY);

    await Promise.all(batch.map(async (scene) => {
      if (signal?.aborted) return;
      const idx = scene.n - 1;
      onEvent({ type: "scene_start", n: scene.n, total });

      const filename = `${project_name}__scene_${String(scene.n).padStart(2, "0")}`;

      // ── Image ──────────────────────────────────────────────────────────────
      const fullPrompt = [imageStylePrefix, script.character_sheet, scene.image_prompt]
        .filter(Boolean).join(", ");

      const imgRes = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "generate_image",
          input: { prompt: fullPrompt, filename, style: channel },
        }),
        signal,
      }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

      if (!imgRes.success) {
        onEvent({ type: "image_error", n: scene.n, error: imgRes.error });
        return; // không có ảnh thì bỏ scene này
      }
      onEvent({ type: "image_done", n: scene.n, path: imgRes.data.filePath });

      // ── Voice (optional — lỗi KHÔNG drop scene, dùng silent thay thế) ────
      let voicePath = "";
      let voiceFailed = false;

      if (scene.voice_text?.trim() && !isNoVoice) {
        const voiceFilename = `${project_name}__voice_${String(scene.n).padStart(2, "0")}`;
        const voiceRes = await fetch("/api/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: "generate_voice",
            input: { text: scene.voice_text, filename: voiceFilename, style: voiceStyle },
          }),
          signal,
        }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

        if (voiceRes.success) {
          voicePath = voiceRes.data.filePath;
          onEvent({ type: "voice_done", n: scene.n, path: voicePath });
        } else {
          // BUG FIX: không drop scene — dùng silent audio, cảnh vẫn xuất hiện trong video
          voiceFailed = true;
          onEvent({ type: "voice_error", n: scene.n, error: voiceRes.error, fallback: "silent" });
        }
      } else {
        onEvent({ type: "voice_done", n: scene.n, path: "" });
      }

      sceneResults[idx] = {
        imagePath: imgRes.data.filePath,
        voicePath,
        voiceText: scene.voice_text ?? "",
        mainText: scene.main_text,
        punchline: scene.punchline,
        duration: scene.duration ?? (isNoVoice || voiceFailed ? defaultDuration : undefined),
        voiceFailed,
      };
    }));
  }

  if (signal?.aborted) return;

  const validScenes = sceneResults.filter(Boolean) as NonNullable<typeof sceneResults[0]>[];
  if (validScenes.length === 0) {
    onEvent({ type: "assemble_error", error: "Không có scene nào thành công" });
    return;
  }

  const failedVoice = validScenes.filter(s => s.voiceFailed).length;
  if (failedVoice > 0) {
    console.warn(`[runner] ${failedVoice} scenes dùng silent audio do voice thất bại`);
  }

  onEvent({ type: "assemble_start" });

  const asmRes = await fetch("/api/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool: "assemble_video",
      input: { scenes: validScenes, outputFilename: project_name, formats, music, style: channel },
    }),
    signal,
  }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

  if (!asmRes.success) {
    onEvent({ type: "assemble_error", error: asmRes.error });
    return;
  }
  onEvent({ type: "assemble_done", files: asmRes.data.files });
  onEvent({ type: "done" });
}
