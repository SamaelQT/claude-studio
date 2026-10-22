/**
 * Bộ cảnh "hộp thư" (video 3 — viết email tiếng Anh, dịch ngược để kiểm). Tone riêng: nền xanh navy đêm,
 * cửa sổ ứng dụng thư, chữ gõ dần, vòng lặp 4 bước, "gương" Anh ↔ Việt, máy bay giấy khi gửi.
 * Các cảnh đăng ký trong SCENES với tiền tố "m-".
 */
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene, Script } from "./types";
import { prog } from "./anim";

type SP = { sc: Scene; script: Script; dur: number };

export const M = {
  bg1: "#0D1828",
  bg2: "#14294A",
  card: "#1A2C47",
  card2: "#223A5E",
  line: "#2E4A72",
  ink: "#F3F7FC",
  muted: "#9DB1CC",
  teal: "#25C7A8",
  tealSoft: "rgba(37,199,168,0.16)",
  amber: "#FFB547",
  amberSoft: "rgba(255,181,71,0.18)",
  red: "#FF6464",
  paper: "#F6F8FB",
  paperInk: "#15233A",
};
const MONO = `"Cascadia Mono", "Consolas", monospace`;
const glow = "0 24px 60px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255,255,255,0.04)";

function usePopAt() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (delay: number, damping = 14) => spring({ frame: f - delay, fps, config: { damping, mass: 0.6 } });
}
const pop = (p: number, dy = 34): React.CSSProperties => ({
  opacity: Math.min(1, p * 1.4),
  transform: `translateY(${(1 - p) * dy}px) scale(${0.95 + 0.05 * p})`,
});
const type = (text: string, f: number, a: number, b: number) => text.slice(0, Math.floor(prog(f, a, b) * text.length));

const Title: React.FC<{ text?: string; kicker?: string }> = ({ text, kicker }) => {
  const at = usePopAt();
  if (!text) return null;
  return (
    <div style={{ textAlign: "center", marginBottom: 44 }}>
      {kicker ? <div style={{ ...pop(at(0)), display: "inline-block", fontSize: 28, fontWeight: 800, letterSpacing: 4, color: M.bg1, background: M.teal, padding: "8px 24px", borderRadius: 999, marginBottom: 22 }}>{kicker}</div> : null}
      <div style={{ ...pop(at(3), 20), fontSize: 64, fontWeight: 900, color: M.ink, lineHeight: 1.12 }}>{text}</div>
    </div>
  );
};

/** Cửa sổ ứng dụng (thanh tiêu đề 3 chấm + nhãn). */
const Win: React.FC<{ label: string; style?: React.CSSProperties; light?: boolean; children: React.ReactNode }> = ({ label, style, light, children }) => (
  <div style={{ background: light ? M.paper : M.card, borderRadius: 26, boxShadow: glow, overflow: "hidden", ...style }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 22px", background: light ? "#E3E9F1" : M.card2 }}>
      {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <div key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c }} />)}
      <div style={{ marginLeft: 14, fontSize: 24, fontWeight: 700, color: light ? "#55657D" : M.muted }}>{label}</div>
    </div>
    <div style={{ padding: "26px 30px" }}>{children}</div>
  </div>
);

const Caret: React.FC<{ on: boolean; color?: string }> = ({ on, color = M.teal }) => {
  const f = useCurrentFrame();
  return on ? <span style={{ color, opacity: f % 20 < 10 ? 1 : 0 }}>▌</span> : null;
};

// ── Cảnh ─────────────────────────────────────────────────────────────────────

/** Bìa: thư tiếng Anh + bản tiếng Việt soi gương, mũi tên vòng giữa. */
export const MCover: React.FC<SP> = ({ sc, script }) => {
  const f = useCurrentFrame();
  const row = (w: number, c: string) => <div style={{ height: 16, width: `${w}%`, borderRadius: 8, background: c, marginBottom: 14 }} />;
  return (
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 30%, ${M.bg2} 0%, ${M.bg1} 70%)`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 130, boxSizing: "border-box" }}>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 4, color: M.ink, border: `3px solid ${M.line}`, padding: "10px 28px", borderRadius: 999 }}>{script.series}</div>
      <div style={{ marginTop: 50, fontSize: 42, fontWeight: 900, color: M.bg1, background: M.amber, padding: "8px 28px", borderRadius: 14, transform: "rotate(-3deg)" }}>{String(sc.tag ?? "MẸO AI")}</div>
      <div style={{ marginTop: 40, fontSize: 112, fontWeight: 900, color: M.ink, lineHeight: 1.02, textAlign: "center" }}>{String(sc.line1)}</div>
      <div style={{ marginTop: 10, fontSize: 84, fontWeight: 900, color: M.teal, lineHeight: 1.05, textAlign: "center" }}>{String(sc.line2)}</div>
      <div style={{ marginTop: 40, fontSize: 46, fontWeight: 800, color: M.paperInk, background: M.paper, padding: "14px 38px", borderRadius: 999 }}>{String(sc.hook)}</div>
      <div style={{ position: "relative", marginTop: 200, display: "flex", alignItems: "center", gap: 36, transform: "scale(1.15)" }}>
        <div style={{ width: 340, background: M.paper, borderRadius: 24, padding: "26px 28px", transform: "rotate(-4deg)", boxShadow: glow }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: M.paperInk, marginBottom: 16 }}>EN · Dear Mr. Somchai,</div>
          {row(100, "#C9D3E0")}{row(86, "#C9D3E0")}{row(94, "#C9D3E0")}{row(60, "#C9D3E0")}
        </div>
        <svg width="120" height="140" viewBox="0 0 120 140" style={{ transform: `rotate(${f * 3}deg)` }}>
          <path d="M60 14 A46 46 0 1 1 18 84" fill="none" stroke={M.amber} strokeWidth="10" strokeLinecap="round" />
          <path d="M8 66 L18 92 L40 76" fill="none" stroke={M.amber} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ width: 340, background: M.card2, borderRadius: 24, padding: "26px 28px", transform: "rotate(3deg)", boxShadow: glow, border: `3px solid ${M.teal}` }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: M.teal, marginBottom: 16 }}>VI · Kính gửi anh…</div>
          {row(96, M.line)}{row(80, M.line)}{row(90, M.line)}{row(54, M.line)}
        </div>
      </div>
      <div style={{ marginTop: 150, display: "flex", alignItems: "center", gap: 22, fontSize: 40, fontWeight: 800 }}>
        <div style={{ background: M.amberSoft, color: M.amber, border: `3px solid ${M.amber}`, padding: "14px 26px", borderRadius: 18, textDecoration: "line-through" }}>"slight delay"</div>
        <div style={{ color: M.muted, fontSize: 50 }}>→</div>
        <div style={{ background: M.tealSoft, color: M.teal, border: `3px solid ${M.teal}`, padding: "14px 26px", borderRadius: 18 }}>trễ 3 ngày ✓</div>
      </div>
      <div style={{ position: "absolute", bottom: 80, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontSize: 28, color: M.amber, fontWeight: 800, letterSpacing: 2 }}>AI SHARING TIPS CHALLENGE 2026</div>
        <div style={{ fontSize: 36, color: M.ink, fontWeight: 700, marginTop: 10 }}>{script.author}</div>
      </div>
    </div>
  );
};

/** Mở đầu: cửa sổ soạn thư, gõ rồi xoá, đồng hồ chạy vèo. */
export const MHook: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const tries = ["Dear sir, I am want to inform…", "Dear Mr. Somchai, the delivery is…", "Dear Mr. Somchai, I would like to…"];
  const seg = Math.max(12, Math.floor((dur * 0.8) / tries.length));
  const k = Math.min(tries.length - 1, Math.floor(f / seg));
  const t = f - k * seg;
  const len = tries[k].length;
  const n = t < seg * 0.55 ? Math.floor((t / (seg * 0.55)) * len) : k < tries.length - 1 ? Math.max(0, Math.floor(len * (1 - (t - seg * 0.55) / (seg * 0.35)))) : len;
  const phut = Math.floor(prog(f, 0, dur) * 28);
  const giay = Math.floor(prog(f, 0, dur) * 28 * 60) % 60;
  return (
    <div style={{ padding: "0 60px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ ...pop(at(0)), fontSize: 70, fontWeight: 900, color: M.ink, textAlign: "center", lineHeight: 1.1, marginBottom: 40 }}>{String(sc.big)}</div>
      <div style={{ position: "relative", width: "100%" }}>
        <Win label="Thư mới" style={{ ...pop(at(4)) }}>
          <div style={{ fontSize: 28, color: M.muted, borderBottom: `2px solid ${M.line}`, paddingBottom: 14, marginBottom: 20 }}>Đến: Somchai (Giám đốc vùng)</div>
          <div style={{ fontSize: 36, color: M.ink, minHeight: 300, lineHeight: 1.4 }}>{tries[k].slice(0, n)}<Caret on /></div>
        </Win>
        <div style={{ position: "absolute", right: -20, top: -60, background: M.red, color: "#fff", borderRadius: 24, padding: "14px 26px", fontFamily: MONO, fontSize: 52, fontWeight: 700, boxShadow: glow, ...pop(at(10)) }}>
          {String(phut).padStart(2, "0")}:{String(giay).padStart(2, "0")}
        </div>
      </div>
      <div style={{ ...pop(at(30)), marginTop: 44, fontSize: 44, fontWeight: 800, color: M.bg1, background: M.amber, padding: "12px 34px", borderRadius: 18, transform: `${pop(at(30)).transform} rotate(-2deg)` }}>{String(sc.sub)}</div>
    </div>
  );
};

/** PROBLEM: 3 thẻ, thẻ cuối (nỗi đau chính) nổi màu hổ phách. */
export const MProblem: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const items = sc.items as { k: string; t: string; d: string }[];
  const step = Math.max(12, Math.floor((dur * 0.6) / items.length));
  return (
    <div style={{ padding: "0 64px" }}>
      <Title kicker="PROBLEM" text={sc.heading} />
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <div key={i} style={{ ...pop(at(8 + i * step)), display: "flex", gap: 26, alignItems: "center", background: last ? M.amberSoft : M.card, border: `3px solid ${last ? M.amber : "transparent"}`, borderRadius: 26, padding: "28px 30px", boxShadow: glow }}>
              <div style={{ width: 92, height: 92, flex: "none", borderRadius: 24, background: last ? M.amber : M.card2, color: last ? M.bg1 : M.ink, fontSize: 40, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{it.k}</div>
              <div>
                <div style={{ fontSize: 42, fontWeight: 800, color: M.ink }}>{it.t}</div>
                <div style={{ fontSize: 30, color: last ? M.amber : M.muted, marginTop: 6, fontWeight: 600 }}>{it.d}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** AI TIP: 4 bước xếp thành vòng tròn, chấm sáng chạy quanh, bước đang tới phóng to. */
export const MLoop: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const steps = sc.steps as string[];
  const R = 340;
  const cx = 480;
  const cy = 420;
  const p = prog(f, 10, dur * 0.85);
  const ang = -Math.PI / 2 + p * Math.PI * 2;
  const pos = (i: number) => {
    const a = -Math.PI / 2 + (i / steps.length) * Math.PI * 2;
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
  };
  const active = Math.min(steps.length - 1, Math.floor(p * steps.length + 0.02));
  return (
    <div style={{ padding: "0 60px" }}>
      <Title kicker="AI TIP" text={sc.heading} />
      <div style={{ ...pop(at(4)), position: "relative", width: 960, height: 840 }}>
        <svg width="960" height="840" style={{ position: "absolute", inset: 0 }}>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={M.line} strokeWidth="6" strokeDasharray="14 14" />
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={M.teal} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * R} strokeDashoffset={2 * Math.PI * R * (1 - p)} transform={`rotate(-90 ${cx} ${cy})`} />
          <circle cx={cx + R * Math.cos(ang)} cy={cy + R * Math.sin(ang)} r="16" fill={M.amber} />
        </svg>
        <div style={{ position: "absolute", left: cx - 150, top: cy - 70, width: 300, textAlign: "center", fontSize: 40, fontWeight: 900, color: M.ink, lineHeight: 1.2 }}>
          Việt → Anh<br /><span style={{ color: M.teal }}>→ Việt</span>
        </div>
        {steps.map((s, i) => {
          const [x, y] = pos(i);
          const on = i <= active;
          const cur = i === active;
          return (
            <div key={i} style={{ position: "absolute", left: x - 150, top: y - 66, width: 300, height: 132, borderRadius: 28, background: cur ? M.teal : on ? M.card2 : M.card, color: cur ? M.bg1 : M.ink, border: `3px solid ${on ? M.teal : M.line}`, boxShadow: glow, display: "flex", alignItems: "center", gap: 18, padding: "0 22px", boxSizing: "border-box", transform: `scale(${cur ? 1.08 : 1})` }}>
              <div style={{ width: 62, height: 62, flex: "none", borderRadius: 31, background: cur ? M.bg1 : M.teal, color: cur ? M.teal : M.bg1, fontSize: 34, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
              <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.18 }}>{s}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Bước 1: ghi chú tiếng Việt gạch đầu dòng, gõ dần trên tờ giấy sáng. */
export const MNotes: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const notes = sc.notes as string[];
  const per = (dur * 0.7) / notes.length;
  return (
    <div style={{ padding: "0 60px" }}>
      <Title text={sc.heading} />
      <Win light label={String(sc.label ?? "Ghi chú")} style={{ ...pop(at(4)) }}>
        <div style={{ fontSize: 28, color: "#55657D", fontWeight: 700, marginBottom: 18 }}>{String(sc.to)}</div>
        {notes.map((t, i) => {
          const a = 10 + i * per;
          const s = type(t, f, a, a + per * 0.8);
          return (
            <div key={i} style={{ display: "flex", gap: 18, fontSize: 36, color: M.paperInk, lineHeight: 1.38, marginBottom: 22, opacity: s ? 1 : 0.15 }}>
              <span style={{ color: M.teal, fontWeight: 900 }}>•</span>
              <span>{s}<Caret on={s.length > 0 && s.length < t.length} /></span>
            </div>
          );
        })}
      </Win>
      <div style={{ ...pop(at(dur * 0.75)), marginTop: 34, textAlign: "center", fontSize: 36, fontWeight: 700, color: M.amber }}>Không cần câu cú, chỉ cần đủ ý + đủ số</div>
    </div>
  );
};

/** Câu lệnh mẫu: gõ dần, 2 dòng quan trọng sáng lên. */
export const MPrompt: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const lines = sc.lines as string[];
  const hot = (sc.hot as number[]) ?? [];
  const total = lines.join("\n").length;
  const shown = Math.floor(prog(f, 8, dur * 0.6) * total);
  let used = 0;
  return (
    <div style={{ padding: "0 54px" }}>
      <Title text={sc.heading} />
      <Win label="Gửi cho AI" style={{ ...pop(at(4)) }}>
        {lines.map((l, i) => {
          const take = Math.max(0, Math.min(l.length, shown - used));
          used += l.length + 1;
          const isHot = hot.includes(i) && f > dur * 0.64;
          return (
            <div key={i} style={{ display: "flex", gap: 18, marginBottom: 20, opacity: take ? 1 : 0.12 }}>
              <div style={{ width: 46, height: 46, flex: "none", borderRadius: 12, background: isHot ? M.amber : M.card2, color: isHot ? M.bg1 : M.teal, fontWeight: 900, fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
              <div style={{ fontSize: 33, lineHeight: 1.38, color: isHot ? M.amber : M.ink, fontWeight: isHot ? 800 : 500 }}>{l.slice(0, take)}<Caret on={take > 0 && take < l.length} /></div>
            </div>
          );
        })}
      </Win>
    </div>
  );
};

/** Thư tiếng Anh AI trả về: cửa sổ thư sáng, gõ dần; câu được đánh dấu (`mark`) có gạch vàng mờ. */
export const MEmail: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const body = sc.body as string[];
  const total = body.join("\n").length;
  const shown = Math.floor(prog(f, 10, dur * 0.8) * total);
  let used = 0;
  return (
    <div style={{ padding: "0 50px" }}>
      <Title text={sc.heading} />
      <Win light label="Thư tiếng Anh · AI viết" style={{ ...pop(at(4)) }}>
        <div style={{ fontSize: 26, color: "#55657D", borderBottom: "2px solid #D5DDE8", paddingBottom: 12, marginBottom: 18 }}>
          <b>Subject:</b> {String(sc.subject)}
        </div>
        {body.map((l, i) => {
          const take = Math.max(0, Math.min(l.length, shown - used));
          used += l.length + 1;
          return <div key={i} style={{ fontSize: 31, lineHeight: 1.42, color: M.paperInk, minHeight: l ? undefined : 18, marginBottom: 10 }}>{l.slice(0, take)}<Caret on={take > 0 && take < l.length} color="#1F7A68" /></div>;
        })}
      </Win>
    </div>
  );
};

/**
 * Gương Anh ↔ Việt: trên là câu tiếng Anh, dưới là bản dịch ngược; câu `flag` bị so với ghi chú gốc → cờ đỏ.
 */
export const MMirror: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const pairs = sc.pairs as [string, string][];
  const flag = Number(sc.flag ?? 0);
  const step = Math.max(8, Math.floor((dur * 0.35) / pairs.length));
  const flagAt = 14 + pairs.length * step + 6;
  const fl = prog(f, flagAt, flagAt + 10);
  return (
    <div style={{ padding: "0 44px" }}>
      <Title text={sc.heading} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {pairs.map(([en, vi], i) => {
          const isFlag = i === flag;
          return (
            <div key={i} style={{ ...pop(at(10 + i * step)), display: "flex", flexDirection: "column", borderRadius: 22, overflow: "hidden", boxShadow: glow, border: `3px solid ${isFlag && fl > 0 ? M.red : "transparent"}` }}>
              <div style={{ background: M.paper, color: M.paperInk, fontSize: 28, lineHeight: 1.35, padding: "16px 22px", display: "flex", gap: 14 }}>
                <b style={{ color: "#55657D", fontSize: 22, marginTop: 4 }}>EN</b>
                <span style={{ background: isFlag ? `rgba(255,181,71,${0.55 * fl})` : "transparent", borderRadius: 6 }}>{en}</span>
              </div>
              <div style={{ background: M.card2, color: M.ink, fontSize: 30, lineHeight: 1.35, padding: "16px 22px", display: "flex", gap: 14 }}>
                <b style={{ color: M.teal, fontSize: 22, marginTop: 4 }}>VI</b>
                <span style={{ background: isFlag ? `rgba(255,100,100,${0.35 * fl})` : "transparent", borderRadius: 6 }}>{vi}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 22, opacity: fl, transform: `translateY(${(1 - fl) * 30}px)` }}>
        <div style={{ flex: 1, background: M.card, border: `3px dashed ${M.muted}`, borderRadius: 20, padding: "18px 22px", fontSize: 32, color: M.ink }}>
          <div style={{ fontSize: 24, color: M.muted, fontWeight: 700 }}>Ghi chú gốc</div>{String(sc.original)}
        </div>
        <div style={{ background: M.red, color: "#fff", fontSize: 38, fontWeight: 900, padding: "22px 26px", borderRadius: 20, transform: `rotate(-3deg) scale(${0.8 + 0.2 * fl})` }}>{String(sc.verdict)}</div>
      </div>
    </div>
  );
};

/** Sửa + soát số: nhắc AI sửa 1 câu, câu cũ gạch, câu mới xanh; rồi tick từng dữ kiện so với ghi chú. */
export const MFix: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const facts = sc.facts as string[];
  const swap = Math.round(dur * 0.22);
  const sw = prog(f, swap, swap + 10);
  const step = Math.max(8, Math.floor((dur * 0.45) / facts.length));
  const factAt = swap + 18;
  return (
    <div style={{ padding: "0 54px" }}>
      <Title text={sc.heading} />
      <div style={{ ...pop(at(2)), display: "flex", justifyContent: "flex-end", marginBottom: 22 }}>
        <div style={{ background: M.teal, color: M.bg1, fontSize: 32, fontWeight: 800, padding: "18px 26px", borderRadius: 28, borderBottomRightRadius: 8, maxWidth: 760 }}>{String(sc.ask)}</div>
      </div>
      <div style={{ ...pop(at(8)), background: M.paper, borderRadius: 22, padding: "20px 24px", boxShadow: glow, fontSize: 29, lineHeight: 1.38 }}>
        <div style={{ color: "#B23B3B", textDecoration: "line-through", opacity: 1 - 0.5 * sw }}>{String(sc.before)}</div>
        <div style={{ color: "#11704F", fontWeight: 800, marginTop: 10, opacity: sw, background: `rgba(37,199,168,${0.18 * sw})`, borderRadius: 8, padding: "4px 8px" }}>{String(sc.after)}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 30 }}>
        {facts.map((t, i) => {
          const a = factAt + i * step;
          const k = prog(f, a, a + 8);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, background: M.card, borderRadius: 18, padding: "18px 20px", opacity: 0.3 + 0.7 * k, border: `2px solid ${k > 0.9 ? M.teal : M.line}` }}>
              <div style={{ width: 46, height: 46, flex: "none", borderRadius: 23, background: k > 0.9 ? M.teal : M.card2, color: M.bg1, fontSize: 30, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${0.6 + 0.4 * k})` }}>✓</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: M.ink }}>{t}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** RESULT: nút Gửi bấm xuống, máy bay giấy bay đi, các dòng kết quả. */
export const MSend: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const items = sc.items as string[];
  const press = prog(f, 8, 12) - prog(f, 14, 18);
  const fly = prog(f, 14, 40);
  const step = Math.max(10, Math.floor((dur * 0.4) / items.length));
  const x = interpolate(fly, [0, 1], [0, 520]);
  const y = interpolate(fly, [0, 1], [0, -360]) + Math.sin(fly * Math.PI) * -60;
  return (
    <div style={{ padding: "0 64px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Title kicker="RESULT" text={sc.heading} />
      <div style={{ position: "relative", height: 230, width: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ ...pop(at(2)), background: M.teal, color: M.bg1, fontSize: 52, fontWeight: 900, padding: "24px 70px", borderRadius: 999, transform: `scale(${1 - 0.1 * press})`, boxShadow: glow }}>
          {f > 16 ? "✓ Đã gửi" : "Gửi"}
        </div>
        <svg width="120" height="120" viewBox="0 0 64 64" style={{ position: "absolute", left: "58%", top: 40, transform: `translate(${x}px, ${y}px) rotate(${-20 - fly * 15}deg)`, opacity: fly > 0 && fly < 1 ? 1 : 0 }}>
          <path d="M4 30 L60 6 L40 58 L30 36 Z" fill={M.paper} />
          <path d="M30 36 L60 6" stroke={M.muted} strokeWidth="2" />
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22, width: "100%", marginTop: 20 }}>
        {items.map((t, i) => (
          <div key={i} style={{ ...pop(at(30 + i * step)), display: "flex", alignItems: "center", gap: 22, background: M.card, borderRadius: 24, padding: "26px 30px", boxShadow: glow }}>
            <span style={{ color: M.teal, fontSize: 48, fontWeight: 900 }}>✓</span>
            <span style={{ fontSize: 38, fontWeight: 700, color: M.ink, lineHeight: 1.25 }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Biến thể dùng ngay: thẻ có nhãn ngôn ngữ / tình huống. */
export const MVariants: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const items = sc.items as { tag: string; t: string; d: string }[];
  const step = Math.max(12, Math.floor((dur * 0.6) / items.length));
  return (
    <div style={{ padding: "0 60px" }}>
      <Title kicker="DÙNG THÊM" text={sc.heading} />
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        {items.map((it, i) => (
          <div key={i} style={{ ...pop(at(8 + i * step)), background: M.card, borderRadius: 26, padding: "28px 30px", boxShadow: glow, borderLeft: `10px solid ${[M.amber, M.teal, "#8FA8FF"][i % 3]}` }}>
            <div style={{ display: "inline-block", fontSize: 26, fontWeight: 900, color: M.bg1, background: [M.amber, M.teal, "#8FA8FF"][i % 3], padding: "4px 16px", borderRadius: 10, marginBottom: 12 }}>{it.tag}</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: M.ink, lineHeight: 1.2 }}>{it.t}</div>
            <div style={{ fontSize: 30, color: M.muted, marginTop: 8, lineHeight: 1.3 }}>{it.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const MOutro: React.FC<SP> = ({ sc, script }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 60px" }}>
      <svg width="220" height="220" viewBox="0 0 120 140" style={{ ...pop(at(0)), transform: `${pop(at(0)).transform} rotate(${f * 2}deg)` }}>
        <path d="M60 14 A46 46 0 1 1 18 84" fill="none" stroke={M.teal} strokeWidth="10" strokeLinecap="round" />
        <path d="M8 66 L18 92 L40 76" fill="none" stroke={M.teal} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ ...pop(at(8)), fontSize: 56, fontWeight: 900, color: M.ink, textAlign: "center", lineHeight: 1.18, marginTop: 30 }}>{String(sc.line)}</div>
      <div style={{ ...pop(at(18)), fontSize: 46, fontWeight: 900, color: M.muted, marginTop: 60, textAlign: "center" }}>{script.series}</div>
      <div style={{ ...pop(at(22)), fontSize: 36, color: M.muted, marginTop: 14, fontWeight: 600 }}>{script.author}</div>
      <div style={{ ...pop(at(32)), marginTop: 56, background: M.amber, color: M.bg1, fontSize: 44, fontWeight: 800, padding: "18px 44px", borderRadius: 999, transform: `${pop(at(32)).transform} translateY(${Math.sin(f / 7) * 6}px)` }}>{String(sc.cta)} ↓</div>
    </div>
  );
};

export const MAIL_SCENES: Record<string, React.FC<SP>> = {
  "m-cover": MCover, "m-hook": MHook, "m-problem": MProblem, "m-loop": MLoop, "m-notes": MNotes, "m-prompt": MPrompt,
  "m-email": MEmail, "m-mirror": MMirror, "m-fix": MFix, "m-send": MSend, "m-variants": MVariants, "m-outro": MOutro,
};
