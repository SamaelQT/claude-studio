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
        const filePath = await generateImage(input.prompt as string, input.filename as string);
        return { success: true, data: { filePath, message: `Ảnh đã tạo: ${filePath}` } };
      }

      case "generate_voice": {
        const filePath = await generateVoice(
          input.text as string,
          input.filename as string,
          (input.provider as "elevenlabs" | "kokoro") ?? "elevenlabs"
        );
        return { success: true, data: { filePath, message: `Voice đã tạo: ${filePath}` } };
      }

      case "assemble_video": {
        const filePath = await assembleVideo(
          input.scenes as Array<{ imagePath: string; voicePath: string }>,
          input.outputFilename as string,
          input.subtitles as string[] | undefined
        );
        return { success: true, data: { filePath, message: `Video hoàn chỉnh: ${filePath}` } };
      }

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
