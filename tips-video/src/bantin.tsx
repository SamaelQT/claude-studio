/**
 * Tuần 5 (18–24/11/2026) — phong cách "Bản tin sơ đồ" (Quang chốt 18/11/2026, skill `lam-video-bang-code/references/mau-tham-chieu.md` look `ban-tin-so-do`).
 *  - Nền xanh nhạt kẻ ô; chip cam ở đỉnh trái, số clip ở đỉnh phải; tiêu đề chương chữ đỏ đậm nghiêng khổ hẹp, cụm [[xanh]].
 *  - Giữa: sơ đồ phẳng (thẻ trắng bo góc, viên thuốc đỏ / xanh lá / xanh dương) XÂY DẦN đúng lúc lời đọc tới (cue).
 *  - Đáy: phụ đề từng chữ trên nền trắng bo tròn, chữ khoá xanh. Không người dẫn.
 *  - Làm lại 19/11 (Quang chê nói suông, kết văn mẫu): bìa "num" (1 cặp số trước → sau), minh chứng = ẢNH CHỤP THẬT ("n-shot"),
 *    kết = kết quả đáng nhớ + bước tiếp theo ("n-end"). Không kết bằng "bình luận bên dưới". Skill `lam-video-bang-code/references/mo-bai-ket-bai-minh-chung.md`.
 *  - Cảnh "n-cover" = ảnh bìa đã duyệt (scratchpad bia/*.html), TĨNH từ khung 0 → khung đầu video = bìa.
 */
import React from "react";
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Props, Scene, Script } from "./types";
import { makeClock, type Clock } from "./board";

const C = { bg: "#e8f1fb", grid: "#cfe0f3", navy: "#18324f", red: "#d62828", green: "#2bb673", blue: "#1f6fd1", orange: "#f07a1a", muted: "#5b7493", grey: "#8597ad", shadow: "#b9cde4" };
const COLOR: Record<string, string> = { red: C.red, green: C.green, blue: C.blue, orange: C.orange };
const OUT = Easing.bezier(0.33, 1, 0.68, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const lerp = (f: number, a: number, b: number, from = 0, to = 1, ease = OUT) => interpolate(f, [a, Math.max(a + 1, b)], [from, to], { ...clamp, easing: ease });
const norm = (s: string) => s.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

// CSS chép đúng bản bìa đã duyệt (box-sizing mặc định content-box như trang HTML)
const CSS = `
.bt{font-family:"Segoe UI";color:${C.navy};box-sizing:content-box}
.bt *{box-sizing:content-box}
.bt .chip{position:absolute;top:110px;left:70px;background:${C.orange};color:#fff;font-weight:800;font-size:36px;padding:12px 30px;border-radius:40px;letter-spacing:1px}
.bt .no{position:absolute;top:110px;right:70px;background:${C.navy};color:#fff;font-weight:800;font-size:36px;padding:12px 26px;border-radius:40px}
.bt .h1{position:absolute;top:230px;left:70px;right:60px;margin:0;font-family:Bahnschrift;font-stretch:condensed;font-style:italic;font-weight:700;color:${C.red};font-size:150px;line-height:.98;letter-spacing:-1px;white-space:pre-line}
.bt .h1 span{color:${C.blue}}
.bt .card{background:#fff;border-radius:28px;box-shadow:0 10px 0 ${C.shadow};padding:34px;position:absolute}
.bt .tag{position:absolute;font-weight:800;font-size:32px;color:#fff;padding:8px 22px;border-radius:30px}
.bt .red{background:${C.red}}.bt .green{background:${C.green}}.bt .blue{background:${C.blue}}.bt .orange{background:${C.orange}}
.bt .arrow{position:absolute;font-size:90px;font-weight:900;color:${C.red};line-height:1;z-index:5}
.bt .big{position:absolute;left:70px;right:70px;bottom:270px;display:flex;justify-content:center;align-items:center;gap:26px}
.bt .big .p{font-size:58px;font-weight:900;color:#fff;padding:20px 40px;border-radius:60px;white-space:nowrap}
.bt .foot{position:absolute;bottom:90px;left:0;right:0;text-align:center;font-size:30px;font-weight:700;color:${C.muted};letter-spacing:2px}
.bt .foot b{display:block;color:${C.navy};font-size:34px;letter-spacing:0;margin-top:8px}
.bt .b-txt{left:70px;top:900px;width:360px;font-size:34px;line-height:1.45;color:${C.muted}}
.bt .b-flow{left:560px;top:840px;width:450px;display:flex;flex-direction:column;align-items:center;gap:10px}
.bt .b-n{color:#fff;font-weight:800;font-size:40px;padding:18px 26px;border-radius:14px;text-align:center}
.bt .b-a{color:${C.red};font-size:36px;font-weight:900;line-height:1}
.bt .b-row{display:flex;gap:14px}
.bt .c-bub{position:absolute;left:70px;width:400px;background:#fff;border-radius:22px;padding:20px 26px;font-size:34px;box-shadow:0 6px 0 ${C.shadow};color:${C.muted}}
.bt .c-bub b{color:${C.red}}
.bt .c-pc{left:600px;top:960px;width:350px;font-size:36px;line-height:1.4}
.bt .c-pc .t{font-weight:900;color:${C.blue};font-size:42px;margin-bottom:10px}
.bt .d-doc{width:370px;font-size:34px;line-height:1.45;white-space:pre-line}
.bt .d-doc .h{font-weight:900;font-size:38px;margin-bottom:10px}
.bt .d-bad{left:70px;top:880px;color:${C.grey}}.bt .d-good{left:575px;top:880px;color:${C.navy}}
.bt .d-good .h{color:${C.blue}}.bt .x{color:${C.red};font-weight:900}.bt .v{color:${C.green};font-weight:900}
`;

type S = Scene & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type SP = { sc: S; script: Script; clock: Clock };

/** "[[xanh]]" → <span>, "\n" xuống dòng (white-space: pre-line ở khung cha). */
const rich = (t: string) => t.split(/(\[\[[\s\S]*?\]\])/g).filter(Boolean).map((s, i) => (s.startsWith("[[") ? <span key={i}>{s.slice(2, -2)}</span> : <React.Fragment key={i}>{s}</React.Fragment>));

/** Hiện ra: mờ → rõ, trượt (dx, dy), phóng từ s → 1. */
const pop = (f: number, from: number, o: { dx?: number; dy?: number; s?: number; len?: number } = {}): React.CSSProperties => {
  const p = lerp(f, from, from + (o.len ?? 12));
  const s = o.s ?? 1;
  return { opacity: p, transform: `translate(${(1 - p) * (o.dx ?? 0)}px, ${(1 - p) * (o.dy ?? 40)}px) scale(${s + (1 - s) * p})` };
};

const Pills: React.FC<{ pills: string[]; style?: React.CSSProperties }> = ({ pills, style }) => (
  <div className="big" style={style}>
    <span className="p red">{pills[0]}</span>
    <span style={{ fontSize: 70, fontWeight: 900, color: C.red }}>→</span>
    <span className="p green">{pills[1]}</span>
  </div>
);
const Foot: React.FC<{ script: Script; style?: React.CSSProperties }> = ({ script, style }) => (
  <div className="foot" style={style}>AI SHARING TIPS CHALLENGE 2026<b>{script.author}</b></div>
);

// ── Bìa (tĩnh, đúng bản duyệt) ──
const Cover: React.FC<SP> = ({ sc, script }) => (
  <AbsoluteFill>
    <div className="chip">{sc.chip}</div>
    <div className="no">{script.num}</div>
    <div className="h1" style={sc.titleSize ? { fontSize: sc.titleSize } : undefined}>{rich(sc.title)}</div>
    {sc.variant === "b" ? (
      <>
        <div className="card b-txt">{sc.doc}</div>
        <div className="tag red" style={{ left: 70, top: 840 }}>Đoạn văn</div>
        <div className="arrow" style={{ left: 475, top: 1060 }}>→</div>
        <div className="card b-flow">
          <div className="b-n blue">Nhận đơn</div><div className="b-a">↓</div>
          <div className="b-n orange" style={{ borderRadius: 40 }}>Đủ hàng?</div><div className="b-a">↓</div>
          <div className="b-row"><div className="b-n blue">Xuất kho</div><div className="b-n blue">Báo mua</div></div>
        </div>
        <div className="tag green" style={{ left: 560, top: 780 }}>Lưu đồ</div>
      </>
    ) : null}
    {sc.variant === "c" ? (
      <>
        {(sc.bubbles as string[]).map((b, k) => {
          const [t, n] = b.split(" |");
          return <div key={k} className="c-bub" style={{ top: 820 + k * 120 }}>{t} <b>{n}</b></div>;
        })}
        <div className="arrow" style={{ left: 510, top: 1040 }}>→</div>
        <div className="card c-pc"><div className="t">{sc.card.title}</div>{sc.card.text}</div>
      </>
    ) : null}
    {sc.variant === "num" ? (
      <div style={{ position: "absolute", left: 70, right: 70, top: sc.numTop ?? 820, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ position: "relative", fontFamily: "Bahnschrift", fontStretch: "condensed", fontWeight: 700, fontSize: 170, lineHeight: 1, color: C.grey }}>
          {sc.nums.before}
          <div style={{ position: "absolute", left: -24, right: -24, top: "50%", height: 18, borderRadius: 9, background: C.red, transform: "rotate(-7deg)" }} />
        </div>
        <div style={{ fontSize: 110, fontWeight: 900, color: C.red, lineHeight: 1.1 }}>↓</div>
        <div style={{ fontFamily: "Bahnschrift", fontStretch: "condensed", fontWeight: 700, fontSize: sc.nums.size ?? 300, lineHeight: 0.95, color: C.green, whiteSpace: "nowrap" }}>{sc.nums.after}</div>
        {sc.nums.unit ? <div style={{ fontSize: 58, fontWeight: 800, color: C.navy, textAlign: "center", marginTop: 22, lineHeight: 1.25, whiteSpace: "pre-line" }}>{rich(sc.nums.unit)}</div> : null}
      </div>
    ) : null}
    {sc.variant === "d" ? (
      <>
        <div className="card d-doc d-bad"><div className="h"><span className="x">✗</span> {sc.bad.h}</div>{sc.bad.text}</div>
        <div className="card d-doc d-good"><div className="h"><span className="v">✓</span> {sc.good.h}</div>{sc.good.text}</div>
        <div className="arrow" style={{ left: 478, top: 1010 }}>→</div>
      </>
    ) : null}
    {sc.pills ? <Pills pills={sc.pills} /> : null}
    <Foot script={script} />
  </AbsoluteFill>
);

// ── Khung chung các cảnh trong: chip chương, số clip, tiêu đề quét từ trái sang ──
const Chrome: React.FC<SP & { children: React.ReactNode }> = ({ sc, script, children }) => {
  const f = useCurrentFrame();
  const p = lerp(f, 1, 15);
  return (
    <AbsoluteFill>
      <div className="chip" style={pop(f, 0, { dx: -30, dy: 0, len: 8 })}>{sc.tag}</div>
      <div className="no">{script.num}</div>
      <div className="h1" style={{ fontSize: 112, clipPath: `inset(-12% ${(1 - p) * 110 - 10}% -12% -6%)` }}>{rich(sc.heading ?? "")}</div>
      {children}
    </AbsoluteFill>
  );
};
const BODY: React.CSSProperties = { position: "absolute", top: 600, left: 70, right: 70, display: "flex", flexDirection: "column" };
const REL: React.CSSProperties = { position: "relative" };

const Points: React.FC<SP> = (p) => {
  const f = useCurrentFrame();
  return (
    <Chrome {...p}>
      <div style={{ ...BODY, gap: 40 }}>
        {(p.sc.items as { t: string; tag: string; color: string; cue: string }[]).map((it, k) => (
          <div key={k} className="card" style={{ ...REL, padding: "30px 38px", borderLeft: `16px solid ${COLOR[it.color]}`, ...pop(f, p.clock.at(it.cue, k), { dx: 90, dy: 0 }) }}>
            <span className="tag" style={{ position: "static", display: "inline-block", background: COLOR[it.color] }}>{it.tag}</span>
            <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.25, marginTop: 16 }}>{it.t}</div>
          </div>
        ))}
      </div>
    </Chrome>
  );
};

const Prompt: React.FC<SP> = (p) => {
  const f = useCurrentFrame();
  const { sc, clock } = p;
  const lines = sc.lines as string[];
  const hot: number[] = sc.hot ?? [];
  const cues: string[] = sc.cues ?? [];
  const first = clock.at(cues[0], 0);
  return (
    <Chrome {...p}>
      <div style={{ ...BODY, gap: 36 }}>
        <div className="card" style={{ ...REL, padding: "30px 34px", ...pop(f, Math.max(0, first - 8), { dy: 30 }) }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: C.blue, marginBottom: 16 }}>📋 Dán vào AI:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {lines.map((l, k) => {
              const on = hot.includes(k);
              return (
                <div key={k} style={{ fontSize: 42, fontWeight: on ? 800 : 600, lineHeight: 1.38, padding: "10px 18px", borderRadius: 12, background: on ? "#e3eefc" : "transparent", borderLeft: `8px solid ${on ? C.blue : C.shadow}`, color: on ? C.navy : C.muted, ...pop(f, clock.at(cues[k], k), { dx: 50, dy: 0 }) }}>{l}</div>
              );
            })}
          </div>
        </div>
        <div className="card" style={{ ...REL, padding: "24px 30px", background: "#fff7ef", boxShadow: "0 8px 0 #f3cfa8", display: "flex", alignItems: "center", gap: 20, ...pop(f, clock.at(sc.noteCue, lines.length), { dy: 30 }) }}>
          <span className="tag orange" style={{ position: "static", flexShrink: 0 }}>Mẹo</span>
          <span style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.3 }}>{sc.note}</span>
        </div>
      </div>
    </Chrome>
  );
};

// ── Lưu đồ: ô hiện theo lời, mũi tên vẽ dần; mũi tên "bẫy" màu đỏ ──
type FNode = { id: string; t: string; x: number; y: number; kind: "end" | "dec" | "box"; cue?: string };
type FEdge = { a: string; b: string; label?: string; trap?: boolean; cue?: string };
const FS = 34, FH = 62, YS = 1, FX = 60, FY = 650;
const nodeW = (t: string) => Math.max(250, Math.round(t.length * FS * 0.52 + 56));
const Flow: React.FC<SP> = (p) => {
  const f = useCurrentFrame();
  const { sc, clock } = p;
  const nodes = sc.nodes as FNode[];
  const edges = sc.edges as FEdge[];
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const cnt: Record<string, number> = {};
  const appear: Record<string, number> = {};
  for (const n of nodes) {
    const key = n.cue ?? "";
    const k = (cnt[key] = (cnt[key] ?? -1) + 1);
    appear[n.id] = clock.at(n.cue) + k * 5;
  }
  const ctr = (n: FNode) => ({ x: n.x, y: n.y * YS + FH / 2 });
  const clip = (n: FNode, dx: number, dy: number) => {
    const hw = nodeW(n.t) / 2 + 4, hh = FH / 2 + 4;
    const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
    return { x: ctr(n).x + dx * t, y: ctr(n).y + dy * t };
  };
  return (
    <Chrome {...p}>
      <div className="tag red" style={{ left: 70, top: 600, ...pop(f, clock.at(sc.docCue), { dy: 20 }) }}>📄 {sc.doc}</div>
      <svg width={960} height={960} style={{ position: "absolute", left: FX, top: FY, overflow: "visible" }}>
        {edges.map((e, k) => {
          const A = byId[e.a], Bn = byId[e.b];
          const ca = ctr(A), cb = ctr(Bn);
          const dx = cb.x - ca.x, dy = cb.y - ca.y;
          const s = clip(A, dx, dy), t = clip(Bn, -dx, -dy);
          const from = e.cue ? clock.at(e.cue) + 4 : Math.max(appear[e.a], appear[e.b]) + 8;
          const pr = lerp(f, from, from + 12);
          if (pr <= 0) return null;
          const col = e.trap ? C.red : C.muted;
          const ang = Math.atan2(t.y - s.y, t.x - s.x), L = 22;
          const ex = s.x + (t.x - s.x) * pr, ey = s.y + (t.y - s.y) * pr;
          const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
          return (
            <g key={k}>
              <line x1={s.x} y1={s.y} x2={ex} y2={ey} stroke={col} strokeWidth={e.trap ? 8 : 6} strokeLinecap="round" />
              {pr >= 1 ? <polygon points={`${t.x},${t.y} ${t.x - L * Math.cos(ang - 0.45)},${t.y - L * Math.sin(ang - 0.45)} ${t.x - L * Math.cos(ang + 0.45)},${t.y - L * Math.sin(ang + 0.45)}`} fill={col} /> : null}
              {e.label && pr >= 1 ? (
                <foreignObject x={mx - 90} y={my - 26} width={180} height={52} style={{ overflow: "visible" }}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <span style={{ background: e.trap ? C.red : "#fff", color: e.trap ? "#fff" : C.navy, border: `3px solid ${col}`, borderRadius: 20, padding: "0px 12px", fontSize: 26, fontWeight: 800, whiteSpace: "nowrap" }}>{e.label}</span>
                  </div>
                </foreignObject>
              ) : null}
            </g>
          );
        })}
      </svg>
      {nodes.map((n) => {
        const c = ctr(n);
        const bg = n.kind === "dec" ? C.orange : n.kind === "end" ? C.navy : C.blue;
        return (
          <div key={n.id} style={{ position: "absolute", left: FX + c.x - nodeW(n.t) / 2, top: FY + c.y - FH / 2, width: nodeW(n.t), height: FH, display: "flex", alignItems: "center", justifyContent: "center", background: bg, color: "#fff", fontSize: FS, fontWeight: 800, borderRadius: n.kind === "box" ? 14 : 40, boxShadow: `0 6px 0 ${C.shadow}`, whiteSpace: "nowrap", ...pop(f, appear[n.id], { dy: 0, s: 0.6, len: 10 }) }}>{n.t}</div>
        );
      })}
    </Chrome>
  );
};

const Chat: React.FC<SP> = (p) => {
  const f = useCurrentFrame();
  const { sc, clock } = p;
  const st = sc.stamp as { big: string; small: string; cue: string };
  const sf = clock.at(st.cue);
  const sp = lerp(f, sf, sf + 8);
  return (
    <Chrome {...p}>
      <div style={{ ...BODY, gap: 24, alignItems: "flex-start" }}>
        {(sc.bubbles as { t: string; n: string; cue: string }[]).map((b, k) => (
          <div key={k} style={{ ...REL, background: "#fff", borderRadius: 26, padding: "22px 30px", fontSize: 46, fontWeight: 600, boxShadow: `0 6px 0 ${C.shadow}`, color: C.navy, display: "flex", gap: 20, alignItems: "center", ...pop(f, clock.at(b.cue, k), { dx: -60, dy: 0 }) }}>
            <span style={{ background: C.red, color: "#fff", fontWeight: 900, fontSize: 36, borderRadius: 30, padding: "4px 16px" }}>{b.n}</span>
            {b.t}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", right: 80, top: 1290, border: `8px solid ${C.red}`, borderRadius: 26, padding: "16px 36px", background: "rgba(255,255,255,0.9)", color: C.red, textAlign: "center", opacity: sp, transform: `rotate(-8deg) scale(${1.5 - 0.5 * sp})` }}>
        <div style={{ fontFamily: "Bahnschrift", fontStretch: "condensed", fontStyle: "italic", fontWeight: 700, fontSize: 96, lineHeight: 1 }}>{st.big}</div>
        <div style={{ fontSize: 44, fontWeight: 800, marginTop: 6 }}>{st.small}</div>
      </div>
    </Chrome>
  );
};

type Side = { h: string; cue: string; lines: { t: string; cue: string }[] };
const Compare: React.FC<SP> = (p) => {
  const f = useCurrentFrame();
  const { sc, clock } = p;
  const side = (s: Side, good: boolean) => (
    <div className="card" style={{ ...REL, flex: 1, padding: "30px 30px", ...pop(f, clock.at(s.cue), { dx: good ? 80 : -80, dy: 0 }) }}>
      <div style={{ fontSize: 44, fontWeight: 900, color: good ? C.blue : C.grey, marginBottom: 20 }}>
        <span style={{ color: good ? C.green : C.red }}>{good ? "✓" : "✗"}</span> {s.h}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {s.lines.map((l, k) => (
          <div key={k} style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.3, color: good ? C.navy : C.muted, display: "flex", gap: 12, ...pop(f, Math.max(clock.at(l.cue, k), clock.at(s.cue)), { dy: 24 }) }}>
            <span style={{ color: good ? C.green : C.red, fontWeight: 900 }}>{good ? "✓" : "✗"}</span><span>{l.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <Chrome {...p}>
      <div style={{ position: "absolute", top: 600, left: 70, right: 70, fontSize: 40, fontWeight: 700, color: C.muted, ...pop(f, clock.at(sc.introCue), { dy: 20 }) }}>📌 {sc.intro}</div>
      <div style={{ position: "absolute", top: 690, left: 60, right: 60, display: "flex", gap: 24, alignItems: "flex-start" }}>
        {side(sc.bad, false)}
        {side(sc.good, true)}
      </div>
    </Chrome>
  );
};

/** Số lăn từ a tới b (chỉ phần tử số đầu; "8/8" → lăn 8, giữ "/8"). */
const Roll: React.FC<{ before?: string; after: string; from: number; size: number }> = ({ before, after, from, size }) => {
  const f = useCurrentFrame();
  const m = after.match(/^(\d+)(.*)$/);
  const p = lerp(f, from, from + 22);
  let txt = after;
  if (m) {
    const b0 = before?.match(/^(\d+)/);
    const a = b0 ? Number(b0[1]) : 0, b = Number(m[1]);
    txt = `${Math.round(a + (b - a) * p)}${m[2]}`;
  }
  return <span style={{ fontSize: size, fontWeight: 900, color: p >= 1 ? C.green : C.navy, fontVariantNumeric: "tabular-nums", letterSpacing: -1, opacity: f < from ? 0 : 1 }}>{txt}</span>;
};
const Score: React.FC<SP> = (p) => {
  const f = useCurrentFrame();
  const { sc, clock } = p;
  const rows = sc.rows as { label: string; before?: string; after: string; cue: string }[];
  const dense = rows.length > 2;
  return (
    <Chrome {...p}>
      <div style={{ ...BODY, gap: dense ? 24 : 34 }}>
        {rows.map((r, k) => {
          const from = clock.at(r.cue, k);
          return (
            <div key={k} className="card" style={{ ...REL, display: "flex", alignItems: "center", gap: 24, padding: dense ? "22px 38px" : "34px 40px", ...pop(f, from, { dx: 70, dy: 0 }) }}>
              <div style={{ flex: 1, fontSize: dense ? 44 : 50, fontWeight: 800, lineHeight: 1.2 }}>{r.label}</div>
              {r.before ? (
                <>
                  <span style={{ fontSize: dense ? 52 : 62, fontWeight: 800, color: C.grey, textDecoration: "line-through" }}>{r.before}</span>
                  <span style={{ fontSize: 56, fontWeight: 900, color: C.red }}>→</span>
                </>
              ) : null}
              <Roll before={r.before} after={r.after} from={from + 4} size={dense ? 84 : 104} />
            </div>
          );
        })}
        <div style={{ ...pop(f, clock.at(sc.proofCue), { dy: 20 }) }}>
          <span className="tag green" style={{ position: "static", display: "inline-block", fontSize: 34 }}>✓ {sc.proof}</span>
        </div>
        <div className="card" style={{ ...REL, padding: "24px 30px", borderLeft: `14px solid ${C.orange}`, fontSize: 40, fontWeight: 700, lineHeight: 1.3, ...pop(f, clock.at(sc.limitCue), { dy: 30 }) }}>
          <span style={{ color: C.orange, fontWeight: 900 }}>Lưu ý: </span>{sc.limit}
        </div>
      </div>
    </Chrome>
  );
};

const Outro: React.FC<SP> = (p) => {
  const f = useCurrentFrame();
  const { sc, clock, script } = p;
  const askF = clock.at(sc.askCue);
  return (
    <Chrome {...p}>
      <Pills pills={sc.pills} style={{ bottom: "auto", top: 640, ...pop(f, clock.at(sc.pillsCue), { dy: 0, s: 0.7 }) }} />
      <div className="card" style={{ left: 70, right: 70, top: 860, padding: "40px 44px", textAlign: "center", ...pop(f, askF, { dy: 40 }) }}>
        <div style={{ fontSize: 84, lineHeight: 1 }}>💬</div>
        <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1.25, marginTop: 18 }}>{sc.ask}</div>
      </div>
      <Foot script={script} style={{ bottom: "auto", top: 1250, ...pop(f, askF + 10, { dy: 20 }) }} />
    </Chrome>
  );
};

// ── Minh chứng: ẢNH CHỤP THẬT màn hình AI (public/<id>/shots/*.jpg, 540×960). Toạ độ crop / marks / blur theo pixel ảnh gốc. ──
type Box = { x: number; y: number; w: number; h: number };
// nhãn: mặc định trên-phải khung; below = dưới-phải; right = sát bên phải khung (dòng ngắn, bên phải còn trống)
type Mark = Box & { label?: string; cue?: string; color?: string; below?: boolean; right?: boolean };
const SHOT_W = 940, SHOT_MAXH = 1060;
const Shot: React.FC<SP> = (p) => {
  const f = useCurrentFrame();
  const { sc, script, clock } = p;
  const crop = sc.crop as Box;
  const k = SHOT_W / crop.w;
  const top: number = sc.top ?? 520;
  const h = Math.min(crop.h * k, SHOT_MAXH);
  // cuộn xuống trong ảnh (như người xem đang lướt màn hình) khi lời đọc tới panCue
  const pan = sc.pan as { dy: number; cue?: string; len?: number } | undefined;
  const pf = pan ? clock.at(pan.cue, 1) : 0;
  const dy = pan ? lerp(f, pf, pf + (pan.len ?? 40), 0, pan.dy, Easing.inOut(Easing.cubic)) : 0;
  const marks = (sc.marks as Mark[] | undefined) ?? [];
  const blur = (sc.blur as Box[] | undefined) ?? [];
  return (
    <Chrome {...p}>
      <div style={{ position: "absolute", left: 70, top, width: SHOT_W, height: h, borderRadius: 28, overflow: "hidden", background: "#262624", boxShadow: `0 10px 0 ${C.shadow}`, outline: "6px solid #fff", ...pop(f, 0, { dy: 70, len: 10 }) }}>
        <div style={{ position: "absolute", left: -crop.x * k, top: -(crop.y + dy) * k, width: 540 * k, height: 960 * k }}>
          <Img src={staticFile(`${script.id}/shots/${sc.src}`)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
          {blur.map((b, i) => (
            <div key={i} style={{ position: "absolute", left: b.x * k, top: b.y * k, width: b.w * k, height: b.h * k, borderRadius: 14, background: "rgba(38,38,36,0.55)", backdropFilter: "blur(16px)" }} />
          ))}
          {marks.map((m, i) => {
            const a = clock.at(m.cue, i);
            const pr = lerp(f, a, a + 9);
            const col = COLOR[m.color ?? "orange"];
            return (
              <div key={i} style={{ position: "absolute", left: m.x * k - 10, top: m.y * k - 10, width: m.w * k + 20, height: m.h * k + 20, border: `7px solid ${col}`, borderRadius: 18, opacity: pr, transform: `scale(${1.12 - 0.12 * pr})` }}>
                {m.label ? <span className="tag" style={{ background: col, whiteSpace: "nowrap", fontSize: 30, padding: "6px 14px", ...(m.right ? { left: "100%", marginLeft: 10, top: "50%", transform: "translateY(-50%)" } : m.below ? { right: -7, top: "100%", marginTop: 6 } : { right: -7, bottom: "100%", marginBottom: 6 }) }}>{m.label}</span> : null}
              </div>
            );
          })}
        </div>
      </div>
      {sc.label ? <div className={`tag ${sc.labelColor ?? "blue"}`} style={{ left: 50, top: top - 34, fontSize: 36, boxShadow: `0 6px 0 ${C.shadow}`, ...pop(f, 4, { dx: -30, dy: 0, len: 8 }) }}>{sc.label}</div> : null}
      {sc.note ? (
        <div className="card" style={{ left: 70, right: 70, top: top + h + 44, padding: "24px 32px", borderLeft: `16px solid ${COLOR[sc.note.color ?? "orange"]}`, fontSize: 44, fontWeight: 800, lineHeight: 1.3, ...pop(f, clock.at(sc.note.cue, 2), { dy: 30 }) }}>{rich(sc.note.t)}</div>
      ) : null}
    </Chrome>
  );
};

// ── Kết: con số đáng nhớ + bước tiếp theo cụ thể. KHÔNG hỏi "bình luận bên dưới". ──
const End: React.FC<SP> = (p) => {
  const f = useCurrentFrame();
  const { sc, script, clock } = p;
  const big = sc.big as { label: string; before?: string; after: string; cue: string };
  const nx = sc.next as { h?: string; t: string; cue: string };
  const bf = clock.at(big.cue, 0);
  const nf = clock.at(nx.cue, 1);
  return (
    <Chrome {...p}>
      <div className="card" style={{ left: 70, right: 70, top: 600, padding: "36px 40px", textAlign: "center", ...pop(f, bf, { dy: 40 }) }}>
        <div style={{ fontSize: 46, fontWeight: 800, color: C.muted }}>{big.label}</div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 30, marginTop: 10 }}>
          {big.before ? <span style={{ fontSize: 110, fontWeight: 800, color: C.grey, textDecoration: "line-through" }}>{big.before}</span> : null}
          {big.before ? <span style={{ fontSize: 90, fontWeight: 900, color: C.red }}>→</span> : null}
          <Roll before={big.before} after={big.after} from={bf + 6} size={190} />
        </div>
      </div>
      <div className="card" style={{ left: 70, right: 70, top: 1010, padding: "34px 40px", borderLeft: `18px solid ${C.orange}`, ...pop(f, nf, { dx: 80, dy: 0 }) }}>
        <span className="tag orange" style={{ position: "static", display: "inline-block" }}>{nx.h ?? "Lần tới"}</span>
        <div style={{ fontSize: 54, fontWeight: 900, lineHeight: 1.28, marginTop: 18, whiteSpace: "pre-line" }}>{rich(nx.t)}</div>
      </div>
      <Foot script={script} style={{ bottom: "auto", top: 1440, ...pop(f, nf + 20, { dy: 20 }) }} />
    </Chrome>
  );
};

const SCENES: Record<string, React.FC<SP>> = { "n-cover": Cover, "n-points": Points, "n-prompt": Prompt, "n-flow": Flow, "n-chat": Chat, "n-compare": Compare, "n-score": Score, "n-outro": Outro, "n-shot": Shot, "n-end": End };

/** Phụ đề từng chữ: đã đọc = xanh đậm, chưa đọc = xám xanh, chữ khoá của cảnh = xanh dương. Ẩn trên bìa. */
const Subtitle: React.FC<Props> = ({ script, timeline }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  let si = -1;
  let cau: (typeof timeline.scenes)[number]["caus"][number] | undefined;
  timeline.scenes.forEach((s, i) => {
    if (cau) return;
    const c = s.caus.find((x) => t >= x.start - 0.05 && t <= x.end + 0.15);
    if (c) { cau = c; si = i; }
  });
  if (!cau || script.scenes[si]?.type === "n-cover") return null;
  const words = cau.text.split(/\s+/);
  const tw = (cau as { words?: { start: number }[] }).words ?? [];
  const daDoc = tw.length ? Math.round((tw.filter((w) => w.start <= t).length / tw.length) * words.length) : Math.round(interpolate(t, [cau.start, cau.end], [0, words.length], clamp));
  // đánh dấu chữ khoá
  const keys = ((script.scenes[si] as S).keys as string[] | undefined) ?? [];
  const nw = words.map((w) => norm(w));
  const idx = nw.map((w, i) => (w ? i : -1)).filter((i) => i >= 0);
  const isKey = new Set<number>();
  for (const k of keys) {
    const kw = norm(k).split(" ");
    for (let a = 0; a + kw.length <= idx.length; a++) {
      if (kw.every((w, j) => nw[idx[a + j]] === w)) for (let j = 0; j < kw.length; j++) isKey.add(idx[a + j]);
    }
  }
  return (
    <div style={{ position: "absolute", left: 60, right: 60, bottom: 130, display: "flex", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 30, padding: "22px 36px", maxWidth: 940, textAlign: "center", fontSize: 46, fontWeight: 700, lineHeight: 1.3, boxShadow: `0 8px 0 ${C.shadow}` }}>
        {words.map((w, i) => (
          <span key={i} style={{ color: isKey.has(i) ? (i < daDoc ? C.blue : "#9fc0ea") : i < daDoc ? C.navy : "#9fb3c8", fontWeight: isKey.has(i) ? 900 : 700 }}>{w}{i < words.length - 1 ? " " : ""}</span>
        ))}
      </div>
    </div>
  );
};

/** Toàn bộ video kiểu "Bản tin sơ đồ" (theme "bantin"). */
export const BantinVideo: React.FC<Props> = (props) => {
  const { script, timeline } = props;
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const starts = timeline.scenes.map((s, i) => (i === 0 ? 0 : Math.round(s.start * fps)));
  const coverEnd = script.scenes[0]?.type === "n-cover" ? (starts[1] ?? durationInFrames) : 0;
  return (
    <AbsoluteFill className="bt" style={{ background: C.bg, backgroundImage: `linear-gradient(${C.grid} 2px, transparent 2px), linear-gradient(90deg, ${C.grid} 2px, transparent 2px)`, backgroundSize: "60px 60px", overflow: "hidden" }}>
      <style>{CSS}</style>
      {props.silent ? null : <Audio src={staticFile(`${script.id}/voice.mp3`)} />}
      {script.scenes.map((sc, i) => {
        const Comp = SCENES[sc.type];
        if (!Comp) return null;
        const from = starts[i];
        const dur = (starts[i + 1] ?? durationInFrames) - from;
        return (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <Comp sc={sc as S} script={script} clock={makeClock(timeline.scenes[i], fps, dur)} />
          </Sequence>
        );
      })}
      {f >= coverEnd ? <div style={{ position: "absolute", top: 0, left: 0, height: 10, width: `${(f / durationInFrames) * 100}%`, background: C.orange }} /> : null}
      <Subtitle {...props} />
    </AbsoluteFill>
  );
};
