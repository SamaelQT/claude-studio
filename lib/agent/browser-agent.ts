import { Message } from "@/components/ChatMessage";

type HistoryMessage = { role: "user" | "assistant"; content: unknown };

// Client-side transport: gọi /api/chat (server giữ ANTHROPIC_API_KEY, chạy vòng lặp tool-use)
// và đọc kết quả dạng NDJSON stream, phát từng event ra qua onEvent.
export async function runAgent(
  history: HistoryMessage[],
  onEvent: (msg: Message | { type: "done" }) => void,
  signal?: AbortSignal
) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`/api/chat error ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (signal?.aborted) return;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line));
    }
  }

  if (buffer.trim()) {
    onEvent(JSON.parse(buffer));
  }
}
