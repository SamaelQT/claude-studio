// Types và client-safe functions — không import fs/path
// File này được dùng cả ở client (page.tsx) và server

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
  channel: string;
  style_id: string;
  style?: string;
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
}

// ── Client-safe runner (dùng fetch thay vì gọi trực tiếp) ─────────────────────
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
  const channel = script.channel;
  const styleId = styleIdOverride ?? script.style_id ?? script.style ?? "manga-horror";

  // Lấy style DNA từ API
  let promptPrefix = "";
  try {
    const styleRes = await fetch(`/api/styles?channel=${channel}&id=${styleId}`).then(r => r.json());
    if (styleRes.style) {
      const dna = styleRes.style as StyleDNA;
      promptPrefix = [dna.prompt_prefix, dna.scene_layer].filter(Boolean).join(". ");
    }
  } catch {}

  const isNoVoice = channel === "huong-noi";
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

      // ── Image ──
      const imageStylePrefix = styleExtra ? `${promptPrefix}. Additional: ${styleExtra}` : promptPrefix;
      const fullPrompt = [imageStylePrefix, script.character_sheet, scene.image_prompt].filter(Boolean).join(", ");

      const imgRes = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "generate_image", input: { prompt: fullPrompt, filename, style: channel } }),
        signal,
      }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

      if (!imgRes.success) {
        onEvent({ type: "image_error", n: scene.n, error: imgRes.error });
        return;
      }
      onEvent({ type: "image_done", n: scene.n, path: imgRes.data.filePath });

      // ── Voice (lỗi KHÔNG drop scene) ──
      let voicePath = "";
      let voiceFailed = false;

      if (scene.voice_text?.trim() && !isNoVoice) {
        const voiceFilename = `${project_name}__voice_${String(scene.n).padStart(2, "0")}`;
        const voiceRes = await fetch("/api/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool: "generate_voice", input: { text: scene.voice_text, filename: voiceFilename, style: channel } }),
          signal,
        }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

        if (voiceRes.success) {
          voicePath = voiceRes.data.filePath;
          onEvent({ type: "voice_done", n: scene.n, path: voicePath });
        } else {
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

  onEvent({ type: "assemble_start" });
  const asmRes = await fetch("/api/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool: "assemble_video", input: { scenes: validScenes, outputFilename: project_name, formats, music, style: channel } }),
    signal,
  }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

  if (!asmRes.success) { onEvent({ type: "assemble_error", error: asmRes.error }); return; }
  onEvent({ type: "assemble_done", files: asmRes.data.files });
  onEvent({ type: "done" });
}
