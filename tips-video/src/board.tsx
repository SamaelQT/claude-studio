/**
 * Tuần 4 (11–17/11/2026) — phong cách "Bảng trắng viết tay" (Quang chốt 10/11/2026).
 * Ngữ pháp phỏng theo LemoLab lemo-opuscar `styles/whiteboard/STYLE.md` (CC BY 4.0, https://github.com/lemomo-ai/lemo-opuscar)
 * + nguyên tắc ở skill `lam-video-bang-code/references/{phong-cach-tuan4,nguyen-tac-dung-video-code}.md`:
 *  - MỘT tấm bảng lớn là bản đồ: mỗi cảnh = 1 vùng trên bảng, máy quay đi qua bảng thay vì cắt cảnh; cuối clip lùi ra thấy cả bảng.
 *  - Nét và chữ vẽ dần ĐÚNG LÚC lời đọc tới (cue = cụm chữ trong lời đọc của cảnh).
 *  - 3 màu mực, mỗi màu 1 nghĩa: INK = sự vật / chữ thường; BLUE = quy trình, mũi tên; RED = "chỗ AI làm / con số chốt".
 *  - Bút lông nổi, không vẽ bàn tay; không fade-in chung chung, không gradient tiêu đề, không glow.
 */
import React from "react";
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Props, Scene, SceneTiming, Script } from "./types";

export const B = {
  board: "#FBFAF5",
  ink: "#1E2A36",
  blue: "#1F5FBF",
  red: "#E0482D",
  hl: "#FFD43B",
  muted: "#6B7682",
  paper: "#FFFFFF",
  tape: "rgba(244, 214, 120, 0.78)",
};
const HAND = `"Segoe Print", "Segoe Script", "Comic Sans MS", cursive`;
const PRINT = `"Segoe UI", "Segoe UI Variable", Arial, sans-serif`;
const EASE = Easing.bezier(0.65, 0, 0.35, 1);
const OUT = Easing.bezier(0.33, 1, 0.68, 1);

// ── Bố cục bảng: vùng i nằm theo lưới 2 cột, máy quay đặt vùng vào khung nhìn [VX, VY] ──
const RW = 1000, RH = 1260, GX = 1180, GY = 1400, VX = 40, VY = 320;
const ZOOM = 1.03; // phóng nhẹ cho chữ to, dễ đọc trên điện thoại
const regionXY = (i: number) => ({ x: (i % 2) * GX + 90, y: Math.floor(i / 2) * GY + 90 });

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const lerp = (f: number, a: number, b: number, from = 0, to = 1, ease = EASE) => interpolate(f, [a, Math.max(a + 1, b)], [from, to], { ...clamp, easing: ease });

// ── Hẹn giờ theo lời: cue là một cụm chữ trong lời đọc của cảnh → khung (tính từ đầu cảnh) ──
const norm = (s: string) => s.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
export type Clock = { at: (cue?: string, k?: number) => number; fps: number; dur: number };
function makeClock(tm: SceneTiming | undefined, fps: number, dur: number): Clock {
  const t0 = tm?.start ?? 0;
  const caus = tm?.caus ?? [];
  const at = (cue?: string, k = 0): number => {
    if (cue) {
      const c = norm(cue);
      for (const cau of caus) {
        const words = norm(cau.text).split(" ");
        const cw = c.split(" ");
        for (let i = 0; i + cw.length <= words.length; i++) {
          if (cw.every((w, j) => words[i + j] === w)) {
            const ws = (cau as { words?: { start: number }[] }).words ?? [];
            const sec = ws.length ? ws[Math.min(ws.length - 1, Math.round((i / words.length) * ws.length))].start : cau.start + ((cau.end - cau.start) * i) / words.length;
            return Math.max(0, Math.round((sec - t0) * fps) - 2); // hình đi trước tiếng 2 khung
          }
        }
      }
    }
    if (!caus.length) return Math.round(6 + k * 8);
    const cau = caus[Math.min(k, caus.length - 1)];
    return Math.max(0, Math.round((cau.start - t0) * fps));
  };
  return { at, fps, dur };
}

// ── Nét tay: đường lượn có rung, vẽ dần bằng pathLength ──
function wobble(pts: [number, number][], seed: string, amp = 3): string {
  let d = "";
  pts.forEach(([x, y], i) => {
    const jx = (random(`${seed}x${i}`) - 0.5) * amp, jy = (random(`${seed}y${i}`) - 0.5) * amp;
    d += i === 0 ? `M ${x + jx} ${y + jy}` : ` L ${x + jx} ${y + jy}`;
  });
  return d;
}
const lineP = (x1: number, y1: number, x2: number, y2: number, n = 8): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => [x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n]);
/** Vòng khoanh tay: bắt đầu lệch, đi quá 1 chút, không khép kín. */
const ellipseP = (cx: number, cy: number, rx: number, ry: number, seed: string): [number, number][] => {
  const a0 = -2.2 + random(seed) * 0.6;
  return Array.from({ length: 41 }, (_, i) => {
    const a = a0 + (i / 40) * Math.PI * 2.18;
    const r = 1 + (random(`${seed}r${i}`) - 0.5) * 0.06 + i * 0.0012;
    return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r];
  });
};
const rectP = (x: number, y: number, w: number, h: number): [number, number][] => [
  ...lineP(x, y, x + w, y, 6), ...lineP(x + w, y, x + w, y + h, 4).slice(1), ...lineP(x + w, y + h, x, y + h, 6).slice(1), ...lineP(x, y + h, x + 4, y - 3, 4).slice(1),
];

const Stroke: React.FC<{ pts: [number, number][]; seed: string; color?: string; w?: number; from: number; len?: number; amp?: number }> = ({ pts, seed, color = B.ink, w = 7, from, len = 14, amp = 3 }) => {
  const f = useCurrentFrame();
  const p = lerp(f, from, from + len);
  if (p <= 0) return null;
  return <path d={wobble(pts, seed, amp)} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={{ mixBlendMode: "multiply", opacity: 0.94 }} />;
};

/** Mũi tên tay từ (x1,y1) tới (x2,y2). */
const Arrow: React.FC<{ x1: number; y1: number; x2: number; y2: number; seed: string; color?: string; from: number; w?: number }> = ({ x1, y1, x2, y2, seed, color = B.blue, from, w = 7 }) => {
  const a = Math.atan2(y2 - y1, x2 - x1), L = 26;
  const h1: [number, number] = [x2 - L * Math.cos(a - 0.5), y2 - L * Math.sin(a - 0.5)];
  const h2: [number, number] = [x2 - L * Math.cos(a + 0.5), y2 - L * Math.sin(a + 0.5)];
  return (
    <>
      <Stroke pts={lineP(x1, y1, x2, y2, 10)} seed={seed} color={color} w={w} from={from} len={12} />
      <Stroke pts={[h1, [x2, y2], h2]} seed={`${seed}h`} color={color} w={w} from={from + 11} len={5} amp={1.5} />
    </>
  );
};

/** Chữ viết tay hiện dần trái → phải đúng lúc lời tới; [[từ]] = từ khoá có bút dạ quang vàng quét sau. Bút lông nổi chạy theo mép chữ. */
const Hand: React.FC<{ text: string; from: number; size?: number; color?: string; weight?: number; font?: string; pen?: boolean; style?: React.CSSProperties }> = ({ text, from, size = 54, color = B.ink, weight = 700, font = HAND, pen = true, style }) => {
  const f = useCurrentFrame();
  const plain = text.replace(/\[\[|\]\]/g, "");
  const len = Math.min(48, Math.max(9, plain.length * 0.9));
  const p = lerp(f, from, from + len, 0, 1, Easing.bezier(0.45, 0.05, 0.55, 0.95));
  if (f < from) return null;
  const parts = text.split(/(\[\[.*?\]\])/g).filter(Boolean);
  const hlP = lerp(f, from + len, from + len + 5, 0, 1, OUT);
  return (
    <div style={{ position: "relative", display: "inline-block", ...style }}>
      <div style={{ fontFamily: font, fontSize: size, fontWeight: weight, color, lineHeight: 1.25, clipPath: `inset(-20% ${(1 - p) * 100}% -20% 0)`, mixBlendMode: "multiply" }}>
        {parts.map((s, i) =>
          s.startsWith("[[") ? (
            <span key={i} style={{ backgroundImage: `linear-gradient(${B.hl}, ${B.hl})`, backgroundRepeat: "no-repeat", backgroundSize: `${hlP * 100}% 62%`, backgroundPosition: "0 78%", padding: "0 4px" }}>{s.slice(2, -2)}</span>
          ) : (
            <span key={i}>{s}</span>
          ),
        )}
      </div>
      {pen && p > 0 && p < 1 ? <Pen x={`${p * 100}%`} y={size * 0.95} /> : null}
    </div>
  );
};

/** Bút lông nổi: đầu bút đặt tại (x,y) trong khung cha, có bóng đổ. */
const Pen: React.FC<{ x: string | number; y: number }> = ({ x, y }) => (
  <div style={{ position: "absolute", left: x, top: y - 150, width: 0, height: 0, pointerEvents: "none" }}>
    <svg width="90" height="170" viewBox="0 0 90 170" style={{ position: "absolute", left: -6, top: 0, overflow: "visible", filter: "drop-shadow(10px 18px 10px rgba(0,0,0,0.22))" }}>
      <g transform="rotate(28 10 150)">
        <rect x="-4" y="0" width="30" height="118" rx="7" fill="#2B3440" />
        <rect x="-4" y="18" width="30" height="22" fill={B.red} />
        <path d="M -2 118 L 24 118 L 15 146 L 7 146 Z" fill="#cfd5db" />
        <path d="M 7 146 L 15 146 L 11 156 Z" fill={B.ink} />
      </g>
    </svg>
  </div>
);

/** Số lăn tới đích (tabular-nums), tới đích thì đổi màu. */
const Roll: React.FC<{ to: number; from: number; dec?: number; prefix?: string; suffix?: string; size?: number; color?: string }> = ({ to, from, dec = 0, prefix = "", suffix = "", size = 120, color = B.red }) => {
  const f = useCurrentFrame();
  const p = lerp(f, from, from + 24, 0, 1, OUT);
  if (f < from) return null;
  const v = (to * p).toLocaleString("vi-VN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return <span style={{ fontFamily: PRINT, fontWeight: 900, fontSize: size, color: p >= 1 ? color : B.ink, fontVariantNumeric: "tabular-nums", letterSpacing: -2 }}>{prefix}{v}{suffix}</span>;
};

/** Ảnh chụp thật dán băng keo lên bảng; rơi xuống nhẹ khi xuất hiện. */
const Photo: React.FC<{ src: string; from: number; w: number; ar: number; rot?: number; children?: React.ReactNode }> = ({ src, from, w, ar, rot = -1.2, children }) => {
  const f = useCurrentFrame();
  if (f < from) return null;
  const p = lerp(f, from, from + 9, 0, 1, OUT);
  const h = w / ar;
  return (
    <div style={{ position: "relative", width: w, height: h, transform: `rotate(${rot}deg) scale(${1.06 - 0.06 * p})`, opacity: Math.min(1, p * 2) }}>
      <div style={{ position: "absolute", inset: -14, background: B.paper, boxShadow: `0 ${14 * p}px ${30 * p}px rgba(0,0,0,0.16)` }} />
      <Img src={src} style={{ position: "absolute", inset: 0, width: w, height: h, objectFit: "cover" }} />
      <div style={{ position: "absolute", left: -30, top: -26, width: 150, height: 44, background: B.tape, transform: "rotate(-24deg)" }} />
      <div style={{ position: "absolute", right: -30, top: -22, width: 150, height: 44, background: B.tape, transform: "rotate(22deg)" }} />
      {children}
    </div>
  );
};

type SP = { sc: Scene; script: Script; clock: Clock; i: number };
const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => <svg width={RW} height={RH} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>{children}</svg>;
const Tag: React.FC<{ text?: string; from: number; color?: string }> = ({ text, from, color = B.blue }) =>
  text ? <Hand text={text} from={from} size={34} color={color} font={PRINT} weight={800} pen={false} style={{ letterSpacing: 3 }} /> : null;

// ── Cảnh ──
const BTitle: React.FC<SP> = ({ sc, clock, i }) => {
  const l1 = String(sc.line1 ?? ""), l2 = String(sc.line2 ?? ""), hook = String(sc.hook ?? "");
  const t2 = 4 + Math.min(48, l1.length * 0.9) + 2;
  const tU = t2 + Math.min(48, l2.length * 0.9);
  return (
    <div style={{ position: "absolute", inset: 0, padding: "90px 40px" }}>
      <Tag text={String(sc.tag ?? "")} from={0} color={B.red} />
      <div style={{ marginTop: 60 }}><Hand text={l1} from={4} size={104} /></div>
      <div style={{ marginTop: 6 }}><Hand text={l2} from={t2} size={96} color={B.blue} /></div>
      <svg width="920" height="40" style={{ display: "block", overflow: "visible" }}><Stroke pts={lineP(10, 20, 880, 10, 12)} seed={`t${i}u`} color={B.red} w={10} from={tU} len={12} /></svg>
      <div style={{ marginTop: 70 }}><Hand text={hook} from={Math.max(tU + 8, clock.at(String(sc.hookCue ?? ""), 1))} size={62} color={B.ink} /></div>
      {Array.isArray(sc.chips) ? (
        <div style={{ marginTop: 50, display: "flex", flexWrap: "wrap", gap: 26 }}>
          {(sc.chips as string[]).map((c, k) => <Hand key={k} text={`• ${c}`} from={tU + 30 + k * 6} size={42} color={B.muted} font={PRINT} weight={700} pen={false} />)}
        </div>
      ) : null}
    </div>
  );
};

const BList: React.FC<SP> = ({ sc, clock, i }) => {
  const items = (sc.items as { t: string; cue?: string; mark?: "x" | "v" }[]) ?? [];
  const st = sc.stamp as { big: string; small?: string; cue?: string } | undefined;
  return (
    <div style={{ position: "absolute", inset: 0, padding: "40px 40px" }}>
      <Tag text={String(sc.tag ?? "")} from={0} />
      <div style={{ marginTop: 22 }}><Hand text={String(sc.heading ?? "")} from={3} size={70} /></div>
      <div style={{ marginTop: 50, display: "flex", flexDirection: "column", gap: 34 }}>
        {items.map((it, k) => {
          const at = clock.at(it.cue, k);
          return (
            <div key={k} style={{ position: "relative", paddingLeft: 92, minHeight: 70 }}>
              <svg width="80" height="80" style={{ position: "absolute", left: 0, top: 4, overflow: "visible" }}>
                {it.mark === "v" ? (
                  <Stroke pts={[[12, 40], [30, 60], [66, 14]]} seed={`l${i}${k}`} color={B.blue} w={9} from={at} len={8} amp={2} />
                ) : (
                  <>
                    <Stroke pts={lineP(14, 14, 62, 60, 4)} seed={`l${i}${k}a`} color={B.red} w={9} from={at} len={5} amp={2} />
                    <Stroke pts={lineP(62, 14, 14, 60, 4)} seed={`l${i}${k}b`} color={B.red} w={9} from={at + 4} len={5} amp={2} />
                  </>
                )}
              </svg>
              <Hand text={it.t} from={at + 4} size={52} />
            </div>
          );
        })}
      </div>
      {st ? <Stamp st={st} clock={clock} i={i} /> : null}
    </div>
  );
};
const Stamp: React.FC<{ st: { big: string; small?: string; cue?: string }; clock: Clock; i: number }> = ({ st, clock, i }) => {
  const at = clock.at(st.cue, 9);
  return (
    <div style={{ position: "absolute", left: 380, top: 900, width: 540, textAlign: "center", transform: "rotate(-4deg)" }}>
      <Hand text={st.big} from={at} size={st.big.length > 8 ? 70 : 92} color={B.red} pen={false} />
      {st.small ? <div><Hand text={st.small} from={at + 10} size={40} color={B.red} pen={false} /></div> : null}
      <Svg><Stroke pts={ellipseP(270, 95, 280, 115, `st${i}`)} seed={`st${i}`} color={B.red} w={8} from={at + 6} len={16} /></Svg>
    </div>
  );
};

const BFlow: React.FC<SP> = ({ sc, clock, i }) => {
  const steps = (sc.steps as { t: string; d?: string; ai?: boolean; cue?: string }[]) ?? [];
  const bw = 640, bh = 150, gap = (RH - 230 - steps.length * bh) / Math.max(1, steps.length - 1);
  return (
    <div style={{ position: "absolute", inset: 0, padding: "40px 40px" }}>
      <Tag text={String(sc.tag ?? "")} from={0} />
      <div style={{ marginTop: 22 }}><Hand text={String(sc.heading ?? "")} from={3} size={64} /></div>
      {steps.map((s, k) => {
        const x = k % 2 === 0 ? 40 : 320, y = 230 + k * (bh + gap);
        const at = clock.at(s.cue, k);
        const col = s.ai ? B.red : B.blue;
        const next = steps[k + 1];
        return (
          <React.Fragment key={k}>
            <Svg>
              <Stroke pts={rectP(x, y, bw, bh)} seed={`f${i}${k}`} color={col} w={7} from={at} len={14} />
              {next ? <Arrow x1={x + bw / 2} y1={y + bh + 8} x2={(k % 2 === 0 ? 320 : 40) + bw / 2} y2={y + bh + gap - 10} seed={`fa${i}${k}`} from={clock.at(next.cue, k + 1) - 10} /> : null}
            </Svg>
            <div style={{ position: "absolute", left: x + 34, top: y + 18, width: bw - 60 }}>
              <Hand text={s.t} from={at + 6} size={46} color={s.ai ? B.red : B.ink} />
              {s.d ? <div><Hand text={s.d} from={at + 14} size={32} color={B.muted} font={PRINT} weight={600} pen={false} /></div> : null}
            </div>
            {s.ai ? (
              <div style={{ position: "absolute", left: x + bw - 70, top: y - 34, transform: "rotate(8deg)" }}>
                <Hand text="AI" from={at + 10} size={52} color={B.red} pen={false} />
              </div>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const BPhoto: React.FC<SP> = ({ sc, script, clock, i }) => {
  const ar = Number(sc.ar ?? 1.6), w = Math.min(920, 700 * ar), h = w / ar;
  const [fx, fy, fw, fh] = (sc.focus as number[]) ?? [10, 10, 80, 30];
  const at = clock.at(String(sc.cue ?? ""), 1);
  const lab = clock.at(String(sc.labelCue ?? ""), 2);
  const top = Math.max(200, Math.min(330, 900 - h));
  const cx = ((fx + fw / 2) / 100) * w, cy = ((fy + fh / 2) / 100) * h;
  return (
    <div style={{ position: "absolute", inset: 0, padding: "40px 40px" }}>
      <Tag text={String(sc.tag ?? "")} from={0} />
      <div style={{ marginTop: 22 }}><Hand text={String(sc.heading ?? "")} from={3} size={62} /></div>
      <div style={{ position: "absolute", left: 40 + (920 - w) / 2, top }}>
        <Photo src={staticFile(`${script.id}/${String(sc.src)}`)} from={6} w={w} ar={ar}>
          <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <Stroke pts={ellipseP(cx, cy, (fw / 100) * w * 0.62, (fh / 100) * h * 0.72, `ph${i}`)} seed={`ph${i}`} color={B.red} w={9} from={at} len={18} />
          </svg>
        </Photo>
      </div>
      <div style={{ position: "absolute", left: 60, right: 40, top: top + h + 70 }}>
        <Svg><Arrow x1={460} y1={-8} x2={Math.min(880, Math.max(80, (920 - w) / 2 + cx - 20))} y2={-62} seed={`pa${i}`} color={B.red} from={lab} /></Svg>
        <Hand text={String(sc.label ?? "")} from={lab + 10} size={56} color={B.red} />
        {sc.note ? <div style={{ marginTop: 10 }}><Hand text={String(sc.note)} from={lab + 30} size={36} color={B.muted} font={PRINT} weight={600} pen={false} /></div> : null}
      </div>
    </div>
  );
};

const BNumbers: React.FC<SP> = ({ sc, clock, i }) => {
  const nums = (sc.nums as { v: number; dec?: number; pre?: string; suf?: string; label: string; cue?: string; star?: boolean }[]) ?? [];
  return (
    <div style={{ position: "absolute", inset: 0, padding: "40px 40px" }}>
      <Tag text={String(sc.tag ?? "")} from={0} color={B.red} />
      <div style={{ marginTop: 22 }}><Hand text={String(sc.heading ?? "")} from={3} size={64} /></div>
      <div style={{ position: "absolute", left: 40, right: 40, top: 240, display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 70, columnGap: 40 }}>
        {nums.map((n, k) => {
          const at = clock.at(n.cue, k);
          return (
            <div key={k} style={{ position: "relative", height: 290 }}>
              <Roll to={n.v} dec={n.dec} prefix={n.pre} suffix={n.suf} from={at} size={`${n.pre ?? ""}${n.v.toLocaleString("vi-VN", { minimumFractionDigits: n.dec ?? 0 })}${n.suf ?? ""}`.length > 4 ? 92 : 124} color={n.star ? B.red : B.blue} />
              <div style={{ marginTop: 6 }}><Hand text={n.label} from={at + 8} size={40} color={B.ink} pen={false} /></div>
              {n.star ? <Svg><Stroke pts={ellipseP(210, 120, 250, 150, `n${i}${k}`)} seed={`n${i}${k}`} color={B.red} w={8} from={at + 26} len={16} /></Svg> : null}
            </div>
          );
        })}
      </div>
      {sc.source ? <div style={{ position: "absolute", left: 40, right: 40, top: 1050 }}><Hand text={String(sc.source)} from={clock.at(undefined, 9)} size={30} color={B.muted} font={PRINT} weight={600} pen={false} /></div> : null}
    </div>
  );
};

const BCompare: React.FC<SP> = ({ sc, clock, i }) => {
  const rows = (sc.rows as { k: string; a: string; b: string; cue?: string }[]) ?? [];
  const top = 300, rh = Math.min(200, 820 / Math.max(1, rows.length));
  return (
    <div style={{ position: "absolute", inset: 0, padding: "40px 40px" }}>
      <Tag text={String(sc.tag ?? "")} from={0} />
      <div style={{ marginTop: 22 }}><Hand text={String(sc.heading ?? "")} from={3} size={64} /></div>
      <div style={{ position: "absolute", left: 360, top: 220 }}><Hand text={String(sc.colA ?? "TRƯỚC")} from={6} size={40} color={B.muted} pen={false} /></div>
      <div style={{ position: "absolute", left: 690, top: 220 }}><Hand text={String(sc.colB ?? "CÓ AI")} from={8} size={40} color={B.red} pen={false} /></div>
      <Svg>
        <Stroke pts={lineP(40, top - 12, 960, top - 16, 10)} seed={`c${i}h`} color={B.ink} w={5} from={8} len={10} />
        <Stroke pts={lineP(660, 212, 664, top + rows.length * rh, 10)} seed={`c${i}v`} color={B.ink} w={5} from={10} len={10} />
      </Svg>
      {rows.map((r, k) => {
        const at = clock.at(r.cue, k);
        const y = top + k * rh + 18;
        return (
          <React.Fragment key={k}>
            <div style={{ position: "absolute", left: 40, top: y, width: 300 }}><Hand text={r.k} from={at} size={36} color={B.ink} font={PRINT} weight={800} pen={false} /></div>
            <div style={{ position: "absolute", left: 360, top: y, width: 290 }}>
              <Hand text={r.a} from={at + 4} size={44} color={B.muted} pen={false} />
              <Svg><Stroke pts={lineP(0, 34, 270, 30, 6)} seed={`c${i}${k}x`} color={B.red} w={5} from={at + 18} len={6} /></Svg>
            </div>
            <div style={{ position: "absolute", left: 690, top: y, width: 290 }}><Hand text={r.b} from={at + 22} size={48} color={B.red} /></div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** Phép tính viết tay: các dòng lần lượt, dòng cuối là kết quả được khoanh. */
const BMath: React.FC<SP> = ({ sc, clock, i }) => {
  const lines = (sc.lines as { t: string; cue?: string; total?: boolean; note?: string }[]) ?? [];
  return (
    <div style={{ position: "absolute", inset: 0, padding: "40px 40px" }}>
      <Tag text={String(sc.tag ?? "")} from={0} color={B.red} />
      <div style={{ marginTop: 22 }}><Hand text={String(sc.heading ?? "")} from={3} size={64} /></div>
      <div style={{ marginTop: 60, display: "flex", flexDirection: "column", gap: 44 }}>
        {lines.map((l, k) => {
          const at = clock.at(l.cue, k);
          return (
            <div key={k} style={{ position: "relative" }}>
              {l.total ? <Svg><Stroke pts={lineP(0, -18, 900, -22, 10)} seed={`m${i}l`} color={B.ink} w={6} from={at - 6} len={8} /></Svg> : null}
              <Hand text={l.t} from={at} size={l.total ? 76 : 50} color={l.total ? B.red : B.ink} />
              {l.note ? <div><Hand text={l.note} from={at + 12} size={32} color={B.muted} font={PRINT} weight={600} pen={false} /></div> : null}
              {l.total ? <Svg><Stroke pts={ellipseP(440, 50, 500, 95, `m${i}`)} seed={`m${i}`} color={B.red} w={8} from={at + 30} len={16} /></Svg> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Tờ giấy câu lệnh dán lên bảng: từng dòng hiện dần như đang gõ; dòng `hot` có bút dạ quang. */
const BNote: React.FC<SP> = ({ sc, clock, i }) => {
  const f = useCurrentFrame();
  const lines = (sc.lines as string[]) ?? [];
  const hot = (sc.hot as number[]) ?? [];
  const cues = (sc.cues as string[]) ?? [];
  const t0 = clock.at(String(sc.cue ?? ""), 0);
  const p = lerp(f, t0, t0 + 9, 0, 1, OUT);
  return (
    <div style={{ position: "absolute", inset: 0, padding: "40px 40px" }}>
      <Tag text={String(sc.tag ?? "")} from={0} />
      <div style={{ marginTop: 22 }}><Hand text={String(sc.heading ?? "")} from={3} size={64} /></div>
      <div style={{ position: "absolute", left: 50, top: 250, width: 900, transform: `rotate(-1deg) scale(${1.05 - 0.05 * p})`, opacity: Math.min(1, p * 2) }}>
        <div style={{ position: "absolute", inset: -10, background: "#FFFDF3", boxShadow: `0 ${16 * p}px ${34 * p}px rgba(0,0,0,0.16)`, borderLeft: `10px solid ${B.red}` }} />
        <div style={{ position: "absolute", left: 360, top: -34, width: 180, height: 46, background: B.tape }} />
        <div style={{ position: "relative", padding: "36px 40px", fontFamily: PRINT, fontSize: 38, lineHeight: 1.42, color: B.ink }}>
          {lines.map((l, k) => {
            const at = cues[k] ? clock.at(cues[k], k) : t0 + 8 + k * 10;
            const q = lerp(f, at, at + Math.min(30, l.length * 0.6), 0, 1, Easing.linear);
            const n = Math.round(l.length * q);
            const isHot = hot.includes(k);
            const hp = lerp(f, at + l.length * 0.6, at + l.length * 0.6 + 6, 0, 1, OUT);
            return (
              <div key={k} style={{ minHeight: 54, fontWeight: isHot ? 800 : 500 }}>
                <span style={isHot ? { backgroundImage: `linear-gradient(${B.hl}, ${B.hl})`, backgroundRepeat: "no-repeat", backgroundSize: `${hp * 100}% 60%`, backgroundPosition: "0 80%" } : undefined}>{l.slice(0, n)}</span>
                {q > 0 && q < 1 ? <span style={{ color: B.red }}>▌</span> : null}
              </div>
            );
          })}
        </div>
      </div>
      {sc.note ? <div style={{ position: "absolute", left: 50, right: 40, top: 1080 }}><Hand text={String(sc.note)} from={clock.at(String(sc.noteCue ?? ""), 9)} size={44} color={B.red} /></div> : null}
    </div>
  );
};

const BOutro: React.FC<SP> = ({ sc, clock }) => {
  const tools = (sc.tools as string[]) ?? [];
  return (
    <div style={{ position: "absolute", inset: 0, padding: "40px 40px" }}>
      <div style={{ marginTop: 60 }}><Hand text={String(sc.line ?? "")} from={4} size={86} /></div>
      <div style={{ marginTop: 50 }}><Hand text={String(sc.echo ?? "")} from={clock.at(String(sc.echoCue ?? ""), 0) + 10} size={54} color={B.red} /></div>
      <div style={{ marginTop: 60, display: "flex", gap: 30, flexWrap: "wrap" }}>
        {tools.map((t, k) => <Hand key={k} text={t} from={40 + k * 5} size={40} color={B.blue} font={PRINT} weight={800} pen={false} />)}
      </div>
      <div style={{ marginTop: 70 }}><Hand text={String(sc.cta ?? "")} from={clock.at(undefined, 1) + 4} size={50} color={B.ink} /></div>
    </div>
  );
};

export const BOARD_SCENES: Record<string, React.FC<SP>> = {
  "b-title": BTitle, "b-list": BList, "b-flow": BFlow, "b-photo": BPhoto, "b-numbers": BNumbers, "b-compare": BCompare, "b-math": BMath, "b-note": BNote, "b-outro": BOutro,
};

// ── Máy quay: giữa các cảnh lướt qua bảng (lùi nhẹ giữa đường), trong cảnh đẩy rất chậm ×1,00 → ×1,03 ──
const VCX = VX + RW / 2, VCY = VY + RH / 2; // tâm khung nhìn (vùng nội dung)
function camera(f: number, starts: number[], n: number, total: number, overviewFrom: number) {
  const rows = Math.ceil(n / 2);
  const worldW = GX * 2 + 180, worldH = GY * rows + 180;
  const ctr = (i: number) => { const r = regionXY(i); return { x: r.x + RW / 2, y: r.y + RH / 2 }; };
  let k = 0;
  for (let i = 0; i < n; i++) if (f >= starts[i]) k = i;
  const MOVE = 22;
  const t = k > 0 ? lerp(f, starts[k], starts[k] + MOVE) : 1;
  const a = ctr(Math.max(0, k - 1)), b = ctr(k);
  let cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t;
  const end = k + 1 < n ? starts[k + 1] : total;
  // lùi nhẹ giữa đường đi (thấy mình đang lướt trên bảng), trong cảnh đẩy rất chậm cho khỏi đứng hình
  let s = ZOOM * (1 - 0.14 * Math.sin(Math.PI * t)) * (1 + 0.03 * lerp(f, starts[k] + MOVE, end, 0, 1, Easing.linear));
  if (overviewFrom >= 0 && f >= overviewFrom) {
    const o = lerp(f, overviewFrom, overviewFrom + 36);
    const so = Math.min(1040 / worldW, 1300 / worldH);
    cx = cx + (worldW / 2 - cx) * o; cy = cy + (worldH / 2 - cy) * o; s = s + (so - s) * o;
  }
  return { tx: VCX - s * cx, ty: VCY - s * cy, s };
}

const BoardSubtitle: React.FC<Props> = ({ timeline }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const cau = timeline.scenes.flatMap((s) => s.caus).find((c) => t >= c.start - 0.05 && t <= c.end + 0.15);
  if (!cau) return null;
  const words = cau.text.split(/\s+/);
  const tw = (cau as { words?: { start: number }[] }).words ?? [];
  const daDoc = tw.length ? Math.round((tw.filter((w) => w.start <= t).length / tw.length) * words.length) : Math.round(interpolate(t, [cau.start, cau.end], [0, words.length], clamp));
  return (
    <div style={{ position: "absolute", left: 60, right: 60, bottom: 130, display: "flex", justifyContent: "center" }}>
      <div style={{ background: "rgba(255,253,244,0.94)", border: `3px solid ${B.ink}`, borderRadius: 26, padding: "22px 36px", maxWidth: 960, textAlign: "center", fontFamily: PRINT, fontSize: 46, fontWeight: 700, lineHeight: 1.3, color: B.ink, boxShadow: "6px 8px 0 rgba(30,42,54,0.18)" }}>
        {words.map((w, i) => <span key={i} style={{ color: i < daDoc ? B.red : B.ink }}>{w}{i < words.length - 1 ? " " : ""}</span>)}
      </div>
    </div>
  );
};

/** Toàn bộ video kiểu bảng trắng (theme "board"): mọi cảnh vẽ trên một tấm bảng, máy quay đi qua từng vùng. */
export const BoardVideo: React.FC<Props> = (props) => {
  const { script, timeline } = props;
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const n = script.scenes.length;
  const starts = timeline.scenes.map((s, i) => (i === 0 ? 0 : Math.round(s.start * fps)));
  const ovIdx = script.scenes.findIndex((s) => s.type === "b-outro");
  const overviewFrom = ovIdx >= 0 ? starts[ovIdx] + Math.round(fps * 0.4) : -1;
  const cam = camera(f, starts, n, durationInFrames, overviewFrom);
  const rows = Math.ceil(n / 2);
  const worldW = GX * 2 + 180, worldH = GY * rows + 180;
  const regions = script.scenes.map((sc, i) => ({ sc, i, ...regionXY(i) }));
  const outro = ovIdx >= 0 ? regions[ovIdx] : null;
  return (
    <AbsoluteFill style={{ background: "#E9E6DC", overflow: "hidden" }}>
      <Audio src={staticFile(`${script.id}/voice.mp3`)} />
      <div style={{ position: "absolute", left: 0, top: 0, width: worldW, height: worldH, transformOrigin: "0 0", transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})` }}>
        {/* mặt bảng + bóng chữ cũ + vệt sáng cửa sổ trôi chậm hơn máy quay */}
        <div style={{ position: "absolute", inset: 0, background: B.board, boxShadow: "inset 0 0 120px rgba(0,0,0,0.06)" }} />
        {Array.from({ length: rows * 3 }, (_, k) => (
          <div key={k} style={{ position: "absolute", left: 120 + random(`g${k}`) * (worldW - 700), top: 120 + random(`h${k}`) * (worldH - 300), fontFamily: HAND, fontSize: 70, color: B.ink, opacity: 0.045, transform: `rotate(${(random(`r${k}`) - 0.5) * 10}deg)` }}>
            {["→ việc cần làm", "ghi chú họp", "ai làm?", "đã chốt?", "1 giờ", "check!", "hạn chót", "tuần"][k % 8]}
          </div>
        ))}
        <div style={{ position: "absolute", left: -cam.tx * 0.35 - 400, top: -cam.ty * 0.35 - 400, width: 1400, height: worldH + 800, background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.55) 45%, transparent 60%)", pointerEvents: "none" }} />
        {regions.map(({ sc, i, x, y }) => {
          if (sc.type === "b-outro") return null;
          const Comp = BOARD_SCENES[sc.type];
          if (!Comp) return null;
          const from = starts[i];
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y, width: RW, height: RH }}>
              <Sequence from={from} layout="none">
                <Comp sc={sc} script={script} clock={makeClock(timeline.scenes[i], fps, (starts[i + 1] ?? durationInFrames) - from)} i={i} />
              </Sequence>
            </div>
          );
        })}
      </div>
      {/* cuối clip: lùi ra thấy cả bảng, câu chốt viết trên một tờ giấy lớn dán đè */}
      {outro ? (
        <Sequence from={starts[outro.i] + Math.round(fps * 1.2)} layout="none">
          <OutroSheet sc={outro.sc} script={script} clock={makeClock(timeline.scenes[outro.i], fps, durationInFrames - starts[outro.i])} i={outro.i} delay={Math.round(fps * 1.2)} />
        </Sequence>
      ) : null}
      <div style={{ position: "absolute", top: 0, left: 0, height: 8, width: `${(f / durationInFrames) * 100}%`, background: B.ink }} />
      <div style={{ position: "absolute", top: 40, left: 40, fontFamily: PRINT, fontWeight: 800, fontSize: 28, letterSpacing: 3, color: B.muted }}>{script.series}</div>
      <BoardSubtitle {...props} />
    </AbsoluteFill>
  );
};

const OutroSheet: React.FC<SP & { delay: number }> = ({ sc, script, clock, i, delay }) => {
  const f = useCurrentFrame();
  const p = lerp(f, 0, 10, 0, 1, OUT);
  const c2: Clock = { ...clock, at: (cue?: string, k?: number) => clock.at(cue, k) - delay };
  return (
    <div style={{ position: "absolute", left: 60, top: 300, width: 960, height: 1100, transform: `rotate(-1.5deg) translateY(${(1 - p) * 60}px)`, opacity: p }}>
      <div style={{ position: "absolute", inset: 0, background: B.paper, boxShadow: "0 24px 60px rgba(0,0,0,0.22)" }} />
      <div style={{ position: "absolute", left: 380, top: -24, width: 200, height: 50, background: B.tape }} />
      <div style={{ position: "absolute", inset: 0 }}><BOutro sc={sc} script={script} clock={c2} i={i} /></div>
    </div>
  );
};
