import { TOOL_DEFINITIONS } from "./tools-definition";
import { Message } from "@/components/ChatMessage";

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

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

interface AnthropicResponse {
  content: ContentBlock[];
  stop_reason: string;
}

export async function runAgent(
  apiKey: string,
  history: Array<{ role: "user" | "assistant"; content: unknown }>,
  onEvent: (msg: Message | { type: "done" }) => void
) {
  const messages = [...history] as Array<{ role: string; content: unknown }>;
  let continueLoop = true;

  while (continueLoop) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }

    const data: AnthropicResponse = await res.json();

    // Emit events
    for (const block of data.content) {
      if (block.type === "text") {
        onEvent({ role: "assistant", content: block.text });
      } else if (block.type === "tool_use") {
        onEvent({ role: "tool_start", tool: block.name, input: block.input });
      }
    }

    messages.push({ role: "assistant", content: data.content });

    if (data.stop_reason === "tool_use") {
      const toolResults = [];

      for (const block of data.content) {
        if (block.type !== "tool_use") continue;

        const toolRes = await fetch("/api/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool: block.name, input: block.input }),
        });
        const result = await toolRes.json();

        onEvent({
          role: "tool_result",
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

      messages.push({ role: "user", content: toolResults });
    } else {
      continueLoop = false;
    }
  }

  onEvent({ type: "done" });
}
