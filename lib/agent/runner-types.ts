// Types và client-safe functions — không import fs/path
// File này được dùng cả ở client (page.tsx) và server

import type { SceneMotion } from "@/lib/tools/motion";
export type { SceneMotion };

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
  /** id của vai đọc câu này — trỏ tới ScriptJSON.speakers[].id */
  speaker?: string;
  /** sắc thái cảm xúc: neutral | tense | whisper | fear | panic | sad | angry | warm */
  emotion?: string;
  /** không gian vang: dry | room | hallway | outdoor | phone */
  space?: string;
  /** chuyển động camera của cảnh — do AI chọn theo nội dung + lời thoại */
  motion?: SceneMotion;
}

/** Khoảng lặng trước/sau lời thoại theo cảm xúc — khớp với EMOTIONS trong voice.ts.
 *  Để ở đây (client-safe) vì runner chạy trên trình duyệt, không import được voice.ts. */
export const EMOTION_PADS: Record<string, { before: number; after: number; db: number; space?: string }> = {
  // người kể chuyện: lùi hẳn xuống dưới nhân vật (-5.5dB) và luôn khô tiếng,
  // để lời thoại nhân vật nổi lên phía trước
  narration: { before: 0, after: 0.15, db: -5.5, space: "dry" },
  neutral: { before: 0,    after: 0.2,  db: 0 },
  tense:   { before: 0.15, after: 0.3,  db: 0 },
  whisper: { before: 0.2,  after: 0.35, db: -3 },
  fear:    { before: 0.1,  after: 0.25, db: 0 },
  panic:   { before: 0,    after: 0.12, db: 1 },
  sad:     { before: 0.2,  after: 0.4,  db: -1.5 },
  angry:   { before: 0.12, after: 0.2,  db: 1.5 },
  warm:    { before: 0.1,  after: 0.25, db: 0 },
};

/** Một vai có giọng riêng trong video (người kể, nam chính, nữ chính…) */
export interface SpeakerDef {
  id: string;
  name: string;
  voice: string;
  speed: number;
}

export interface ScriptJSON {
  project_name: string;
  channel: string;
  style_id: string;
  style?: string;
  character_sheet?: string;
  scenes: SceneInput[];
  formats?: string[];
  has_voice?: boolean;
  /** Giọng mặc định — dùng cho scene không chỉ định speaker */
  voice?: string;
  /** -3 (chậm nhất) → +3 (nhanh nhất) */
  voice_speed?: number;
  /** Dàn giọng: mỗi vai một giọng riêng */
  speakers?: SpeakerDef[];
  /** Không gian vang mặc định cho cả video — scene ghi riêng thì scene thắng */
  space?: string;
  /** true = cho nhân vật cử động thật bằng model i2v (cần ComfyUI/GPU).
   *  Scene animate hỏng sẽ tự lùi về ảnh tĩnh + Ken Burns, không làm hỏng cả video. */
  animate?: boolean;
  /** "comfy" = PC nhà (free) | "fal" = tốn credit | "off" */
  animate_provider?: "comfy" | "fal" | "off";
  /** tên workflow trong comfy/workflows/ — mặc định wan-i2v */
  animate_workflow?: string;
}

export type RunEvent =
  | { type: "scene_start"; n: number; total: number }
  | { type: "image_done"; n: number; path: string }
  | { type: "image_error"; n: number; error: string }
  | { type: "clip_done"; n: number; path: string }
  | { type: "clip_skipped"; n: number }
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
  let styleGuidance: number | undefined;
  let styleNegative: string | undefined;
  try {
    const styleRes = await fetch(`/api/styles?channel=${channel}&id=${styleId}`).then(r => r.json());
    if (styleRes.style) {
      const dna = styleRes.style as StyleDNA;
      promptPrefix = [dna.prompt_prefix, dna.scene_layer].filter(Boolean).join(". ");
      // mỗi style có độ bám prompt riêng — trước đây bị bỏ qua, dùng cứng theo kênh
      styleGuidance = dna.guidance_scale;
      // đã kiểm chứng: FLUX dev thật sự áp dụng negative_prompt (cùng seed ra ảnh khác)
      styleNegative = dna.negative;
    }
  } catch {}

  // Chỉ tắt giọng khi script nói rõ has_voice=false — không hardcode theo kênh nữa,
  // để kênh nào cũng có thể bật giọng nếu người dùng muốn.
  const isNoVoice = script.has_voice === false;
  const animateOn = script.animate === true;
  const speakerMap = new Map((script.speakers ?? []).map(s => [s.id, s]));
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
    padBefore?: number;
    padAfter?: number;
    volumeDb?: number;
    space?: string;
    motion?: SceneMotion;
    clipPath?: string;
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
      // THỨ TỰ QUAN TRỌNG: nội dung cảnh phải đứng TRƯỚC style.
      // FLUX dùng CLIP encoder cắt ở ~77 token; nếu style (~120 từ) đứng đầu thì phần
      // mô tả cảnh bị đẩy ra ngoài và model tự bịa cảnh khác. Đã kiểm chứng bằng A/B.
      const imageStyleSuffix = styleExtra ? `${promptPrefix}. Additional: ${styleExtra}` : promptPrefix;
      const fullPrompt = [scene.image_prompt, script.character_sheet, imageStyleSuffix].filter(Boolean).join(", ");

      const imgRes = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "generate_image",
          input: {
            prompt: fullPrompt, filename, style: channel,
            guidanceScale: styleGuidance, negativePrompt: styleNegative,
          },
        }),
        signal,
      }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

      if (!imgRes.success) {
        onEvent({ type: "image_error", n: scene.n, error: imgRes.error });
        return;
      }
      onEvent({ type: "image_done", n: scene.n, path: imgRes.data.filePath });

      // ── Animate: ảnh tĩnh → clip nhân vật cử động (chỉ khi script bật animate) ──
      // Thất bại KHÔNG drop scene: clipPath rỗng thì scene rơi về ảnh tĩnh + Ken Burns.
      let clipPath = "";
      if (animateOn) {
        const clipFilename = `${project_name}__clip_${String(scene.n).padStart(2, "0")}`;
        const aRes = await fetch("/api/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: "animate_scene",
            input: {
              image_path: imgRes.data.filePath,
              filename: clipFilename,
              style: channel,
              motion: scene.motion,
              scene_hint: scene.image_prompt,
              duration: scene.duration ?? defaultDuration,
              provider: script.animate_provider,
              workflow: script.animate_workflow,
            },
          }),
          signal,
        }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

        if (aRes.success && aRes.data?.filePath) {
          clipPath = aRes.data.filePath;
          onEvent({ type: "clip_done", n: scene.n, path: clipPath });
        } else {
          onEvent({ type: "clip_skipped", n: scene.n });
        }
      }

      // ── Voice (lỗi KHÔNG drop scene) ──
      let voicePath = "";
      let voiceFailed = false;

      if (scene.voice_text?.trim() && !isNoVoice) {
        // Vai của scene này → giọng riêng; không có vai thì dùng giọng mặc định
        const sp = scene.speaker ? speakerMap.get(scene.speaker) : undefined;
        const sceneVoice = sp?.voice ?? script.voice;
        const sceneSpeed = sp?.speed ?? script.voice_speed;

        // Gắn giọng + cảm xúc vào tên file để đổi thiết lập không dính cache cũ
        const emo = scene.emotion && scene.emotion !== "neutral" ? `_${scene.emotion}` : "";
        // bỏ dấu tiếng Việt trước rồi mới lọc, nếu không "Đức Trí" và "Đoan Trang"
        // đều bị cắt cụt thành chuỗi khó phân biệt
        const voiceTag = sceneVoice
          ? sceneVoice.normalize("NFD").replace(/[̀-ͯ]/g, "")
              .replace(/đ/g, "d").replace(/Đ/g, "D")
              .replace(/:/g, "_").replace(/[^a-zA-Z0-9_-]/g, "")
          : "";
        const voiceSuffix = voiceTag
          ? `_${voiceTag}${sceneSpeed ? `s${sceneSpeed}` : ""}${emo}`
          : emo;
        const voiceFilename = `${project_name}__voice_${String(scene.n).padStart(2, "0")}${voiceSuffix}`;
        const voiceRes = await fetch("/api/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: "generate_voice",
            input: {
              text: scene.voice_text,
              filename: voiceFilename,
              style: channel,
              voice: sceneVoice,
              speed: sceneSpeed,
              emotion: scene.emotion,
            },
          }),
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

      // Nhịp nghỉ lấy theo cảm xúc của scene (Edge chặn <break>, nên ffmpeg lo phần này)
      const emo = EMOTION_PADS[scene.emotion ?? "neutral"] ?? EMOTION_PADS.neutral;

      sceneResults[idx] = {
        imagePath: imgRes.data.filePath,
        voicePath,
        voiceText: scene.voice_text ?? "",
        mainText: scene.main_text,
        punchline: scene.punchline,
        duration: scene.duration ?? (isNoVoice || voiceFailed ? defaultDuration : undefined),
        voiceFailed,
        padBefore: emo.before,
        padAfter: emo.after,
        volumeDb: emo.db,
        // cảm xúc có thể ép không gian riêng (người kể chuyện luôn khô tiếng)
        space: emo.space ?? scene.space ?? script.space,
        motion: scene.motion,
        clipPath,
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
