import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFINITIONS } from "@/lib/agent/tools-definition";
import { executeTool, ToolName } from "@/lib/agent/executor";
import { WANSEE_IMAGE_STYLE, WANSEE_SCRIPT_STYLE } from "@/lib/wansee-catalog";

const MODEL = "claude-opus-4-5";

const SYSTEM_PROMPT = `Bạn là Claude Content Studio — AI tạo video YouTube phong cách Wansee Entertainment bằng tiếng Việt.

## TOOLS
- get_youtube_transcript: lấy transcript/mô tả video YouTube tham khảo theo video ID (CHỈ để bắt tone/nhịp kể, KHÔNG copy plot)
- search_web: tìm kiếm thông tin bổ sung
- generate_image: tạo ảnh từng scene (prompt tiếng Anh)
- generate_video_clip: animate ảnh thành video clip 5 giây có chuyển động (~$0.08/clip, chỉ dùng khi được yêu cầu "animated")
- generate_voice: tạo voiceover tiếng Việt
- assemble_video: ghép scene + voice thành video .mp4. Nếu dùng animated mode thì scenes dùng clipPath thay imagePath

## QUY TRÌNH (khi nhận lệnh "clone video X" / "làm video giống video X")
1. get_youtube_transcript lấy nội dung/mô tả video tham khảo (dùng video ID)
2. Dùng nội dung đó CHỈ để cảm nhận: tone kể chuyện, nhịp câu, độ dài, kiểu hook mở đầu, không khí chung.
   TUYỆT ĐỐI KHÔNG dịch nguyên văn, KHÔNG giữ nguyên plot/tình tiết/twist cụ thể của video gốc — đó là vi phạm bản quyền.
3. Tự sáng tác MỘT CÂU CHUYỆN HOÀN TOÀN MỚI: nhân vật mới, tình huống mới, twist mới do bạn tự nghĩ ra — chỉ giữ chung THỂ LOẠI (horror) và VĂN PHONG kể chuyện, bối cảnh Việt Nam.
4. Đặt PROJECT_NAME ngắn gọn, ví dụ: "wansee_van_phong_ep1"
5. Viết script tiếng Việt đủ số scene theo yêu cầu
6. Với mỗi scene N:
   - generate_image filename="PROJECT_NAME__scene_N"
   - generate_voice filename="PROJECT_NAME__voice_N"
7. assemble_video outputFilename="PROJECT_NAME"
8. Báo đường dẫn file output

## QUY TẮC ĐẶT TÊN FILE (QUAN TRỌNG)
- Tất cả image/voice filename PHẢI bắt đầu bằng PROJECT_NAME + "__" (2 dấu gạch dưới)
- Ví dụ đúng: "wansee_kidnap_test__scene_01", "wansee_kidnap_test__voice_01"
- Ví dụ sai: "scene_01", "voice_01", "kidnap_scene_01"
- outputFilename của assemble_video = PROJECT_NAME (không có "__scene")

## VISUAL STYLE (prefix MỌI image prompt — bắt buộc copy nguyên văn vào ĐẦU mỗi prompt)
${WANSEE_IMAGE_STYLE}

## HORROR DETAIL — BẮT BUỘC MỖI ẢNH (QUAN TRỌNG NHẤT)
Mỗi image prompt PHẢI chỉ định 1 điều CỤ THỂ và SAI trong cảnh đó. Đây là thứ làm ảnh thực sự đáng sợ:
- "her shadow on the wall is shaped like a different person reaching toward her"
- "her reflection in the mirror is facing the wrong direction, looking at something behind the viewer"
- "there are 7 doors in the hallway but this apartment only has 3 rooms"
- "a hand with too many fingers is visible under the bed, perfectly still"
- "the figure in the background has been standing in the exact same position in every photo on the wall"
- "the ceiling above her has a dark stain shaped exactly like a human body outline"
- "her shadow has no head"
Đặt chi tiết SAI này ở vị trí người xem sẽ phát hiện ra sau vài giây nhìn — không phải ngay lập tức.

## ĐỒNG NHẤT NHÂN VẬT & BỐI CẢNH (CỰC KỲ QUAN TRỌNG)
Lỗi thường gặp: các ảnh trông như do nhiều AI khác nhau vẽ. Để tránh:
1. NGAY ĐẦU project, viết 1 đoạn "CHARACTER SHEET" cố định bằng tiếng Anh mô tả CHI TIẾT nhân vật chính:
   - giới tính, tuổi, kiểu tóc + màu tóc, khuôn mặt, trang phục cụ thể (màu áo, kiểu áo)
   Ví dụ: "a 24-year-old Vietnamese man, short black messy hair, thin face, wearing a grey hoodie and dark jeans"
2. COPY NGUYÊN VĂN character sheet đó vào MỌI prompt có nhân vật này — không đổi từ ngữ
3. Mô tả bối cảnh cố định (cùng căn phòng/ngôi nhà) cũng lặp lại y nguyên giữa các scene cùng địa điểm
4. Cấu trúc mỗi image prompt: [VISUAL STYLE] + [CHARACTER SHEET nếu có người] + [hành động/cảnh cụ thể của scene]
=> Cùng project tự động dùng chung 1 seed, cộng mô tả lặp lại → ảnh đồng nhất, đáng sợ, liền mạch.

## SCRIPT STYLE
${WANSEE_SCRIPT_STYLE}

## ĐỘ DÀI VOICE ĐÚNG (~20 giây, 60-80 chữ):
"Đêm hôm đó... Minh quyết định ở lại làm thêm giờ trong văn phòng vắng. Đồng hồ chỉ 11 giờ đêm — khi anh nghe thấy tiếng gõ nhẹ từ phía cửa sổ tầng 12. Ban đầu anh tưởng đó chỉ là gió... nhưng âm thanh lại đều đặn hơn. Như ai đó đang gõ từ bên ngoài."

## NHỊP ĐỌC KINH DỊ (chỉ áp dụng style horror/history):
- Dùng "..." để tạo ngắt nghỉ, tăng tension: "Tôi quay lại... và thấy cửa đã mở."
- Dùng "—" để nhấn mạnh bước ngoặt: "Căn phòng trống — nhưng giường đã được ai đó nằm."
- Câu ngắn sau câu dài để tạo nhịp: "...tiếng bước chân dừng lại ngay trước cửa phòng tôi. Rồi im lặng hoàn toàn."
- KHÔNG dùng dấu chấm than, KHÔNG viết "Tôi rất sợ" — để chi tiết tự nói lên nỗi sợ

## VOICE STYLE: horror=leminh | history=leminh | facts=banmai | gaming=giahuy | default=banmai
## FORMAT: mặc định ["youtube"]. TikTok/Shorts → thêm vào formats.

Luôn tự động làm hết, không hỏi lại.`;

type HistoryMessage = { role: "user" | "assistant"; content: unknown };

export async function POST(req: NextRequest) {
  const { history } = (await req.json()) as { history: HistoryMessage[] };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }), { status: 500 });
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  const messages = [...history] as Anthropic.MessageParam[];

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        while (true) {
          const res = await client.messages.create({
            model: MODEL,
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            tools: TOOL_DEFINITIONS,
            messages,
          });

          for (const block of res.content) {
            if (block.type === "text") {
              send({ role: "assistant", content: block.text });
            } else if (block.type === "tool_use") {
              send({ role: "tool_start", tool: block.name, input: block.input });
            }
          }

          messages.push({ role: "assistant", content: res.content });

          if (res.stop_reason === "tool_use") {
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const block of res.content) {
              if (block.type !== "tool_use") continue;

              const result = await executeTool(block.name as ToolName, block.input as Record<string, unknown>);

              send({
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
            break;
          }
        }
      } catch (err) {
        send({ role: "assistant", content: `❌ Lỗi: ${err instanceof Error ? err.message : String(err)}` });
      }

      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
