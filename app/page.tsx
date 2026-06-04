"use client";

import { useState, useRef, useEffect } from "react";
import ChatMessage, { Message } from "@/components/ChatMessage";
import { runAgent } from "@/lib/agent/browser-agent";
import { WANSEE_CATALOG } from "@/lib/wansee-catalog";

const ANTHROPIC_API_KEY = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY!;

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<Array<{ role: "user" | "assistant"; content: unknown }>>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setLoading(true);
    const abort = new AbortController();
    abortRef.current = abort;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    historyRef.current.push({ role: "user", content: text });
    setInput("");

    try {
      let assistantText = "";

      await runAgent(ANTHROPIC_API_KEY, [...historyRef.current], (event) => {
        if (abort.signal.aborted) return;
        if ("type" in event && event.type === "done") {
          abortRef.current = null;
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
      }, abort.signal);
    } catch (err) {
      if (!abort.signal.aborted) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `❌ Lỗi: ${err instanceof Error ? err.message : String(err)}` },
        ]);
      }
    } finally {
      abortRef.current = null;
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
          <div className="mt-10 max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <div className="text-3xl mb-2">🎬</div>
              <h2 className="text-lg font-semibold text-zinc-300">Chào Quang!</h2>
              <p className="text-zinc-500 text-sm">Chọn story để clone hoặc nhập yêu cầu tự do</p>
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto pr-1">
              {WANSEE_CATALOG.map((s) => (
                <button
                  key={s.id}
                  onClick={() => sendMessage(`tạo clone ${s.id}`)}
                  className="text-left bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-200">{s.titleVi}</span>
                    <span className="text-xs text-zinc-600 group-hover:text-zinc-400 shrink-0 ml-3">tạo ngay →</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 truncate">{s.setting}</div>
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
          {loading ? (
            <button
              onClick={() => abortRef.current?.abort()}
              className="bg-red-600 hover:bg-red-500 text-white rounded-xl px-5 py-3 text-sm font-medium transition-colors shrink-0"
            >
              Dừng
            </button>
          ) : (
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl px-5 py-3 text-sm font-medium transition-colors shrink-0"
            >
              Tạo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
