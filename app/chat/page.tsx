"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import ChatMessage, { Message } from "@/components/ChatMessage";
import { runAgent } from "@/lib/agent/browser-agent";
import { WANSEE_CATALOG } from "@/lib/wansee-catalog";

const C = {
  bg: "#0a0a0a",
  panel: "#141414",
  border: "#2a2a2a",
  text: "#e8e8e8",
  sub: "#888",
};

export default function ChatPage() {
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

      await runAgent(
        [...historyRef.current],
        (event) => {
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
        },
        abort.signal
      );
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

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  };

  const randomIdea = () => {
    const story = WANSEE_CATALOG[Math.floor(Math.random() * WANSEE_CATALOG.length)];
    setInput(`Làm video horror kiểu Wansee lấy cảm hứng từ ý tưởng: ${story.titleVi} — ${story.setting}. 20 scenes, format youtube.`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, color: C.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Top bar */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", alignItems: "center", height: 52, gap: 16 }}>
        <Link href="/" style={{ color: C.sub, fontSize: 13, textDecoration: "none" }}>← Pipeline</Link>
        <span style={{ fontWeight: 700, fontSize: 15 }}>💬 Chat Agent — Clone Wansee</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: C.sub }}>
          Nhập lệnh tự nhiên, VD: &quot;Clone video vidId=abc123 sang tiếng Việt, 20 scenes&quot;
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          {messages.length === 0 && (
            <div style={{ color: C.sub, fontSize: 13, lineHeight: 1.7 }}>
              <p>Agent này tự động chạy toàn bộ quy trình: lấy transcript video tham khảo (chỉ để bắt tone/nhịp kể) → tự sáng tác plot mới → tạo ảnh → tạo voice → ghép video.</p>
              <p style={{ marginTop: 8 }}>Ví dụ lệnh: <em>&quot;Clone video youtube ID dQw4w9WgXcQ sang bản Wansee tiếng Việt, 20 scenes, format youtube&quot;</em></p>
              <button onClick={randomIdea} style={{ marginTop: 12, background: "#222", color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                🎲 Gợi ý ý tưởng ngẫu nhiên
              </button>
            </div>
          )}
          {messages.map((m, i) => (
            <ChatMessage key={i} msg={m} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 24px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", gap: 10 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && sendMessage(input)}
            placeholder="Nhập lệnh..."
            disabled={loading}
            style={{ flex: 1, background: "#111", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "10px 14px", fontSize: 13, outline: "none" }}
          />
          {loading ? (
            <button onClick={stop} style={{ background: "#5c2323", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              ■ Dừng
            </button>
          ) : (
            <button onClick={() => sendMessage(input)} disabled={!input.trim()} style={{ background: "#c0392b", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: input.trim() ? 1 : 0.5 }}>
              Gửi ➤
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
