import Anthropic from "@anthropic-ai/sdk";

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "get_youtube_transcript",
    description: "Lấy transcript (phụ đề/lời thoại) của một video YouTube theo video ID. Dùng để clone nội dung video gốc sang tiếng Việt.",
    input_schema: {
      type: "object" as const,
      properties: {
        video_id: { type: "string", description: "YouTube video ID, VD: dQw4w9WgXcQ" },
      },
      required: ["video_id"],
    },
  },
  {
    name: "search_web",
    description: "Tìm kiếm thông tin trên internet về một chủ đề. Dùng để research nội dung, số liệu, sự kiện cho video.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Câu tìm kiếm" },
        max_results: { type: "number", description: "Số kết quả tối đa (mặc định 5)" },
      },
      required: ["query"],
    },
  },
  {
    name: "generate_video_clip",
    description: "Animate một ảnh tĩnh thành video clip 5 giây có chuyển động (camera pan, fog, breathing effect). Dùng sau generate_image khi muốn video có chuyển động thật thay vì ảnh tĩnh. Đắt hơn ảnh (~$0.08/clip).",
    input_schema: {
      type: "object" as const,
      properties: {
        image_path: { type: "string", description: "Đường dẫn file ảnh từ generate_image" },
        motion_prompt: { type: "string", description: "Mô tả chuyển động bằng tiếng Anh, VD: 'slow camera push in, fog drifting, horror atmosphere, subtle breathing'" },
        filename: { type: "string", description: "Tên file output (không có đuôi), dùng cùng prefix PROJECT_NAME__clip_N" },
      },
      required: ["image_path", "motion_prompt", "filename"],
    },
  },
  {
    name: "generate_image",
    description: "Tạo ảnh từ mô tả text bằng AI. Trả về đường dẫn file ảnh đã lưu.",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt: { type: "string", description: "Mô tả ảnh bằng tiếng Anh, chi tiết càng tốt" },
        filename: { type: "string", description: "Tên file (không có đuôi), VD: scene_01" },
      },
      required: ["prompt", "filename"],
    },
  },
  {
    name: "generate_voice",
    description: "Tạo giọng đọc (voiceover) từ text. Trả về đường dẫn file audio đã lưu.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "Nội dung cần đọc (tiếng Việt)" },
        filename: { type: "string", description: "Tên file (không có đuôi), VD: voice_01" },
        style: {
          type: "string",
          enum: ["horror", "history", "news", "finance", "facts", "lifestyle", "kids", "gaming", "travel", "default"],
          description: "Phong cách giọng đọc theo loại kênh. horror=trầm huyền bí, history=ấm nghiêm túc, facts=rõ nhanh, gaming=trẻ năng động, default=nữ Bắc rõ ràng",
        },
      },
      required: ["text", "filename"],
    },
  },
  {
    name: "assemble_video",
    description: "Ghép nhiều scene (ảnh + voice) thành video hoàn chỉnh. Có thể xuất nhiều format cùng lúc từ 1 bộ assets — không tốn thêm API call nào. youtube=16:9, shorts=9:16 full, tiktok=9:16 tối đa 3 scene/60s.",
    input_schema: {
      type: "object" as const,
      properties: {
        scenes: {
          type: "array",
          description: "Danh sách scene",
          items: {
            type: "object",
            properties: {
              imagePath: { type: "string", description: "Đường dẫn file ảnh từ generate_image" },
              voicePath: { type: "string", description: "Đường dẫn file audio từ generate_voice" },
            },
            required: ["imagePath", "voicePath"],
          },
        },
        outputFilename: { type: "string", description: "Tên file video output (không có đuôi)" },
        subtitles: {
          type: "array",
          items: { type: "string" },
          description: "Subtitle text cho từng scene (optional, cùng số lượng với scenes)",
        },
        formats: {
          type: "array",
          items: { type: "string", enum: ["youtube", "shorts", "tiktok"] },
          description: "Danh sách format cần xuất. Mặc định ['youtube']. Có thể xuất nhiều cùng lúc VD: ['youtube','shorts','tiktok']",
        },
      },
      required: ["scenes", "outputFilename"],
    },
  },
];
