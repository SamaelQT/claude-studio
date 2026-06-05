"use client";

import { useState, useRef, useEffect } from "react";
import ChatMessage, { Message } from "@/components/ChatMessage";
import { runAgent } from "@/lib/agent/browser-agent";
import { CHANNELS } from "@/lib/channels";

const ANTHROPIC_API_KEY = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY!;

interface Session {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
  history: Array<{ role: "user" | "assistant"; content: unknown }>;
}

function newSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem("ccs_sessions");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: Session[]) {
  localStorage.setItem("ccs_sessions", JSON.stringify(sessions));
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeChannel, setActiveChannel] = useState(CHANNELS[0].id);
  const [confirmVideo, setConfirmVideo] = useState<{ title: string; url: string; style: string } | null>(null);
  const [confirmFormats, setConfirmFormats] = useState<string[]>(["youtube"]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load từ localStorage khi mount
  useEffect(() => {
    const saved = loadSessions();
    setSessions(saved);
    if (saved.length > 0) setActiveId(saved[0].id);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, activeId]);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;

  const createSession = (title: string): Session => {
    const s: Session = {
      id: newSessionId(),
      title,
      createdAt: Date.now(),
      messages: [],
      history: [],
    };
    const updated = [s, ...sessions];
    setSessions(updated);
    saveSessions(updated);
    setActiveId(s.id);
    return s;
  };

  const updateSession = (id: string, patch: Partial<Session>) => {
    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      saveSessions(updated);
      return updated;
    });
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveSessions(updated);
      return updated;
    });
    if (activeId === id) {
      const remaining = sessions.filter((s) => s.id !== id);
      setActiveId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const sendMessage = async (text: string, sessionOverride?: Session) => {
    if (!text.trim() || loading) return;
    setLoading(true);

    let session = sessionOverride ?? activeSession;
    if (!session) {
      session = createSession(text.slice(0, 50));
    }
    const sid = session.id;

    const abort = new AbortController();
    abortRef.current = abort;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...session.messages, userMsg];
    const newHistory = [...session.history, { role: "user" as const, content: text }];
    updateSession(sid, { messages: newMessages, history: newHistory });

    setInput("");

    try {
      let assistantText = "";
      let currentMessages = [...newMessages];

      await runAgent(ANTHROPIC_API_KEY, [...newHistory], (event) => {
        if (abort.signal.aborted) return;

        if ("type" in event && event.type === "done") {
          abortRef.current = null;
          if (assistantText) {
            const finalHistory = [...newHistory, { role: "assistant" as const, content: assistantText }];
            updateSession(sid, { history: finalHistory });
          }
          return;
        }

        const msg = event as Message;

        if (msg.role === "assistant") {
          assistantText += msg.content as string;
          setSessions((prev) => {
            const updated = prev.map((s) => {
              if (s.id !== sid) return s;
              const last = s.messages[s.messages.length - 1];
              const msgs = last?.role === "assistant"
                ? [...s.messages.slice(0, -1), { role: "assistant" as const, content: assistantText }]
                : [...s.messages, { role: "assistant" as const, content: assistantText }];
              return { ...s, messages: msgs };
            });
            saveSessions(updated);
            return updated;
          });
        } else {
          currentMessages = [...currentMessages, msg];
          setSessions((prev) => {
            const updated = prev.map((s) =>
              s.id === sid ? { ...s, messages: [...s.messages, msg] } : s
            );
            saveSessions(updated);
            return updated;
          });
        }
      }, abort.signal);
    } catch (err) {
      if (!abort.signal.aborted) {
        const errMsg: Message = { role: "assistant", content: `❌ Lỗi: ${err instanceof Error ? err.message : String(err)}` };
        setSessions((prev) => {
          const updated = prev.map((s) =>
            s.id === sid ? { ...s, messages: [...s.messages, errMsg] } : s
          );
          saveSessions(updated);
          return updated;
        });
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-64 shrink-0 border-r border-zinc-800 flex flex-col">
          <div className="px-4 py-4 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-300">Sessions</span>
            <button
              onClick={() => { createSession("Session mới"); }}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded text-zinc-400 hover:text-white transition-colors"
            >
              + Mới
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {sessions.length === 0 && (
              <p className="text-xs text-zinc-600 px-4 py-3">Chưa có session nào</p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`group flex items-start gap-2 px-3 py-2.5 mx-1 rounded-lg cursor-pointer transition-colors ${
                  s.id === activeId ? "bg-zinc-800" : "hover:bg-zinc-900"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-300 truncate leading-tight">{s.title}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {new Date(s.createdAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 text-xs shrink-0 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="border-b border-zinc-800 px-4 py-3 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="text-zinc-500 hover:text-white transition-colors text-lg leading-none"
          >
            ☰
          </button>
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xs">CS</div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-white text-sm truncate">
              {activeSession?.title ?? "Claude Content Studio"}
            </h1>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl w-full mx-auto">
          {!activeSession || activeSession.messages.length === 0 ? (
            <div className="mt-4 max-w-3xl mx-auto">
              <div className="text-center mb-3">
                <div className="text-3xl mb-2">🎬</div>
                <h2 className="text-lg font-semibold text-zinc-300">Chào Quang!</h2>
                <p className="text-zinc-500 text-sm">Chọn kênh và video muốn clone</p>
              </div>

              {/* Channel tabs */}
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannel(ch.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeChannel === ch.id
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {ch.name}
                  </button>
                ))}
              </div>

              {/* Channel info */}
              {(() => {
                const ch = CHANNELS.find((c) => c.id === activeChannel)!;
                return (
                  <>
                    <p className="text-xs text-zinc-600 mb-2">{ch.description} — {ch.videos.length} videos</p>
                    <div className="flex flex-col gap-1 max-h-[58vh] overflow-y-auto pr-1">
                      {ch.videos.map((v, i) => (
                        <button
                          key={v.id}
                          onClick={() => setConfirmVideo({ title: v.title, url: v.url, style: ch.style })}
                          className="text-left bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 rounded-lg px-4 py-2.5 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-zinc-600 w-8 shrink-0">#{i + 1}</span>
                            <span className="text-sm text-zinc-200 flex-1 truncate">{v.title}</span>
                            <span className="text-xs text-zinc-500 shrink-0">{(v.views / 1_000_000).toFixed(1)}M</span>
                            <span className="text-xs text-zinc-700 group-hover:text-zinc-400 shrink-0">clone →</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            activeSession.messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)
          )}
          {loading && (
            <div className="flex justify-start mb-4">
              <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3 text-zinc-400 text-sm animate-pulse">
                Claude đang làm việc...
              </div>
            </div>
          )}

          {/* Post-test actions */}
          {!loading && activeSession && activeSession.messages.length > 0 && (() => {
            const firstUser = activeSession.history.find((m) => m.role === "user");
            const isTest = typeof firstUser?.content === "string" && firstUser.content.includes("3 SCENE");
            if (!isTest) return null;
            return (
              <div className="mt-4 mb-2 border border-zinc-700 rounded-2xl p-4 bg-zinc-900/60">
                <p className="text-xs text-zinc-400 mb-3 font-medium">✅ Test xong — tiếp theo?</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      const firstMsg = typeof firstUser?.content === "string" ? firstUser.content : "";
                      const fullMsg = firstMsg.replace("CHỈ 3 SCENE để test pipeline, ", "tối thiểu 7 phút (15-20 scene), ");
                      sendMessage(fullMsg);
                    }}
                    className="bg-blue-600 hover:bg-blue-500 rounded-xl px-4 py-2.5 text-left transition-colors"
                  >
                    <div className="text-sm font-medium text-white">🎬 Tạo full 7 phút</div>
                    <div className="text-xs text-blue-200 mt-0.5">Dùng y nguyên cốt truyện này, tạo video hoàn chỉnh</div>
                  </button>
                  <button
                    onClick={() => {
                      const firstMsg = typeof firstUser?.content === "string" ? firstUser.content : "";
                      const newSession = createSession((activeSession.title ?? "Test mới") + " (v2)");
                      sendMessage(firstMsg, newSession);
                    }}
                    className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-xl px-4 py-2.5 text-left transition-colors"
                  >
                    <div className="text-sm font-medium text-white">🔁 Test lại (giữ nguyên yêu cầu)</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Tạo session mới, chạy lại 3 scene</div>
                  </button>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      id="custom-retest"
                      type="text"
                      placeholder="Hoặc nhập yêu cầu chỉnh sửa... (Enter)"
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (!val) return;
                          (e.target as HTMLInputElement).value = "";
                          sendMessage(val);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {/* Confirm dialog */}
        {confirmVideo && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <h3 className="font-semibold text-white mb-1 truncate">{confirmVideo.title}</h3>
              <p className="text-xs text-zinc-500 mb-3">Chọn format xuất</p>

              {/* Format selection */}
              <div className="flex gap-2 mb-5">
                {[
                  { id: "youtube", label: "YouTube", desc: "16:9" },
                  { id: "shorts", label: "Shorts", desc: "9:16" },
                  { id: "tiktok", label: "TikTok", desc: "9:16 ≤60s" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setConfirmFormats((prev) =>
                      prev.includes(f.id) ? prev.filter((x) => x !== f.id) : [...prev, f.id]
                    )}
                    className={`flex-1 rounded-lg px-3 py-2 text-center transition-colors border ${
                      confirmFormats.includes(f.id)
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <div className="text-xs font-medium">{f.label}</div>
                    <div className="text-xs opacity-60">{f.desc}</div>
                  </button>
                ))}
              </div>

              <p className="text-xs text-zinc-500 mb-3">Chọn chế độ tạo</p>
              <div className="flex flex-col gap-3">
                {(() => {
                  const fmtStr = confirmFormats.join(", ");
                  const fmtNote = confirmFormats.length > 1 ? ` (xuất ${fmtStr})` : "";
                  const isShortOnly = confirmFormats.every(f => f === "shorts" || f === "tiktok");
                  return (
                    <>
                      <button
                        onClick={() => {
                          const v = confirmVideo; const fmt = [...confirmFormats];
                          setConfirmVideo(null);
                          const s = createSession(v.title);
                          sendMessage(`Clone video "${v.title}" (${v.url}) thành tiếng Việt, bối cảnh Việt Nam, CHỈ 3 SCENE để test pipeline, style ${v.style}, formats: [${fmt.map(f=>`"${f}"`).join(",")}]`, s);
                        }}
                        className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-xl px-4 py-3 text-left transition-colors"
                      >
                        <div className="text-sm font-medium text-white">🧪 Test — 3 scene (ảnh tĩnh){fmtNote}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">Kiểm tra pipeline nhanh, tiết kiệm token</div>
                      </button>
                      {!isShortOnly && (
                        <button
                          onClick={() => {
                            const v = confirmVideo; const fmt = [...confirmFormats];
                            setConfirmVideo(null);
                            const s = createSession(v.title);
                            sendMessage(`Clone video "${v.title}" (${v.url}) thành tiếng Việt, bối cảnh Việt Nam, tối thiểu 7 phút (15-20 scene), style ${v.style}, formats: [${fmt.map(f=>`"${f}"`).join(",")}]`, s);
                          }}
                          className="bg-blue-600 hover:bg-blue-500 rounded-xl px-4 py-3 text-left transition-colors"
                        >
                          <div className="text-sm font-medium text-white">🎬 Full — 7 phút (ảnh tĩnh){fmtNote}</div>
                          <div className="text-xs text-blue-200 mt-0.5">Video hoàn chỉnh để đăng YouTube</div>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const v = confirmVideo; const fmt = [...confirmFormats];
                          setConfirmVideo(null);
                          const s = createSession(v.title + " [animated]");
                          sendMessage(`Clone video "${v.title}" (${v.url}) thành tiếng Việt, bối cảnh Việt Nam, CHỈ 3 SCENE để test, dùng animated mode (generate_image rồi generate_video_clip cho mỗi scene), style ${v.style}, formats: [${fmt.map(f=>`"${f}"`).join(",")}]`, s);
                        }}
                        className="bg-purple-700 hover:bg-purple-600 rounded-xl px-4 py-3 text-left transition-colors"
                      >
                        <div className="text-sm font-medium text-white">✨ Test Animated — 3 scene{fmtNote}</div>
                        <div className="text-xs text-purple-300 mt-0.5">Clip 5s có chuyển động (~$0.24 cho 3 clip)</div>
                      </button>
                      {!isShortOnly && (
                        <button
                          onClick={() => {
                            const v = confirmVideo; const fmt = [...confirmFormats];
                            setConfirmVideo(null);
                            const s = createSession(v.title + " [animated full]");
                            sendMessage(`Clone video "${v.title}" (${v.url}) thành tiếng Việt, bối cảnh Việt Nam, tối thiểu 7 phút (15-20 scene), dùng animated mode (generate_image rồi generate_video_clip cho mỗi scene), style ${v.style}, formats: [${fmt.map(f=>`"${f}"`).join(",")}]`, s);
                          }}
                          className="bg-purple-900 hover:bg-purple-800 border border-purple-600 rounded-xl px-4 py-3 text-left transition-colors"
                        >
                          <div className="text-sm font-medium text-white">🎞️ Full Animated — 7 phút{fmtNote}</div>
                          <div className="text-xs text-purple-400 mt-0.5">Video hoàn chỉnh có chuyển động (~$1.2–1.6)</div>
                        </button>
                      )}
                      {isShortOnly && (
                        <p className="text-xs text-zinc-500 text-center py-1">Shorts/TikTok chỉ hỗ trợ tối đa 60 giây — dùng Test 3 scene</p>
                      )}
                    </>
                  );
                })()}
              </div>
              <button
                onClick={() => setConfirmVideo(null)}
                className="mt-4 w-full text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Huỷ
              </button>
            </div>
          </div>
        )}

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
              placeholder="Mô tả video bạn muốn tạo... (Enter để gửi)"
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
    </div>
  );
}
