// Chạy toàn bộ pipeline (image + voice + video) từ JSON script
// KHÔNG dùng Claude API — zero LLM cost

// Flux-optimized prompts: keyword-forward, trigger words first, negative via wording
const IMAGE_STYLES: Record<string, string> = {
  // ── Horror variants ────────────────────────────────────────────────────────
  horror:
    "manga panel, black and white ink illustration, Junji Ito style, dense crosshatch shading, high contrast monochrome, single blood red accent only, psychological horror atmosphere, ONE subtle visual error in the scene (wrong shadow direction, extra fingers, reflection mismatch), no color palette except black white and red, horror manga page, detailed ink linework",

  horror_light:
    "manga panel, Junji Ito style ink illustration, black and white crosshatch, clean precise linework, everyday scene with barely visible wrongness — shadow pointing wrong way, object reflected differently, figure barely visible in background, unsettling subtle detail, psychological unease, monochrome ink, no gore, atmospheric dread",

  horror_heavy:
    "Junji Ito manga page, intense black ink, deep shadow fill, visceral horror illustration, distorted human anatomy, spiral motifs, grotesque detail, dense crosshatch shadows, blood red accent only color, body horror elements, oppressive darkness, monochrome ink illustration, deeply disturbing composition",

  horror_extreme:
    "Junji Ito cosmic horror manga, maximum darkness, near-total black ink fill, white highlight accents and blood red only, incomprehensible scale, writhing organic masses, faces in absolute terror, spiral vortex geometry, chaos composition, visceral nightmare imagery, monochrome ink, no color except red accent",

  // ── Introvert variants ─────────────────────────────────────────────────────
  introvert:
    "35mm film photograph, analog grain texture, melancholic mood, cold desaturated color palette, faded blues and washed grays, quiet lonely interior space, cinematic natural lighting, no people, emotional atmosphere, film photography aesthetic",

  introvert_sad:
    "35mm analog film photograph, heavy grain, overexposed highlights, deeply melancholic mood, cold blue-gray desaturated palette, quiet lonely scene — unmade bed, single dim lamp, rain on dark window, empty chair, forgotten cold drink, late night 3am atmosphere, raw emotional sadness, no people, not aesthetic or polished, honest film photography",

  introvert_fun:
    "cozy aesthetic flat illustration, soft warm pastel colors — cream beige dusty rose sage green butter yellow, warm dim lighting, comfortable scene — blanket pile, snacks, glowing laptop, fairy lights, headphones, cozy corner, relatable comfort moment, cute and inviting, no people, soft shadows, warm glow",

  // ── Other channels ─────────────────────────────────────────────────────────
  history:
    "historical oil painting illustration, period-accurate scene, cinematic dramatic lighting, muted earth tones and sepia, documentary aesthetic, detailed environment, painterly style",

  story:
    "cinematic slice-of-life illustration, warm natural lighting, Vietnamese everyday setting, golden hour or blue hour mood, emotional atmosphere, soft colors, relatable scene",

  facts:
    "bold graphic design illustration, clean modern style, vibrant accent colors, clear subject focus, informative aesthetic, flat design elements",

  gaming:
    "dynamic game art illustration, vibrant neon colors, dramatic action perspective, energetic composition, game-art style, bold colors",
};

const PREVIEW_SCENES: Record<string, string> = {
  horror_light:   "empty apartment hallway at night, one fluorescent light flickering, door at the end slightly open, shadow on the wall that faces the wrong direction",
  horror_heavy:   "bathroom mirror showing a dark distorted figure that is not in the room, water pooling on cracked floor tiles, single bare light bulb",
  horror_extreme: "spiral staircase descending into void darkness, walls covered in identical screaming faces, spiral patterns consuming the space",
  introvert_sad:  "unmade bed with crumpled sheets, single bedside lamp, rain on window glass, cold cup of tea forgotten, phone face-down, 3am darkness",
  introvert_fun:  "cozy desk corner, warm fairy lights strung above, snack bowl, glowing laptop screen, soft headphones, blanket draped over chair",
};

export { PREVIEW_SCENES };

export async function generatePreviewImage(
  styleKey: string,
  sceneDesc: string,
  extraNotes: string,
): Promise<{ filePath: string } | { error: string }> {
  const stylePrefix = IMAGE_STYLES[styleKey] ?? IMAGE_STYLES.introvert_sad;
  const prompt = [stylePrefix, sceneDesc, extraNotes].filter(Boolean).join(". ");
  const filename = `style_preview__${styleKey}__${Date.now()}`;
  const res = await fetch("/api/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool: "generate_image", input: { prompt, filename, style: styleKey.split("_")[0] } }),
  }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));
  if (!res.success) return { error: res.error };
  return { filePath: res.data.filePath };
}

export interface SceneInput {
  n: number;
  image_prompt: string;
  voice_text?: string;   // optional — introvert style có thể không có voice
  main_text?: string;    // text lớn hiển thị trong ảnh (introvert style)
  punchline?: string;    // dòng nhỏ hơn bên dưới (punchline / reaction)
  duration?: number;     // giây hiển thị scene (mặc định 5s nếu không có voice)
}

export interface ScriptJSON {
  project_name: string;
  style: string;
  character_sheet?: string;
  scenes: SceneInput[];
  formats?: string[];
}

export type RunEvent =
  | { type: "scene_start"; n: number; total: number }
  | { type: "image_done"; n: number; path: string }
  | { type: "image_error"; n: number; error: string }
  | { type: "voice_done"; n: number; path: string }
  | { type: "voice_error"; n: number; error: string }
  | { type: "assemble_start" }
  | { type: "assemble_done"; files: Record<string, string> }
  | { type: "assemble_error"; error: string }
  | { type: "done" };

export interface MusicConfig {
  mode: "auto" | "manual";
  auto?: { musicPath: string; startOffset: number; volume: number; fadeIn: number; fadeOut: number };
  manual?: Array<{ musicPath: string; musicStart: number; videoStart: number; videoEnd: number; volume: number }>;
}

export async function runFromJSON(
  script: ScriptJSON,
  onEvent: (e: RunEvent) => void,
  signal?: AbortSignal,
  music?: MusicConfig,
  styleVariant?: string,
  styleExtra?: string,
  sceneDuration?: number,  // giây mỗi scene (introvert/no-voice), override JSON
) {
  const { project_name, style, character_sheet = "", scenes, formats = ["youtube"] } = script;
  const total = scenes.length;
  const styleKey = styleVariant ?? style;
  const basePrefix = IMAGE_STYLES[styleKey] ?? IMAGE_STYLES[style] ?? IMAGE_STYLES.horror;
  const imageStylePrefix = styleExtra ? `${basePrefix}. Additional requirements: ${styleExtra}` : basePrefix;
  const isIntrovert = style === "introvert";
  const defaultDuration = sceneDuration ?? 5;

  const sceneResults: Array<{
    imagePath: string;
    voicePath: string;
    voiceText: string;
    mainText?: string;
    punchline?: string;
    duration?: number;
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
      const fullPrompt = [imageStylePrefix, character_sheet, scene.image_prompt].filter(Boolean).join(", ");
      const imgRes = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "generate_image", input: { prompt: fullPrompt, filename, style } }),
        signal,
      }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

      if (!imgRes.success) { onEvent({ type: "image_error", n: scene.n, error: imgRes.error }); return; }
      onEvent({ type: "image_done", n: scene.n, path: imgRes.data.filePath });

      // ── Voice (bỏ qua nếu introvert và không có voice_text) ──
      let voicePath = "";
      if (scene.voice_text?.trim()) {
        const voiceFilename = `${project_name}__voice_${String(scene.n).padStart(2, "0")}`;
        const voiceRes = await fetch("/api/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool: "generate_voice", input: { text: scene.voice_text, filename: voiceFilename, style } }),
          signal,
        }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

        if (!voiceRes.success) { onEvent({ type: "voice_error", n: scene.n, error: voiceRes.error }); return; }
        voicePath = voiceRes.data.filePath;
      }
      onEvent({ type: "voice_done", n: scene.n, path: voicePath });

      sceneResults[idx] = {
        imagePath: imgRes.data.filePath,
        voicePath,
        voiceText: scene.voice_text ?? "",
        mainText: scene.main_text,
        punchline: scene.punchline,
        duration: scene.duration ?? (isIntrovert ? defaultDuration : undefined),
      };
    }));
  }

  if (signal?.aborted) return;

  const validScenes = sceneResults.filter(Boolean) as NonNullable<typeof sceneResults[0]>[];
  if (validScenes.length === 0) { onEvent({ type: "assemble_error", error: "Không có scene nào thành công" }); return; }

  onEvent({ type: "assemble_start" });
  const asmRes = await fetch("/api/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool: "assemble_video", input: { scenes: validScenes, outputFilename: project_name, formats, music, style } }),
    signal,
  }).then(r => r.json()).catch(e => ({ success: false, error: e.message }));

  if (!asmRes.success) { onEvent({ type: "assemble_error", error: asmRes.error }); return; }
  onEvent({ type: "assemble_done", files: asmRes.data.files });
  onEvent({ type: "done" });
}
