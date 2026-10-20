import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "./theme";
import type { Props } from "./types";
import { SCENES } from "./scenes";

/** Phụ đề: câu đang đọc, phần đã đọc tô vàng dần theo thời gian (ước lượng theo số ký tự). */
const Subtitle: React.FC<Props> = ({ timeline }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const all = timeline.scenes.flatMap((s) => s.caus);
  const cau = all.find((c) => t >= c.start - 0.05 && t <= c.end + 0.15);
  if (!cau) return null;
  const words = cau.text.split(/\s+/);
  const total = cau.text.length;
  const done = interpolate(t, [cau.start, cau.end], [0, total], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  let acc = 0;
  const appear = interpolate(t, [cau.start - 0.05, cau.start + 0.12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 60, right: 60, bottom: 150, display: "flex", justifyContent: "center", opacity: appear }}>
      <div style={{ background: "rgba(10, 40, 24, 0.92)", borderRadius: 28, padding: "26px 40px", maxWidth: 960, textAlign: "center", fontSize: 50, fontWeight: 700, lineHeight: 1.3, color: "#fff" }}>
        {words.map((w, i) => {
          const on = acc + w.length / 2 <= done;
          acc += w.length + 1;
          return <span key={i} style={{ color: on ? C.yellow : "#fff" }}>{w}{i < words.length - 1 ? " " : ""}</span>;
        })}
      </div>
    </div>
  );
};

const Header: React.FC<Props> = ({ script, timeline }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = f / (timeline.total * fps);
  return (
    <>
      <div style={{ position: "absolute", top: 0, left: 0, height: 10, width: `${p * 100}%`, background: C.green }} />
      <div style={{ position: "absolute", top: 70, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 3, color: C.green, background: C.greenSoft, padding: "10px 28px", borderRadius: 999 }}>{script.series}</div>
        <div style={{ fontSize: 44, fontWeight: 800, color: C.ink }}>{script.title}</div>
      </div>
    </>
  );
};

export const AiTipVideo: React.FC<Props> = (props) => {
  const { script, timeline } = props;
  const { fps, durationInFrames } = useVideoConfig();
  const starts = timeline.scenes.map((s, i) => (i === 0 ? 0 : Math.round(s.start * fps)));
  return (
    <AbsoluteFill style={{ background: `linear-gradient(170deg, ${C.bg1} 0%, ${C.bg2} 100%)`, fontFamily: FONT }}>
      {/* chấm nền nhẹ cho đỡ trống */}
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${C.line} 2px, transparent 2px)`, backgroundSize: "44px 44px", opacity: 0.55 }} />
      <Audio src={staticFile(`${script.id}/voice.mp3`)} />
      {/* Header chỉ hiện sau bìa (bìa tự có tên loạt + tiêu đề) */}
      <Sequence from={script.scenes[0]?.type === "cover" ? starts[1] : 0} layout="none">
        <Header {...props} />
      </Sequence>
      {script.scenes.map((sc, i) => {
        const from = starts[i];
        const to = i + 1 < starts.length ? starts[i + 1] : durationInFrames;
        const Comp = SCENES[sc.type];
        if (!Comp) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={to - from} layout="none">
            {sc.type === "cover" ? (
              <Comp sc={sc} script={script} dur={to - from} />
            ) : (
              <SceneFrame dur={to - from}>
                <Comp sc={sc} script={script} dur={to - from} />
              </SceneFrame>
            )}
          </Sequence>
        );
      })}
      <Subtitle {...props} />
    </AbsoluteFill>
  );
};

/** Khung nội dung giữa header và phụ đề; hiện dần + trượt nhẹ khi vào cảnh, mờ dần khi ra. */
const SceneFrame: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame();
  const vao = interpolate(f, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  const ra = interpolate(f, [dur - 4, dur], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <div style={{ position: "absolute", top: 250, left: 0, right: 0, height: 1250, display: "flex", flexDirection: "column", justifyContent: "center", opacity: Math.min(vao, ra), transform: `translateY(${(1 - vao) * 30}px)` }}>
      <div style={{ transform: "scale(1.05)", transformOrigin: "center center" }}>{children}</div>
    </div>
  );
};
