"use client";

import { useState, useRef, useEffect } from "react";
import ChatMessage, { Message } from "@/components/ChatMessage";
import { runAgent } from "@/lib/agent/browser-agent";

const ANTHROPIC_API_KEY = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY!;

const QUICK_PROMPTS = [
  "Làm video về top 5 sự thật kỳ lạ về vũ trụ (3 scene)",
  "Tạo video lịch sử ngắn về Trận Điện Biên Phủ (4 scene)",
  "Video facts về loài bạch tuộc thông minh (3 scene)",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<Array<{ role: "user" | "assistant"; content: unknown }>>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setLoading(true);

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    historyRef.current.push({ role: "user", content: text });
    setInput("");

    try {
      let assistantText = "";

      await runAgent(ANTHROPIC_API_KEY, [...historyRef.current], (event) => {
        if ("type" in event && event.type === "done") {
          if (assistantText) {
            historyRef.current.push({ role: "assistant", content: assistantText });
          }
          return;
        }

        const msg = event as Message;

        if (msg.role === "assistant") {
          assistantText += msg.content as string;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [...prev.slice(0, -1), { role: "assistant", content: assistantText }];
            }
            return [...prev, { role: "assistant", content: assistantText }];
          });
        } else {
          setMessages((prev) => [...prev, msg]);
        }
      });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ Lỗi: ${err instanceof Error ? err.message : String(err)}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white">
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">CS</div>
        <div>
          <h1 className="font-semibold text-white">Claude Content Studio</h1>
          <p className="text-xs text-zinc-500">Tạo video YouTube hoàn chỉnh từ ý tưởng</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl w-full mx-auto">
        {messages.length === 0 && (
          <div className="text-center mt-16">
            <div className="text-4xl mb-4">🎬</div>
            <h2 className="text-xl font-semibold text-zinc-300 mb-2">Chào Quang!</h2>
            <p className="text-zinc-500 mb-8">Nói với tôi video bạn muốn tạo — tôi sẽ làm hết từ A đến Z</p>
            <div className="flex flex-col gap-3 max-w-md mx-auto">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="text-left bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-300 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} msg={msg} />
        ))}
        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3 text-zinc-400 text-sm animate-pulse">
              Claude đang làm việc...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-zinc-800 px-4 py-4 max-w-4xl w-full mx-auto">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Mô tả video bạn muốn tạo... (Enter để gửi, Shift+Enter xuống dòng)"
            rows={2}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-blue-500 transition-colors"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl px-5 py-3 text-sm font-medium transition-colors shrink-0"
          >
            Tạo
          </button>
        </div>
      </div>
    </div>
  );
}
