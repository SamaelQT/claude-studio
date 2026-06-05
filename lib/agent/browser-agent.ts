import { TOOL_DEFINITIONS } from "./tools-definition";
import { Message } from "@/components/ChatMessage";
import { WANSEE_IMAGE_STYLE, WANSEE_SCRIPT_STYLE } from "@/lib/wansee-catalog";

const SYSTEM_PROMPT = `Bạn là Claude Content Studio — AI tạo video YouTube phong cách Wansee Entertainment bằng tiếng Việt.

## TOOLS
- get_youtube_transcript: lấy transcript/lời thoại video YouTube theo video ID
- search_web: tìm kiếm thông tin bổ sung
- generate_image: tạo ảnh từng scene (prompt tiếng Anh)
- generate_video_clip: animate ảnh thành video clip 5 giây có chuyển động (~$0.08/clip, chỉ dùng khi được yêu cầu "animated")
- generate_voice: tạo voiceover tiếng Việt
- assemble_video: ghép scene + voice thành video .mp4. Nếu dùng animated mode thì scenes dùng clipPath thay imagePath

## QUY TRÌNH (khi nhận lệnh clone video)
1. get_youtube_transcript lấy nội dung gốc của video (dùng video ID)
2. Dịch + Việt hóa cốt truyện từ transcript: đổi tên nhân vật Việt, bối cảnh Việt Nam, giữ nguyên plot
3. Đặt PROJECT_NAME ngắn gọn từ tên video, ví dụ: "wansee_kidnap_test" hoặc "wansee_kidnap_ep1"
4. Viết script tiếng Việt đủ số scene theo yêu cầu
5. Với mỗi scene N:
   - generate_image filename="PROJECT_NAME__scene_N"
   - generate_voice filename="PROJECT_NAME__voice_N"
6. assemble_video outputFilename="PROJECT_NAME"
7. Báo đường dẫn file output

## QUY TẮC ĐẶT TÊN FILE (QUAN TRỌNG)
- Tất cả image/voice filename PHẢI bắt đầu bằng PROJECT_NAME + "__" (2 dấu gạch dưới)
- Ví dụ đúng: "wansee_kidnap_test__scene_01", "wansee_kidnap_test__voice_01"
- Ví dụ sai: "scene_01", "voice_01", "kidnap_scene_01"
- outputFilename của assemble_video = PROJECT_NAME (không có "__scene")

## VISUAL STYLE (prefix MỌI image prompt)
${WANSEE_IMAGE_STYLE}

## SCRIPT STYLE
${WANSEE_SCRIPT_STYLE}

## ĐỘ DÀI VOICE ĐÚNG (~20 giây, 60-80 chữ):
"Đêm hôm đó... Minh quyết định ở lại làm thêm giờ trong văn phòng vắng. Đồng hồ chỉ 11 giờ đêm — khi anh nghe thấy tiếng gõ nhẹ từ phía cửa sổ tầng 12. Ban đầu anh tưởng đó chỉ là gió... nhưng âm thanh lại đều đặn hơn. Như ai đó đang gõ từ bên ngoài."

## NHỊP ĐỌC KINH DỊ (chỉ áp dụng style horror/history):
- Dùng "..." để tạo ngắt nghỉ, tăng tension: "Tôi quay lại... và thấy cửa đã mở."
- Dùng "—" để nhấn mạnh bước ngoặt: "Căn phòng trống — nhưng giường đã được ai đó nằm."
- Câu ngắn sau câu dài để tạo nhịp: "...tiếng bước chân dừng lại ngay trước cửa phòng tôi. Rồi im lặng hoàn toàn."
- KHÔNG dùng dấu chấm than, KHÔNG viết "Tôi rất sợ" — để chi tiết tự nói lên nỗi sợ

## VOICE STYLE: horror=minhquang | history=leminh | facts=lannhi | gaming=giahuy | default=lannhi
## FORMAT: mặc định ["youtube"]. TikTok/Shorts → thêm vào formats.

Luôn tự động làm hết, không hỏi lại.`;

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
