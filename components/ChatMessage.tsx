"use client";

export type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "tool_start"; tool: string; input: unknown }
  | { role: "tool_result"; tool: string; success: boolean; data?: unknown; error?: string };

const TOOL_ICONS: Record<string, string> = {
  get_youtube_transcript: "📄",
  search_web: "🔍",
  generate_image: "🎨",
  generate_video_clip: "✨",
  generate_voice: "🎙️",
  assemble_video: "🎬",
};

const FORMAT_LABELS: Record<string, string> = {
  youtube: "▶️ YouTube 16:9",
  shorts: "📱 Shorts 9:16",
  tiktok: "🎵 TikTok 9:16",
};

export default function ChatMessage({ msg }: { msg: Message }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[75%] whitespace-pre-wrap text-sm">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.role === "assistant") {
    return (
      <div className="flex justify-start mb-4">
        <div className="bg-zinc-800 text-zinc-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] whitespace-pre-wrap text-sm">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.role === "tool_start") {
    return (
      <div className="flex justify-start mb-2">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-400">
          <span className="mr-2">{TOOL_ICONS[msg.tool] ?? "⚙️"}</span>
          <span className="text-zinc-300 font-medium">{msg.tool}</span>
          <span className="ml-2 text-zinc-500">đang chạy...</span>
        </div>
      </div>
    );
  }

  if (msg.role === "tool_result") {
    if (!msg.success) {
      return (
        <div className="flex justify-start mb-2">
          <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-2 max-w-[85%] text-sm text-red-300">
            ❌ {msg.tool}: {msg.error}
          </div>
        </div>
      );
    }

    const data = msg.data as Record<string, unknown> | undefined;
    const files = data?.files as Record<string, string> | undefined;

    if (msg.tool === "assemble_video" && files) {
      return (
        <div className="flex justify-start mb-4">
          <div className="bg-green-950 border border-green-800 rounded-2xl p-4 max-w-[90%] w-full">
            <p className="text-green-300 text-sm font-medium mb-3">🎬 Video hoàn chỉnh!</p>
            {Object.entries(files).map(([fmt, filePath]) => (
              <div key={fmt} className="mb-3">
                <p className="text-xs text-green-500 mb-1">{FORMAT_LABELS[fmt] ?? fmt}</p>
                <video
                  src={`/api/video?path=${encodeURIComponent(filePath)}`}
                  controls
                  className="w-full rounded-lg bg-black"
                  style={{ maxHeight: "360px" }}
                />
                <p className="text-xs text-zinc-600 mt-1 truncate">{filePath}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const message = data?.message as string | undefined;
    return (
      <div className="flex justify-start mb-2">
        <div className="bg-green-950 border border-green-800 rounded-xl px-4 py-2 max-w-[85%] text-sm text-green-300">
          ✅ {message ?? `${msg.tool} hoàn thành`}
        </div>
      </div>
    );
  }

  return null;
}
