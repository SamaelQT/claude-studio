/**
 * Bộ cảnh "bản vẽ kỹ thuật đêm" (tuần 2 — loạt "Dùng AI đúng cách", trí nhớ của AI).
 * Style bible: nền đen than + lưới mờ, MỘT màu nhấn cam đỏ, chữ grotesk rất đậm + mono kiểu terminal,
 * nhãn góc "PL. 02 — …", "BƯỚC 02 / 03", khung góc vuông, vài trang giấy kem chữ serif; easing "giữ → giật" (outExpo).
 * Luật cấm: không neon tím, không "mưa code", không logo hãng, không cảnh cảnh báo cuối video.
 * Các cảnh đăng ký trong SCENES với tiền tố "d-".
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { Scene, Script } from "./types";
import { prog } from "./anim";

type SP = { sc: Scene; script: Script; dur: number };

export const D = {
  bg: "#0D0E10",
  bg2: "#15171A",
  grid: "rgba(255,255,255,0.045)",
  ink: "#F2EEE8",
  muted: "#8A8F98",
  dim: "#3A3E45",
  acc: "#FF5A1F",
  accSoft: "rgba(255,90,31,0.14)",
  ok: "#4ADE80",
  cream: "#EFE9DD",
  creamInk: "#1D1B18",
};
const MONO = `"Cascadia Mono", "Consolas", monospace`;
const SERIF = `"Georgia", "Times New Roman", serif`;

/** Easing "giữ → giật": đứng yên tới `a`, rồi bật nhanh tới đích trong `d` khung (outExpo). */
const snap = (f: number, a: number, d = 9) => {
  const x = Math.min(1, Math.max(0, (f - a) / d));
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
};
const vao = (f: number, a: number, dy = 40): React.CSSProperties => {
  const p = snap(f, a);
  return { opacity: Math.min(1, p * 1.6), transform: `translateY(${(1 - p) * dy}px)` };
};

/** Khung góc vuông (4 góc) quanh một vùng. */
const Corners: React.FC<{ color?: string; size?: number; inset?: number }> = ({ color = D.dim, size = 26, inset = 0 }) => (
  <>
    {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y], i) => (
      <div key={i} style={{ position: "absolute", width: size, height: size, [x ? "right" : "left"]: inset, [y ? "bottom" : "top"]: inset,
        borderTop: y ? "none" : `3px solid ${color}`, borderBottom: y ? `3px solid ${color}` : "none",
        borderLeft: x ? "none" : `3px solid ${color}`, borderRight: x ? `3px solid ${color}` : "none" } as React.CSSProperties} />
    ))}
  </>
);

/** Nhãn kỹ thuật nhỏ: "PL. 03 — TÊN" bên trái, "BƯỚC 01 / 03" + vạch tiến độ bên phải. */
const Plate: React.FC<{ pl?: string; step?: [number, number] }> = ({ pl, step }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: MONO, fontSize: 22, color: D.muted, letterSpacing: 2, marginBottom: 30 }}>
    <span>{pl ?? ""}</span>
    {step ? (
      <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ color: D.acc }}>BƯỚC {String(step[0]).padStart(2, "0")} / {String(step[1]).padStart(2, "0")}</span>
        <span style={{ display: "flex", gap: 6 }}>{Array.from({ length: step[1] }, (_, i) => <span key={i} style={{ width: 26, height: 6, background: i < step[0] ? D.acc : D.dim }} />)}</span>
      </span>
    ) : null}
  </div>
);

/** Tiêu đề lớn hiện từng từ (giữ → giật), từ khoá trong [[…]] tô cam. */
const BigTitle: React.FC<{ text: string; at?: number; size?: number; step?: number }> = ({ text, at = 2, size = 96, step = 4 }) => {
  const f = useCurrentFrame();
  const tokens = text.split(/(\[\[.*?\]\])/).flatMap((p) => (p.startsWith("[[") ? [{ w: p.slice(2, -2), hot: true }] : p.split(/\s+/).filter(Boolean).map((w) => ({ w, hot: false }))));
  return (
    <div style={{ fontSize: size, fontWeight: 900, lineHeight: 1.02, color: D.ink, letterSpacing: -1 }}>
      {tokens.map((t, i) => (
        <span key={i} style={{ display: "inline-block", marginRight: size * 0.22, color: t.hot ? D.acc : D.ink, ...vao(f, at + i * step, 30) }}>{t.w}</span>
      ))}
    </div>
  );
};

// ── Cảnh ─────────────────────────────────────────────────────────────────────

/** Bìa: khung chat rất dài bị cắt, thanh cuộn tí hon, tiêu đề lớn. Khung 0 phải đẹp sẵn. */
export const DCover: React.FC<SP> = ({ sc, script }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", inset: 0, background: D.bg, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${D.grid} 2px, transparent 2px), linear-gradient(90deg, ${D.grid} 2px, transparent 2px)`, backgroundSize: "60px 60px" }} />
      <div style={{ position: "absolute", left: 40, right: 40, top: 40, bottom: 40 }}><Corners color={D.dim} size={40} /></div>
      <div style={{ position: "absolute", top: 80, left: 80, right: 80, display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 24, color: D.muted, letterSpacing: 3 }}>
        <span>{script.series}</span><span style={{ color: D.acc }}>{String(sc.tag ?? "")}</span>
      </div>
      <div style={{ position: "absolute", top: 230, left: 80, right: 80 }}>
        <div style={{ fontSize: 150, fontWeight: 900, color: D.ink, lineHeight: 0.98, letterSpacing: -3 }}>{String(sc.line1)}</div>
        <div style={{ fontSize: 120, fontWeight: 900, color: D.acc, lineHeight: 1.02, letterSpacing: -2, marginTop: 10 }}>{String(sc.line2)}</div>
        <div style={{ marginTop: 40, display: "inline-block", fontFamily: MONO, fontSize: 36, color: D.bg, background: D.ink, padding: "10px 24px" }}>{String(sc.hook)}</div>
      </div>
      {/* minh hoạ: khung chat dài vô tận + thanh cuộn nhỏ xíu + tin đầu tiên mờ dần phía trên */}
      <div style={{ position: "absolute", left: 80, right: 80, top: 980, height: 640, border: `3px solid ${D.dim}`, background: D.bg2, overflow: "hidden" }}>
        <div style={{ position: "absolute", right: 14, top: 14, bottom: 14, width: 10, background: D.dim }}>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 14, background: D.acc }} />
        </div>
        <div style={{ position: "absolute", left: 30, right: 50, top: -40, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ alignSelf: "flex-end", fontFamily: MONO, fontSize: 26, color: D.acc, border: `2px dashed ${D.acc}`, padding: "10px 16px", opacity: 0.55 }}>#001 QUY ƯỚC: bảng 4 cột…</div>
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} style={{ alignSelf: i % 2 ? "flex-start" : "flex-end", width: `${[62, 78, 55, 70, 48, 74, 60, 66, 52][i]}%`, height: 54, background: i % 2 ? "#23262B" : "#2C2F35", opacity: 0.35 + i * 0.07 }} />
          ))}
        </div>
        <div style={{ position: "absolute", left: 30, bottom: 26, fontFamily: MONO, fontSize: 30, color: D.ink }}>
          #187 <span style={{ color: D.acc }}>AI: …bảng 3 cột?</span><span style={{ opacity: f % 20 < 10 ? 1 : 0 }}>▌</span>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 80, left: 80, right: 80, display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 24, color: D.muted }}>
        <span>AI SHARING TIPS CHALLENGE 2026</span><span style={{ color: D.ink }}>{script.author}</span>
      </div>
    </div>
  );
};

/** Mở đầu: cột tin nhắn cuộn vèo lên, bộ đếm tin nhảy tới #187, tin cuối AI làm sai quy ước bị khoanh. */
export const DHook: React.FC<SP> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  const n = Math.round(interpolate(f, [6, dur * 0.55], [1, Number(sc.count ?? 187)], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const scroll = interpolate(f, [6, dur * 0.55], [0, 2600], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  const flag = snap(f, dur * 0.58);
  return (
    <div style={{ padding: "0 70px" }}>
      <Plate pl="PL. 01 — VẤN ĐỀ" />
      <BigTitle text={String(sc.big)} size={84} />
      <div style={{ position: "relative", marginTop: 40, height: 720, border: `3px solid ${D.dim}`, background: D.bg2, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 24, right: 24, bottom: 120 - scroll, display: "flex", flexDirection: "column", gap: 16 }}>
          {Array.from({ length: 48 }, (_, i) => (
            <div key={i} style={{ alignSelf: i % 2 ? "flex-start" : "flex-end", width: `${45 + ((i * 37) % 40)}%`, height: 46, background: i % 2 ? "#23262B" : "#2C2F35" }} />
          ))}
        </div>
        <div style={{ position: "absolute", top: 18, right: 18, fontFamily: MONO, fontSize: 40, color: D.bg, background: D.acc, padding: "6px 16px" }}>#{n}</div>
        <div style={{ position: "absolute", left: 24, right: 24, bottom: 20, background: D.bg, border: `3px solid ${flag > 0.5 ? D.acc : D.dim}`, padding: "18px 22px", fontFamily: MONO, fontSize: 30, color: D.ink, opacity: flag }}>
          <span style={{ color: D.muted }}>AI ›</span> {String(sc.wrong)}
        </div>
      </div>
      <div style={{ marginTop: 30, fontFamily: MONO, fontSize: 34, color: D.acc, ...vao(f, dur * 0.62) }}>{String(sc.sub)}</div>
    </div>
  );
};

/**
 * Vì sao: "bộ nhớ" của AI là một ô cố định; tin mới vào từ dưới, tin cũ bị đẩy ra trên.
 * Tin #001 (quy ước quan trọng) trôi ra khỏi ô và mờ đi.
 */
export const DMemory: React.FC<SP> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  const notes = (sc.notes as string[]) ?? [];
  const p = interpolate(f, [12, dur * 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rowH = 74;
  const rows = 14;
  const shift = p * rowH * 7;   // tin mới vào từ dưới → cả cột trôi lên, #001 bị đẩy ra khỏi ô
  return (
    <div style={{ padding: "0 70px" }}>
      <Plate pl="PL. 02 — VÌ SAO" />
      <BigTitle text={String(sc.heading)} size={80} />
      <div style={{ display: "flex", gap: 40, marginTop: 40, alignItems: "center" }}>
        <div style={{ position: "relative", width: 520, height: 600 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 80, height: 440, border: `4px solid ${D.acc}`, background: D.accSoft }} />
          <div style={{ position: "absolute", left: 0, top: 40, fontFamily: MONO, fontSize: 22, color: D.acc }}>BỘ NHỚ CỦA AI (CÓ HẠN)</div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 80, height: 440, overflow: "hidden" }}>
            {Array.from({ length: rows }, (_, i) => {
              const y = 10 + i * rowH - shift;
              const first = i === 0;
              const out = y < 0;
              return (
                <div key={i} style={{ position: "absolute", left: 20, right: 20, top: y, height: rowH - 14, background: first ? "transparent" : "#2C2F35", border: first ? `3px dashed ${D.acc}` : "none",
                  fontFamily: MONO, fontSize: 22, color: first ? D.acc : D.muted, display: "flex", alignItems: "center", padding: "0 16px", boxSizing: "border-box", opacity: out ? 0.25 : 1 }}>
                  {first ? "#001 QUY ƯỚC đã dặn" : `#${String(i + 1).padStart(3, "0")}`}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 26 }}>
          {notes.map((t, i) => (
            <div key={i} style={{ ...vao(f, 20 + i * Math.floor(dur * 0.15)), borderLeft: `6px solid ${D.acc}`, paddingLeft: 20, fontSize: 36, fontWeight: 800, color: D.ink, lineHeight: 1.2 }}>{t}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** AI TIP: danh sách bước, bước hiện tại sáng cam, các bước khác mờ. */
export const DSteps: React.FC<SP> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  const steps = sc.steps as { t: string; d: string }[];
  const per = (dur * 0.8) / steps.length;
  const cur = Math.min(steps.length - 1, Math.floor(Math.max(0, f - 10) / per));
  return (
    <div style={{ padding: "0 70px" }}>
      <Plate pl="PL. 03 — AI TIP" step={[cur + 1, steps.length]} />
      <BigTitle text={String(sc.heading)} size={84} />
      <div style={{ marginTop: 50, display: "flex", flexDirection: "column", gap: 22 }}>
        {steps.map((s, i) => {
          const on = i === cur;
          const done = i < cur;
          return (
            <div key={i} style={{ ...vao(f, 8 + i * 5), position: "relative", display: "flex", gap: 28, alignItems: "center", padding: "30px 30px", background: on ? D.accSoft : D.bg2, opacity: on ? 1 : done ? 0.7 : 0.4 }}>
              <Corners color={on ? D.acc : D.dim} size={22} />
              <div style={{ fontFamily: MONO, fontSize: 64, fontWeight: 700, color: on ? D.acc : D.muted, width: 110 }}>{String(i + 1).padStart(2, "0")}</div>
              <div>
                <div style={{ fontSize: 44, fontWeight: 900, color: D.ink }}>{s.t}</div>
                <div style={{ fontFamily: MONO, fontSize: 26, color: D.muted, marginTop: 8 }}>{s.d}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Câu lệnh mẫu: cửa sổ terminal, gõ dần, dòng quan trọng sáng cam. */
export const DPrompt: React.FC<SP> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  const lines = sc.lines as string[];
  const hot = (sc.hot as number[]) ?? [];
  const total = lines.join("\n").length;
  const shown = Math.floor(prog(f, 8, dur * 0.55) * total);
  let used = 0;
  return (
    <div style={{ padding: "0 60px" }}>
      <Plate pl="PL. 04 — CÂU LỆNH" />
      <BigTitle text={String(sc.heading)} size={80} />
      <div style={{ position: "relative", marginTop: 40, background: "#08090A", border: `3px solid ${D.dim}`, padding: "30px 34px" }}>
        <div style={{ fontFamily: MONO, fontSize: 22, color: D.muted, marginBottom: 20 }}>✻ dán vào cuối cuộc trò chuyện cũ</div>
        {lines.map((l, i) => {
          const take = Math.max(0, Math.min(l.length, shown - used));
          used += l.length + 1;
          const isHot = hot.includes(i) && f > dur * 0.6;
          return (
            <div key={i} style={{ fontFamily: MONO, fontSize: 32, lineHeight: 1.45, color: isHot ? D.bg : take ? D.ink : D.dim, background: isHot ? D.acc : "transparent", padding: isHot ? "2px 10px" : "2px 0", marginBottom: 6 }}>
              <span style={{ color: isHot ? D.bg : D.acc }}>{take ? "› " : "  "}</span>{l.slice(0, take)}{take > 0 && take < l.length ? <span style={{ color: D.acc }}>▌</span> : null}
            </div>
          );
        })}
      </div>
      {sc.note ? <div style={{ marginTop: 30, fontFamily: MONO, fontSize: 30, color: D.acc, ...vao(f, dur * 0.7) }}>{String(sc.note)}</div> : null}
    </div>
  );
};

/** Bản bàn giao: trang giấy kem hiện ra, rồi "giật" bay vào khung chat MỚI (trống), dòng "tiếp tục từ đây". */
export const DHandoff: React.FC<SP> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  const items = sc.items as [string, string][];
  const flyAt = Math.round(dur * 0.55);
  const fly = snap(f, flyAt, 14);
  const step = Math.max(6, Math.floor((dur * 0.35) / items.length));
  return (
    <div style={{ padding: "0 60px" }}>
      <Plate pl="PL. 05 — BẢN BÀN GIAO" />
      <div style={{ position: "relative", height: 1150 }}>
        {/* khung chat mới */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 640, height: 500, border: `3px solid ${fly > 0.5 ? D.acc : D.dim}`, background: D.bg2, opacity: snap(f, flyAt - 12) }}>
          <div style={{ fontFamily: MONO, fontSize: 24, color: D.acc, padding: "16px 22px", borderBottom: `2px solid ${D.dim}` }}>+ CUỘC TRÒ CHUYỆN MỚI</div>
          <div style={{ position: "absolute", left: 22, right: 22, bottom: 24, fontFamily: MONO, fontSize: 30, color: D.ink, opacity: snap(f, flyAt + 16) }}>
            <span style={{ color: D.muted }}>Bạn ›</span> {String(sc.cont)}
          </div>
          <div style={{ position: "absolute", left: 22, right: 22, bottom: 90, fontFamily: MONO, fontSize: 28, color: D.ok, opacity: snap(f, flyAt + 30) }}>AI › {String(sc.reply)}</div>
        </div>
        {/* trang giấy bàn giao */}
        <div style={{ position: "absolute", left: 30, right: 30, top: 0, background: D.cream, color: D.creamInk, padding: "36px 40px", boxShadow: "0 30px 70px rgba(0,0,0,0.6)",
          transform: `translateY(${fly * 680}px) scale(${1 - 0.55 * fly})`, transformOrigin: "50% 0%", opacity: snap(f, 2) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 58 }}>Bản bàn giao</div>
            <div style={{ border: `4px solid ${D.acc}`, color: D.acc, fontWeight: 900, fontSize: 34, padding: "2px 14px", transform: "rotate(6deg)" }}>01</div>
          </div>
          <div style={{ height: 2, background: "#CFC6B5", margin: "16px 0 22px" }} />
          {items.map(([k, v], i) => (
            <div key={i} style={{ display: "flex", gap: 18, fontSize: 30, lineHeight: 1.35, marginBottom: 14, opacity: snap(f, 8 + i * step) }}>
              <div style={{ fontFamily: MONO, fontSize: 22, color: D.acc, width: 170, flex: "none", paddingTop: 6 }}>{k}</div>
              <div style={{ fontWeight: k.startsWith("DỄ SAI") ? 800 : 500 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** So sánh trước / sau: 2 cột, dòng nào cũng đổi từ xám → cam/xanh theo nhịp. */
export const DCompare: React.FC<SP> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  const rows = sc.rows as [string, string, string][];
  const step = Math.max(10, Math.floor((dur * 0.6) / rows.length));
  return (
    <div style={{ padding: "0 60px" }}>
      <Plate pl="PL. 06 — RESULT" />
      <BigTitle text={String(sc.heading)} size={84} />
      <div style={{ display: "flex", fontFamily: MONO, fontSize: 24, color: D.muted, marginTop: 44, marginBottom: 14 }}>
        <div style={{ width: 250 }} /><div style={{ flex: 1 }}>CHAT CŨ</div><div style={{ flex: 1, color: D.acc }}>CHAT MỚI + BÀN GIAO</div>
      </div>
      {rows.map(([k, a, b], i) => {
        const at = 10 + i * step;
        return (
          <div key={i} style={{ ...vao(f, at), display: "flex", alignItems: "stretch", borderTop: `2px solid ${D.dim}`, padding: "26px 0" }}>
            <div style={{ width: 250, fontFamily: MONO, fontSize: 24, color: D.muted, paddingTop: 6 }}>{k}</div>
            <div style={{ flex: 1, fontSize: 36, fontWeight: 700, color: D.muted, textDecoration: snap(f, at + 8) > 0.5 ? "line-through" : "none" }}>{a}</div>
            <div style={{ flex: 1, fontSize: 36, fontWeight: 900, color: D.ink, opacity: snap(f, at + 10) }}><span style={{ color: D.acc }}>→ </span>{b}</div>
          </div>
        );
      })}
    </div>
  );
};

/** Khi nào nên mở chat mới: 3 dấu hiệu dạng "đèn báo". */
export const DSigns: React.FC<SP> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  const items = sc.items as string[];
  const step = Math.max(10, Math.floor((dur * 0.6) / items.length));
  return (
    <div style={{ padding: "0 70px" }}>
      <Plate pl="PL. 07 — DẤU HIỆU" />
      <BigTitle text={String(sc.heading)} size={84} />
      <div style={{ marginTop: 50, display: "flex", flexDirection: "column", gap: 26 }}>
        {items.map((t, i) => {
          const on = snap(f, 10 + i * step);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 30, opacity: 0.3 + 0.7 * on }}>
              <div style={{ width: 64, height: 64, borderRadius: 32, background: on > 0.5 ? D.acc : D.dim, boxShadow: on > 0.5 ? `0 0 40px ${D.acc}` : "none", flex: "none" }} />
              <div style={{ fontSize: 46, fontWeight: 900, color: D.ink, lineHeight: 1.15 }}>{t}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 60, display: "inline-block", background: D.acc, color: D.bg, fontSize: 44, fontWeight: 900, padding: "16px 34px", ...vao(f, 14 + items.length * step) }}>{String(sc.cta)}</div>
    </div>
  );
};

export const DOutro: React.FC<SP> = ({ sc, script }) => {
  const f = useCurrentFrame();
  const tools = (sc.tools as string[]) ?? [];
  return (
    <div style={{ padding: "0 70px" }}>
      <Plate pl="PL. 08 — HẾT" />
      <BigTitle text={String(sc.line)} size={88} />
      <div style={{ display: "flex", gap: 16, marginTop: 50, ...vao(f, 20) }}>
        {tools.map((t) => <div key={t} style={{ position: "relative", fontFamily: MONO, fontSize: 32, color: D.ink, padding: "14px 24px", background: D.bg2 }}><Corners size={14} />{t}</div>)}
      </div>
      <div style={{ marginTop: 90, fontFamily: MONO, fontSize: 28, color: D.muted, ...vao(f, 30) }}>{script.series} · {script.author}</div>
      <div style={{ marginTop: 30, display: "inline-block", background: D.acc, color: D.bg, fontSize: 44, fontWeight: 900, padding: "16px 34px", ...vao(f, 38) }}>{String(sc.cta)} ↓</div>
    </div>
  );
};

export const DARK_SCENES: Record<string, React.FC<SP>> = {
  "d-cover": DCover, "d-hook": DHook, "d-memory": DMemory, "d-steps": DSteps, "d-prompt": DPrompt,
  "d-handoff": DHandoff, "d-compare": DCompare, "d-signs": DSigns, "d-outro": DOutro,
};
