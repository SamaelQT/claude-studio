import Anthropic from "@anthropic-ai/sdk";

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
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
        text: { type: "string", description: "Nội dung cần đọc" },
        filename: { type: "string", description: "Tên file (không có đuôi), VD: voice_01" },
        provider: {
          type: "string",
          enum: ["elevenlabs", "kokoro"],
          description: "Provider TTS, mặc định elevenlabs, tự động fallback kokoro khi hết quota",
        },
      },
      required: ["text", "filename"],
    },
  },
  {
    name: "assemble_video",
    description: "Ghép nhiều scene (ảnh + voice) thành video hoàn chỉnh dùng FFmpeg. Mỗi scene gồm ảnh và audio.",
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
      },
      required: ["scenes", "outputFilename"],
    },
  },
];
