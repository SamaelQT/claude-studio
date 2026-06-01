"use client";

export type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "tool_start"; tool: string; input: unknown }
  | { role: "tool_result"; tool: string; success: boolean; data?: unknown; error?: string };

export default function ChatMessage({ msg }: { msg: Message }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[75%] whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.role === "assistant") {
    return (
      <div className="flex justify-start mb-4">
        <div className="bg-zinc-800 text-zinc-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.role === "tool_start") {
    const icons: Record<string, string> = {
      search_web: "🔍",
      generate_image: "🎨",
      generate_voice: "🎙️",
      assemble_video: "🎬",
    };
    return (
      <div className="flex justify-start mb-2">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 max-w-[85%] text-sm text-zinc-400">
          <span className="mr-2">{icons[msg.tool] ?? "⚙️"}</span>
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
    const message = data?.message as string | undefined;
    const files = data?.files as Record<string, string> | undefined;

    const formatLabels: Record<string, string> = {
      youtube: "▶️ YouTube (16:9)",
      shorts: "📱 Shorts (9:16)",
      tiktok: "🎵 TikTok (9:16)",
    };

    return (
      <div className="flex justify-start mb-2">
        <div className="bg-green-950 border border-green-800 rounded-xl px-4 py-2 max-w-[85%] text-sm text-green-300">
          ✅ {msg.tool === "assemble_video" ? "Video hoàn chỉnh!" : (message || `${msg.tool} hoàn thành`)}
          {files && Object.entries(files).map(([fmt, p]) => (
            <div key={fmt} className="mt-1 text-green-400 font-medium">
              {formatLabels[fmt] ?? fmt}: <span className="text-green-500 text-xs">{p}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
