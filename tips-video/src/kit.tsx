/**
 * Bộ cảnh "k-" dùng chung cho 3 phong cách tuần 2 (Quang 28/10: mỗi clip một phong cách riêng):
 *   badge    — #6 "Thẻ nhân viên": nền xanh cổ vịt, thẻ trắng ngà có lỗ đục, nhấn vàng nghệ, tiêu đề serif.
 *   pinboard — #7 "Bảng ghim giấy nhớ": nền bần nâu, giấy nhớ vàng / hồng / xanh xoay nhẹ, ghim đỏ, chữ viết tay.
 *   swiss    — #8 "Khối màu Thuỵ Sĩ": nền trắng ngà + lưới mảnh, khối màu đặc góc vuông, chữ đen cực đậm.
 * Mỗi phong cách đổi bảng màu, phông, nền, kiểu thẻ (Card) và có một cảnh đặc trưng riêng (k-split, k-cleanup, k-versions).
 * Easing "giữ → giật" (outExpo) như bộ dark. Luật cấm chung: không logo hãng, không cảnh cảnh báo cuối video.
 */
import React from "react";
import { interpolate, random, useCurrentFrame } from "remotion";
import type { Scene, Script } from "./types";
import { prog } from "./anim";

type SP = { sc: Scene; script: Script; dur: number };
type Motif = "badge" | "pinboard" | "swiss" | "blueprint";

export type Look = {
  motif: Motif; bg1: string; bg2: string; dot: string; ink: string; muted: string; acc: string; acc2: string;
  card: string; cardInk: string; line: string; subBg: string; hi: string; head: string; body: string; hand: string;
  blocks: string[];
};

const MONO = `"Cascadia Mono", "Consolas", monospace`;
export const LOOKS: Record<Motif, Look> = {
  badge: {
    motif: "badge", bg1: "#0E3B43", bg2: "#0A2C33", dot: "rgba(255,255,255,0.06)", ink: "#FBF8F2", muted: "#9DB8BC",
    acc: "#F2B705", acc2: "#E4572E", card: "#FBF8F2", cardInk: "#16302F", line: "rgba(22,48,47,0.15)", subBg: "rgba(6,30,34,0.92)",
    hi: "#F2B705", head: `"Cambria", "Times New Roman", serif`, body: `"Segoe UI", Arial, sans-serif`, hand: `"Segoe UI", Arial, sans-serif`,
    blocks: ["#FBF8F2"],
  },
  pinboard: {
    motif: "pinboard", bg1: "#D9C3A0", bg2: "#C9AE84", dot: "rgba(90,60,25,0.16)", ink: "#2B2118", muted: "#6B5640",
    acc: "#D62828", acc2: "#1D6F5C", card: "#FFE066", cardInk: "#2B2118", line: "rgba(43,33,24,0.18)", subBg: "rgba(43,33,24,0.93)",
    hi: "#FFE066", head: `"Bahnschrift", "Segoe UI", Arial, sans-serif`, body: `"Segoe UI", Arial, sans-serif`, hand: `"Segoe Print", "Segoe UI", sans-serif`,
    blocks: ["#FFE066", "#FFB4C2", "#B8E0D2", "#FFE066", "#C9DDF7", "#FFB4C2"],
  },
  swiss: {
    motif: "swiss", bg1: "#F7F5F0", bg2: "#F0EDE6", dot: "rgba(0,0,0,0.05)", ink: "#111111", muted: "#6E6A63",
    acc: "#FF6B2C", acc2: "#2D7FF9", card: "#FFFFFF", cardInk: "#111111", line: "#111111", subBg: "rgba(17,17,17,0.92)",
    hi: "#FFC531", head: `"Segoe UI", Arial, sans-serif`, body: `"Segoe UI", Arial, sans-serif`, hand: `"Segoe UI", Arial, sans-serif`,
    blocks: ["#FF6B2C", "#2BB673", "#7B61FF", "#2D7FF9", "#FFC531"],
  },
  // #9 "Bản vẽ sơ đồ dữ liệu": nền xanh lam bản vẽ + lưới trắng mờ, khung viền trắng như bảng ERD, nhấn cam + xanh ngọc, chữ Bahnschrift + mono.
  blueprint: {
    motif: "blueprint", bg1: "#123A73", bg2: "#0C2B57", dot: "rgba(255,255,255,0.07)", ink: "#F4F8FF", muted: "#9FB6D9",
    acc: "#FF9F1C", acc2: "#2EC4B6", card: "rgba(255,255,255,0.06)", cardInk: "#F4F8FF", line: "rgba(244,248,255,0.55)", subBg: "rgba(8,26,54,0.93)",
    hi: "#FF9F1C", head: `"Bahnschrift", "Segoe UI", Arial, sans-serif`, body: `"Segoe UI", Arial, sans-serif`, hand: MONO,
    blocks: ["rgba(255,255,255,0.06)"],
  },
};
export const lookOf = (s: Script): Look => LOOKS[(s.theme as Motif) ?? "swiss"] ?? LOOKS.swiss;

/** Easing "giữ → giật": đứng yên tới `a`, rồi bật tới đích trong `d` khung (outExpo). */
const snap = (f: number, a: number, d = 9) => {
  const x = Math.min(1, Math.max(0, (f - a) / d));
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
};
const vao = (f: number, a: number, dy = 40): React.CSSProperties => {
  const p = snap(f, a);
  return { opacity: Math.min(1, p * 1.6), transform: `translateY(${(1 - p) * dy}px)` };
};

/** Thẻ theo phong cách: badge = thẻ ngà bo góc có lỗ đục; pinboard = giấy nhớ xoay + ghim; swiss = khối màu đặc góc vuông. */
const Card: React.FC<{ L: Look; i?: number; on?: boolean; color?: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ L, i = 0, on = true, color, style, children }) => {
  if (L.motif === "badge") {
    return (
      <div style={{ position: "relative", background: color ?? L.card, color: L.cardInk, borderRadius: 26, padding: "34px 34px 28px", boxShadow: on ? "0 18px 40px rgba(0,0,0,0.35)" : "none",
        outline: on ? `5px solid ${L.acc}` : "none", outlineOffset: -5, ...style }}>
        <div style={{ position: "absolute", top: 12, left: "50%", width: 70, height: 12, marginLeft: -35, borderRadius: 6, background: "rgba(14,59,67,0.25)" }} />
        {children}
      </div>
    );
  }
  if (L.motif === "pinboard") {
    const rot = [-2.2, 1.6, -1.1, 2.4, -1.8, 1.2][i % 6];
    return (
      <div style={{ position: "relative", background: color ?? L.blocks[i % L.blocks.length], color: L.cardInk, padding: "40px 34px 30px", transform: `rotate(${rot}deg)`,
        boxShadow: "6px 10px 0 rgba(0,0,0,0.12), 0 14px 26px rgba(0,0,0,0.18)", ...style }}>
        <div style={{ position: "absolute", top: -14, left: "50%", marginLeft: -16, width: 32, height: 32, borderRadius: 16, background: L.acc, boxShadow: "0 4px 0 rgba(0,0,0,0.25)" }} />
        {children}
      </div>
    );
  }
  if (L.motif === "blueprint") {
    // khung bản vẽ: viền trắng mảnh, 4 dấu góc cam khi đang được chọn
    return (
      <div style={{ position: "relative", background: color ?? L.card, color: L.cardInk, padding: "30px 32px", border: `3px solid ${on ? L.acc : L.line}`, ...style }}>
        {on ? [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y], k) => (
          <div key={k} style={{ position: "absolute", width: 18, height: 18, background: L.acc, [x ? "right" : "left"]: -10, [y ? "bottom" : "top"]: -10 } as React.CSSProperties} />
        )) : null}
        {children}
      </div>
    );
  }
  return (
    <div style={{ position: "relative", background: color ?? L.card, color: L.cardInk, padding: "32px 34px", border: `5px solid ${L.line}`, ...style }}>{children}</div>
  );
};

/** Tiêu đề hiện từng từ, từ khoá trong [[…]] tô màu nhấn. */
const Title: React.FC<{ L: Look; text: string; at?: number; size?: number }> = ({ L, text, at = 2, size = 86 }) => {
  const f = useCurrentFrame();
  const tokens = text.split(/(\[\[.*?\]\])/).flatMap((p) => (p.startsWith("[[") ? [{ w: p.slice(2, -2), hot: true }] : p.split(/\s+/).filter(Boolean).map((w) => ({ w, hot: false }))));
  const hotStyle = (hot: boolean): React.CSSProperties => {
    if (!hot) return { color: L.ink };
    if (L.motif === "swiss") return { color: L.ink, background: L.hi, padding: "0 10px" };
    if (L.motif === "pinboard") return { color: L.acc, textDecoration: "underline", textDecorationThickness: 8, textUnderlineOffset: 10 };
    if (L.motif === "blueprint") return { color: L.acc };
    return { color: L.acc, fontStyle: "italic" };
  };
  return (
    <div style={{ fontFamily: L.head, fontSize: size, fontWeight: L.motif === "badge" ? 700 : 900, lineHeight: 1.08, letterSpacing: L.motif === "swiss" ? -2 : 0 }}>
      {tokens.map((t, i) => <span key={i} style={{ display: "inline-block", marginRight: size * 0.22, ...hotStyle(t.hot), ...vao(f, at + i * 3, 30) }}>{t.w}</span>)}
    </div>
  );
};

/** Nhãn nhỏ trên tiêu đề: "VẤN ĐỀ", "AI TIP · BƯỚC 2/3"… */
const Tag: React.FC<{ L: Look; text: string }> = ({ L, text }) => (
  <div style={{ fontFamily: L.motif === "pinboard" ? L.hand : MONO, fontSize: 26, letterSpacing: L.motif === "pinboard" ? 0 : 3, color: L.motif === "swiss" ? L.muted : L.acc, marginBottom: 22 }}>{text}</div>
);

// ── Bìa (tự vẽ nền, không qua SceneFrame) ─────────────────────────────────────
export const KCover: React.FC<SP> = ({ sc, script }) => {
  const L = lookOf(script);
  const f = useCurrentFrame();
  const bg: React.CSSProperties = { position: "absolute", inset: 0, overflow: "hidden", background: `linear-gradient(170deg, ${L.bg1}, ${L.bg2})` };
  const footer = (
    <div style={{ position: "absolute", bottom: 80, left: 80, right: 80, display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 24, color: L.muted }}>
      <span>AI SHARING TIPS CHALLENGE 2026</span><span style={{ color: L.ink }}>{script.author}</span>
    </div>
  );
  const head = (
    <div style={{ position: "absolute", top: 80, left: 80, right: 80, display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 24, letterSpacing: 2, color: L.muted }}>
      <span>{script.series}</span><span style={{ color: L.motif === "swiss" ? L.ink : L.acc }}>{String(sc.tag ?? "")}</span>
    </div>
  );
  const titleBlock = (
    <div style={{ position: "absolute", top: 220, left: 80, right: 80 }}>
      <div style={{ fontFamily: L.head, fontSize: String(sc.line1).length > 13 ? 104 : 130, fontWeight: L.motif === "badge" ? 700 : 900, color: L.ink, lineHeight: 1, letterSpacing: L.motif === "swiss" ? -4 : -1 }}>{String(sc.line1)}</div>
      <div style={{ fontFamily: L.head, fontSize: String(sc.line2).length > 13 ? 96 : 112, fontWeight: L.motif === "badge" ? 700 : 900, color: L.motif === "swiss" ? L.ink : L.acc, fontStyle: L.motif === "badge" ? "italic" : "normal",
        background: L.motif === "swiss" ? L.hi : "transparent", display: "inline-block", padding: L.motif === "swiss" ? "0 14px" : 0, lineHeight: 1.05, marginTop: 10 }}>{String(sc.line2)}</div>
      <div style={{ marginTop: 36, display: "inline-block", fontFamily: MONO, fontSize: 34, color: L.motif === "swiss" ? "#fff" : L.bg1, background: L.motif === "swiss" ? L.ink : L.acc, padding: "10px 24px" }}>{String(sc.hook)}</div>
    </div>
  );
  let art: React.ReactNode = null;
  if (L.motif === "badge") {
    // thẻ nhân viên trống tên, dây đeo từ trên xuống
    art = (
      <div style={{ position: "absolute", left: 250, top: 1000, width: 580 }}>
        <div style={{ position: "absolute", left: 255, top: -150, width: 70, height: 170, background: L.acc }} />
        <Card L={L} on={false} style={{ height: 640, padding: "60px 48px" }}>
          <div style={{ width: 200, height: 200, borderRadius: 100, background: "rgba(14,59,67,0.15)", margin: "20px auto 40px" }} />
          <div style={{ fontFamily: MONO, fontSize: 24, color: "rgba(22,48,47,0.5)", textAlign: "center" }}>HỌ TÊN · VAI TRÒ</div>
          <div style={{ height: 6, background: "rgba(22,48,47,0.15)", margin: "26px 40px" }} />
          <div style={{ fontFamily: L.head, fontSize: 52, fontStyle: "italic", textAlign: "center", color: L.acc2 }}>{String(sc.name ?? "???")}<span style={{ opacity: f % 20 < 10 ? 1 : 0 }}>|</span></div>
        </Card>
      </div>
    );
  } else if (L.motif === "pinboard") {
    art = (
      <div style={{ position: "absolute", left: 140, right: 140, top: 960 }}>
        <Card L={L} i={0} style={{ padding: "60px 50px", fontFamily: L.hand, fontSize: 54, lineHeight: 1.3 }}>
          {String(sc.note ?? "")}
          <div style={{ position: "absolute", inset: -26, border: `8px solid ${L.acc}`, borderRadius: "50%", transform: "rotate(-4deg)", opacity: snap(f, 6, 12) }} />
        </Card>
      </div>
    );
  } else if (L.motif === "blueprint") {
    // hai bảng ERD nối nhau, câu SQL lỗi đóng dấu cam
    const tb = (name: string, cols: string[], x: number, y: number) => (
      <div style={{ position: "absolute", left: x, top: y, width: 380 }}>
        <Card L={L} on={false} style={{ padding: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 26, color: L.bg1, background: L.acc2, padding: "10px 18px" }}>{name}</div>
          {cols.map((c) => <div key={c} style={{ fontFamily: MONO, fontSize: 24, padding: "8px 18px", borderTop: `1px solid ${L.line}` }}>{c}</div>)}
        </Card>
      </div>
    );
    art = (
      <div style={{ position: "absolute", left: 80, right: 80, top: 900, height: 700 }}>
        {tb("DON_HANG", ["ma_don", "ma_kh", "ngay_dat", "trang_thai"], 0, 0)}
        {tb("KHACH_HANG", ["ma_kh", "ten_kh", "ngay_tao"], 540, 120)}
        <div style={{ position: "absolute", left: 380, top: 120, width: 160, height: 3, background: L.line }} />
        <div style={{ position: "absolute", left: 40, right: 0, top: 470, fontFamily: MONO, fontSize: 30, color: L.ink, border: `3px solid ${L.acc}`, padding: "16px 22px",
          transform: `rotate(-2deg) scale(${0.9 + 0.1 * snap(f, 6, 12)})`, opacity: snap(f, 6, 12), background: "rgba(255,159,28,0.12)" }}>
          {String(sc.err ?? "")}
        </div>
      </div>
    );
  } else {
    art = (
      <div style={{ position: "absolute", left: 80, right: 80, top: 930 }}>
        <div style={{ fontFamily: L.head, fontWeight: 900, fontSize: 420, lineHeight: 0.9, letterSpacing: -20, color: L.ink }}>{String(sc.big ?? "")}</div>
        <div style={{ fontFamily: MONO, fontSize: 32, color: L.muted, marginTop: 10 }}>{String(sc.bigNote ?? "")}</div>
      </div>
    );
  }
  const pattern = L.motif === "swiss" ? { img: `linear-gradient(90deg, rgba(0,0,0,0.06) 2px, transparent 2px)`, size: "90px 100%" }
    : L.motif === "blueprint" ? { img: `linear-gradient(${L.dot} 2px, transparent 2px), linear-gradient(90deg, ${L.dot} 2px, transparent 2px)`, size: "54px 54px" }
    : { img: `radial-gradient(${L.dot} 3px, transparent 3px)`, size: "38px 38px" };
  return (
    <div style={bg}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: pattern.img, backgroundSize: pattern.size }} />
      {head}{titleBlock}{art}{footer}
    </div>
  );
};

// ── Vấn đề: một dòng lặp đi lặp lại chồng lên nhau + bộ đếm, rồi câu trả lời sai/chung chung bật lên ─────────
export const KHook: React.FC<SP> = ({ sc, script, dur }) => {
  const L = lookOf(script);
  const f = useCurrentFrame();
  const count = Number(sc.count ?? 10);
  const n = Math.round(interpolate(f, [8, dur * 0.5], [1, count], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const shown = Math.min(7, n);
  const wrongAt = dur * 0.58;
  return (
    <div style={{ padding: "0 70px" }}>
      <Tag L={L} text="01 · VẤN ĐỀ" />
      <Title L={L} text={String(sc.big)} size={80} />
      <div style={{ position: "relative", marginTop: 40, height: 700 }}>
        {Array.from({ length: shown }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: i * 14, right: 120 - i * 14, top: i * 62, opacity: 0.4 + 0.6 * (i / Math.max(1, shown - 1)) }}>
            <Card L={L} i={i} on={false} style={{ padding: "22px 28px", fontFamily: L.motif === "pinboard" ? L.hand : L.body, fontSize: 32 }}>{String(sc.rep)}</Card>
          </div>
        ))}
        <div style={{ position: "absolute", top: -10, right: 0, fontFamily: L.head, fontWeight: 900, fontSize: 88, color: L.motif === "swiss" ? L.ink : L.acc,
          background: L.motif === "swiss" ? L.hi : "transparent", padding: "0 12px" }}>×{n}</div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, ...vao(f, wrongAt, 60) }}>
          <Card L={L} i={3} color={L.motif === "pinboard" ? "#FFFFFF" : undefined} style={{ fontSize: 36, fontWeight: 700, fontFamily: L.body }}>
            <span style={{ fontFamily: MONO, fontSize: 24, color: L.acc2 }}>AI ›</span> {String(sc.wrong)}
          </Card>
        </div>
      </div>
      <div style={{ marginTop: 30, fontFamily: L.motif === "pinboard" ? L.hand : MONO, fontSize: 32, color: L.motif === "badge" ? L.acc : L.ink, ...vao(f, wrongAt + 12) }}>{String(sc.sub ?? "")}</div>
    </div>
  );
};

// ── AI TIP: các bước, bước hiện tại nổi bật ─────────────────────────────────────
export const KSteps: React.FC<SP> = ({ sc, script, dur }) => {
  const L = lookOf(script);
  const f = useCurrentFrame();
  const steps = sc.steps as { t: string; d: string }[];
  const per = (dur * 0.82) / steps.length;
  const cur = Math.min(steps.length - 1, Math.floor(Math.max(0, f - 8) / per));
  return (
    <div style={{ padding: "0 70px" }}>
      <Tag L={L} text={`02 · AI TIP · BƯỚC ${cur + 1}/${steps.length}`} />
      <Title L={L} text={String(sc.heading)} size={84} />
      <div style={{ marginTop: 50, display: "flex", flexDirection: "column", gap: L.motif === "pinboard" ? 44 : 26 }}>
        {steps.map((s, i) => {
          const on = i === cur;
          return (
            <div key={i} style={{ ...vao(f, 6 + i * 5), opacity: on ? 1 : i < cur ? 0.75 : 0.45 }}>
              <Card L={L} i={i} on={on} color={L.motif === "swiss" ? (on ? L.blocks[i % L.blocks.length] : "#FFFFFF") : undefined}
                style={{ display: "flex", alignItems: "center", gap: 30 }}>
                <div style={{ fontFamily: L.head, fontWeight: 900, fontSize: 80, width: 100, color: L.motif === "badge" ? (on ? L.acc2 : "rgba(22,48,47,0.35)") : L.cardInk }}>{i + 1}</div>
                <div>
                  <div style={{ fontFamily: L.body, fontSize: 42, fontWeight: 900, lineHeight: 1.15 }}>{s.t}</div>
                  <div style={{ fontFamily: L.motif === "pinboard" ? L.hand : MONO, fontSize: 26, opacity: 0.75, marginTop: 8 }}>{s.d}</div>
                </div>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Câu lệnh / mẫu: gõ dần trong thẻ, dòng quan trọng nổi bật ─────────────────────
export const KPrompt: React.FC<SP> = ({ sc, script, dur }) => {
  const L = lookOf(script);
  const f = useCurrentFrame();
  const lines = sc.lines as string[];
  const hot = (sc.hot as number[]) ?? [];
  const total = lines.join("\n").length;
  const shown = Math.floor(prog(f, 8, dur * 0.55) * total);
  let used = 0;
  return (
    <div style={{ padding: "0 64px" }}>
      <Tag L={L} text="03 · MẪU DÙNG NGAY" />
      <Title L={L} text={String(sc.heading)} size={80} />
      <div style={{ marginTop: 40 }}>
        <Card L={L} i={2} color={L.motif === "pinboard" ? "#FFFFFF" : undefined}>
          <div style={{ fontFamily: MONO, fontSize: 22, opacity: 0.6, marginBottom: 18 }}>{String(sc.hint ?? "")}</div>
          {lines.map((l, i) => {
            const take = Math.max(0, Math.min(l.length, shown - used));
            used += l.length + 1;
            const isHot = hot.includes(i) && f > dur * 0.6;
            return (
              <div key={i} style={{ fontFamily: L.motif === "pinboard" ? L.hand : MONO, fontSize: L.motif === "pinboard" ? 34 : 31, lineHeight: 1.45, marginBottom: 6, whiteSpace: "pre-wrap",
                background: isHot ? L.hi : "transparent", padding: isHot ? "2px 10px" : "2px 0", opacity: take ? 1 : 0.15 }}>
                {l.slice(0, take)}{take > 0 && take < l.length ? <span style={{ color: L.acc }}>▌</span> : null}
              </div>
            );
          })}
        </Card>
      </div>
      {sc.note ? <div style={{ marginTop: 34, fontFamily: L.motif === "pinboard" ? L.hand : MONO, fontSize: 30, color: L.motif === "badge" ? L.acc : L.ink, ...vao(f, dur * 0.68) }}>{String(sc.note)}</div> : null}
    </div>
  );
};

// ── Kết quả trước / sau ─────────────────────────────────────────────────────────
export const KCompare: React.FC<SP> = ({ sc, script, dur }) => {
  const L = lookOf(script);
  const f = useCurrentFrame();
  const rows = sc.rows as [string, string, string][];
  const step = Math.max(10, Math.floor((dur * 0.6) / rows.length));
  return (
    <div style={{ padding: "0 60px" }}>
      <Tag L={L} text="04 · KẾT QUẢ" />
      <Title L={L} text={String(sc.heading)} size={84} />
      <div style={{ marginTop: 40 }}>
        <Card L={L} i={1} on={false} color={L.motif === "pinboard" ? "#FFFFFF" : undefined} style={{ padding: "20px 30px" }}>
          <div style={{ display: "flex", fontFamily: MONO, fontSize: 22, opacity: 0.7, padding: "10px 0" }}>
            <div style={{ width: 230 }} /><div style={{ flex: 1 }}>{String(sc.colA ?? "TRƯỚC")}</div><div style={{ flex: 1, color: L.motif === "badge" ? L.acc2 : L.cardInk }}>{String(sc.colB ?? "SAU")}</div>
          </div>
          {rows.map(([k, a, b], i) => {
            const at = 10 + i * step;
            return (
              <div key={i} style={{ ...vao(f, at), display: "flex", borderTop: `2px solid ${L.line}`, padding: "22px 0" }}>
                <div style={{ width: 230, fontFamily: MONO, fontSize: 22, opacity: 0.7, paddingTop: 6 }}>{k}</div>
                <div style={{ flex: 1, fontSize: 34, fontWeight: 700, opacity: 0.55, textDecoration: snap(f, at + 8) > 0.5 ? "line-through" : "none" }}>{a}</div>
                <div style={{ flex: 1, fontSize: 34, fontWeight: 900, opacity: snap(f, at + 10), background: L.motif === "swiss" ? L.hi : "transparent", padding: L.motif === "swiss" ? "0 8px" : 0 }}>{b}</div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
};

// ── Danh sách ngắn (nên ghi gì / khi nào…) + nút kêu gọi ──────────────────────────
export const KSigns: React.FC<SP> = ({ sc, script, dur }) => {
  const L = lookOf(script);
  const f = useCurrentFrame();
  const items = sc.items as string[];
  const step = Math.max(10, Math.floor((dur * 0.6) / items.length));
  return (
    <div style={{ padding: "0 70px" }}>
      <Tag L={L} text="05 · GHI NHỚ" />
      <Title L={L} text={String(sc.heading)} size={84} />
      <div style={{ marginTop: 50, display: "flex", flexDirection: "column", gap: L.motif === "pinboard" ? 40 : 24 }}>
        {items.map((t, i) => (
          <div key={i} style={{ ...vao(f, 10 + i * step, 50) }}>
            <Card L={L} i={i + 1} on={false} color={L.motif === "swiss" ? L.blocks[(i + 1) % L.blocks.length] : undefined}
              style={{ fontFamily: L.motif === "pinboard" ? L.hand : L.body, fontSize: 42, fontWeight: 800, padding: "26px 32px" }}>{t}</Card>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 50, display: "inline-block", fontFamily: L.body, fontSize: 40, fontWeight: 900, padding: "16px 30px",
        background: L.motif === "swiss" ? L.ink : L.acc, color: L.motif === "swiss" ? "#fff" : L.motif === "badge" ? L.bg1 : "#fff", ...vao(f, 14 + items.length * step) }}>{String(sc.cta)}</div>
    </div>
  );
};

// ── Kết: vọng lại bìa ─────────────────────────────────────────────────────────
export const KOutro: React.FC<SP> = ({ sc, script }) => {
  const L = lookOf(script);
  const f = useCurrentFrame();
  const tools = (sc.tools as string[]) ?? [];
  return (
    <div style={{ padding: "0 70px" }}>
      <Title L={L} text={String(sc.line)} size={92} />
      <div style={{ marginTop: 50, ...vao(f, 14) }}>
        <Card L={L} i={4} style={{ fontFamily: L.motif === "pinboard" ? L.hand : L.head, fontSize: L.motif === "swiss" ? 120 : 64, fontWeight: 900, textAlign: "center", padding: "50px 30px" }}>
          {String(sc.echo ?? "")}
          {sc.echoNote ? <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 400, opacity: 0.7, marginTop: 14 }}>{String(sc.echoNote)}</div> : null}
        </Card>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 50, ...vao(f, 24) }}>
        {tools.map((t) => <div key={t} style={{ fontFamily: MONO, fontSize: 30, color: L.motif === "swiss" ? L.ink : L.ink, border: `3px solid ${L.motif === "swiss" ? L.ink : L.muted}`, padding: "10px 22px" }}>{t}</div>)}
      </div>
      <div style={{ marginTop: 40, display: "inline-block", fontFamily: L.body, fontSize: 42, fontWeight: 900, padding: "16px 30px",
        background: L.motif === "swiss" ? L.ink : L.acc, color: L.motif === "swiss" ? "#fff" : L.motif === "badge" ? L.bg1 : "#fff", ...vao(f, 32) }}>{String(sc.cta)} ↓</div>
    </div>
  );
};

// ── #6 đặc trưng: chia đôi cùng một câu hỏi; thẻ HỒ SƠ rơi xuống đóng dấu, câu trả lời chung chung vỡ ra, câu đúng mọc lại ─────
export const KSplit: React.FC<SP> = ({ sc, script, dur }) => {
  const L = lookOf(script);
  const f = useCurrentFrame();
  const generic = sc.generic as string[];
  const good = sc.good as string[];
  const stampAt = Math.round(dur * 0.42);     // trước đó giữ yên ~0,5 s (khoảng lặng trước cú lật)
  const drop = snap(f, stampAt - 10, 12);
  const shatter = prog(f, stampAt + 2, stampAt + 22);
  const goodShown = Math.floor(prog(f, stampAt + 18, dur * 0.85) * good.join(" ").length);
  const panel = (label: string, on: boolean, children: React.ReactNode) => (
    <Card L={L} on={on} style={{ height: 420, overflow: "hidden", padding: "26px 30px" }}>
      <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: 2, color: on ? L.acc2 : "rgba(22,48,47,0.55)", marginBottom: 14 }}>{label}</div>
      {children}
    </Card>
  );
  let used = 0;
  return (
    <div style={{ padding: "0 60px", position: "relative" }}>
      <Tag L={L} text="CÙNG MỘT CÂU HỎI" />
      <div style={{ fontFamily: L.body, fontSize: 40, fontWeight: 800, color: L.ink, marginBottom: 26 }}>
        <span style={{ fontFamily: MONO, fontSize: 26, color: L.acc }}>Bạn › </span>{String(sc.q)}
      </div>
      {panel(String(sc.labelA ?? "CHƯA CÀI HỒ SƠ"), false,
        generic.map((g, i) => <div key={i} style={{ fontSize: 30, lineHeight: 1.4, opacity: 0.7 }}>{g}</div>))}
      <div style={{ height: 30 }} />
      <div style={{ position: "relative" }}>
        {panel(String(sc.labelB ?? "ĐÃ CÀI HỒ SƠ"), f > stampAt, (
          <div style={{ position: "relative" }}>
            {/* câu chung chung vỡ vụn từng chữ khi dấu rơi */}
            {shatter < 1 ? generic.map((g, i) => (
              <div key={i} style={{ fontSize: 30, lineHeight: 1.4, opacity: 0.7 }}>
                {g.split(" ").map((w, j) => {
                  const r = random(`${i}-${j}`);
                  return <span key={j} style={{ display: "inline-block", marginRight: 8, opacity: 1 - shatter,
                    transform: `translate(${(r - 0.5) * 400 * shatter}px, ${(random(`y${i}-${j}`) * 300 + 80) * shatter}px) rotate(${(r - 0.5) * 120 * shatter}deg)` }}>{w}</span>;
                })}
              </div>
            )) : null}
            {/* câu đúng việc gõ ra */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
              {good.map((g, i) => {
                const take = Math.max(0, Math.min(g.length, goodShown - used));
                used += g.length + 1;
                return <div key={i} style={{ fontSize: 31, lineHeight: 1.4, fontWeight: i === 0 ? 800 : 500 }}>{g.slice(0, take)}</div>;
              })}
            </div>
          </div>
        ))}
        {/* thẻ HỒ SƠ rơi xuống + con dấu */}
        <div style={{ position: "absolute", right: 30, top: -40, width: 300, transform: `translateY(${(1 - drop) * -900}px) rotate(${(1 - drop) * -18 + 6}deg)`, opacity: drop > 0 ? 1 : 0 }}>
          <div style={{ background: L.acc, color: L.bg1, padding: "22px 24px", borderRadius: 18, boxShadow: "0 20px 40px rgba(0,0,0,0.4)", fontFamily: L.body }}>
            <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: 2 }}>HỒ SƠ</div>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.3, marginTop: 6 }}>{String(sc.profile ?? "")}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── #7 đặc trưng: giấy nhớ "AI nhớ về bạn"; mục sai gạch đỏ, gỡ ghim, rơi vào thùng rác; bộ đếm đã dọn ─────────
export const KCleanup: React.FC<SP> = ({ sc, script, dur }) => {
  const L = lookOf(script);
  const f = useCurrentFrame();
  const items = sc.items as { t: string; bad?: boolean }[];
  const appearStep = Math.max(5, Math.floor((dur * 0.28) / items.length));
  const badIdx = items.map((it, i) => (it.bad ? i : -1)).filter((i) => i >= 0);
  const fallStart = Math.round(dur * 0.42);   // khoảng lặng ngắn trước tờ đầu tiên rơi
  const fallStep = Math.max(12, Math.floor((dur * 0.4) / Math.max(1, badIdx.length)));
  const done = badIdx.filter((_, k) => f > fallStart + k * fallStep + 14).length;
  return (
    <div style={{ padding: "0 60px" }}>
      <Tag L={L} text="AI ĐANG NHỚ VỀ BẠN…" />
      <Title L={L} text={String(sc.heading)} size={78} />
      <div style={{ position: "relative", marginTop: 50, height: 900 }}>
        {items.map((it, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const k = badIdx.indexOf(i);
          const t0 = fallStart + k * fallStep;
          const strike = it.bad ? snap(f, t0 - 8, 6) : 0;
          const fall = it.bad ? prog(f, t0, t0 + 16) : 0;
          return (
            <div key={i} style={{ position: "absolute", left: col * 490, top: row * 230, width: 450, opacity: snap(f, 4 + i * appearStep) * (1 - fall * 0.2),
              transform: `translateY(${fall * fall * (780 - row * 230)}px) translateX(${fall * (380 - col * 490) * 0.6}px) rotate(${fall * (col ? 40 : -40)}deg) scale(${1 - fall * 0.5})` }}>
              <Card L={L} i={i} style={{ fontFamily: L.hand, fontSize: 34, lineHeight: 1.25, minHeight: 130, padding: "40px 28px 24px" }}>
                {it.t}
                <div style={{ position: "absolute", left: 16, right: 16, top: "55%", height: 8, background: L.acc, transform: `scaleX(${strike}) rotate(-3deg)`, transformOrigin: "left center" }} />
              </Card>
            </div>
          );
        })}
        {/* thùng rác + bộ đếm */}
        <div style={{ position: "absolute", left: 380, top: 720, width: 160, height: 170 }}>
          <div style={{ position: "absolute", left: -10, right: -10, top: 0, height: 22, background: L.ink, borderRadius: 6 }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 26, bottom: 0, background: "#5B4A39", borderRadius: "0 0 18px 18px",
            backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0 6px, transparent 6px 34px)" }} />
        </div>
        <div style={{ position: "absolute", left: 0, top: 760, fontFamily: L.head, fontWeight: 900, fontSize: 52, color: L.acc }}>Đã dọn {done}/{items.length}</div>
      </div>
    </div>
  );
};

// ── #8 đặc trưng: thẻ câu lệnh lên đời v1 → v2 → v3, mỗi bản thêm một dòng; đồng hồ "lượt phải sửa" đếm lùi ─────
export const KVersions: React.FC<SP> = ({ sc, script, dur }) => {
  const L = lookOf(script);
  const f = useCurrentFrame();
  const vs = sc.versions as { label: string; add: string; fixes: number }[];
  const per = (dur * 0.86) / vs.length;
  const cur = Math.min(vs.length - 1, Math.floor(Math.max(0, f - 6) / per));
  const fixesFrom = cur > 0 ? vs[cur - 1].fixes : vs[0].fixes;
  const fixes = Math.round(interpolate(f, [6 + cur * per, 6 + cur * per + 14], [fixesFrom, vs[cur].fixes], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const color = L.blocks[cur % L.blocks.length];
  return (
    <div style={{ padding: "0 60px" }}>
      <Tag L={L} text="CÂU LỆNH LÊN ĐỜI" />
      <Title L={L} text={String(sc.heading)} size={80} />
      <div style={{ display: "flex", gap: 24, marginTop: 40, alignItems: "stretch" }}>
        <div style={{ flex: 1 }}>
          <Card L={L} color={color} style={{ minHeight: 640 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: MONO, fontSize: 24 }}>{String(sc.name ?? "")}</div>
              <div style={{ fontFamily: L.head, fontWeight: 900, fontSize: 64, background: "#111", color: "#fff", padding: "0 18px" }}>{vs[cur].label}</div>
            </div>
            <div style={{ height: 5, background: "#111", margin: "20px 0 26px" }} />
            {vs.slice(0, cur + 1).map((v, i) => {
              const isNew = i === cur && i > 0;
              const p = isNew ? snap(f, 6 + cur * per, 12) : 1;
              return (
                <div key={i} style={{ fontFamily: MONO, fontSize: 32, lineHeight: 1.4, marginBottom: 16, padding: isNew ? "6px 12px" : "6px 0",
                  background: isNew ? "rgba(255,255,255,0.75)" : "transparent", opacity: p, transform: `translateX(${(1 - p) * 120}px)` }}>
                  {i > 0 ? "+ " : ""}{v.add}
                </div>
              );
            })}
          </Card>
        </div>
        <div style={{ width: 260 }}>
          <Card L={L} style={{ textAlign: "center", padding: "30px 10px", minHeight: 640, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: 22, opacity: 0.7 }}>LƯỢT PHẢI SỬA</div>
            <div style={{ fontFamily: L.head, fontWeight: 900, fontSize: 220, lineHeight: 1, color: fixes === 0 ? "#2BB673" : L.ink }}>{fixes}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 18 }}>
              {vs.map((_, i) => <div key={i} style={{ width: 40, height: 10, background: i <= cur ? "#111" : "rgba(0,0,0,0.15)" }} />)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ── #8: thư viện 5 câu lõi = lưới khối màu ───────────────────────────────────────
export const KLibrary: React.FC<SP> = ({ sc, script, dur }) => {
  const L = lookOf(script);
  const f = useCurrentFrame();
  const items = sc.items as { t: string; d: string }[];
  const step = Math.max(6, Math.floor((dur * 0.55) / items.length));
  return (
    <div style={{ padding: "0 60px" }}>
      <Tag L={L} text="THƯ VIỆN CỦA MÌNH" />
      <Title L={L} text={String(sc.heading)} size={80} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 40 }}>
        {items.map((it, i) => (
          <div key={i} style={{ gridColumn: i === items.length - 1 && items.length % 2 ? "1 / span 2" : undefined, ...vao(f, 8 + i * step, 60) }}>
            <Card L={L} color={L.blocks[i % L.blocks.length]} style={{ minHeight: 200, padding: "24px 26px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                <div style={{ fontFamily: L.head, fontWeight: 900, fontSize: 84, lineHeight: 0.9 }}>{i + 1}</div>
                <div style={{ fontFamily: L.body, fontWeight: 900, fontSize: 40 }}>{it.t}</div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 23, lineHeight: 1.35, marginTop: 12 }}>{it.d}</div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── #9 đặc trưng: chưa có schema → câu SQL dùng cột "ma" (gạch cam, ✗ không tồn tại); schema bay vào → câu đúng gõ ra, cột được dùng sáng xanh ─────
export const KSchema: React.FC<SP> = ({ sc, script, dur }) => {
  const L = lookOf(script);
  const f = useCurrentFrame();
  const tables = sc.tables as { name: string; cols: string[] }[];
  const bad = sc.bad as string[];
  const badCols = (sc.badCols as string[]) ?? [];
  const good = sc.good as string[];
  const used = new Set((sc.used as string[]) ?? []);
  const dropAt = Math.round(dur * 0.4);       // giữ yên ~0,5 s trước khi schema rơi vào (khoảng lặng trước cú lật)
  const drop = snap(f, dropAt, 12);
  const goodShown = Math.floor(prog(f, dropAt + 14, dur * 0.85) * good.join("\n").length);
  const lit = f > dropAt + 20;
  const markBad = (line: string) => line.split(new RegExp(`(${badCols.join("|")})`)).map((p, k) =>
    badCols.includes(p) ? <span key={k} style={{ color: L.acc, textDecoration: f > dropAt * 0.55 ? "line-through" : "none", textDecorationThickness: 4 }}>{p}</span> : <span key={k}>{p}</span>);
  let used2 = 0;
  return (
    <div style={{ padding: "0 56px" }}>
      <Tag L={L} text={drop > 0.5 ? "CÓ SCHEMA" : "CHƯA CÓ SCHEMA"} />
      <div style={{ display: "flex", gap: 18, height: 330, alignItems: "flex-start" }}>
        {tables.map((t, i) => (
          <div key={t.name} style={{ flex: 1, opacity: 0.15 + 0.85 * drop, transform: `translateY(${(1 - drop) * -260}px) rotate(${(1 - drop) * (i - 1) * 8}deg)` }}>
            <Card L={L} on={false} style={{ padding: 0 }}>
              <div style={{ fontFamily: MONO, fontSize: 22, color: L.bg1, background: L.acc2, padding: "8px 14px" }}>{t.name}</div>
              {t.cols.map((c) => {
                const on = lit && used.has(`${t.name}.${c}`);
                return <div key={c} style={{ fontFamily: MONO, fontSize: 21, padding: "6px 14px", borderTop: `1px solid ${L.line}`, background: on ? "rgba(46,196,182,0.25)" : "transparent", color: on ? L.ink : L.muted }}>{on ? "✓ " : ""}{c}</div>;
              })}
            </Card>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 28 }}>
        <Card L={L} on={lit} style={{ minHeight: 470, padding: "24px 28px", background: "rgba(0,0,0,0.25)" }}>
          <div style={{ fontFamily: MONO, fontSize: 22, color: L.muted, marginBottom: 12 }}>AI › câu SQL {lit ? "(có schema)" : "(đoán mò)"}</div>
          {f < dropAt + 10 ? (
            <>
              {bad.map((l, i) => <div key={i} style={{ fontFamily: MONO, fontSize: 28, lineHeight: 1.45, opacity: 1 - drop * 0.8 }}>{markBad(l)}</div>)}
              <div style={{ marginTop: 18, fontFamily: MONO, fontSize: 26, color: L.acc, opacity: snap(f, dropAt * 0.6) }}>{String(sc.errLine ?? "")}</div>
            </>
          ) : good.map((l, i) => {
            const take = Math.max(0, Math.min(l.length, goodShown - used2));
            used2 += l.length + 1;
            return <div key={i} style={{ fontFamily: MONO, fontSize: 28, lineHeight: 1.45, whiteSpace: "pre" }}>{l.slice(0, take)}</div>;
          })}
          {f > dur * 0.86 ? <div style={{ marginTop: 16, fontFamily: MONO, fontSize: 26, color: L.acc2 }}>{String(sc.okLine ?? "")}</div> : null}
        </Card>
      </div>
    </div>
  );
};

export const KIT_SCENES: Record<string, React.FC<SP>> = {
  "k-schema": KSchema,
  "k-cover": KCover, "k-hook": KHook, "k-steps": KSteps, "k-prompt": KPrompt, "k-compare": KCompare, "k-signs": KSigns, "k-outro": KOutro,
  "k-split": KSplit, "k-cleanup": KCleanup, "k-versions": KVersions, "k-library": KLibrary,
};
