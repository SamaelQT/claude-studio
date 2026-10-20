import type React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/** Bật lên (0 → 1) bắt đầu từ khung `delay`, kiểu lò xo nhẹ. */
export function usePop(delay = 0, damping = 14) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping, mass: 0.6 } });
}

/** Style hiện dần + trượt lên cho một phần tử. */
export function popStyle(p: number, dy = 40): React.CSSProperties {
  return { opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * dy}px) scale(${0.94 + 0.06 * p})` };
}

/** Tiến trình tuyến tính 0..1 trong khoảng [a, b] khung. */
export const prog = (f: number, a: number, b: number) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
