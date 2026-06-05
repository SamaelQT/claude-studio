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
        const outDir = path.join(process.cwd(), "output", project, "clips");
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
        const outDir = path.join(process.cwd(), "output", project, "images");
        fs.mkdirSync(outDir, { recursive: true });
        const cached = path.join(outDir, `${filename}.png`);
        if (fs.existsSync(cached)) {
          return { success: true, data: { filePath: cached, message: `Anh da co (cache): ${cached}` } };
        }
        const filePath = await generateImage(input.prompt as string, filename, outDir);
        return { success: true, data: { filePath, message: `Anh da tao: ${filePath}` } };
      }

      case "generate_voice": {
        const filename = input.filename as string;
        const project = getProjectDir(filename);
        const outDir = path.join(process.cwd(), "output", project, "voices");
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
        const videoOutDir = path.join(process.cwd(), "output", project);
        fs.mkdirSync(videoOutDir, { recursive: true });

        const resolveAsset = (p: string, subdir: string, ext: string) => {
          if (path.isAbsolute(p) && fs.existsSync(p)) return p;
          const base = p.replace(/\.(png|jpg|mp3|wav)$/i, "");
          const inProject = path.join(process.cwd(), "output", project, subdir, `${base}${ext}`);
          if (fs.existsSync(inProject)) return inProject;
          // fallback flat structure cũ
          return path.join(process.cwd(), "output", subdir, `${base}${ext}`);
        };

        const scenes = (input.scenes as Array<{ imagePath?: string; clipPath?: string; voicePath: string }>).map((s) => ({
          imagePath: s.clipPath
            ? resolveAsset(s.clipPath, "clips", ".mp4")
            : resolveAsset(s.imagePath ?? "", "images", ".png"),
          voicePath: resolveAsset(s.voicePath, "voices", ".mp3"),
          isVideoClip: !!s.clipPath,
        }));

        const missing: string[] = [];
        for (const s of scenes) {
          if (!fs.existsSync(s.imagePath)) missing.push(`${s.isVideoClip ? "clip" : "image"}: ${s.imagePath}`);
          if (!fs.existsSync(s.voicePath)) missing.push(`voice: ${s.voicePath}`);
        }
        if (missing.length > 0) {
          return { success: false, error: `File khong ton tai:\n${missing.join("\n")}` };
        }

        const result = await assembleVideo(
          scenes,
          outputFilename,
          input.subtitles as string[] | undefined,
          ((input.formats as string[] | undefined) ?? ["youtube"]) as import("@/lib/tools/video").VideoFormat[],
          videoOutDir
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
