/**
 * Bộ cảnh "giấy + bút đỏ" (video 2 — AI soát lỗi văn bản). Tone khác hẳn bộ xanh lá của video 1:
 * nền giấy trắng ngà, chữ mực đen, khoanh bút đỏ, chú thích viết tay (Segoe Print), máy soi quét dọc trang.
 * Các cảnh đăng ký trong SCENES với tiền tố "p-".
 */
import React, { createContext, useContext } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene, Script } from "./types";
import { prog } from "./anim";

type SP = { sc: Scene; script: Script; dur: number };

export const P = {
  bg1: "#F7F3EA",
  bg2: "#EDE6D6",
  paper: "#FFFEFA",
  ink: "#1C1B19",
  muted: "#6B665C",
  line: "#D9D1BF",
  red: "#D62F2F",
  redSoft: "#FBE3E0",
  blue: "#1F4E9C",
  green: "#1E7B47",
  greenSoft: "#E2F1E7",
  dark: "#22201C",
};
const SERIF = `"Times New Roman", "Cambria", serif`;
const HAND = `"Segoe Print", "Segoe Script", "Comic Sans MS", cursive`;
const MONO = `"Cascadia Mono", "Consolas", monospace`;
const paperShadow = "0 24px 60px rgba(40, 30, 10, 0.16), 0 3px 8px rgba(40, 30, 10, 0.08)";

function usePopAt() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (delay: number, damping = 14) => spring({ frame: f - delay, fps, config: { damping, mass: 0.6 } });
}
const pop = (p: number, dy = 34): React.CSSProperties => ({
  opacity: Math.min(1, p * 1.4),
  transform: `translateY(${(1 - p) * dy}px) scale(${0.95 + 0.05 * p})`,
});

/** Tiêu đề cảnh: chữ đen, gạch chân bút đỏ vẽ dần. */
const Title: React.FC<{ text?: string; kicker?: string }> = ({ text, kicker }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  if (!text) return null;
  return (
    <div style={{ textAlign: "center", marginBottom: 46 }}>
      {kicker ? <div style={{ ...pop(at(0)), display: "inline-block", fontSize: 30, fontWeight: 800, letterSpacing: 3, color: P.red, border: `3px solid ${P.red}`, padding: "6px 22px", borderRadius: 10, marginBottom: 22 }}>{kicker}</div> : null}
      <div style={{ ...pop(at(2), 20), fontSize: 66, fontWeight: 900, color: P.ink, lineHeight: 1.12 }}>{text}</div>
      <svg width="420" height="26" viewBox="0 0 420 26" style={{ display: "block", margin: "10px auto 0" }}>
        <path d="M6 16 C 90 6, 200 22, 300 10 S 400 14, 414 12" fill="none" stroke={P.red} strokeWidth="7" strokeLinecap="round"
          strokeDasharray="460" strokeDashoffset={460 * (1 - prog(f, 6, 20))} />
      </svg>
    </div>
  );
};

// ── Văn bản mẫu: "Đề nghị thanh toán" cài sẵn 5 lỗi ───────────────────────────
/** Mỗi lỗi: id, chú thích viết tay, vị trí nhãn (trên/dưới). */
export const LOI: Record<number, { note: string; side: "top" | "bottom" | "right"; align?: "left" | "right" }> = {
  1: { note: "23/10/2026 là thứ Sáu!", side: "bottom", align: "right" },
  2: { note: "Cộng đúng = 13.550.000", side: "top", align: "right" },
  3: { note: "Chữ ≠ số 14.850.000", side: "top", align: "left" },
  4: { note: "Khác tên ở trên?", side: "right" },
  5: { note: "Bảng ghi 10 thùng", side: "bottom", align: "left" },
};

/** circle(id) → 0..1 (đang vẽ / đã vẽ xong). */
const CircleCtx = createContext<(id: number) => number>(() => 0);

/** Khoanh đỏ quanh một đoạn chữ: elip vẽ dần + nhãn viết tay bật ra. */
const E: React.FC<{ id: number; children: React.ReactNode }> = ({ id, children }) => {
  const p = useContext(CircleCtx)(id);
  const loi = LOI[id];
  const nhan = interpolate(p, [0.55, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ background: p > 0.4 ? `rgba(214,47,47,${0.1 * nhan})` : "transparent", borderRadius: 6 }}>{children}</span>
      {p > 0 ? (
        <>
          <svg style={{ position: "absolute", left: -16, top: -12, width: "calc(100% + 32px)", height: "calc(100% + 24px)", overflow: "visible", pointerEvents: "none" }} viewBox="0 0 100 40" preserveAspectRatio="none">
            <path d="M 8 6 C 30 -2, 80 -1, 95 10 C 104 20, 90 38, 50 38 C 12 38, -2 28, 4 16 C 7 9, 18 4, 30 3" fill="none" stroke={P.red} strokeWidth="2.6"
              vectorEffect="non-scaling-stroke" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, p / 0.55)}
              style={{ strokeWidth: 5 }} />
          </svg>
          <span style={{
            position: "absolute",
            ...(loi.side === "right" ? { left: "calc(100% + 26px)", top: "50%" }
              : { [loi.side === "top" ? "bottom" : "top"]: "calc(100% + 14px)", ...(loi.align === "right" ? { right: -10 } : loi.align === "left" ? { left: -10 } : { left: "50%" }) }),
            transform: `${loi.side === "right" ? "translateY(-50%)" : !loi.align ? "translateX(-50%)" : ""} rotate(-3deg) scale(${0.6 + 0.4 * nhan})`, opacity: nhan,
            whiteSpace: "nowrap", fontFamily: HAND, fontSize: 25, fontWeight: 700, color: "#fff", background: P.red,
            padding: "4px 14px", borderRadius: 10, boxShadow: "0 6px 16px rgba(214,47,47,0.35)", zIndex: 5,
          } as React.CSSProperties}>
            <b style={{ fontFamily: "Segoe UI", marginRight: 8 }}>{id}</b>{loi.note}
          </span>
        </>
      ) : null}
    </span>
  );
};

const ROWS = [
  ["1", "Giấy A4 (thùng)", "10", "650.000", "6.500.000"],
  ["2", "Mực in laser (hộp)", "4", "1.200.000", "4.800.000"],
  ["3", "Bìa hồ sơ (xấp)", "25", "90.000", "2.250.000"],
];
const COLW = [60, 330, 70, 170, 190];

/** Tờ "Đề nghị thanh toán" (rộng 940). Toạ độ trong trang dùng cho zoom: % theo chiều rộng / cao của tờ giấy. */
export const Doc: React.FC<{ circle?: (id: number) => number; scanY?: number }> = ({ circle = () => 0, scanY }) => {
  const cell = (v: string, k: number, head = false, extra: React.CSSProperties = {}) => (
    <div key={k} style={{ width: COLW[k], padding: "9px 10px", boxSizing: "border-box", borderRight: k < 4 ? `1.5px solid ${P.ink}` : "none", textAlign: k >= 2 ? "right" : k === 0 ? "center" : "left", fontWeight: head ? 700 : 400, ...extra }}>{v}</div>
  );
  return (
    <CircleCtx.Provider value={circle}>
      <div style={{ position: "relative", width: 940, background: P.paper, boxShadow: paperShadow, borderRadius: 6, padding: "44px 48px 40px", boxSizing: "border-box", fontFamily: SERIF, color: P.ink, fontSize: 26, lineHeight: 1.45 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 19, lineHeight: 1.35, textAlign: "center" }}>
          <div><b>CHI NHÁNH ĐỒNG NAI</b><br />PHÒNG HÀNH CHÍNH<br />Số: 125/ĐNTT-HC</div>
          <div><b>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br /><u>Độc lập – Tự do – Hạnh phúc</u></div>
        </div>
        <div style={{ textAlign: "right", fontStyle: "italic", marginTop: 18 }}>Đồng Nai, <E id={1}>Thứ Năm, ngày 23/10/2026</E></div>
        <div style={{ textAlign: "center", fontSize: 40, fontWeight: 700, margin: "62px 0 18px", letterSpacing: 1 }}>ĐỀ NGHỊ THANH TOÁN</div>
        <div>Kính gửi: <b>Phòng Kế toán</b></div>
        <div>Nội dung: Thanh toán tiền văn phòng phẩm tháng 10/2026 cho <b>Công ty TNHH Minh Phát</b>.</div>
        <div style={{ border: `1.5px solid ${P.ink}`, marginTop: 16, fontSize: 23 }}>
          <div style={{ display: "flex", background: "#F1ECE0" }}>{["STT", "Nội dung", "SL", "Đơn giá", "Thành tiền"].map((v, k) => cell(v, k, true))}</div>
          {ROWS.map((r, i) => <div key={i} style={{ display: "flex", borderTop: `1.5px solid ${P.ink}` }}>{r.map((v, k) => cell(v, k))}</div>)}
          {[["Cộng tiền hàng", "13.750.000", 2], ["Thuế GTGT 8%", "1.100.000", 0], ["Tổng cộng", "14.850.000", 0]].map(([l, v, err]) => (
            <div key={String(l)} style={{ display: "flex", borderTop: `1.5px solid ${P.ink}`, fontWeight: l === "Tổng cộng" ? 700 : 400 }}>
              <div style={{ width: COLW[0] + COLW[1] + COLW[2] + COLW[3], padding: "9px 10px", boxSizing: "border-box", borderRight: `1.5px solid ${P.ink}`, textAlign: "right" }}>{l}</div>
              <div style={{ width: COLW[4], padding: "9px 10px", boxSizing: "border-box", textAlign: "right" }}>{err ? <E id={Number(err)}>{v}</E> : v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>Bằng chữ: <i><E id={3}>Mười bốn triệu năm trăm tám mươi nghìn đồng</E>.</i></div>
        <div style={{ marginTop: 6 }}>Đơn vị thụ hưởng: <E id={4}><b>Công ty TNHH Minh Phát Lộc</b></E></div>
        <div>Số tài khoản: 0123 456 789 – Ngân hàng ABC</div>
        <div style={{ marginTop: 6 }}>Ghi chú: Đã nhận đủ hàng theo biên bản giao nhận ngày 20/10/2026 (<E id={5}>12 thùng giấy A4</E>, 4 hộp mực, 25 xấp bìa).</div>
        <div style={{ display: "flex", justifyContent: "space-around", marginTop: 34, fontSize: 22, fontWeight: 700, textAlign: "center" }}>
          {["Người đề nghị", "Trưởng phòng", "Kế toán trưởng"].map((t) => <div key={t}>{t}<div style={{ fontWeight: 400, fontStyle: "italic", fontSize: 18, color: P.muted }}>(Ký, ghi rõ họ tên)</div></div>)}
        </div>
        {scanY !== undefined && scanY > 0 && scanY < 1 ? (
          <div style={{ position: "absolute", left: 0, right: 0, top: `${scanY * 100}%`, height: 120, transform: "translateY(-100%)", background: "linear-gradient(180deg, rgba(214,47,47,0) 0%, rgba(214,47,47,0.10) 80%, rgba(214,47,47,0.55) 100%)", borderBottom: `4px solid ${P.red}`, pointerEvents: "none" }} />
        ) : null}
      </div>
    </CircleCtx.Provider>
  );
};

// ── Các cảnh ─────────────────────────────────────────────────────────────────

/** Bìa: tờ giấy nghiêng, tiêu đề lớn, "5 lỗi" khoanh đỏ. Khung 0 phải đẹp sẵn. */
export const PCover: React.FC<SP> = ({ sc, script }) => {
  const f = useCurrentFrame();
  const all = () => 1;
  return (
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(170deg, ${P.bg1} 0%, ${P.bg2} 100%)`, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 70, top: 840, transform: `rotate(-5deg) scale(0.86)`, transformOrigin: "top left" }}>
        <Doc circle={all} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${P.bg1} 0%, ${P.bg1} 36%, rgba(247,243,234,0) 52%)` }} />
      <div style={{ position: "absolute", top: 120, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 60px" }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 4, color: P.ink, border: `3px solid ${P.ink}`, padding: "10px 28px", borderRadius: 999 }}>{script.series}</div>
        <div style={{ marginTop: 50, fontFamily: HAND, fontSize: 44, fontWeight: 700, color: "#fff", background: P.red, padding: "6px 26px", borderRadius: 12, transform: "rotate(-3deg)" }}>{String(sc.tag ?? "MẸO AI")}</div>
        <div style={{ marginTop: 40, fontSize: 92, fontWeight: 900, color: P.ink, whiteSpace: "nowrap", textAlign: "center", lineHeight: 1.04 }}>{String(sc.line1)}</div>
        <div style={{ position: "relative", marginTop: 34, fontSize: 96, fontWeight: 900, color: P.red, whiteSpace: "nowrap", textAlign: "center", lineHeight: 1.04 }}>
          {String(sc.line2)}
          <svg style={{ position: "absolute", left: -30, top: -26, width: "calc(100% + 60px)", height: "calc(100% + 52px)", overflow: "visible" }} viewBox="0 0 100 40" preserveAspectRatio="none">
            <path d="M 8 6 C 30 -2, 80 -1, 95 10 C 104 20, 90 38, 50 38 C 12 38, -2 28, 4 16 C 7 9, 18 4, 30 3" fill="none" stroke={P.red} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 7 }} strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ marginTop: 44, fontSize: 48, fontWeight: 800, color: "#fff", background: P.dark, padding: "14px 38px", borderRadius: 999, transform: `scale(${1 + 0.02 * Math.sin(f / 5)})` }}>{String(sc.hook)}</div>
      </div>
      <div style={{ position: "absolute", bottom: 70, left: 0, right: 0, textAlign: "center", background: "rgba(34,32,28,0.92)", padding: "22px 0" }}>
        <div style={{ fontSize: 28, color: "#FFC9C2", fontWeight: 800, letterSpacing: 2 }}>AI SHARING TIPS CHALLENGE 2026</div>
        <div style={{ fontSize: 36, color: "#fff", fontWeight: 700, marginTop: 8 }}>{script.author}</div>
      </div>
    </div>
  );
};

/** Mở đầu: tờ giấy hiện lên + "Bạn thấy lỗi nào không?" + đồng hồ đếm ngược. */
export const PHook: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dem = Math.max(0, 5 - Math.floor(prog(f, 12, Math.max(13, dur - 6)) * 5));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ ...pop(at(0)), fontSize: 64, fontWeight: 900, color: P.ink, textAlign: "center", lineHeight: 1.1, marginBottom: 30 }}>{String(sc.big)}</div>
      <div style={{ position: "relative", zoom: 0.8, transform: `rotate(${-1.5 * at(4)}deg)`, opacity: at(4) }}>
        <Doc />
        <div style={{ position: "absolute", right: -18, top: -40, width: 140, height: 140, borderRadius: 70, background: P.dark, color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: paperShadow, opacity: at(10) }}>
          <div style={{ fontSize: 70, fontWeight: 900, lineHeight: 1 }}>{dem}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#FFC9C2" }}>giây</div>
          <svg width="140" height="140" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
            <circle cx="70" cy="70" r="64" fill="none" stroke={P.red} strokeWidth="7" strokeDasharray={402} strokeDashoffset={402 * prog(f, 12, Math.max(13, dur - 6))} />
          </svg>
        </div>
      </div>
      <div style={{ ...pop(at(fps)), marginTop: 30, fontFamily: HAND, fontSize: 40, fontWeight: 700, color: P.red }}>{String(sc.sub)}</div>
    </div>
  );
};

/** PROBLEM: các lỗi "trông đúng" + hậu quả. */
export const PProblem: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const items = sc.items as string[];
  const step = Math.max(10, Math.floor((dur * 0.45) / items.length));
  return (
    <div style={{ padding: "0 70px" }}>
      <Title kicker="PROBLEM" text={sc.heading} />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {items.map((t, i) => (
          <div key={i} style={{ ...pop(at(10 + i * step)), display: "flex", alignItems: "center", gap: 26, background: P.paper, boxShadow: paperShadow, borderRadius: 18, padding: "26px 32px", borderLeft: `10px solid ${P.red}` }}>
            <div style={{ fontFamily: HAND, fontSize: 48, color: P.red, fontWeight: 700, width: 50, textAlign: "center" }}>✗</div>
            <div style={{ fontSize: 40, fontWeight: 600, color: P.ink, lineHeight: 1.25 }}>{t}</div>
          </div>
        ))}
      </div>
      <div style={{ ...pop(at(14 + items.length * step)), marginTop: 46, background: P.dark, color: "#fff", borderRadius: 22, padding: "28px 34px", fontSize: 40, fontWeight: 700, textAlign: "center", lineHeight: 1.3 }}>
        {String(sc.after)}
      </div>
    </div>
  );
};

/** AI TIP: 4 bước dạng checklist trên giấy, tick đỏ lần lượt. */
export const PSteps: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const steps = sc.steps as { t: string; d: string }[];
  const step = Math.max(12, Math.floor((dur * 0.75) / steps.length));
  return (
    <div style={{ padding: "0 64px" }}>
      <Title kicker="AI TIP" text={sc.heading} />
      <div style={{ ...pop(at(4)), background: P.paper, boxShadow: paperShadow, borderRadius: 10, padding: "30px 40px", backgroundImage: `repeating-linear-gradient(180deg, transparent 0 77px, ${P.line} 77px 79px)` }}>
        {steps.map((s, i) => {
          const a = 10 + i * step;
          const tick = prog(f, a + 6, a + 14);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 26, padding: "22px 0", opacity: 0.25 + 0.75 * prog(f, a, a + 6) }}>
              <div style={{ position: "relative", width: 64, height: 64, flex: "none", border: `4px solid ${P.ink}`, borderRadius: 10 }}>
                <svg width="64" height="64" viewBox="0 0 64 64" style={{ position: "absolute", left: -4, top: -12 }}>
                  <path d="M10 34 L26 50 L58 6" fill="none" stroke={P.red} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - tick} />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 42, fontWeight: 800, color: P.ink }}>{i + 1}. {s.t}</div>
                <div style={{ fontFamily: HAND, fontSize: 30, color: P.blue, marginTop: 4 }}>{s.d}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Câu lệnh mẫu: tờ ghi chú kiểu máy đánh chữ, gõ dần, dòng quan trọng được gạch dạ quang. */
export const PPrompt: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const lines = sc.lines as string[];
  const hot = (sc.hot as number[]) ?? [];
  const total = lines.join("\n").length;
  const shown = Math.floor(prog(f, 8, dur * 0.62) * total);
  let used = 0;
  return (
    <div style={{ padding: "0 50px" }}>
      <Title text={sc.heading} />
      <div style={{ ...pop(at(4)), background: P.dark, borderRadius: 24, padding: "34px 38px", boxShadow: paperShadow }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>{["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <div key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />)}</div>
        {lines.map((l, i) => {
          const take = Math.max(0, Math.min(l.length, shown - used));
          used += l.length + 1;
          const isHot = hot.includes(i) && f > dur * 0.68;
          return (
            <div key={i} style={{ fontFamily: MONO, fontSize: 29, lineHeight: 1.42, color: isHot ? P.dark : "#F2EEE6", marginBottom: 8, minHeight: take ? undefined : 0, background: isHot ? "#FFD84D" : "transparent", borderRadius: 6, padding: isHot ? "2px 8px" : "2px 0", transition: "none" }}>
              {l.slice(0, take)}{take > 0 && take < l.length ? <span style={{ color: "#FF8A7A" }}>▌</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Máy soi: tờ giấy, (tuỳ chọn) tia quét chạy dọc trang, rồi khoanh các lỗi `ids` lần lượt; lỗi trong `done` đã khoanh sẵn.
 * `zoom: [x%, y%, scale]` — phóng vào vùng có lỗi (transform-origin tại điểm đó).
 */
export const PScan: React.FC<SP> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  const ids = (sc.ids as number[]) ?? [];
  const done = (sc.done as number[]) ?? [];
  const scan = Boolean(sc.scan);
  const scanEnd = scan ? Math.round(dur * 0.35) : 0;
  const zoom = (sc.zoom as [number, number, number]) ?? [50, 50, 1];
  const z = 1 + (zoom[2] - 1) * (prog(f, scanEnd, scanEnd + 14) - prog(f, dur - 12, dur - 2) * 0);
  const span = Math.max(1, dur - scanEnd - 10);
  const circle = (id: number) => {
    if (done.includes(id)) return 1;
    const k = ids.indexOf(id);
    if (k < 0) return 0;
    const a = scanEnd + 8 + (k * span) / ids.length;
    return prog(f, a, a + 22);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {sc.heading ? <div style={{ fontSize: 50, fontWeight: 900, color: P.ink, marginBottom: 26 }}>{String(sc.heading)}</div> : null}
      <div style={{ width: 980, height: 1190, overflow: "hidden", borderRadius: 14, display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: 10, boxSizing: "border-box" }}>
        <div style={{ transform: `scale(${z})`, transformOrigin: `${zoom[0]}% ${zoom[1]}%` }}>
          <Doc circle={circle} scanY={scan ? prog(f, 4, scanEnd) * 1.06 : undefined} />
        </div>
      </div>
    </div>
  );
};

/** Bảng lỗi AI trả về. */
export const PTable: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const rows = sc.rows as string[][];
  const step = Math.max(8, Math.floor((dur * 0.5) / rows.length));
  const w = [190, 250, 520];
  return (
    <div style={{ padding: "0 40px" }}>
      <Title text={sc.heading} />
      <div style={{ ...pop(at(2)), background: P.paper, borderRadius: 18, boxShadow: paperShadow, overflow: "hidden" }}>
        <div style={{ display: "flex", background: P.dark, color: "#fff", fontSize: 28, fontWeight: 800 }}>
          {["Vị trí", "Đang ghi", "Lỗi → Đề xuất"].map((h, k) => <div key={h} style={{ width: w[k], padding: "16px 18px", boxSizing: "border-box" }}>{h}</div>)}
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ ...pop(at(10 + i * step), 18), display: "flex", borderTop: `2px solid ${P.line}`, fontSize: 27, lineHeight: 1.3, background: r[2].includes("[?]") ? "#FFF6D6" : "transparent" }}>
            <div style={{ width: w[0], padding: "16px 18px", boxSizing: "border-box", fontWeight: 800, color: P.ink, display: "flex", gap: 10 }}>
              <span style={{ flex: "none", width: 34, height: 34, borderRadius: 17, background: P.red, color: "#fff", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>{r[0]}
            </div>
            <div style={{ width: w[1], padding: "16px 18px", boxSizing: "border-box", color: P.red, textDecoration: "line-through", textDecorationThickness: 2 }}>{r[1]}</div>
            <div style={{ width: w[2], padding: "16px 18px", boxSizing: "border-box", color: P.ink }}>{r[2]}</div>
          </div>
        ))}
      </div>
      <div style={{ ...pop(at(14 + rows.length * step)), marginTop: 34, fontSize: 34, fontWeight: 700, color: P.ink, textAlign: "center" }}>
        <span style={{ background: "#FFF6D6", border: "2px solid #E8C65A", padding: "4px 14px", borderRadius: 10, fontWeight: 900 }}>[?]</span> = AI không chắc → mình tự kiểm tra
      </div>
    </div>
  );
};

/** Bấm máy kiểm lại: máy tính bỏ túi, các phép cộng hiện dần, kết quả khớp → dấu ✓. */
export const PCalc: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const parts = sc.parts as string[];
  const step = Math.max(10, Math.floor((dur * 0.45) / parts.length));
  const doneAt = 10 + parts.length * step;
  const hien = parts.slice(0, Math.min(parts.length, Math.floor((f - 6) / step) + 1));
  return (
    <div style={{ padding: "0 70px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Title text={sc.heading} />
      <div style={{ ...pop(at(4)), width: 620, background: "#2B2A27", borderRadius: 44, padding: 40, boxShadow: paperShadow }}>
        <div style={{ background: "#C9D8B6", borderRadius: 18, padding: "22px 26px", fontFamily: MONO, color: "#1E2A16", textAlign: "right", minHeight: 300, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          {hien.map((p, i) => <div key={i} style={{ fontSize: 40, lineHeight: 1.35 }}>{i ? "+ " : ""}{p}</div>)}
          <div style={{ borderTop: "3px solid #1E2A16", marginTop: 8, paddingTop: 6, fontSize: 64, fontWeight: 700, opacity: prog(f, doneAt, doneAt + 4) }}>{String(sc.total)}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 30 }}>
          {["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "=", "+"].map((k) => {
            const nhan = (k === "+" && f > 6 && f < doneAt && (f - 6) % step < 4) || (k === "=" && f >= doneAt - 2 && f < doneAt + 4);
            return <div key={k} style={{ height: 76, borderRadius: 18, background: nhan ? P.red : k === "=" || k === "+" ? "#4A4740" : "#3A3833", color: "#fff", fontSize: 38, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${nhan ? 0.92 : 1})` }}>{k}</div>;
          })}
        </div>
      </div>
      <div style={{ ...pop(at(doneAt + 8)), marginTop: 40, display: "flex", alignItems: "center", gap: 18, background: P.green, color: "#fff", fontSize: 42, fontWeight: 800, padding: "16px 40px", borderRadius: 999 }}>✓ {String(sc.ok)}</div>
    </div>
  );
};

/** Mẹo nhỏ: 2 văn bản cạnh nhau, đường nối các chỗ khớp/lệch. */
export const PCross: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const pairs = sc.pairs as [string, string, string, boolean][];
  const step = Math.max(10, Math.floor((dur * 0.5) / pairs.length));
  const docBox = (title: string, vals: string[], side: number) => (
    <div style={{ ...pop(at(4 + side * 6)), width: 400, background: P.paper, boxShadow: paperShadow, borderRadius: 8, padding: "26px 28px", fontFamily: SERIF }}>
      <div style={{ fontSize: 30, fontWeight: 700, textAlign: "center", borderBottom: `2px solid ${P.ink}`, paddingBottom: 12, marginBottom: 10 }}>{title}</div>
      {vals.map((v, i) => <div key={i} style={{ fontSize: 28, height: 92, display: "flex", alignItems: "center", borderBottom: `1px dashed ${P.line}` }}>{v}</div>)}
    </div>
  );
  return (
    <div style={{ padding: "0 40px" }}>
      <Title kicker="MẸO NHỎ" text={sc.heading} />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between" }}>
        {docBox(String(sc.left), pairs.map((p) => `${p[0]}: ${p[1]}`), 0)}
        {docBox(String(sc.right), pairs.map((p) => `${p[0]}: ${p[2]}`), 1)}
        {pairs.map((p, i) => {
          const a = 20 + i * step;
          const k = prog(f, a, a + 10);
          return (
            <div key={i} style={{ position: "absolute", left: 400, width: 200 * k, top: 108 + i * 92 + 34, height: 0, borderTop: `5px ${p[3] ? "solid" : "dashed"} ${p[3] ? P.green : P.red}` }}>
              <div style={{ position: "absolute", left: 76, top: -34, width: 48, height: 48, borderRadius: 24, background: p[3] ? P.green : P.red, color: "#fff", fontSize: 30, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", opacity: prog(f, a + 8, a + 12) }}>{p[3] ? "✓" : "✗"}</div>
            </div>
          );
        })}
      </div>
      <div style={{ ...pop(at(24 + pairs.length * step)), marginTop: 40, fontFamily: HAND, fontSize: 38, color: P.red, textAlign: "center", fontWeight: 700 }}>{String(sc.note)}</div>
    </div>
  );
};

/** RESULT: con số lớn + các dòng kết quả. */
export const PResult: React.FC<SP> = ({ sc, dur }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const items = sc.items as string[];
  const big = String(sc.big);
  const step = Math.max(10, Math.floor((dur * 0.4) / items.length));
  return (
    <div style={{ padding: "0 70px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Title kicker="RESULT" text={sc.heading} />
      <div style={{ ...pop(at(6)), position: "relative", fontSize: 220, fontWeight: 900, color: P.red, lineHeight: 1, marginBottom: 10 }}>
        {big}
        <svg style={{ position: "absolute", left: -50, top: -30, width: "calc(100% + 100px)", height: "calc(100% + 60px)", overflow: "visible" }} viewBox="0 0 100 40" preserveAspectRatio="none">
          <path d="M 8 6 C 30 -2, 80 -1, 95 10 C 104 20, 90 38, 50 38 C 12 38, -2 28, 4 16 C 7 9, 18 4, 30 3" fill="none" stroke={P.red} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 8 }}
            strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog(f, 14, 30)} />
        </svg>
      </div>
      <div style={{ ...pop(at(12)), fontFamily: HAND, fontSize: 40, color: P.ink, fontWeight: 700, marginBottom: 46 }}>{String(sc.bigLabel)}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
        {items.map((t, i) => (
          <div key={i} style={{ ...pop(at(30 + i * step)), display: "flex", alignItems: "center", gap: 22, background: P.paper, boxShadow: paperShadow, borderRadius: 18, padding: "22px 30px", fontSize: 38, fontWeight: 600, color: P.ink }}>
            <span style={{ color: P.green, fontSize: 46, fontWeight: 900 }}>✓</span>{t}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Kết: dùng được cho văn bản nào (thẻ giấy xếp chồng) + lời mời. */
export const POutro: React.FC<SP> = ({ sc, script }) => {
  const at = usePopAt();
  const f = useCurrentFrame();
  const uses = sc.uses as string[];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 60px" }}>
      <div style={{ ...pop(at(0)), fontSize: 46, fontWeight: 800, color: P.muted, marginBottom: 30 }}>Dùng ngay cho</div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 22, marginBottom: 70 }}>
        {uses.map((u, i) => (
          <div key={u} style={{ ...pop(at(6 + i * 6)), background: P.paper, boxShadow: paperShadow, borderRadius: 10, padding: "22px 30px", fontFamily: SERIF, fontSize: 38, fontWeight: 700, color: P.ink, transform: `${pop(at(6 + i * 6)).transform} rotate(${[-3, 2, -1, 3][i % 4]}deg)` }}>{u}</div>
        ))}
      </div>
      <div style={{ ...pop(at(30)), fontSize: 60, fontWeight: 900, color: P.ink, textAlign: "center", lineHeight: 1.15 }}>{script.series}</div>
      <div style={{ ...pop(at(36)), fontSize: 38, color: P.muted, marginTop: 18, fontWeight: 600 }}>{script.author}</div>
      <div style={{ ...pop(at(46)), marginTop: 56, background: P.red, color: "#fff", fontSize: 44, fontWeight: 800, padding: "18px 44px", borderRadius: 999, transform: `${pop(at(46)).transform} translateY(${Math.sin(f / 7) * 6}px)` }}>{String(sc.cta)} ↓</div>
    </div>
  );
};

export const PAPER_SCENES: Record<string, React.FC<SP>> = {
  "p-cover": PCover, "p-hook": PHook, "p-problem": PProblem, "p-steps": PSteps, "p-prompt": PPrompt,
  "p-scan": PScan, "p-table": PTable, "p-calc": PCalc, "p-cross": PCross, "p-result": PResult, "p-outro": POutro,
};
