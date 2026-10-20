import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, shadow } from "./theme";
import type { Scene, Script } from "./types";
import { prog } from "./anim";

type SP = { sc: Scene; script: Script; dur: number };

// ── tiện ích chung ────────────────────────────────────────────────────────────
function usePopAt() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (delay: number, damping = 14) => spring({ frame: f - delay, fps, config: { damping, mass: 0.6 } });
}
const pop = (p: number, dy = 40): React.CSSProperties => ({
  opacity: Math.min(1, p * 1.4),
  transform: `translateY(${(1 - p) * dy}px) scale(${0.94 + 0.06 * p})`,
});

const Heading: React.FC<{ text?: string }> = ({ text }) => {
  const at = usePopAt();
  if (!text) return null;
  return (
    <div style={{ ...pop(at(0), 24), fontSize: 64, fontWeight: 800, color: C.ink, textAlign: "center", marginBottom: 44, lineHeight: 1.15 }}>
      {text}
      <div style={{ width: 120 * at(4), height: 8, borderRadius: 4, background: C.yellow, margin: "18px auto 0" }} />
    </div>
  );
};

const Card: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div style={{ background: C.card, borderRadius: 32, boxShadow: shadow, padding: 40, ...style }}>{children}</div>
);

/** Tô vàng những chữ "khó" trong tin nhắn (ngày tương đối, mã sai, thiếu mã). */
function markTricky(text: string) {
  const re = /(chiều mai|thứ \d|như hôm trước|HT10|5bao ht01|càng sớm càng tốt)/gi;
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    out.push(text.slice(last, m.index));
    out.push(<span key={m.index} style={{ background: C.yellowSoft, borderBottom: `5px solid ${C.yellow}`, borderRadius: 6, padding: "0 6px" }}>{m[0]}</span>);
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

const Cell: React.FC<{ v: string; head?: boolean; w: number; flash?: number }> = ({ v, head, w, flash = 0 }) => {
  const q = v.includes("[?]");
  return (
    <div style={{
      width: w, padding: "18px 16px", fontSize: head ? 30 : 32, fontWeight: head ? 700 : 500,
      color: head ? "#fff" : C.ink, background: head ? C.greenDark : q ? `rgba(255,200,58,${0.35 + 0.35 * flash})` : "transparent",
      borderRight: `2px solid ${head ? C.greenDark : C.line}`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      boxSizing: "border-box",
    }}>{v}</div>
  );
};

// ── các cảnh ──────────────────────────────────────────────────────────────────
export const Hook: React.FC<SP> = ({ sc }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ ...pop(at(0)), background: C.green, color: "#fff", fontSize: 40, fontWeight: 700, padding: "14px 36px", borderRadius: 999 }}>{String(sc.kicker)}</div>
      <div style={{ ...pop(at(8)), fontSize: 104, fontWeight: 900, color: C.ink, textAlign: "center", lineHeight: 1.08, marginTop: 60, padding: "0 40px" }}>{String(sc.big)}</div>
      <div style={{ ...pop(at(18)), fontSize: 80, fontWeight: 800, color: C.ink, background: C.yellow, padding: "10px 34px", borderRadius: 20, marginTop: 36, transform: `${pop(at(18)).transform} rotate(-2deg)` }}>{String(sc.sub)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 110, ...pop(at(40)) }}>
        <Bubble />
        <div style={{ fontSize: 90, color: C.green, fontWeight: 900, transform: `translateX(${Math.sin(f / 6) * 10}px)` }}>→</div>
        <SheetIcon />
      </div>
      <div style={{ ...pop(at(60)), marginTop: 70, fontSize: 52, fontWeight: 800, color: C.green }}>Dán 1 lần, ra bảng ngay</div>
    </div>
  );
};

const Bubble = () => (
  <div style={{ width: 230, height: 190, background: C.card, borderRadius: 40, boxShadow: shadow, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, padding: "0 36px", boxSizing: "border-box" }}>
    {[1, 0.7, 0.85].map((w, i) => <div key={i} style={{ height: 20, width: `${w * 100}%`, background: C.line, borderRadius: 10 }} />)}
  </div>
);
const SheetIcon = () => (
  <div style={{ width: 230, height: 190, background: C.card, borderRadius: 28, boxShadow: shadow, overflow: "hidden", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gridAutoRows: "1fr" }}>
    {Array.from({ length: 20 }, (_, i) => <div key={i} style={{ border: `1px solid ${C.line}`, background: i < 4 ? C.green : "transparent" }} />)}
  </div>
);

export const Chat: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const msgs = sc.messages as { from: string; text: string }[];
  const step = Math.max(10, Math.floor((dur * 0.6) / msgs.length));
  return (
    <div style={{ padding: "0 70px" }}>
      <Heading text={sc.heading} />
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ ...pop(at(8 + i * step)), alignSelf: i % 2 ? "flex-end" : "flex-start", maxWidth: 840 }}>
            <div style={{ fontSize: 28, color: C.muted, fontWeight: 600, margin: "0 0 8px 18px" }}>{m.from}</div>
            <div style={{ background: C.card, boxShadow: shadow, borderRadius: 34, borderTopLeftRadius: i % 2 ? 34 : 8, borderTopRightRadius: i % 2 ? 8 : 34, padding: "26px 34px", fontSize: 40, color: C.ink, lineHeight: 1.35 }}>
              {markTricky(m.text)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const Typing: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const cols = ["Khách", "Mã", "Số bao", "Giao"];
  const typed = "ĐL Minh Phát";
  const n = Math.floor(prog(f, 10, dur * 0.8) * typed.length * 0.7);
  const notes = sc.notes as string[];
  return (
    <div style={{ padding: "0 70px" }}>
      <Heading text={sc.heading} />
      <Card style={{ padding: 0, overflow: "hidden", ...pop(at(4)) }}>
        <div style={{ display: "flex" }}>{cols.map((c) => <Cell key={c} v={c} head w={235} />)}</div>
        {[0, 1, 2, 3].map((r) => (
          <div key={r} style={{ display: "flex", borderTop: `2px solid ${C.line}` }}>
            {cols.map((c, k) => (
              <div key={c} style={{ width: 235, height: 76, borderRight: `2px solid ${C.line}`, fontSize: 32, padding: "18px 16px", boxSizing: "border-box", color: C.ink }}>
                {r === 0 && k === 0 ? <>{typed.slice(0, n)}<span style={{ opacity: f % 20 < 10 ? 1 : 0, color: C.green }}>|</span></> : ""}
              </div>
            ))}
          </div>
        ))}
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 56 }}>
        {notes.map((t, i) => (
          <div key={t} style={{ ...pop(at(30 + i * 22)), display: "flex", alignItems: "center", gap: 24, fontSize: 42, color: C.ink, fontWeight: 600 }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: C.redSoft, color: C.red, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>✕</div>
            {t}
          </div>
        ))}
      </div>
    </div>
  );
};

export const Tips: React.FC<SP> = ({ sc, script }) => {
  const at = usePopAt();
  const active = Number(sc.active ?? -1);
  const tips = script.tips ?? [];
  return (
    <div style={{ padding: "0 70px" }}>
      <Heading text={sc.heading} />
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {tips.map((t, i) => {
          const on = active === i;
          const dim = active >= 0 && !on;
          const p = active < 0 ? at(6 + i * 9) : 1;
          return (
            <div key={i} style={{
              ...pop(p), display: "flex", alignItems: "center", gap: 30, background: on ? C.greenSoft : C.card,
              border: `4px solid ${on ? C.green : "transparent"}`, borderRadius: 30, boxShadow: shadow, padding: "30px 36px",
              opacity: dim ? 0.45 : pop(p).opacity, transform: `${pop(p).transform} scale(${on ? 1.03 : 1})`,
            }}>
              <div style={{ width: 84, height: 84, flex: "none", borderRadius: 42, background: on ? C.green : C.greenSoft, color: on ? "#fff" : C.green, fontSize: 44, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: 44, fontWeight: 800, color: C.ink }}>{t.t}</div>
                <div style={{ fontSize: 32, color: C.muted, marginTop: 6 }}>{t.d}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const Prompt: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const lines = sc.lines as string[];
  const all = lines.join("\n");
  const shown = Math.floor(prog(f, 10, dur * 0.75) * all.length);
  let used = 0;
  const colors = [C.green, C.blue, "#B7791F", C.red];
  return (
    <div style={{ padding: "0 60px" }}>
      <Heading text={sc.heading} />
      <Card style={{ ...pop(at(4)), padding: 44 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.muted, marginBottom: 26 }}>✦ Gửi cho AI (ChatGPT / Gemini / Copilot)</div>
        {lines.map((l, i) => {
          const take = Math.max(0, Math.min(l.length, shown - used));
          used += l.length + 1;
          return (
            <div key={i} style={{ display: "flex", gap: 22, marginBottom: 26, opacity: take > 0 ? 1 : 0.15 }}>
              <div style={{ width: 52, height: 52, flex: "none", borderRadius: 14, background: colors[i % 4], color: "#fff", fontWeight: 900, fontSize: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
              <div style={{ fontSize: 36, color: C.ink, lineHeight: 1.38 }}>{l.slice(0, take)}{take > 0 && take < l.length ? <span style={{ color: C.green }}>|</span> : null}</div>
            </div>
          );
        })}
      </Card>
    </div>
  );
};

export const Table: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const cols = sc.columns as string[];
  const rows = sc.rows as string[][];
  const w = [370, 230, 170, 170];
  const step = Math.max(6, Math.floor((dur * 0.35) / rows.length));
  const flash = (Math.sin(f / 5) + 1) / 2 * prog(f, rows.length * step + 20, rows.length * step + 30);
  return (
    <div style={{ padding: "0 50px" }}>
      <Heading text={sc.heading} />
      <Card style={{ padding: 0, overflow: "hidden", ...pop(at(2)) }}>
        <div style={{ display: "flex" }}>{cols.map((c, k) => <Cell key={c} v={c} head w={w[k]} />)}</div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", borderTop: `2px solid ${C.line}`, ...pop(at(10 + i * step), 20) }}>
            {r.map((v, k) => <Cell key={k} v={v} w={w[k]} flash={flash} />)}
          </div>
        ))}
        <div style={{ display: "flex", borderTop: `3px solid ${C.green}`, background: C.greenSoft, ...pop(at(10 + rows.length * step), 20) }}>
          <Cell v="TỔNG" w={w[0] + w[1]} />
          <Cell v={String(sc.total)} w={w[2]} />
          <Cell v="" w={w[3]} />
        </div>
      </Card>
      <div style={{ ...pop(at(rows.length * step + 26)), display: "flex", alignItems: "center", gap: 20, marginTop: 40, fontSize: 38, fontWeight: 700, color: C.ink, justifyContent: "center" }}>
        <span style={{ background: C.yellow, padding: "6px 18px", borderRadius: 12, fontWeight: 900 }}>[?]</span> = chỗ cần hỏi lại khách
      </div>
    </div>
  );
};

export const Total: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const parts = sc.parts as string[];
  const step = Math.max(5, Math.floor((dur * 0.4) / parts.length));
  const doneAt = parts.length * step + 12;
  const sum = Math.round(interpolate(f, [doneAt, doneAt + 20], [0, Number(sc.total)], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <div style={{ padding: "0 70px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Heading text={sc.heading} />
      <div style={{ display: "flex", gap: 60, alignItems: "flex-end" }}>
        <div style={{ textAlign: "right" }}>
          {parts.map((p, i) => (
            <div key={i} style={{ ...pop(at(4 + i * step), 16), fontSize: 56, fontWeight: 700, color: C.ink, lineHeight: 1.25 }}>{i ? "+ " : ""}{p}</div>
          ))}
          <div style={{ height: 6, background: C.ink, margin: "16px 0", width: 220 * prog(f, doneAt - 6, doneAt), marginLeft: "auto" }} />
          <div style={{ fontSize: 96, fontWeight: 900, color: C.green, opacity: prog(f, doneAt - 2, doneAt + 4) }}>{sum}</div>
        </div>
        <Card style={{ ...pop(at(doneAt + 22)), padding: "34px 44px", textAlign: "center" }}>
          <div style={{ fontSize: 32, color: C.muted, fontWeight: 600 }}>Dòng TỔNG của AI</div>
          <div style={{ fontSize: 96, fontWeight: 900, color: C.ink }}>{String(sc.total)}</div>
          <div style={{ marginTop: 16, background: C.green, color: "#fff", fontSize: 40, fontWeight: 800, padding: "10px 28px", borderRadius: 999 }}>✓ Khớp</div>
        </Card>
      </div>
    </div>
  );
};

export const Paste: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const press = prog(f, 20, 28) - prog(f, 30, 38);
  const filled = f > 36;
  const rows = [["ĐL Minh Phát", "HT01", "20", "21/10"], ["ĐL Minh Phát", "GA02", "10", "21/10"], ["Tạp hoá Bảy Hiền", "HT01", "5", "23/10"], ["ĐL Hồng Nhung", "VT03", "15", "24/10"], ["ĐL Hồng Nhung", "GA02", "8", "24/10"]];
  const w = [370, 200, 180, 190];
  return (
    <div style={{ padding: "0 50px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Heading text={sc.heading} />
      <div style={{ ...pop(at(4)), display: "flex", gap: 18, marginBottom: 50, transform: `scale(${1 - press * 0.08})` }}>
        {["Ctrl", "V"].map((k) => (
          <div key={k} style={{ background: C.card, border: `4px solid ${C.ink}`, borderBottomWidth: 12 - press * 8, borderRadius: 22, padding: "18px 40px", fontSize: 60, fontWeight: 900, color: C.ink }}>{k}</div>
        ))}
      </div>
      <Card style={{ padding: 0, overflow: "hidden", ...pop(at(10)) }}>
        <div style={{ display: "flex", background: "#F1F3F2", fontSize: 26, color: C.muted }}>
          {["A", "B", "C", "D"].map((h, k) => <div key={h} style={{ width: w[k], padding: "8px 16px", borderRight: `2px solid ${C.line}`, boxSizing: "border-box" }}>{h}</div>)}
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", borderTop: `2px solid ${C.line}`, background: filled ? `rgba(11,138,74,${0.16 * (1 - prog(f, 36, 70))})` : "transparent" }}>
            {r.map((v, k) => <Cell key={k} v={filled ? v : ""} w={w[k]} />)}
          </div>
        ))}
      </Card>
      <div style={{ ...pop(at(dur * 0.55)), marginTop: 44, fontSize: 40, fontWeight: 700, color: C.green }}>Tin mới đến → cứ dán tiếp</div>
    </div>
  );
};

export const Result: React.FC<SP> = ({ sc }) => {
  const at = usePopAt();
  const pairs = sc.pairs as string[][];
  return (
    <div style={{ padding: "0 60px" }}>
      <Heading text={sc.heading} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 34, fontWeight: 800, marginBottom: 20, padding: "0 20px" }}>
        <span style={{ color: C.red }}>Chép tay</span><span style={{ color: C.green }}>Dùng AI</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        {pairs.map(([label, a, b], i) => (
          <Card key={i} style={{ ...pop(at(6 + i * 16)), padding: "26px 30px" }}>
            <div style={{ fontSize: 30, color: C.muted, fontWeight: 700, textAlign: "center", marginBottom: 14 }}>{label}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
              <div style={{ flex: 1, background: C.redSoft, color: C.red, fontSize: 38, fontWeight: 700, padding: "18px 20px", borderRadius: 20, textAlign: "center" }}>{a}</div>
              <div style={{ fontSize: 52, color: C.ink, fontWeight: 900 }}>→</div>
              <div style={{ flex: 1, background: C.greenSoft, color: C.greenDark, fontSize: 38, fontWeight: 800, padding: "18px 20px", borderRadius: 20, textAlign: "center" }}>{b}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export const Safety: React.FC<SP> = ({ sc }) => {
  const at = usePopAt();
  const items = sc.items as string[];
  return (
    <div style={{ padding: "0 70px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ ...pop(at(0)), width: 170, height: 170, borderRadius: 85, background: C.greenSoft, border: `8px solid ${C.green}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 90, color: C.green, fontWeight: 900, marginBottom: 40 }}>i</div>
      <Heading text={sc.heading} />
      <Card style={{ width: "100%", boxSizing: "border-box" }}>
        {items.map((t, i) => (
          <div key={i} style={{ ...pop(at(10 + i * 14)), display: "flex", gap: 24, alignItems: "center", fontSize: 40, color: C.ink, fontWeight: 600, padding: "18px 0" }}>
            <span style={{ color: C.green, fontSize: 48, fontWeight: 900 }}>✓</span>{t}
          </div>
        ))}
      </Card>
    </div>
  );
};

export const Outro: React.FC<SP> = ({ sc, script }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ ...pop(at(0)), width: 230, height: 230, borderRadius: 115, background: C.green, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 92, fontWeight: 900, boxShadow: shadow }}>AI</div>
      <div style={{ ...pop(at(8)), fontSize: 64, fontWeight: 900, color: C.ink, marginTop: 50, textAlign: "center", padding: "0 60px", lineHeight: 1.15 }}>{script.series}</div>
      <div style={{ ...pop(at(14)), fontSize: 40, color: C.muted, marginTop: 22, fontWeight: 600 }}>{script.author}</div>
      <div style={{ ...pop(at(24)), marginTop: 70, background: C.yellow, color: C.ink, fontSize: 46, fontWeight: 800, padding: "20px 46px", borderRadius: 999, transform: `${pop(at(24)).transform} translateY(${Math.sin(f / 7) * 6}px)` }}>
        {String(sc.cta)} ↓
      </div>
    </div>
  );
};

/** Bìa: khung đầu tiên người xem thấy khi lướt (và ảnh bia.png). Toàn màn hình, nền xanh đậm cho khác phần nội dung. */
export const Cover: React.FC<SP> = ({ sc, script }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Khung 0 phải đẹp sẵn (nhiều nền tảng lấy khung đầu làm ảnh đại diện) → không cho hiện dần từ 0.
  const nhip = spring({ frame: f, fps, config: { damping: 12 } });
  const rows = [["ĐL Minh Phát", "HT01", "20"], ["Bảy Hiền", "HT01", "5"], ["Hồng Nhung", "VT03", "15"], ["Tư Long", "[?]", "30"]];
  return (
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(165deg, ${C.greenDark} 0%, ${C.green} 100%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 60px 120px", boxSizing: "border-box" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 2px, transparent 2px)", backgroundSize: "44px 44px" }} />
      <div style={{ position: "relative", fontSize: 32, fontWeight: 800, letterSpacing: 4, color: "#fff", border: "3px solid rgba(255,255,255,0.55)", padding: "12px 30px", borderRadius: 999 }}>{script.series}</div>
      <div style={{ position: "relative", marginTop: 70, background: C.yellow, color: C.ink, fontSize: 44, fontWeight: 900, padding: "10px 30px", borderRadius: 16, transform: "rotate(-3deg)" }}>{String(sc.tag ?? "MẸO AI")}</div>
      <div style={{ position: "relative", marginTop: 50, fontSize: 132, fontWeight: 900, color: "#fff", textAlign: "center", lineHeight: 1.02, textShadow: "0 8px 30px rgba(0,0,0,0.25)" }}>
        {String(sc.line1)}<br /><span style={{ color: C.yellow }}>{String(sc.line2)}</span>
      </div>
      <div style={{ position: "relative", marginTop: 46, fontSize: 56, fontWeight: 800, color: C.ink, background: "#fff", padding: "14px 40px", borderRadius: 999 }}>{String(sc.hook)}</div>
      {/* minh hoạ: tin nhắn → bảng */}
      <div style={{ position: "relative", marginTop: 120, display: "flex", alignItems: "center", gap: 30, transform: `scale(${1.12 + 0.04 * nhip})` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {["20 bao HT01, chiều mai", "5bao ht01 thứ 6", "như hôm trước 30 bao"].map((t, i) => (
            <div key={i} style={{ background: "#fff", color: C.ink, fontSize: 30, padding: "16px 24px", borderRadius: 24, borderTopLeftRadius: 6, boxShadow: shadow, marginLeft: i % 2 ? 30 : 0 }}>{t}</div>
          ))}
        </div>
        <div style={{ fontSize: 90, fontWeight: 900, color: C.yellow }}>→</div>
        <div style={{ background: "#fff", borderRadius: 24, overflow: "hidden", boxShadow: shadow }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", borderTop: i ? `2px solid ${C.line}` : "none" }}>
              {r.map((v, k) => (
                <div key={k} style={{ width: [190, 100, 70][k], padding: "14px 12px", fontSize: 26, fontWeight: 600, color: C.ink, background: v === "[?]" ? C.yellow : i === 0 && k === 0 ? "transparent" : "transparent", boxSizing: "border-box", borderRight: k < 2 ? `2px solid ${C.line}` : "none" }}>{v}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 100, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontSize: 30, color: C.yellow, fontWeight: 800, letterSpacing: 2 }}>AI SHARING TIPS CHALLENGE 2026</div>
        <div style={{ fontSize: 38, color: "rgba(255,255,255,0.92)", fontWeight: 700, marginTop: 12 }}>{script.author}</div>
      </div>
    </div>
  );
};

export const SCENES: Record<string, React.FC<SP>> = {
  cover: Cover,
  hook: Hook, chat: Chat, typing: Typing, tips: Tips, prompt: Prompt, table: Table,
  total: Total, paste: Paste, result: Result, safety: Safety, outro: Outro,
};
