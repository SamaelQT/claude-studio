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

const bubble = {
  base: { padding: "10px 14px", borderRadius: 14, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" } as React.CSSProperties,
  row: (justify: "flex-end" | "flex-start"): React.CSSProperties => ({ display: "flex", justifyContent: justify, marginBottom: 10 }),
};

export default function ChatMessage({ msg }: { msg: Message }) {
  if (msg.role === "user") {
    return (
      <div style={bubble.row("flex-end")}>
        <div style={{ ...bubble.base, background: "#2563eb", color: "#fff", maxWidth: "75%", borderTopRightRadius: 4 }}>
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.role === "assistant") {
    return (
      <div style={bubble.row("flex-start")}>
        <div style={{ ...bubble.base, background: "#1e1e1e", color: "#e8e8e8", maxWidth: "85%", borderTopLeftRadius: 4 }}>
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.role === "tool_start") {
    return (
      <div style={bubble.row("flex-start")}>
        <div style={{ ...bubble.base, background: "#141414", border: "1px solid #2a2a2a", color: "#888" }}>
          <span style={{ marginRight: 8 }}>{TOOL_ICONS[msg.tool] ?? "⚙️"}</span>
          <span style={{ color: "#ccc", fontWeight: 600 }}>{msg.tool}</span>
          <span style={{ marginLeft: 8, color: "#666" }}>đang chạy...</span>
        </div>
      </div>
    );
  }

  if (msg.role === "tool_result") {
    if (!msg.success) {
      return (
        <div style={bubble.row("flex-start")}>
          <div style={{ ...bubble.base, background: "#2a1414", border: "1px solid #5c2323", color: "#f0a0a0", maxWidth: "85%" }}>
            ❌ {msg.tool}: {msg.error}
          </div>
        </div>
      );
    }

    const data = msg.data as Record<string, unknown> | undefined;
    const files = data?.files as Record<string, string> | undefined;

    if (msg.tool === "assemble_video" && files) {
      return (
        <div style={bubble.row("flex-start")}>
          <div style={{ ...bubble.base, background: "#0f2318", border: "1px solid #1f4a30", maxWidth: "90%" }}>
            <p style={{ color: "#4ade80", fontWeight: 600, marginBottom: 6 }}>🎬 Video hoàn chỉnh!</p>
            {Object.entries(files).map(([fmt, filePath]) => (
              <p key={fmt} style={{ fontSize: 11, color: "#888", fontFamily: "monospace", wordBreak: "break-all" }}>{filePath}</p>
            ))}
          </div>
        </div>
      );
    }

    const message = data?.message as string | undefined;
    return (
      <div style={bubble.row("flex-start")}>
        <div style={{ ...bubble.base, background: "#0f2318", border: "1px solid #1f4a30", color: "#4ade80", maxWidth: "85%" }}>
          ✅ {message ?? `${msg.tool} hoàn thành`}
        </div>
      </div>
    );
  }

  return null;
}
