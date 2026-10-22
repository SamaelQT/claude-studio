import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import path from "path";
import fs from "fs";
import { buildSceneVideoFilter, hasMotion, MOTION_FPS, type SceneMotion } from "./motion";

ffmpeg.setFfmpegPath((ffmpegStatic as string).replace(/\\/g, "/"));
const fwd = (p: string) => p.replace(/\\/g, "/");

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Scene {
  imagePath: string;
  voicePath: string;        // "" nếu không có voice (introvert style)
  voiceText?: string;       // subtitle burn dưới màn hình
  mainText?: string;        // chữ lớn giữa ảnh (introvert meme)
  punchline?: string;       // dòng nhỏ phía dưới mainText
  duration?: number;        // giây hiển thị nếu không có voice (mặc định 5)
  isVideoClip?: boolean;
  motion?: SceneMotion;     // chuyển động camera cho ảnh tĩnh
  // ── Hậu kỳ audio ──
  padBefore?: number;       // giây lặng trước lời thoại
  padAfter?: number;        // giây lặng sau lời thoại
  space?: SpaceKey;         // không gian vang của cảnh
  volumeDb?: number;        // chỉnh to/nhỏ theo cảm xúc, áp SAU loudnorm
}

// Không gian quyết định độ vang — cùng một giọng, đứng ở hành lang khác trong phòng ngủ
export type SpaceKey = "dry" | "room" | "hallway" | "outdoor" | "phone";

// Đã giảm mạnh so với bản đầu: vang cũ (decay 0.22) nghe "ướt" và giả.
// Giờ chỉ đủ để tai cảm nhận có không gian, không nghe ra là hiệu ứng.
const SPACE_FILTERS: Record<SpaceKey, string> = {
  // Bỏ makeup gain: nén rồi khuếch đại lại cộng với loudnorm phía sau dễ làm vỡ tiếng.
  // khô hoàn toàn, chỉ nén rất nhẹ
  dry:      "acompressor=threshold=0.125:ratio=2:attack=15:release=250",
  // phòng nhỏ: vang cực ngắn, gần như không nhận ra
  room:     "acompressor=threshold=0.125:ratio=2:attack=15:release=250,aecho=0.9:0.2:20:0.05",
  // hành lang/kho: đuôi vang dài hơn chút nhưng vẫn nhẹ
  hallway:  "acompressor=threshold=0.125:ratio=2:attack=15:release=260,aecho=0.9:0.25:50:0.07",
  // ngoài trời: không vang, cắt trầm cho thoáng
  outdoor:  "acompressor=threshold=0.125:ratio=2:attack=15:release=220,highpass=f=100",
  // qua điện thoại/bộ đàm: băng hẹp (cố tình nghe ra hiệu ứng)
  phone:    "highpass=f=380,lowpass=f=3200,acompressor=threshold=0.06:ratio=5:attack=5:release=120:makeup=1.8",
};

export type VideoFormat = "youtube" | "shorts" | "tiktok";
export interface AssembleResult { youtube?: string; shorts?: string; tiktok?: string }

export interface MusicCue {
  musicPath: string; musicStart: number; videoStart: number; videoEnd: number; volume: number;
}
export interface MusicConfig {
  mode: "auto" | "manual";
  auto?: { musicPath: string; startOffset: number; volume: number; fadeIn: number; fadeOut: number };
  manual?: MusicCue[];
}

function sanitize(n: string) { return n.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60); }
function hasVoice(scenes: Scene[]) { return scenes.some(s => s.voicePath && fs.existsSync(s.voicePath)); }

// ── ffprobe duration ──────────────────────────────────────────────────────────
function getAudioDuration(filePath: string): Promise<number> {
  return new Promise(resolve => {
    ffmpeg.ffprobe(fwd(filePath), (err, meta) => {
      resolve((!err && meta?.format?.duration) ? (meta.format.duration as number) : 20);
    });
  });
}

// ── ASS subtitle builder ──────────────────────────────────────────────────────
function buildASS(text: string, duration: number, w: number, h: number): string {
  const escaped = text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
  const wrapped = escaped.replace(/(.{45,55})(\s)/g, "$1\\N");
  const toT = (s: number) => {
    const h2 = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = (s % 60).toFixed(2).padStart(5, "0");
    return `${h2}:${String(m).padStart(2, "0")}:${sc}`;
  };
  const fs2 = w >= 1920 ? 56 : 40, mv = Math.round(h * 0.06);
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: ${w}\nPlayResY: ${h}\nWrapStyle: 1\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Default,Arial,${fs2},&H00FFFFFF,&H000000FF,&H00000000,&HAA000000,0,0,0,0,100,100,0.5,0,3,2.5,0,2,40,40,${mv},0\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\nDialogue: 0,${toT(0)},${toT(duration - 0.1)},Default,,0,0,0,,${wrapped}\n`;
}

// Đường dẫn nằm trong complexFilter → ffmpeg parse 2 tầng (filtergraph rồi filter option),
// nên ':' phải escape 2 lần. Escape 1 lần sẽ khiến ffmpeg hiểu phần sau ':' là option
// positional và báo lỗi "Error applying option 'original_size' to filter 'subtitles'".
function escapeSubtitlePath(p: string) {
  return fwd(p)
    .replace(/\\/g, "/")
    .replace(/:/g, "\\\\:")
    .replace(/'/g, "\\\\'")
    .replace(/ /g, "\\\\ ");
}

// ── Assemble ──────────────────────────────────────────────────────────────────
export async function assembleVideo(
  scenes: Scene[], outputFilename: string,
  formats: VideoFormat[] = ["youtube"], outDir?: string, music?: MusicConfig
): Promise<AssembleResult> {
  const safeName = sanitize(outputFilename);
  const baseDir = outDir ?? path.join(process.cwd(), "output", "videos");
  fs.mkdirSync(baseDir, { recursive: true });
  const tempDir = path.join(baseDir, `tmp_${safeName}`);
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const clipPaths: string[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const clip = await createSceneClip(scenes[i], path.join(tempDir, `clip_${i}.mp4`), "16:9", tempDir);
    clipPaths.push(clip);
  }

  const result: AssembleResult = {};
  await Promise.all(formats.map(async fmt => {
    if (fmt === "youtube") {
      const out = path.join(baseDir, `${safeName}_youtube.mp4`);
      const raw = path.join(tempDir, `${safeName}_raw.mp4`);
      await concatClips(clipPaths, raw);
      music ? await applyMusic(raw, out, music, hasVoice(scenes)) : fs.renameSync(raw, out);
      result.youtube = out;
    }
    if (fmt === "shorts" || fmt === "tiktok") {
      const maxS = fmt === "tiktok" ? Math.min(scenes.length, 3) : scenes.length;
      const vClips: string[] = [];
      for (let i = 0; i < maxS; i++)
        vClips.push(await createSceneClip(scenes[i], path.join(tempDir, `clip_${fmt}_${i}.mp4`), "9:16", tempDir));
      const out = path.join(baseDir, `${safeName}_${fmt}.mp4`);
      const raw = path.join(tempDir, `${safeName}_${fmt}_raw.mp4`);
      await concatClips(vClips, raw);
      music ? await applyMusic(raw, out, music, hasVoice(scenes)) : fs.renameSync(raw, out);
      if (fmt === "shorts") result.shorts = out;
      if (fmt === "tiktok") result.tiktok = out;
    }
  }));

  fs.rmSync(tempDir, { recursive: true, force: true });
  return result;
}

// ── Scene clip ────────────────────────────────────────────────────────────────
async function createSceneClip(scene: Scene, outputClip: string, aspect: "16:9" | "9:16", tempDir: string): Promise<string> {
  const [w, h] = aspect === "16:9" ? [1920, 1080] : [1080, 1920];
  const is916 = aspect === "9:16";
  const hasV = !!scene.voicePath && fs.existsSync(scene.voicePath);
  // Đầu vào có thể là ảnh tĩnh HOẶC clip i2v đã animate — clip thì không Ken Burns nữa
  const isClip = !!scene.isVideoClip;
  // Khoảng lặng trước/sau lời thoại — Edge chặn thẻ <break> nên nhịp nghỉ làm ở đây
  const padBefore = Math.max(0, scene.padBefore ?? 0);
  const padAfter = Math.max(0, scene.padAfter ?? 0);
  const duration = hasV
    ? (await getAudioDuration(scene.voicePath)) + padBefore + padAfter
    : (scene.duration ?? 5);
  const base = path.basename(outputClip, ".mp4");

  // ASS subtitle
  let assPath: string | null = null;
  if (scene.voiceText && hasV) {
    assPath = path.join(tempDir, `sub_${base}.ass`);
    fs.writeFileSync(assPath, buildASS(scene.voiceText, duration, w, h), "utf8");
  }

  // Text overlay files
  let mainTextFile: string | null = null, punchlineFile: string | null = null;
  if (scene.mainText) {
    mainTextFile = path.join(tempDir, `mt_${base}.txt`);
    fs.writeFileSync(mainTextFile, scene.mainText, "utf8");
  }
  if (scene.punchline) {
    punchlineFile = path.join(tempDir, `pl_${base}.txt`);
    fs.writeFileSync(punchlineFile, scene.punchline, "utf8");
  }

  const moving = !isClip && hasMotion(scene.motion);

  return new Promise((resolve, reject) => {
    // Base: scale/crop + chuyển động camera (scene không motion → y hệt hành vi cũ)
    let complexF = buildSceneVideoFilter(w, h, is916, isClip ? undefined : scene.motion, duration);

    // Subtitle burn
    if (assPath) {
      complexF = complexF.replace("[v]", "[vsub_in]");
      complexF += `;[vsub_in]subtitles=${escapeSubtitlePath(assPath)}:fontsdir=${escapeSubtitlePath("C:/Windows/Fonts")}[v]`;
    }

    // mainText (big centered text)
    // Font size: Shorts 9:16 (h=1920) cần lớn hơn để đọc được trên mobile
    if (mainTextFile) {
      const fs2 = h >= 1920 ? 80 : w >= 1920 ? 72 : 56;
      const centerY = is916 ? "h*0.44" : "h/2";
      const yPos = punchlineFile ? `(${centerY})-${Math.round(fs2 * 1.0)}` : `(${centerY})-(text_h/2)`;
      complexF = complexF.replace("[v]", "[vmt_in]");
      complexF += `;[vmt_in]drawtext=textfile=${escapeSubtitlePath(mainTextFile)}` +
        `:fontfile=${escapeSubtitlePath("C:/Windows/Fonts/Arial.ttf")}` +
        `:fontsize=${fs2}:fontcolor=white` +
        `:box=1:boxcolor=black@0.55:boxborderw=${Math.round(fs2 * 0.35)}` +
        `:borderw=0:x=(w-text_w)/2:y=${yPos}[v]`;
    }

    // punchline (smaller text below mainText)
    if (punchlineFile) {
      const fs2 = h >= 1920 ? 54 : w >= 1920 ? 46 : 38;
      const centerY = is916 ? "h*0.44" : "h/2";
      const yPos = mainTextFile ? `(${centerY})+${Math.round(fs2 * 0.5)}` : `(h*2/3)-(text_h/2)`;
      complexF = complexF.replace("[v]", "[vpl_in]");
      complexF += `;[vpl_in]drawtext=textfile=${escapeSubtitlePath(punchlineFile)}` +
        `:fontfile=${escapeSubtitlePath("C:/Windows/Fonts/Arial.ttf")}` +
        `:fontsize=${fs2}:fontcolor=white@0.90` +
        `:box=1:boxcolor=black@0.45:boxborderw=${Math.round(fs2 * 0.3)}` +
        `:borderw=0:x=(w-text_w)/2:y=${yPos}[v]`;
    }

    // -framerate ép nguồn ảnh phát đúng fps để zoompan (d=1) chạy mượt theo thời gian thật
    // clip video: lặp lại cho đủ độ dài lời thoại; ảnh tĩnh: -loop 1 + framerate cho zoompan
    let cmd = isClip
      ? ffmpeg().input(fwd(scene.imagePath)).inputOptions(["-stream_loop -1"])
      : ffmpeg().input(fwd(scene.imagePath)).inputOptions(["-loop 1", `-framerate ${MOTION_FPS}`]);
    if (hasV) cmd = cmd.input(fwd(scene.voicePath));

    // silent audio input for no-voice scenes
    if (!hasV) cmd = cmd.input("anullsrc=r=44100:cl=stereo").inputOptions(["-f lavfi"]);

    // ── Hậu kỳ giọng: khoảng lặng + nén + vang theo không gian ──
    let audioMap = "1:a";
    if (hasV) {
      // THỨ TỰ QUAN TRỌNG: chuẩn hoá TRƯỚC rồi mới chỉnh âm lượng.
      // Làm ngược lại (hạ volume rồi loudnorm) sẽ kéo ngược nhiễu nền lên → nghe rè.
      const chain: string[] = [];
      if (padBefore > 0) {
        const ms = Math.round(padBefore * 1000);
        chain.push(`adelay=${ms}|${ms}`);
      }
      chain.push(SPACE_FILTERS[scene.space ?? "dry"]);
      chain.push("loudnorm=I=-16:TP=-1.5:LRA=11");
      // volume của cảm xúc áp sau chuẩn hoá → giữ được sắc thái to/nhỏ mà không rè
      if (scene.volumeDb && scene.volumeDb !== 0) chain.push(`volume=${scene.volumeDb}dB`);
      if (padAfter > 0) chain.push(`apad=pad_dur=${padAfter}`);
      // loudnorm tự đẩy sample rate lên 192k → ép về 48k cho khỏi phình file
      chain.push("aresample=48000");

      complexF += `;[1:a]${chain.join(",")}[aout]`;
      audioMap = "[aout]";
    }

    cmd.complexFilter(complexF)
      .outputOptions([
        "-map [v]",
        `-map ${audioMap}`,
        "-c:v libx264",
        // -tune stillimage tối ưu cho khung đứng yên; bật khi có motion sẽ bệt chuyển động
        ...(moving ? ["-crf 18", "-preset faster"] : ["-tune stillimage"]),
        "-c:a aac", "-b:a 192k",
        "-pix_fmt yuv420p",
        // fps cố định cho MỌI clip — concat dùng -c copy nên lệch fps là hỏng ghép
        `-r ${MOTION_FPS}`,
        `-t ${duration}`,
      ])
      .output(fwd(outputClip))
      .on("end", () => resolve(outputClip))
      .on("error", reject)
      .run();
  });
}

function buildVerticalComplexFilter(w: number, h: number): string {
  return `[0:v]scale=${w}:${h},boxblur=20:5[bg];[0:v]scale=${w}:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[v]`;
}


// ── Music ─────────────────────────────────────────────────────────────────────
async function applyMusic(videoPath: string, outputPath: string, music: MusicConfig, withVoice: boolean) {
  if (music.mode === "auto" && music.auto) return mixAuto(videoPath, outputPath, music.auto, withVoice);
  if (music.mode === "manual" && music.manual?.length) return mixManual(videoPath, outputPath, music.manual, withVoice);
  fs.renameSync(videoPath, outputPath);
}

function mixAuto(videoPath: string, outputPath: string, cfg: NonNullable<MusicConfig["auto"]>, withVoice: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    getAudioDuration(videoPath).then(videoDur => {
      const { musicPath, startOffset, volume, fadeIn, fadeOut } = cfg;
      let musicChain = `[1:a]atrim=start=${startOffset}:end=${startOffset + videoDur + 1},asetpts=PTS-STARTPTS`;
      if (fadeIn > 0) musicChain += `,afade=t=in:st=0:d=${fadeIn}`;
      if (fadeOut > 0) musicChain += `,afade=t=out:st=${videoDur - fadeOut}:d=${fadeOut}`;
      musicChain += `,volume=${volume}[music]`;
      const filters = withVoice
        ? [`[0:a]volume=1.0[voice]`, musicChain, `[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]`]
        : [musicChain, `[music]acopy[aout]`];
      ffmpeg().input(fwd(videoPath)).input(fwd(musicPath)).inputOptions(["-stream_loop -1"])
        .complexFilter(filters)
        .outputOptions(["-map 0:v", "-map [aout]", "-c:v copy", "-c:a aac", "-b:a 192k", "-shortest"])
        .output(fwd(outputPath)).on("end", () => resolve()).on("error", reject).run();
    });
  });
}

function mixManual(videoPath: string, outputPath: string, cues: MusicCue[], withVoice: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const musicInputs = [...new Set(cues.map(c => c.musicPath))];
    const idxMap: Record<string, number> = {};
    musicInputs.forEach((p, i) => { idxMap[p] = i + 1; });
    let cmd = ffmpeg().input(fwd(videoPath));
    musicInputs.forEach(p => { cmd = cmd.input(fwd(p)).inputOptions(["-stream_loop -1"]); });
    const filters: string[] = [], labels: string[] = [];
    cues.forEach((cue, i) => {
      const label = `[cue${i}]`;
      filters.push(`[${idxMap[cue.musicPath]}:a]atrim=start=${cue.musicStart}:duration=${cue.videoEnd - cue.videoStart},asetpts=PTS-STARTPTS,adelay=${Math.round(cue.videoStart * 1000)}:all=1,volume=${cue.volume}${label}`);
      labels.push(label);
    });
    if (withVoice) {
      filters.push(`[0:a]volume=1.0[voice]`);
      filters.push(`[voice]${labels.join("")}amix=inputs=${labels.length + 1}:duration=first:dropout_transition=2[aout]`);
    } else {
      filters.push(labels.length === 1 ? `${labels[0]}acopy[aout]` : `${labels.join("")}amix=inputs=${labels.length}:duration=longest[aout]`);
    }
    cmd.complexFilter(filters)
      .outputOptions(["-map 0:v", "-map [aout]", "-c:v copy", "-c:a aac", "-b:a 192k", "-shortest"])
      .output(fwd(outputPath)).on("end", () => resolve()).on("error", reject).run();
  });
}

function concatClips(clipPaths: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const listFile = outputPath.replace(".mp4", "_list.txt");
    fs.writeFileSync(listFile, clipPaths.map(p => `file '${fwd(p)}'`).join("\n"));
    ffmpeg().input(fwd(listFile)).inputOptions(["-f concat", "-safe 0"]).outputOptions(["-c copy"])
      .output(fwd(outputPath)).on("end", () => { fs.unlinkSync(listFile); resolve(); }).on("error", reject).run();
  });
}
