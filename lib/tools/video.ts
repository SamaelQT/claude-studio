import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import path from "path";
import fs from "fs";

ffmpeg.setFfmpegPath((ffmpegStatic as string).replace(/\\/g, "/"));

const fwd = (p: string) => p.replace(/\\/g, "/");

export interface Scene {
  imagePath: string;
  voicePath: string;
}

export type VideoFormat = "youtube" | "shorts" | "tiktok";

export interface AssembleResult {
  youtube?: string;
  shorts?: string;
  tiktok?: string;
}

// Tạo video theo nhiều format từ cùng 1 bộ assets — không tốn thêm API call
function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
}

export async function assembleVideo(
  scenes: Scene[],
  outputFilename: string,
  subtitles?: string[],
  formats: VideoFormat[] = ["youtube"]
): Promise<AssembleResult> {
  const safeName = sanitize(outputFilename);
  const tempDir = path.join(process.cwd(), "output", "videos", `tmp_${safeName}`);
  fs.mkdirSync(tempDir, { recursive: true });

  // Tạo clips 16:9 gốc — dùng chung cho mọi format
  const clipPaths: string[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const clip = await createSceneClip(scenes[i], path.join(tempDir, `clip_${i}.mp4`), subtitles?.[i], "16:9");
    clipPaths.push(clip);
  }

  const result: AssembleResult = {};

  // Ghép và reformat song song
  await Promise.all(
    formats.map(async (fmt) => {
      if (fmt === "youtube") {
        const out = path.join(process.cwd(), "output", "videos", `${safeName}_youtube.mp4`);
        await concatClips(clipPaths, out);
        result.youtube = out;
      }

      if (fmt === "shorts" || fmt === "tiktok") {
        // Tạo clips 9:16 từ ảnh gốc (blur+fit — không crop mất nội dung)
        const verticalClips: string[] = [];
        const maxScenes = fmt === "tiktok" ? Math.min(scenes.length, 3) : scenes.length;

        for (let i = 0; i < maxScenes; i++) {
          const clip = await createSceneClip(
            scenes[i],
            path.join(tempDir, `clip_${fmt}_${i}.mp4`),
            subtitles?.[i],
            "9:16"
          );
          verticalClips.push(clip);
        }

        const out = path.join(process.cwd(), "output", "videos", `${safeName}_${fmt}.mp4`);
        await concatClips(verticalClips, out);

        if (fmt === "shorts") result.shorts = out;
        if (fmt === "tiktok") result.tiktok = out;
      }
    })
  );

  fs.rmSync(tempDir, { recursive: true, force: true });
  return result;
}

function createSceneClip(
  scene: Scene,
  outputClip: string,
  subtitle?: string,
  aspect: "16:9" | "9:16" = "16:9"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const [w, h] = aspect === "16:9" ? [1920, 1080] : [1080, 1920];

    const is916 = aspect === "9:16";
    // 9:16 dùng complexFilter (blur bg + overlay) với output label [v]
    // 16:9 dùng vf đơn giản, map trực tiếp từ stream 0:v
    const complexFilter = is916 ? buildVerticalComplexFilter(w, h, subtitle) : null;
    const simpleFilter = !is916
      ? subtitle
        ? `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},` + buildSubtitleFilter(w, h, subtitle)
        : `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`
      : null;

    let cmd = ffmpeg()
      .input(fwd(scene.imagePath))
      .inputOptions(["-loop 1"])
      .input(fwd(scene.voicePath));

    if (complexFilter) cmd = cmd.complexFilter(complexFilter);
    if (simpleFilter) cmd = (cmd as any).videoFilter(simpleFilter);

    cmd = cmd.outputOptions([
        ...(complexFilter ? ["-map [v]"] : ["-map 0:v"]),
        "-map 1:a",
        "-c:v libx264",
        "-tune stillimage",
        "-c:a aac",
        "-b:a 192k",
        "-pix_fmt yuv420p",
        "-shortest",
      ])
      .output(fwd(outputClip))
      .on("end", () => resolve(outputClip))
      .on("error", reject)
      .run();
  });
}

function buildVerticalComplexFilter(w: number, h: number, subtitle?: string): string {
  // Blur background stretch full 9:16, ảnh gốc fit ở giữa
  const base = `[0:v]scale=${w}:${h},boxblur=20:5[bg];[0:v]scale=${w}:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`;
  const withSub = subtitle ? `${base},${buildSubtitleFilter(w, h, subtitle)}[v]` : `${base}[v]`;
  return withSub;
}

function buildVerticalFilter(w: number, h: number, subtitle?: string): string {
  const base = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;
  return subtitle ? `${base},${buildSubtitleFilter(w, h, subtitle)}` : base;
}

function buildSubtitleFilter(w: number, h: number, subtitle: string): string {
  const safe = subtitle.replace(/'/g, "’").replace(/:/g, "\\:").replace(/\\/g, "/");
  const fs = w >= 1080 ? 42 : 36;
  return `drawtext=text='${safe}':fontcolor=white:fontsize=${fs}:box=1:boxcolor=black@0.6:boxborderw=8:x=(w-text_w)/2:y=h-th-60`;
}

function concatClips(clipPaths: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const listFile = outputPath.replace(".mp4", "_list.txt");
    const content = clipPaths.map((p) => `file '${fwd(p)}'`).join("\n");
    fs.writeFileSync(listFile, content);

    ffmpeg()
      .input(fwd(listFile))
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c copy"])
      .output(fwd(outputPath))
      .on("end", () => {
        fs.unlinkSync(listFile);
        resolve();
      })
      .on("error", reject)
      .run();
  });
}
