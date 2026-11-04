/**
 * Bộ cảnh "s-" — phong cách TUẦN 3 "Màn hình làm việc thật" (Quang chốt 04/11: mỗi TUẦN một phong cách, cả 4 clip trong tuần dùng chung).
 * Ngôn ngữ chuyển động khác hẳn bộ k-: mọi thứ diễn ra trên một desktop giả — cửa sổ app mở ra, con trỏ chuột đi theo đường cong
 * và bấm (gợn sóng), gõ phím có con nháy, kéo thả file vào cửa sổ AI, camera zoom / lia theo con trỏ, thông báo trượt vào.
 * Toạ độ: khung nội dung 1000 × 1150 (SceneFrame đặt ở top 250); vùng desktop = phần dưới tiêu đề (DESK_Y → hết).
 */
import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { Scene, Script } from "./types";

type SP = { sc: Scene; script: Script; dur: number };

export const D = {
  wall1: "#D9E6F8", wall2: "#BFD2F0", wallGlow: "rgba(124, 92, 255, 0.28)", ink: "#0F172A", muted: "#5B6475",
  win: "#FFFFFF", chrome: "#F3F5F9", line: "#E3E8F0", acc: "#2563EB", accSoft: "#E3ECFF", hi: "#FFD43B", ok: "#16A34A", okSoft: "#DCFCE7",
  bad: "#DC2626", badSoft: "#FEE2E2", ai: "#7C5CFF", aiSoft: "#EFEAFF", subBg: "rgba(15, 23, 42, 0.92)",
};
const MONO = `"Cascadia Mono", "Consolas", monospace`;
const W = 1000;
const DESK_Y = 190;   // desktop bắt đầu dưới tiêu đề

// ── tiện ích chuyển động ────────────────────────────────────────────────────────────────────────────────
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);   // easeInOutCubic
const outBack = (x: number) => { const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const p = (f: number, a: number, d: number) => clamp01((f - a) / d);
type Key = { f: number; x: number; y: number; click?: boolean; drag?: boolean };

/** Vị trí con trỏ theo các mốc (đi cong nhẹ giữa 2 mốc, easeInOut). */
function cursorAt(f: number, keys: Key[]) {
  if (!keys.length) return { x: W / 2, y: 700, drag: false };
  if (f <= keys[0].f) return { ...keys[0], drag: !!keys[0].drag };
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (f <= b.f) {
      const t = ease((f - a.f) / Math.max(1, b.f - a.f));
      const bow = Math.sin(Math.PI * t) * Math.min(60, Math.hypot(b.x - a.x, b.y - a.y) * 0.12);   // vòng cung
      const nx = -(b.y - a.y), ny = b.x - a.x, L = Math.hypot(nx, ny) || 1;
      return { x: a.x + (b.x - a.x) * t + (nx / L) * bow, y: a.y + (b.y - a.y) * t + (ny / L) * bow, drag: !!b.drag };
    }
  }
  const z = keys[keys.length - 1];
  return { ...z, drag: !!z.drag };
}

const Cursor: React.FC<{ keys: Key[] }> = ({ keys }) => {
  const f = useCurrentFrame();
  const c = cursorAt(f, keys);
  const clicks = keys.filter((k) => k.click);
  const press = clicks.some((k) => f >= k.f && f < k.f + 5);
  return (
    <>
      {clicks.map((k, i) => {
        const q = p(f, k.f, 14);
        if (q <= 0 || q >= 1) return null;
        return <div key={i} style={{ position: "absolute", left: k.x - 40 * q, top: k.y - 40 * q, width: 80 * q, height: 80 * q, borderRadius: "50%",
          border: `4px solid ${D.acc}`, opacity: 1 - q, pointerEvents: "none" }} />;
      })}
      <svg width={46} height={56} viewBox="0 0 23 28" style={{ position: "absolute", left: c.x - 4, top: c.y - 2, transform: `scale(${press ? 0.86 : 1})`,
        transformOrigin: "4px 2px", filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.35))", zIndex: 50 }}>
        <path d="M2 1 L2 22 L7.5 17 L11.2 25.5 L14.6 24 L11 15.8 L18.5 15.6 Z" fill="#111" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    </>
  );
};

/** Camera: phóng to quanh (cx, cy) của vùng desktop, có kẹp để không lộ mép. keys: [{f, cx, cy, z}] */
function camAt(f: number, keys: { f: number; cx: number; cy: number; z: number }[], w: number, h: number) {
  let k = keys[0] ?? { f: 0, cx: w / 2, cy: h / 2, z: 1 };
  let cx = k.cx, cy = k.cy, z = k.z;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (f >= a.f) {
      const t = ease(clamp01((f - a.f) / Math.max(1, b.f - a.f)));
      cx = a.cx + (b.cx - a.cx) * t; cy = a.cy + (b.cy - a.cy) * t; z = a.z + (b.z - a.z) * t; k = b;
    }
  }
  const tx = Math.min(0, Math.max(w - w * z, w / 2 - cx * z));
  const ty = Math.min(0, Math.max(h - h * z, h / 2 - cy * z));
  return `translate(${tx}px, ${ty}px) scale(${z})`;
}

// ── khối giao diện ─────────────────────────────────────────────────────────────────────────────────────
/** Tiêu đề cảnh: chữ đậm, từ khoá [[…]] tô dạ quang như bút highlight quét qua. */
const Head: React.FC<{ text: string; tag?: string }> = ({ text, tag }) => {
  const f = useCurrentFrame();
  const parts = text.split(/(\[\[.*?\]\])/);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: DESK_Y - 20, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      {tag ? <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: 3, color: D.acc, marginBottom: 10, opacity: p(f, 0, 6) }}>{tag}</div> : null}
      <div style={{ fontSize: 66, fontWeight: 900, color: D.ink, lineHeight: 1.1, letterSpacing: -1, opacity: p(f, 1, 6), transform: `translateY(${(1 - p(f, 1, 8)) * 16}px)` }}>
        {parts.map((t, i) => t.startsWith("[[")
          ? <span key={i} style={{ position: "relative", display: "inline-block", whiteSpace: "nowrap" }}>
              <span style={{ position: "absolute", left: -6, right: -6, bottom: 4, height: "42%", background: D.hi, transformOrigin: "left", transform: `scaleX(${ease(p(f, 8, 12))})`, zIndex: 0 }} />
              <span style={{ position: "relative" }}>{t.slice(2, -2)}</span>
            </span>
          : <span key={i}>{t}</span>)}
      </div>
    </div>
  );
};

/** Cửa sổ app: thanh tiêu đề + biểu tượng màu, mở ra bằng cách phóng từ nhỏ (outBack). */
const Win: React.FC<{ x: number; y: number; w: number; h: number; title: string; icon?: string; color?: string; at?: number; active?: boolean;
  children?: React.ReactNode; bodyStyle?: React.CSSProperties }> = ({ x, y, w, h, title, icon = "▤", color = D.acc, at = 0, active = true, children, bodyStyle }) => {
  const f = useCurrentFrame();
  const q = p(f, at, 10);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, borderRadius: 18, background: D.win, overflow: "hidden",
      boxShadow: active ? "0 30px 60px rgba(15,23,42,0.28), 0 0 0 1px rgba(15,23,42,0.08)" : "0 14px 30px rgba(15,23,42,0.16), 0 0 0 1px rgba(15,23,42,0.06)",
      opacity: clamp01(q * 1.5), transform: `scale(${0.82 + 0.18 * outBack(q)})`, transformOrigin: "50% 80%" }}>
      <div style={{ height: 56, background: D.chrome, borderBottom: `1px solid ${D.line}`, display: "flex", alignItems: "center", padding: "0 18px", gap: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: color, color: "#fff", fontSize: 18, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: D.ink, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        <div style={{ display: "flex", gap: 22, color: D.muted, fontSize: 22 }}><span>—</span><span>▢</span><span>✕</span></div>
      </div>
      <div style={{ position: "absolute", top: 56, left: 0, right: 0, bottom: 0, ...bodyStyle }}>{children}</div>
    </div>
  );
};

/** Nền desktop: gradient + quầng sáng + taskbar dưới đáy. */
const Desk: React.FC<{ children: React.ReactNode; cam?: string; h?: number }> = ({ children, cam, h = 1150 - DESK_Y }) => (
  <div style={{ position: "absolute", left: 0, top: DESK_Y, width: W, height: h, borderRadius: 26, overflow: "hidden",
    background: `radial-gradient(120% 80% at 80% 0%, ${D.wallGlow}, transparent 60%), linear-gradient(160deg, ${D.wall1}, ${D.wall2})`,
    boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.6), 0 20px 50px rgba(15,23,42,0.18)" }}>
    <div style={{ position: "absolute", inset: 0, transform: cam, transformOrigin: "0 0" }}>{children}</div>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 62, background: "rgba(255,255,255,0.72)", backdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
      {["#2563EB", "#16A34A", "#7C5CFF", "#F59E0B", "#0EA5E9"].map((c, i) => <div key={i} style={{ width: 34, height: 34, borderRadius: 9, background: c, opacity: 0.85 }} />)}
    </div>
  </div>
);

/** Chữ gõ dần + con nháy. */
const Typed: React.FC<{ text: string; a: number; b: number; caret?: boolean; style?: React.CSSProperties }> = ({ text, a, b, caret = true, style }) => {
  const f = useCurrentFrame();
  const n = Math.floor(clamp01((f - a) / Math.max(1, b - a)) * text.length);
  const typing = f >= a && f <= b + 20;
  return <span style={style}>{text.slice(0, n)}{caret && typing ? <span style={{ opacity: f % 16 < 8 ? 1 : 0, color: D.acc }}>▍</span> : null}</span>;
};

const Toast: React.FC<{ at: number; text: string; sub?: string; y: number; color?: string }> = ({ at, text, sub, y, color = D.ok }) => {
  const f = useCurrentFrame();
  const q = outBack(p(f, at, 12));
  return (
    <div style={{ position: "absolute", right: 24, top: y, width: 560, background: "#fff", borderRadius: 16, padding: "18px 22px", display: "flex", gap: 16, alignItems: "center",
      boxShadow: "0 18px 40px rgba(15,23,42,0.25)", transform: `translateX(${(1 - q) * 620}px)`, opacity: clamp01(q * 2) }}>
      <div style={{ width: 46, height: 46, borderRadius: 23, background: color, color: "#fff", fontSize: 26, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</div>
      <div><div style={{ fontSize: 28, fontWeight: 800, color: D.ink }}>{text}</div>{sub ? <div style={{ fontSize: 21, color: D.muted, marginTop: 2 }}>{sub}</div> : null}</div>
    </div>
  );
};

const fileColor = (name: string) => /\.xlsx|excel|list|case|devops|timeline|benefit/i.test(name) ? "#16A34A" : /\.pdf|cr/i.test(name) ? "#DC2626" : /\.docx|biên|word/i.test(name) ? "#2563EB" : "#7C5CFF";
const FileIcon: React.FC<{ name: string; size?: number }> = ({ name, size = 44 }) => (
  <div style={{ width: size, height: size * 1.2, borderRadius: 6, background: fileColor(name), position: "relative", flexShrink: 0, boxShadow: "0 3px 6px rgba(0,0,0,0.15)" }}>
    <div style={{ position: "absolute", right: 0, top: 0, width: size * 0.35, height: size * 0.35, background: "rgba(255,255,255,0.55)", borderBottomLeftRadius: 6 }} />
  </div>
);

// ── BÌA: desktop, cửa sổ ghi chú gõ tiêu đề, con trỏ bấm nút hook (tự vẽ cả khung 1080×1920) ─────────────────────
export const SCover: React.FC<SP> = ({ sc, script }) => {
  const f = useCurrentFrame();
  const files = (sc.files as string[]) ?? [];
  const keys: Key[] = [{ f: 0, x: 980, y: 1700 }, { f: 30, x: 560, y: 1040, click: true }, { f: 60, x: 620, y: 1080 }];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: `radial-gradient(90% 60% at 85% 10%, ${D.wallGlow}, transparent 60%), linear-gradient(165deg, ${D.wall1}, ${D.wall2})` }}>
      <div style={{ position: "absolute", top: 80, left: 70, right: 70, display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 24, letterSpacing: 2, color: D.muted }}>
        <span>{script.series}</span><span style={{ color: D.acc }}>{String(sc.tag ?? "")}</span>
      </div>
      {/* biểu tượng file trên desktop */}
      <div style={{ position: "absolute", left: 70, top: 200, display: "grid", gridTemplateColumns: "repeat(4, 220px)", gap: 24 }}>
        {files.map((n, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: p(f, 2 + i * 2, 6), transform: `translateY(${(1 - p(f, 2 + i * 2, 8)) * 20}px)` }}>
            <FileIcon name={n} size={64} /><div style={{ fontSize: 22, fontWeight: 700, color: D.ink, textAlign: "center" }}>{n}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 640 }}>
        <Win x={0} y={0} w={960} h={560} title="Ghi chú · việc của team" icon="✎" color={D.ai} at={4}>
          <div style={{ padding: "40px 46px" }}>
            <div style={{ fontSize: 92, fontWeight: 900, color: D.ink, lineHeight: 1.05, letterSpacing: -2 }}><Typed text={String(sc.line1)} a={8} b={22} caret={false} /></div>
            <div style={{ fontSize: 92, fontWeight: 900, color: D.acc, lineHeight: 1.1, letterSpacing: -2 }}><Typed text={String(sc.line2)} a={22} b={36} /></div>
            <div style={{ marginTop: 34, display: "inline-block", fontSize: 38, fontWeight: 800, background: D.hi, color: D.ink, padding: "12px 26px", borderRadius: 14,
              transform: `scale(${0.8 + 0.2 * outBack(p(f, 30, 10))})`, opacity: p(f, 30, 6) }}>{String(sc.hook)}</div>
          </div>
        </Win>
      </div>
      <div style={{ position: "absolute", bottom: 80, left: 70, right: 70, display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 24, color: D.muted }}>
        <span>AI SHARING TIPS CHALLENGE 2026</span><span style={{ color: D.ink }}>{script.author}</span>
      </div>
      <Cursor keys={keys} />
    </div>
  );
};

// ── VẤN ĐỀ: cửa sổ Excel, con trỏ bấm qua từng tab file (lặp), đồng hồ chạy nhanh, bộ đếm ×n ─────────────────────
export const SProblem: React.FC<SP> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  const files = (sc.files as string[]) ?? [];
  const n = files.length || 1;
  const step = Math.max(8, Math.floor((dur * 0.62) / n));
  const cur = Math.min(n - 1, Math.max(0, Math.floor((f - 10) / step)));
  const tabW = 900 / n;
  const keys: Key[] = files.map((_, i) => ({ f: 10 + i * step, x: 50 + tabW * i + tabW / 2, y: 690, click: true }));
  // đồng hồ: mặc định giờ → ngày (bộ tài liệu dự án); `clockTo` + `clockUnit` (VD 15, "phút") cho việc ngắn hơn
  const clockTo = Number(sc.clockTo ?? 20);
  const hours = Math.round(interpolate(f, [10, 10 + n * step], [0, clockTo], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const clockText = sc.clockUnit ? `${hours} ${String(sc.clockUnit)}` : hours < 8 ? `${hours} giờ` : `${Math.max(1, Math.round(hours / 8))} ngày`;
  const counter = String(sc.counter ?? "file");
  return (
    <div style={{ position: "relative", width: W, height: 1150, margin: "0 auto" }}>
      <Head text={String(sc.heading)} tag={String(sc.tag ?? "01 · LÀM TAY")} />
      <Desk>
        <Win x={30} y={40} w={940} h={700} title={sc.winTitle ? String(sc.winTitle) : `${files[cur] ?? ""} — làm tay`} icon="X" color="#16A34A" at={0}>
          <div style={{ position: "absolute", inset: "0 0 64px 0", display: "grid", gridTemplateColumns: "60px repeat(5, 1fr)" }}>
            {Array.from({ length: 6 * 9 }, (_, i) => {
              const r = Math.floor(i / 6), c = i % 6;
              const filled = c > 0 && r > 0 && (r * 5 + c) < ((f - 10) % step) * 2.4;
              return <div key={i} style={{ borderRight: `1px solid ${D.line}`, borderBottom: `1px solid ${D.line}`, background: r === 0 || c === 0 ? D.chrome : "#fff",
                fontSize: 18, color: D.muted, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {r === 0 && c > 0 ? "ABCDE"[c - 1] : c === 0 && r > 0 ? r : filled ? <div style={{ width: "70%", height: 10, borderRadius: 5, background: "#CBD5E1" }} /> : null}
              </div>;
            })}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 64, background: D.chrome, borderTop: `1px solid ${D.line}`, display: "flex" }}>
            {files.map((t, i) => (
              <div key={i} style={{ width: tabW, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, textAlign: "center", lineHeight: 1.1,
                color: i === cur ? D.ok : D.muted, background: i === cur ? "#fff" : "transparent", borderTop: i === cur ? `4px solid ${D.ok}` : "4px solid transparent" }}>{t}</div>
            ))}
          </div>
        </Win>
        {/* đồng hồ + bộ đếm */}
        <div style={{ position: "absolute", left: 30, top: 770, display: "flex", gap: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "14px 22px", fontSize: 30, fontWeight: 800, color: D.bad, boxShadow: "0 10px 24px rgba(15,23,42,0.15)" }}>
            ⏱ {clockText}
          </div>
          <div style={{ background: D.ink, color: D.hi, borderRadius: 16, padding: "14px 22px", fontSize: 30, fontWeight: 900 }}>× {cur + 1} {counter}</div>
        </div>
        <div style={{ position: "absolute", left: 30, right: 30, top: 850, fontSize: 28, fontWeight: 700, color: D.ink, opacity: p(f, dur * 0.7, 8) }}>{String(sc.sub ?? "")}</div>
        <Cursor keys={keys} />
      </Desk>
    </div>
  );
};

// ── KÉO THẢ: cửa sổ thư mục bên trên, cửa sổ AI (Project) bên dưới; con trỏ kéo từng file xuống, hiện chip đính kèm ─────
export const SDrop: React.FC<SP> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  const files = (sc.files as string[]) ?? [];
  const n = files.length;
  const per = Math.max(14, Math.floor((dur * 0.7) / Math.max(1, n)));
  const rowY = (i: number) => 40 + 56 + 24 + i * 64 + 22;   // giữa dòng file trong cửa sổ thư mục
  const keys: Key[] = [{ f: 0, x: 900, y: 860 }];
  files.forEach((_, i) => {
    const a = 8 + i * per;
    keys.push({ f: a, x: 200, y: rowY(i), click: true }, { f: a + per * 0.7, x: 300 + (i % 3) * 200, y: 740, drag: true }, { f: a + per * 0.85, x: 300 + (i % 3) * 200, y: 740 });
  });
  const dropped = (i: number) => f >= 8 + i * per + per * 0.7;
  const drag = files.findIndex((_, i) => f >= 8 + i * per && f < 8 + i * per + per * 0.7);
  const c = cursorAt(f, keys);
  return (
    <div style={{ position: "relative", width: W, height: 1150, margin: "0 auto" }}>
      <Head text={String(sc.heading)} tag={String(sc.tag ?? "02 · LÀM 1 LẦN")} />
      <Desk>
        <Win x={30} y={40} w={620} h={120 + n * 64} title={String(sc.folder ?? "Thư mục dự án")} icon="📁" color="#F59E0B" at={0} active={false}>
          <div style={{ padding: "16px 22px" }}>
            {files.map((t, i) => (
              <div key={i} style={{ height: 64, display: "flex", alignItems: "center", gap: 16, fontSize: 25, fontWeight: 600, color: D.ink,
                background: drag === i ? D.accSoft : "transparent", borderRadius: 10, padding: "0 10px", opacity: dropped(i) ? 0.45 : 1 }}>
                <FileIcon name={t} size={34} />{t}
              </div>
            ))}
          </div>
        </Win>
        <Win x={60} y={470} w={910} h={430} title={String(sc.app ?? "Project · Tài liệu dự án")} icon="✦" color={D.ai} at={4}>
          <div style={{ padding: "22px 26px" }}>
            <div style={{ fontSize: 22, color: D.muted, marginBottom: 14 }}>{String(sc.hint ?? "Kéo file vào đây — AI đọc mỗi lần làm việc")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, minHeight: 160, border: `3px dashed ${drag >= 0 ? D.ai : D.line}`, borderRadius: 16, padding: 16, background: drag >= 0 ? D.aiSoft : "#FAFBFF" }}>
              {files.map((t, i) => dropped(i) ? (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `2px solid ${D.line}`, borderRadius: 12, padding: "10px 16px", fontSize: 22, fontWeight: 700,
                  transform: `scale(${0.7 + 0.3 * outBack(p(f, 8 + i * per + per * 0.7, 10))})` }}><FileIcon name={t} size={24} />{t}</div>
              ) : null)}
            </div>
            {sc.note ? <div style={{ marginTop: 18, fontSize: 24, fontWeight: 700, color: D.ai, opacity: p(f, dur * 0.8, 8) }}>{String(sc.note)}</div> : null}
          </div>
        </Win>
        {drag >= 0 ? (
          <div style={{ position: "absolute", left: c.x + 18, top: c.y + 20, display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 10, padding: "8px 14px",
            fontSize: 21, fontWeight: 700, boxShadow: "0 12px 26px rgba(15,23,42,0.3)", transform: "rotate(-4deg)", zIndex: 40 }}><FileIcon name={files[drag]} size={22} />{files[drag]}</div>
        ) : null}
        <Cursor keys={keys} />
      </Desk>
    </div>
  );
};

// ── CHECKLIST: cửa sổ việc cần làm, con trỏ tích từng bước theo nhịp lời đọc ─────────────────────────────────────
export const SSteps: React.FC<SP> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  const steps = (sc.steps as { t: string; d: string }[]) ?? [];
  const per = (dur * 0.86) / Math.max(1, steps.length);
  const rowY = (i: number) => 40 + 56 + 30 + i * 160;
  const keys: Key[] = [{ f: 0, x: 880, y: 860 }, ...steps.map((_, i) => ({ f: 6 + i * per + per * 0.55, x: 110, y: rowY(i) + 46, click: true }))];
  return (
    <div style={{ position: "relative", width: W, height: 1150, margin: "0 auto" }}>
      <Head text={String(sc.heading)} tag={String(sc.tag ?? "QUY TRÌNH")} />
      <Desk>
        <Win x={30} y={40} w={940} h={140 + steps.length * 160} title={String(sc.app ?? "Việc cần làm")} icon="✓" color={D.ok} at={0}>
          <div style={{ padding: "30px 34px" }}>
            {steps.map((s, i) => {
              const done = f >= 6 + i * per + per * 0.55;
              const on = f >= 6 + i * per && !done;
              return (
                <div key={i} style={{ height: 140, marginBottom: 20, display: "flex", alignItems: "center", gap: 28, borderRadius: 18, padding: "0 26px",
                  background: on ? D.accSoft : done ? D.okSoft : "#F8FAFC", outline: on ? `4px solid ${D.acc}` : "none", opacity: f >= i * per * 0.4 ? 1 : 0.4 }}>
                  <div style={{ width: 58, height: 58, borderRadius: 14, border: `4px solid ${done ? D.ok : "#94A3B8"}`, background: done ? D.ok : "#fff", color: "#fff", fontSize: 38,
                    fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${done ? 0.9 + 0.1 * outBack(p(f, 6 + i * per + per * 0.55, 8)) : 1})` }}>{done ? "✓" : ""}</div>
                  <div>
                    <div style={{ fontSize: 40, fontWeight: 900, color: D.ink, lineHeight: 1.15, textDecoration: done ? "none" : "none" }}>{s.t}</div>
                    <div style={{ fontFamily: MONO, fontSize: 24, color: D.muted, marginTop: 6 }}>{s.d}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Win>
        <Cursor keys={keys} />
      </Desk>
    </div>
  );
};

// ── CÂU LỆNH: cửa sổ AI, con trỏ bấm ô nhập, gõ từng dòng, Enter → AI trả lời; camera zoom vào ô nhập rồi lùi ra ─────
export const SPrompt: React.FC<SP> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  const lines = (sc.lines as string[]) ?? [];
  const hot = new Set((sc.hot as number[]) ?? []);
  const total = lines.join("\n").length;
  const typeA = 14, typeB = Math.max(typeA + 20, dur * 0.62);
  const sent = f >= typeB + 6;
  let acc = 0;
  const deskH = 1150 - DESK_Y;
  const cam = camAt(f, [{ f: 0, cx: 500, cy: 380, z: 1 }, { f: 12, cx: 500, cy: 470, z: 1.06 }, { f: typeB, cx: 500, cy: 470, z: 1.06 }, { f: typeB + 14, cx: 500, cy: 380, z: 1 }], W, deskH);
  const keys: Key[] = [{ f: 0, x: 860, y: 840 }, { f: 12, x: 300, y: 520, click: true }, { f: typeB + 4, x: 900, y: 660, click: true }];
  return (
    <div style={{ position: "relative", width: W, height: 1150, margin: "0 auto" }}>
      <Head text={String(sc.heading)} tag={String(sc.tag ?? "CÂU LỆNH MẪU")} />
      <Desk cam={cam}>
        <Win x={30} y={40} w={940} h={680} title={String(sc.app ?? "Trợ lý AI · Project")} icon="✦" color={D.ai} at={0}>
          <div style={{ padding: "22px 28px" }}>
            {sc.hint ? <div style={{ fontSize: 22, color: D.muted }}>{String(sc.hint)}</div> : null}
            {sent ? (
              <div style={{ marginTop: 18, display: "flex", gap: 14, opacity: p(f, typeB + 10, 8) }}>
                <div style={{ width: 46, height: 46, borderRadius: 23, background: D.ai, color: "#fff", fontWeight: 900, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✦</div>
                <div style={{ background: D.aiSoft, borderRadius: 18, padding: "16px 20px", fontSize: 27, fontWeight: 600, color: D.ink, lineHeight: 1.35 }}>
                  <Typed text={String(sc.reply ?? "Đã hiểu. Gửi tài liệu để tôi bắt đầu.")} a={typeB + 12} b={typeB + 40} />
                </div>
              </div>
            ) : null}
          </div>
          <div style={{ position: "absolute", left: 24, right: 24, bottom: 24, minHeight: 300, border: `3px solid ${f >= 12 ? D.ai : D.line}`, borderRadius: 18, padding: "18px 22px",
            background: sent ? "#F8FAFC" : "#fff", opacity: sent ? 0.55 : 1 }}>
            {lines.map((ln, i) => {
              const a = typeA + ((typeB - typeA) * acc) / Math.max(1, total);
              acc += ln.length + 1;
              const b = typeA + ((typeB - typeA) * acc) / Math.max(1, total);
              return (
                <div key={i} style={{ fontFamily: MONO, fontSize: 28, lineHeight: 1.5, color: hot.has(i) ? D.ink : "#334155", whiteSpace: "pre-wrap",
                  background: hot.has(i) && f > b ? "rgba(255,212,59,0.55)" : "transparent", borderRadius: 6 }}>
                  <Typed text={ln} a={a} b={b} caret={f >= a && f < b} />
                </div>
              );
            })}
            <div style={{ position: "absolute", right: 16, bottom: 14, width: 56, height: 56, borderRadius: 28, background: sent ? D.ok : D.ai, color: "#fff", fontSize: 28, fontWeight: 900,
              display: "flex", alignItems: "center", justifyContent: "center" }}>{sent ? "✓" : "↑"}</div>
          </div>
        </Win>
        <Cursor keys={keys} />
      </Desk>
      {sc.note ? <div style={{ position: "absolute", left: 0, right: 0, top: 1150 - 6, fontFamily: MONO, fontSize: 26, color: D.acc, opacity: p(f, dur * 0.75, 8) }}>{String(sc.note)}</div> : null}
    </div>
  );
};

// ── ẢNH CHỤP THẬT: cửa sổ app chứa ảnh, con trỏ đi tới vùng focus, bấm, camera zoom theo, khung sáng + nhãn ─────────
export const SShot: React.FC<SP> = ({ sc, script, dur }) => {
  const f = useCurrentFrame();
  const ar = Number(sc.ar ?? 1.5);
  const [fx, fy, fw, fh] = (sc.focus as number[]) ?? [0, 0, 100, 100];
  const winW = 940, imgW = winW, imgH = Math.min(760, Math.round(imgW / ar));
  const winH = imgH + 56;
  const wx = 30, wy = 40;
  // vùng focus theo toạ độ desktop
  const bx = wx + (fx / 100) * imgW, by = wy + 56 + (fy / 100) * imgH, bw = (fw / 100) * imgW, bh = (fh / 100) * imgH;
  const zMax = Math.max(1, Math.min(2.2, 900 / Math.max(bw, bh * 1.3, 1)));
  const deskH = 1150 - DESK_Y;
  const t1 = dur * 0.22, t2 = dur * 0.42;
  const cam = camAt(f, [{ f: 0, cx: W / 2, cy: deskH / 2, z: 1 }, { f: t1, cx: W / 2, cy: deskH / 2, z: 1 }, { f: t2, cx: bx + bw / 2, cy: by + bh / 2, z: zMax }], W, deskH);
  const keys: Key[] = [{ f: 0, x: 880, y: 880 }, { f: t1 - 2, x: bx + bw * 0.5, y: by + bh * 0.5, click: true }, { f: dur, x: bx + bw * 0.62, y: by + bh * 0.6 }];
  const hl = p(f, t2, 8);
  return (
    <div style={{ position: "relative", width: W, height: 1150, margin: "0 auto" }}>
      <Head text={String(sc.heading)} tag={String(sc.tag ?? "ẢNH CHỤP THẬT")} />
      <Desk cam={cam}>
        <Win x={wx} y={wy} w={winW} h={winH} title={String(sc.window ?? "")} icon={String(sc.icon ?? "X")} color={String(sc.color ?? "#16A34A")} at={0}>
          <Img src={staticFile(`${script.id}/${String(sc.src)}`)} style={{ width: imgW, height: imgH, objectFit: "fill", display: "block" }} />
        </Win>
        <div style={{ position: "absolute", left: bx, top: by, width: bw, height: bh, border: `${5 / zMax}px solid ${D.acc}`, borderRadius: 8 / zMax, opacity: hl,
          boxShadow: `0 0 0 4000px rgba(15,23,42,${0.38 * hl})` }} />
        <Cursor keys={keys} />
      </Desk>
      {sc.caption ? <div style={{ position: "absolute", left: 0, right: 0, top: 1150 - 6, fontSize: 36, fontWeight: 800, color: D.ink, opacity: p(f, dur * 0.55, 8) }}>
        <span style={{ background: D.hi, padding: "4px 14px", borderRadius: 8 }}>{String(sc.caption)}</span></div> : null}
    </div>
  );
};

// ── TRƯỚC / SAU: 2 cửa sổ báo cáo cạnh nhau, số đếm lên, gạch số cũ; con trỏ chỉ sang cột "Sau" ─────────────────────
export const SCompare: React.FC<SP> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  const rows = (sc.rows as string[][]) ?? [];
  const per = (dur * 0.6) / Math.max(1, rows.length);
  const keys: Key[] = [{ f: 0, x: 880, y: 880 }, ...rows.map((_, i) => ({ f: 10 + i * per + per * 0.6, x: 760, y: 40 + 56 + 120 + i * 150 + 40 }))];
  const col = (title: string, color: string, soft: string, x: number, idx: number, at: number) => (
    <Win x={x} y={40} w={455} h={140 + rows.length * 150} title={title} icon={idx === 1 ? "✗" : "✓"} color={color} at={at}>
      <div style={{ padding: "24px 26px" }}>
        {rows.map((r, i) => {
          const on = f >= 10 + i * per;
          return (
            <div key={i} style={{ height: 130, marginBottom: 20, borderRadius: 16, background: on ? soft : "#F8FAFC", padding: "16px 20px", opacity: on ? 1 : 0.35 }}>
              <div style={{ fontFamily: MONO, fontSize: 20, color: D.muted, letterSpacing: 1 }}>{r[0]}</div>
              <div style={{ fontSize: 44, fontWeight: 900, color, marginTop: 8, textDecoration: idx === 1 && f >= 10 + i * per + per * 0.6 ? "line-through" : "none",
                transform: idx === 2 && on ? `scale(${0.85 + 0.15 * outBack(p(f, 10 + i * per + per * 0.5, 10))})` : "none", transformOrigin: "left" }}>{r[idx]}</div>
            </div>
          );
        })}
      </div>
    </Win>
  );
  return (
    <div style={{ position: "relative", width: W, height: 1150, margin: "0 auto" }}>
      <Head text={String(sc.heading)} tag="KẾT QUẢ" />
      <Desk>
        {col(String(sc.colA ?? "TRƯỚC"), D.bad, D.badSoft, 30, 1, 0)}
        {col(String(sc.colB ?? "SAU"), D.ok, D.okSoft, 515, 2, 6)}
        <Cursor keys={keys} />
      </Desk>
    </div>
  );
};

// ── KẾT: desktop, thông báo trượt vào lần lượt, các app AI trên taskbar sáng lên, con trỏ bấm nút CTA ─────────────
export const SOutro: React.FC<SP> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  const tools = (sc.tools as string[]) ?? [];
  const keys: Key[] = [{ f: 0, x: 880, y: 860 }, { f: dur * 0.7, x: 260, y: 690, click: true }];
  const parts = String(sc.line).split(/(\[\[.*?\]\])/);
  return (
    <div style={{ position: "relative", width: W, height: 1150, margin: "0 auto" }}>
      <Desk>
        <div style={{ position: "absolute", left: 50, top: 90, right: 50, fontSize: 84, fontWeight: 900, color: D.ink, lineHeight: 1.08, letterSpacing: -2 }}>
          {parts.map((t, i) => t.startsWith("[[") ? <span key={i} style={{ color: D.acc }}>{t.slice(2, -2)}</span> : <span key={i}>{t}</span>)}
        </div>
        <Toast at={10} y={430} text={String(sc.echo ?? "")} sub={String(sc.echoNote ?? "")} />
        <div style={{ position: "absolute", left: 50, top: 560, display: "flex", gap: 14, flexWrap: "wrap" }}>
          {tools.map((t, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "10px 20px", fontSize: 26, fontWeight: 700, color: D.ink, boxShadow: "0 8px 18px rgba(15,23,42,0.14)",
              opacity: p(f, 18 + i * 4, 6), transform: `translateY(${(1 - p(f, 18 + i * 4, 8)) * 20}px)` }}>{t}</div>
          ))}
        </div>
        <div style={{ position: "absolute", left: 50, top: 600 + 40, background: D.acc, color: "#fff", borderRadius: 18, padding: "20px 34px", fontSize: 38, fontWeight: 900,
          boxShadow: "0 16px 30px rgba(37,99,235,0.4)", opacity: p(f, 30, 8), transform: `scale(${f >= dur * 0.7 && f < dur * 0.7 + 5 ? 0.94 : 1})` }}>{String(sc.cta ?? "")} ↓</div>
        <Cursor keys={keys} />
      </Desk>
    </div>
  );
};

export const DESK_SCENES: Record<string, React.FC<SP>> = {
  "s-cover": SCover, "s-problem": SProblem, "s-drop": SDrop, "s-steps": SSteps, "s-prompt": SPrompt, "s-shot": SShot, "s-compare": SCompare, "s-outro": SOutro,
};
