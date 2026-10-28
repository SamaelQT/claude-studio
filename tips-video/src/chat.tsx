/**
 * Bộ cảnh "khung chat trước / sau" (loạt "Dùng AI đúng cách" — video gom 4 lỗi hỏi AI, tuần 1).
 * Tone riêng: nền sáng tím-xanh (indigo), khung chat giả lập không logo hãng nào; "LỖI" đỏ ↔ "MẸO" xanh lá,
 * bộ đếm lượt hỏi, thước đo độ dài, bút chì sửa câu hỏi, vệt quét chuyển từ lỗi sang mẹo.
 * Các cảnh đăng ký trong SCENES với tiền tố "c-".
 */
import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene, Script } from "./types";
import { prog } from "./anim";

type SP = { sc: Scene; script: Script; dur: number };

export const K = {
  bg1: "#F4F5FF",
  bg2: "#E6E8FB",
  ink: "#1B1D3A",
  muted: "#6B6F92",
  line: "#D9DCF3",
  indigo: "#4F46E5",
  indigoSoft: "#E7E6FD",
  red: "#E5484D",
  redSoft: "#FDE8E8",
  green: "#12A26B",
  greenSoft: "#DFF5EC",
  card: "#FFFFFF",
  dark: "#1B1D3A",
};
const shadow = "0 20px 50px rgba(40, 40, 110, 0.14), 0 2px 6px rgba(40, 40, 110, 0.06)";

function usePopAt() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (delay: number, damping = 14) => spring({ frame: f - delay, fps, config: { damping, mass: 0.6 } });
}
const pop = (p: number, dy = 30): React.CSSProperties => ({
  opacity: Math.min(1, p * 1.4),
  transform: `translateY(${(1 - p) * dy}px) scale(${0.95 + 0.05 * p})`,
});

/** Tô đoạn [[…]] trong chữ: xanh (good) / đỏ (bad). */
function mark(text: string, tone: "good" | "bad" | "none") {
  const parts = text.split(/\[\[|\]\]/);
  return parts.map((p, i) =>
    i % 2 ? (
      <span key={i} style={{ background: tone === "bad" ? K.redSoft : tone === "good" ? K.greenSoft : K.indigoSoft, color: tone === "bad" ? K.red : tone === "good" ? "#0B7A50" : K.indigo, fontWeight: 800, borderRadius: 8, padding: "0 6px" }}>{p}</span>
    ) : <React.Fragment key={i}>{p}</React.Fragment>,
  );
}

type Msg = { who: "u" | "ai"; text?: string; at: number; lines?: number; list?: string[]; tone?: "good" | "bad"; edit?: string; editAt?: number; fade?: number; label?: string };

/** Khung chat: tin nhắn hiện theo `at` (0..1 của cảnh), tin AI có "…" đang gõ trước; dồn đáy như app thật. */
const ChatWin: React.FC<{ msgs: Msg[]; dur: number; tone: "good" | "bad"; height?: number }> = ({ msgs, dur, tone, height = 980 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ background: K.card, borderRadius: 34, boxShadow: shadow, overflow: "hidden", border: `4px solid ${tone === "bad" ? "#F5C6C8" : "#BDE9D6"}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 26px", borderBottom: `2px solid ${K.line}` }}>
        <div style={{ width: 48, height: 48, borderRadius: 24, background: K.indigo, color: "#fff", fontWeight: 900, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>AI</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: K.ink }}>Trợ lý AI</div>
        <div style={{ marginLeft: "auto", fontSize: 22, color: K.muted, fontWeight: 600 }}>Gemini · ChatGPT · Copilot</div>
      </div>
      <div style={{ height, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 18, padding: "22px 24px", overflow: "hidden", boxSizing: "border-box" }}>
        {msgs.map((m, i) => {
          const a = Math.round(m.at * dur);
          const typing = m.who === "ai" ? 10 : 0;
          if (f < a) return null;
          const show = f >= a + typing;
          const p = spring({ frame: f - a, fps: 30, config: { damping: 15, mass: 0.6 } });
          const fade = m.fade !== undefined ? 1 - prog(f, m.fade * dur, m.fade * dur + 10) : 1;
          if (fade <= 0.02) return null;
          const editing = m.edit && m.editAt !== undefined && f >= m.editAt * dur;
          const txt = editing ? m.edit! : m.text ?? "";
          const isU = m.who === "u";
          return (
            <div key={i} style={{ alignSelf: isU ? "flex-end" : "flex-start", maxWidth: "86%", opacity: Math.min(1, p * 1.5) * fade, transform: `translateY(${(1 - p) * 24}px)`, position: "relative" }}>
              {m.label ? <div style={{ fontSize: 22, fontWeight: 800, color: m.tone === "bad" ? K.red : K.green, margin: isU ? "0 12px 6px 0" : "0 0 6px 12px", textAlign: isU ? "right" : "left" }}>{m.label}</div> : null}
              <div style={{
                background: isU ? (editing ? K.green : K.indigo) : "#F2F3FA", color: isU ? "#fff" : K.ink, fontSize: 32, lineHeight: 1.36, padding: "18px 24px", borderRadius: 28,
                borderBottomRightRadius: isU ? 8 : 28, borderBottomLeftRadius: isU ? 28 : 8, border: m.tone === "bad" && !isU ? `3px solid ${K.red}` : m.tone === "good" && !isU ? `3px solid ${K.green}` : "3px solid transparent",
              }}>
                {!show ? (
                  <span style={{ letterSpacing: 6, fontWeight: 900, color: K.muted }}>{".".repeat(1 + (Math.floor(f / 6) % 3))}</span>
                ) : (
                  <>
                    {txt ? <div>{mark(txt, isU ? "none" : m.tone ?? "none")}</div> : null}
                    {m.list ? m.list.map((l, k) => (
                      <div key={k} style={{ display: "flex", gap: 12, marginTop: 8, opacity: prog(f, a + typing + k * 5, a + typing + k * 5 + 6) }}>
                        <span style={{ fontWeight: 900, color: K.indigo }}>{/^\d/.test(l) ? "" : "•"}</span><span>{mark(l, m.tone ?? "none")}</span>
                      </div>
                    )) : null}
                    {m.lines ? Array.from({ length: m.lines }, (_, k) => (
                      <div key={k} style={{ height: 16, width: `${[96, 88, 92, 70, 94, 80, 90, 62][k % 8]}%`, background: "#D7D9EC", borderRadius: 8, marginTop: 14, opacity: prog(f, a + typing + k * 2, a + typing + k * 2 + 4) }} />
                    )) : null}
                  </>
                )}
              </div>
              {m.edit && m.editAt !== undefined ? <EditPencil at={m.editAt * dur} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Bút chì sửa câu hỏi: con trỏ chuột bay tới, bút chì hiện, nhấp. */
const EditPencil: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  const hien = prog(f, at - 22, at - 14) * (1 - prog(f, at + 6, at + 14));
  const click = prog(f, at - 4, at) - prog(f, at, at + 4);
  const bay = prog(f, at - 22, at - 6);
  return (
    <div style={{ position: "absolute", left: -84, top: "50%", opacity: hien, transform: `translateY(-50%)` }}>
      <div style={{ width: 62, height: 62, borderRadius: 31, background: K.card, boxShadow: shadow, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, transform: `scale(${1 - 0.15 * click})` }}>✏️</div>
      <svg width="44" height="44" viewBox="0 0 24 24" style={{ position: "absolute", left: 30 + (1 - bay) * 160, top: 26 + (1 - bay) * 120 }}>
        <path d="M3 2 L3 19 L8 14 L11 21 L14 20 L11 13 L18 13 Z" fill="#fff" stroke={K.ink} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

/** Nhãn đầu cảnh: "LỖI 1/4" đỏ hoặc "MẸO 1/4" xanh + tiêu đề. */
const Badge: React.FC<{ tone: "good" | "bad"; n: number; total: number; title: string }> = ({ tone, n, total, title }) => {
  const at = usePopAt();
  const c = tone === "bad" ? K.red : K.green;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 26, ...pop(at(0)) }}>
      <div style={{ flex: "none", background: c, color: "#fff", fontWeight: 900, fontSize: 30, padding: "10px 20px", borderRadius: 16, letterSpacing: 1 }}>{tone === "bad" ? "LỖI" : "MẸO"} {n}/{total}</div>
      <div style={{ fontSize: 46, fontWeight: 900, color: K.ink, lineHeight: 1.12 }}>{title}</div>
    </div>
  );
};

/** Cảnh LỖI: khung chat viền đỏ, bộ đếm lượt hỏi / thước độ dài, dấu ✗ đóng xuống cuối cảnh. */
export const CBad: React.FC<SP> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  const msgs = sc.msgs as Msg[];
  const luot = msgs.filter((m) => m.who === "u" && f >= m.at * dur).length;
  const stampAt = Math.round(dur * 0.8);
  const st = prog(f, stampAt, stampAt + 6);
  const shake = f > stampAt && f < stampAt + 10 ? Math.sin(f * 2.4) * 8 : 0;
  return (
    <div style={{ padding: "0 44px", transform: `translateX(${shake}px)` }}>
      <Badge tone="bad" n={Number(sc.n)} total={Number(sc.total ?? 4)} title={String(sc.heading)} />
      <div style={{ position: "relative" }}>
        <ChatWin msgs={msgs} dur={dur} tone="bad" height={Number(sc.h ?? 960)} />
        {sc.counter ? (
          <div style={{ position: "absolute", right: 20, top: 96, background: K.red, color: "#fff", borderRadius: 18, padding: "10px 20px", fontSize: 30, fontWeight: 900, boxShadow: shadow }}>Lượt hỏi: {luot}</div>
        ) : null}
        {sc.meter ? (
          <div style={{ position: "absolute", right: 20, top: 96, background: K.red, color: "#fff", borderRadius: 18, padding: "10px 20px", fontSize: 30, fontWeight: 900, boxShadow: shadow }}>{String(sc.meter)}</div>
        ) : null}
        <div style={{ position: "absolute", left: "50%", top: "52%", transform: `translate(-50%,-50%) rotate(-12deg) scale(${2 - st})`, opacity: st, border: `10px solid ${K.red}`, color: K.red, borderRadius: 28, padding: "10px 40px", fontSize: 92, fontWeight: 900, background: "rgba(255,255,255,0.88)", whiteSpace: "nowrap" }}>✗ {String(sc.stamp ?? "SAI CÁCH")}</div>
      </div>
    </div>
  );
};

/** Cảnh MẸO: vệt xanh quét qua mở màn, khung chat viền xanh, thẻ câu lệnh lõi ghim dưới. */
export const CGood: React.FC<SP> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  const at = usePopAt();
  const msgs = sc.msgs as Msg[];
  const wipe = prog(f, 0, 12);
  const keyAt = Math.round(dur * (Number(sc.keyAt ?? 0.62)));
  return (
    <div style={{ padding: "0 44px", position: "relative" }}>
      <Badge tone="good" n={Number(sc.n)} total={Number(sc.total ?? 4)} title={String(sc.heading)} />
      <div style={{ position: "relative" }}>
        <ChatWin msgs={msgs} dur={dur} tone="good" height={Number(sc.h ?? 800)} />
        {sc.meter ? (
          <div style={{ position: "absolute", right: 20, top: 96, background: K.green, color: "#fff", borderRadius: 18, padding: "10px 20px", fontSize: 30, fontWeight: 900, boxShadow: shadow, ...pop(at(dur * 0.5)) }}>{String(sc.meter)}</div>
        ) : null}
      </div>
      {sc.key ? (
        <div style={{ ...pop(at(keyAt)), marginTop: 26, background: K.dark, color: "#fff", borderRadius: 24, padding: "22px 28px", display: "flex", gap: 18, alignItems: "flex-start", boxShadow: shadow }}>
          <div style={{ flex: "none", background: K.green, borderRadius: 12, padding: "4px 14px", fontSize: 24, fontWeight: 900, marginTop: 4 }}>CÂU LỆNH</div>
          <div style={{ fontSize: 31, lineHeight: 1.38, fontWeight: 600 }}>{String(sc.key)}</div>
        </div>
      ) : null}
      {/* vệt quét chuyển cảnh LỖI → MẸO */}
      <div style={{ position: "absolute", top: -400, bottom: -400, left: -60, width: 1200, background: `linear-gradient(90deg, ${K.green} 0%, ${K.green} 85%, rgba(18,162,107,0) 100%)`, transform: `translateX(${wipe * 1300}px)`, opacity: wipe < 1 ? 1 : 0 }} />
    </div>
  );
};

/** Mở đầu: dồn dập các tin nhắn "sửa đi sửa lại", bộ đếm lượt nhảy số. */
export const CHook: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const msgs = sc.msgs as string[];
  const step = Math.max(6, Math.floor((dur * 0.6) / msgs.length));
  const n = Math.min(msgs.length, Math.floor((f - 8) / step) + 1);
  return (
    <div style={{ padding: "0 60px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ ...pop(at(0)), fontSize: 68, fontWeight: 900, color: K.ink, textAlign: "center", lineHeight: 1.12, marginBottom: 34 }}>{String(sc.big)}</div>
      <div style={{ position: "relative", width: "100%", display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-end", minHeight: 640 }}>
        {msgs.slice(0, Math.max(0, n)).map((m, i) => (
          <div key={i} style={{ background: K.indigo, color: "#fff", fontSize: 36, padding: "16px 26px", borderRadius: 26, borderBottomRightRadius: 8, transform: `rotate(${(i % 2 ? 1 : -1) * 1.5}deg)`, boxShadow: shadow }}>{m}</div>
        ))}
        <div style={{ position: "absolute", left: 0, top: 40, width: 230, height: 230, borderRadius: 115, background: K.red, color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: shadow, transform: `scale(${1 + 0.06 * Math.sin(f / 3)})`, opacity: at(6) }}>
          <div style={{ fontSize: 110, fontWeight: 900, lineHeight: 1 }}>{Math.max(0, n)}</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>lượt sửa</div>
        </div>
      </div>
      <div style={{ ...pop(at(dur * 0.7)), marginTop: 30, fontSize: 46, fontWeight: 900, color: K.ink, background: "#FFD84D", padding: "12px 34px", borderRadius: 18, transform: `${pop(at(dur * 0.7)).transform} rotate(-2deg)` }}>{String(sc.sub)}</div>
    </div>
  );
};

/** Tổng kết: 4 thẻ lỗi → mẹo lật lần lượt (✗ đỏ đổi thành ✓ xanh). */
export const CRecap: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const items = sc.items as [string, string][];
  const step = Math.max(10, Math.floor((dur * 0.7) / items.length));
  return (
    <div style={{ padding: "0 50px" }}>
      <div style={{ ...pop(at(0)), fontSize: 62, fontWeight: 900, color: K.ink, textAlign: "center", marginBottom: 40 }}>{String(sc.heading)}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {items.map(([bad, good], i) => {
          const a = 10 + i * step;
          const lat = prog(f, a + 8, a + 16);
          return (
            <div key={i} style={{ ...pop(at(a)), display: "flex", alignItems: "center", gap: 22, background: K.card, borderRadius: 26, padding: "24px 28px", boxShadow: shadow, border: `4px solid ${lat > 0.5 ? K.green : K.line}` }}>
              <div style={{ width: 70, height: 70, flex: "none", borderRadius: 35, background: lat > 0.5 ? K.green : K.red, color: "#fff", fontSize: 40, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", transform: `rotateY(${(lat > 0.5 ? 1 - lat : lat) * 180}deg)` }}>{lat > 0.5 ? "✓" : "✗"}</div>
              <div>
                <div style={{ fontSize: 28, color: K.red, textDecoration: "line-through", fontWeight: 600, opacity: 0.4 + 0.6 * (1 - lat) }}>{bad}</div>
                <div style={{ fontSize: 40, color: K.ink, fontWeight: 900, opacity: 0.3 + 0.7 * lat }}>{i + 1}. {good}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Bìa: bong bóng "viết giùm cái báo cáo" bị gạch, tiêu đề lớn. */
export const CCover: React.FC<SP> = ({ sc, script }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(165deg, ${K.indigo} 0%, #3730A3 100%)`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 130, boxSizing: "border-box", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 2px, transparent 2px)", backgroundSize: "44px 44px" }} />
      <div style={{ position: "relative", fontSize: 30, fontWeight: 800, letterSpacing: 4, color: "#fff", border: "3px solid rgba(255,255,255,0.5)", padding: "10px 28px", borderRadius: 999 }}>{script.series}</div>
      <div style={{ position: "relative", marginTop: 50, fontSize: 42, fontWeight: 900, color: K.ink, background: "#FFD84D", padding: "8px 28px", borderRadius: 14, transform: "rotate(-3deg)" }}>{String(sc.tag ?? "MẸO AI")}</div>
      <div style={{ position: "relative", marginTop: 40, fontSize: 150, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{String(sc.line1)}</div>
      <div style={{ position: "relative", marginTop: 14, fontSize: 80, fontWeight: 900, color: "#FFD84D", lineHeight: 1.08, textAlign: "center", padding: "0 60px" }}>{String(sc.line2)}</div>
      <div style={{ position: "relative", marginTop: 40, fontSize: 46, fontWeight: 800, color: K.ink, background: "#fff", padding: "14px 38px", borderRadius: 999 }}>{String(sc.hook)}</div>
      <div style={{ position: "relative", marginTop: 90, width: 860, display: "flex", flexDirection: "column", gap: 20 }}>
        {[["viết giùm cái báo cáo", false], ["không phải, ngắn thôi", false], ["sai rồi, ý tôi là…", false]].map(([t], i) => (
          <div key={i} style={{ alignSelf: i % 2 ? "flex-start" : "flex-end", position: "relative", background: "rgba(255,255,255,0.95)", color: K.ink, fontSize: 40, fontWeight: 700, padding: "18px 30px", borderRadius: 28, transform: `rotate(${i % 2 ? 2 : -2}deg)` }}>
            {String(t)}
            <div style={{ position: "absolute", left: -10, right: -10, top: "50%", height: 8, background: K.red, borderRadius: 4, transform: `rotate(${i % 2 ? -4 : 3}deg)` }} />
          </div>
        ))}
        <div style={{ alignSelf: "center", marginTop: 10, background: K.green, color: "#fff", fontSize: 42, fontWeight: 900, padding: "16px 34px", borderRadius: 26, transform: `scale(${1 + 0.03 * Math.sin(f / 5)})` }}>✓ 4 mẹo sửa ngay</div>
      </div>
      <div style={{ position: "absolute", bottom: 80, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontSize: 28, color: "#FFD84D", fontWeight: 800, letterSpacing: 2 }}>AI SHARING TIPS CHALLENGE 2026</div>
        <div style={{ fontSize: 36, color: "#fff", fontWeight: 700, marginTop: 10 }}>{script.author}</div>
      </div>
    </div>
  );
};

export const COutro: React.FC<SP> = ({ sc, script }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const tools = (sc.tools as string[]) ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 60px" }}>
      <div style={{ ...pop(at(0)), fontSize: 44, fontWeight: 800, color: K.muted }}>Dùng được trên</div>
      <div style={{ display: "flex", gap: 18, marginTop: 24, marginBottom: 70 }}>
        {tools.map((t, i) => <div key={t} style={{ ...pop(at(4 + i * 5)), background: K.card, boxShadow: shadow, borderRadius: 20, padding: "18px 30px", fontSize: 40, fontWeight: 900, color: K.indigo }}>{t}</div>)}
      </div>
      <div style={{ ...pop(at(20)), fontSize: 62, fontWeight: 900, color: K.ink, textAlign: "center", lineHeight: 1.15 }}>{script.series}</div>
      <div style={{ ...pop(at(26)), fontSize: 38, color: K.muted, marginTop: 18, fontWeight: 600 }}>{script.author}</div>
      <div style={{ ...pop(at(36)), marginTop: 60, background: K.indigo, color: "#fff", fontSize: 44, fontWeight: 800, padding: "18px 44px", borderRadius: 999, transform: `${pop(at(36)).transform} translateY(${Math.sin(f / 7) * 6}px)` }}>{String(sc.cta)} ↓</div>
    </div>
  );
};

export const CHAT_SCENES: Record<string, React.FC<SP>> = {
  "c-cover": CCover, "c-hook": CHook, "c-bad": CBad, "c-good": CGood, "c-recap": CRecap, "c-outro": COutro,
};

