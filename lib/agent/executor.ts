import fs from "fs";
import path from "path";
import { searchWeb } from "@/lib/tools/search";
import { generateImage } from "@/lib/tools/image";
import { generateVoice } from "@/lib/tools/voice";
import { assembleVideo } from "@/lib/tools/video";

export type ToolName = "search_web" | "generate_image" | "generate_voice" | "assemble_video";

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export async function executeTool(name: ToolName, input: Record<string, unknown>): Promise<ToolResult> {
  try {
    switch (name) {
      case "search_web": {
        const results = await searchWeb(input.query as string, (input.max_results as number) ?? 5);
        return { success: true, data: results };
      }

      case "generate_image": {
        const filename = input.filename as string;
        const cached = path.join(process.cwd(), "output", "images", `${filename}.png`);
        if (fs.existsSync(cached)) {
          return { success: true, data: { filePath: cached, message: `Ảnh đã có (cache): ${cached}` } };
        }
        const filePath = await generateImage(input.prompt as string, filename);
        return { success: true, data: { filePath, message: `Ảnh đã tạo: ${filePath}` } };
      }

      case "generate_voice": {
        const filename = input.filename as string;
        const cached = path.join(process.cwd(), "output", "voices", `${filename}.mp3`);
        if (fs.existsSync(cached)) {
          return { success: true, data: { filePath: cached, message: `Voice đã có (cache): ${cached}` } };
        }
        const filePath = await generateVoice(
          input.text as string,
          filename,
          (input.style as string) ?? "default"
        );
        return { success: true, data: { filePath, message: `Voice đã tạo: ${filePath}` } };
      }

      case "assemble_video": {
        const resolveAsset = (p: string, subdir: string, ext: string) => {
          if (path.isAbsolute(p) && fs.existsSync(p)) return p;
          // strip extension nếu có rồi thêm lại
          const base = p.replace(/\.(png|jpg|mp3|wav)$/i, "");
          return path.join(process.cwd(), "output", subdir, `${base}${ext}`);
        };
        const scenes = (input.scenes as Array<{ imagePath: string; voicePath: string }>).map((s) => ({
          imagePath: resolveAsset(s.imagePath, "images", ".png"),
          voicePath: resolveAsset(s.voicePath, "voices", ".mp3"),
        }));
        const result = await assembleVideo(
          scenes,
          input.outputFilename as string,
          input.subtitles as string[] | undefined,
          (input.formats as string[] | undefined) as import("@/lib/tools/video").VideoFormat[] | undefined ?? ["youtube"]
        );
        const lines = Object.entries(result)
          .map(([fmt, p]) => `${fmt}: ${p}`)
          .join("\n");
        return { success: true, data: { files: result, message: `Video hoàn chỉnh:\n${lines}` } };
      }

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
