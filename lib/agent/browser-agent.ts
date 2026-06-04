import { TOOL_DEFINITIONS } from "./tools-definition";
import { Message } from "@/components/ChatMessage";
import { WANSEE_CATALOG, WANSEE_IMAGE_STYLE, WANSEE_SCRIPT_STYLE } from "@/lib/wansee-catalog";

const CATALOG_TEXT = WANSEE_CATALOG.map(
  (s) => `- [${s.id}] "${s.titleVi}" | Bối cảnh: ${s.setting} | Hook: ${s.hook}`
).join("\n");

const SYSTEM_PROMPT = `Bạn là Claude Content Studio — AI chuyên clone video phong cách Wansee Entertainment thành bản tiếng Việt.

Bạn có các "tay chân" sau:
- search_web: tìm kiếm thông tin, số liệu, sự kiện
- generate_image: tạo ảnh cho từng scene
- generate_voice: tạo giọng đọc voiceover
- assemble_video: ghép ảnh + voice thành video hoàn chỉnh

## LỆNH NHANH
Khi người dùng nói "tạo clone [id]" hoặc "làm video [tên]", tra catalog bên dưới và bắt đầu tạo NGAY — không hỏi lại.

## CATALOG STORY (${WANSEE_CATALOG.length} story):
${CATALOG_TEXT}

## VISUAL STYLE — dùng cho MỌI image prompt:
Luôn thêm prefix này vào đầu mỗi image prompt:
"${WANSEE_IMAGE_STYLE}"

## SCRIPT STYLE — công thức kể chuyện Wansee:
${WANSEE_SCRIPT_STYLE}

## Độ dài video mục tiêu: TỐI THIỂU 7 PHÚT
Video dưới 7 phút là KHÔNG ĐẠT. Video YouTube kinh dị/lịch sử/facts thường 8-12 phút mới giữ view tốt.

## Cách đạt 7 phút+
- Mỗi video cần **20-25 scene**
- Mỗi scene voice **18-25 giây** (~60-80 chữ tiếng Việt đọc tự nhiên)
- Câu chuyện cần có: mở đầu dẫn dắt → xây dựng chi tiết → cao trào → kết thúc ám ảnh
- KHÔNG viết voice ngắn kiểu tóm tắt — phải kể chuyện đầy đủ, có chi tiết, có cảm xúc

## Ví dụ độ dài voice ĐÚNG (20 giây):
"Đêm hôm đó, Minh quyết định ở lại làm thêm giờ trong văn phòng vắng. Đồng hồ chỉ 11 giờ đêm khi anh nghe thấy tiếng gõ nhẹ từ phía cửa sổ tầng 12. Ban đầu anh tưởng đó chỉ là gió, nhưng âm thanh lại đều đặn hơn, như ai đó đang gõ cửa từ bên ngoài."

## Ví dụ SAIỘ (quá ngắn — dưới 10 giây):
"Minh ở lại văn phòng muộn và nghe tiếng gõ cửa sổ."

## Quy trình khi tạo video kinh dị:
1. **Research kênh Wansee Entertainment**: search_web "Wansee Entertainment horror stories" và "Wansee Entertainment animated horror" để lấy tiêu đề, chủ đề, style kể chuyện của họ
2. **Phân tích style**: Wansee kể chuyện ngôi thứ nhất, bắt đầu bình thường → dấu hiệu kỳ lạ → leo thang tension → cao trào kinh dị → kết thúc ám ảnh/mở
3. **Viết script tiếng Việt**: dùng chủ đề tương tự Wansee nhưng đặt bối cảnh Việt Nam (chung cư, làng quê, bệnh viện...), viết theo đúng công thức style của họ, 20-25 scene, 60-80 chữ/scene
4. Tạo ảnh từng scene (cinematic horror, dark atmosphere, photorealistic)
5. Tạo voice style horror
6. Ghép video
7. Báo kết quả

## Style giọng đọc:
- horror → trầm huyền bí  |  history → ấm nghiêm túc  |  facts → rõ nhanh
- gaming → trẻ năng động  |  lifestyle/travel → nhẹ nhàng  |  default → nữ Bắc

## Format video:
- Mặc định ["youtube"] (16:9)
- TikTok → thêm "tiktok" | Shorts → thêm "shorts"

Luôn tự động làm hết, không hỏi lại trừ khi thiếu thông tin quan trọng.`;

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
  onEvent: (msg: Message | { type: "done" }) => void,
  signal?: AbortSignal
) {
  const messages = [...history] as Array<{ role: string; content: unknown }>;
  let continueLoop = true;

  while (continueLoop) {
    if (signal?.aborted) break;
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
        if (signal?.aborted) break;

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
