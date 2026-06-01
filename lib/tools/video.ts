import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";

export interface Scene {
  imagePath: string;
  voicePath: string;
  duration?: number; // giây, nếu không có thì auto theo voice
}

export async function assembleVideo(
  scenes: Scene[],
  outputFilename: string,
  subtitles?: string[]
): Promise<string> {
  const outputPath = path.join(process.cwd(), "output", "videos", `${outputFilename}.mp4`);
  const tempDir = path.join(process.cwd(), "output", "videos", `temp_${outputFilename}`);
  fs.mkdirSync(tempDir, { recursive: true });

  // Tạo từng clip scene: ảnh + voice
  const clipPaths: string[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const clip = await createSceneClip(scenes[i], path.join(tempDir, `clip_${i}.mp4`), subtitles?.[i]);
    clipPaths.push(clip);
  }

  // Ghép tất cả clip thành video hoàn chỉnh
  await concatClips(clipPaths, outputPath);

  // Dọn temp
  fs.rmSync(tempDir, { recursive: true, force: true });

  return outputPath;
}

function createSceneClip(scene: Scene, outputClip: string, subtitle?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg()
      .input(scene.imagePath)
      .inputOptions(["-loop 1"])
      .input(scene.voicePath)
      .outputOptions([
        "-c:v libx264",
        "-tune stillimage",
        "-c:a aac",
        "-b:a 192k",
        "-pix_fmt yuv420p",
        "-shortest",
      ]);

    if (subtitle) {
      // Burn subtitle text vào video
      const safeText = subtitle.replace(/'/g, "\\'").replace(/:/g, "\\:");
      cmd = cmd.videoFilters(`drawtext=text='${safeText}':fontcolor=white:fontsize=36:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=h-th-40`);
    }

    cmd
      .output(outputClip)
      .on("end", () => resolve(outputClip))
      .on("error", reject)
      .run();
  });
}

function concatClips(clipPaths: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const listFile = outputPath.replace(".mp4", "_list.txt");
    const content = clipPaths.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n");
    fs.writeFileSync(listFile, content);

    ffmpeg()
      .input(listFile)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c copy"])
      .output(outputPath)
      .on("end", () => {
        fs.unlinkSync(listFile);
        resolve();
      })
      .on("error", reject)
      .run();
  });
}
