import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { TOOL_DEFINITIONS } from "@/lib/agent/tools-definition";
import { executeTool, ToolName } from "@/lib/agent/executor";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Bạn là Claude Content Studio — một AI chuyên tạo nội dung video YouTube hoàn chỉnh.

Bạn có các "tay chân" sau:
- search_web: tìm kiếm thông tin, số liệu, sự kiện
- generate_image: tạo ảnh cho từng scene
- generate_voice: tạo giọng đọc voiceover
- assemble_video: ghép ảnh + voice thành video hoàn chỉnh

Khi người dùng yêu cầu tạo video, bạn sẽ:
1. Research nội dung (nếu cần)
2. Viết script, chia thành các scene ngắn (mỗi scene 10-30 giây)
3. Tạo ảnh cho từng scene (prompt tiếng Anh, phong cách phù hợp)
4. Tạo voiceover cho từng scene
5. Ghép thành video hoàn chỉnh
6. Báo cáo kết quả và đường dẫn file video

Với ảnh: prompt phải bằng tiếng Anh, mô tả chi tiết style (photorealistic, illustration, cinematic...)
Với voice: viết text tự nhiên, phù hợp giọng đọc YouTube
Với subtitle: tóm tắt ý chính của scene đó, ngắn gọn

Luôn tự động làm hết các bước, không hỏi lại trừ khi thực sự cần thêm thông tin quan trọng.`;

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const send = async (data: object) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  (async () => {
    try {
      const anthropicMessages: Anthropic.MessageParam[] = messages;
      let continueLoop = true;

      while (continueLoop) {
        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          tools: TOOL_DEFINITIONS,
          messages: anthropicMessages,
        });

        // Stream từng text block
        for (const block of response.content) {
          if (block.type === "text") {
            await send({ type: "text", content: block.text });
          } else if (block.type === "tool_use") {
            await send({
              type: "tool_start",
              tool: block.name,
              input: block.input,
            });
          }
        }

        // Thêm response của Claude vào message history
        anthropicMessages.push({ role: "assistant", content: response.content });

        if (response.stop_reason === "tool_use") {
          // Thực thi các tool
          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const block of response.content) {
            if (block.type === "tool_use") {
              const result = await executeTool(
                block.name as ToolName,
                block.input as Record<string, unknown>
              );

              await send({
                type: "tool_result",
                tool: block.name,
                success: result.success,
                data: result.data,
                error: result.error,
              });

              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify(result.success ? result.data : { error: result.error }),
              });
            }
          }

          anthropicMessages.push({ role: "user", content: toolResults });
        } else {
          continueLoop = false;
        }
      }

      await send({ type: "done" });
    } catch (err) {
      await send({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
