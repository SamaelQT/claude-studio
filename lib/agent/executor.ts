import fs from "fs";
import path from "path";
import { searchWeb } from "@/lib/tools/search";
import { generateImage } from "@/lib/tools/image";
import { generateVoice } from "@/lib/tools/voice";
import { assembleVideo } from "@/lib/tools/video";
import { getYoutubeTranscript } from "@/lib/tools/transcript";
import { generateVideoClip } from "@/lib/tools/videoclip";

export type ToolName = "get_youtube_transcript" | "search_web" | "generate_image" | "generate_video_clip" | "generate_voice" | "assemble_video";

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Lấy project folder từ filename: "ma_van_phong_ep1__scene_01" → "ma_van_phong_ep1"
function getProjectDir(filename: string): string {
  // Nếu filename có dạng "projectName__scene_xx" thì tách lấy phần trước "__"
  const parts = filename.split("__");
  const project = parts.length > 1 ? parts[0] : filename.replace(/_scene_\d+$/, "").replace(/_voice_\d+$/, "");
  return project || filename;
}

export async function executeTool(name: ToolName, input: Record<string, unknown>): Promise<ToolResult> {
  try {
    switch (name) {
      case "get_youtube_transcript": {
        const transcript = await getYoutubeTranscript(input.video_id as string);
        return { success: true, data: { transcript } };
      }

      case "search_web": {
        const results = await searchWeb(input.query as string, (input.max_results as number) ?? 5);
        return { success: true, data: results };
      }

      case "generate_video_clip": {
        const filename = input.filename as string;
        const project = getProjectDir(filename);
        const styleDir = (input.style as string) || "misc";
        const outDir = path.join(process.cwd(), "output", styleDir, project, "clips");
        fs.mkdirSync(outDir, { recursive: true });
        const cached = path.join(outDir, `${filename}.mp4`);
        if (fs.existsSync(cached)) {
          return { success: true, data: { filePath: cached, message: `Clip da co (cache): ${cached}` } };
        }
        const filePath = await generateVideoClip(
          input.image_path as string,
          input.motion_prompt as string,
          filename,
          outDir
        );
        return { success: true, data: { filePath, message: `Clip da tao: ${filePath}` } };
      }

      case "generate_image": {
        const filename = input.filename as string;
        const project = getProjectDir(filename);
        const styleDir = (input.style as string) || "misc";
        const outDir = path.join(process.cwd(), "output", styleDir, project, "images");
        fs.mkdirSync(outDir, { recursive: true });
        const cached = path.join(outDir, `${filename}.png`);
        if (fs.existsSync(cached)) {
          return { success: true, data: { filePath: cached, message: `Anh da co (cache): ${cached}` } };
        }
        const filePath = await generateImage(input.prompt as string, filename, outDir, styleDir);
        return { success: true, data: { filePath, message: `Anh da tao: ${filePath}` } };
      }

      case "generate_voice": {
        const filename = input.filename as string;
        const project = getProjectDir(filename);
        const styleDir = (input.style as string) || "misc";
        const outDir = path.join(process.cwd(), "output", styleDir, project, "voices");
        fs.mkdirSync(outDir, { recursive: true });
        const cached = path.join(outDir, `${filename}.mp3`);
        if (fs.existsSync(cached)) {
          return { success: true, data: { filePath: cached, message: `Voice da co (cache): ${cached}` } };
        }
        const filePath = await generateVoice(
          input.text as string,
          filename,
          (input.style as string) ?? "default",
          outDir
        );
        return { success: true, data: { filePath, message: `Voice da tao: ${filePath}` } };
      }

      case "assemble_video": {
        const outputFilename = input.outputFilename as string;
        const project = getProjectDir(outputFilename) || outputFilename;
        const styleDir = (input.style as string) || "misc";
        const videoOutDir = path.join(process.cwd(), "output", styleDir, project);
        fs.mkdirSync(videoOutDir, { recursive: true });

        // Cache check — nếu video youtube đã có thì trả về luôn
        const formats = ((input.formats as string[] | undefined) ?? ["youtube"]);
        const safeName = outputFilename.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
        const cachedFiles: Record<string, string> = {};
        const missingFormats: string[] = [];
        for (const fmt of formats) {
          const p = path.join(videoOutDir, `${safeName}_${fmt}.mp4`);
          if (fs.existsSync(p)) cachedFiles[fmt] = p;
          else missingFormats.push(fmt);
        }
        if (missingFormats.length === 0) {
          const lines = Object.entries(cachedFiles).map(([f, p]) => `${f}: ${p}`).join("\n");
          return { success: true, data: { files: cachedFiles, message: `Video da co (cache):\n${lines}` } };
        }

        const resolveAsset = (p: string, subdir: string, ext: string) => {
          if (path.isAbsolute(p) && fs.existsSync(p)) return p;
          const base = p.replace(/\.(png|jpg|mp3|wav)$/i, "");
          const inStyleProject = path.join(process.cwd(), "output", styleDir, project, subdir, `${base}${ext}`);
          if (fs.existsSync(inStyleProject)) return inStyleProject;
          // fallback: cấu trúc cũ không có style folder
          const inProject = path.join(process.cwd(), "output", project, subdir, `${base}${ext}`);
          if (fs.existsSync(inProject)) return inProject;
          return inStyleProject;
        };

        type SceneIn = { imagePath?: string; clipPath?: string; voicePath: string; voiceText?: string; mainText?: string; punchline?: string; duration?: number };
        const scenes = (input.scenes as SceneIn[]).map((s) => ({
          imagePath: s.clipPath ? resolveAsset(s.clipPath, "clips", ".mp4") : resolveAsset(s.imagePath ?? "", "images", ".png"),
          voicePath: s.voicePath ? resolveAsset(s.voicePath, "voices", ".mp3") : "",
          voiceText: s.voiceText,
          mainText: s.mainText,
          punchline: s.punchline,
          duration: s.duration,
          isVideoClip: !!s.clipPath,
        }));

        const missing: string[] = [];
        for (const s of scenes) {
          if (!fs.existsSync(s.imagePath)) missing.push(`${s.isVideoClip ? "clip" : "image"}: ${s.imagePath}`);
          if (s.voicePath && !fs.existsSync(s.voicePath)) missing.push(`voice: ${s.voicePath}`);
        }
        if (missing.length > 0) {
          return { success: false, error: `File khong ton tai:\n${missing.join("\n")}` };
        }

        const result = await assembleVideo(
          scenes,
          outputFilename,
          ((input.formats as string[] | undefined) ?? ["youtube"]) as import("@/lib/tools/video").VideoFormat[],
          videoOutDir,
          input.music as import("@/lib/tools/video").MusicConfig | undefined
        );
        const lines = Object.entries(result).map(([fmt, p]) => `${fmt}: ${p}`).join("\n");
        return { success: true, data: { files: result, message: `Video hoan chinh:\n${lines}` } };
      }

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
