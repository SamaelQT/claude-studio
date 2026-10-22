// Motion engine — sinh chuyển động camera cho ảnh tĩnh bằng ffmpeg zoompan.
// KHÔNG import fs/path để runner-types.ts (client) dùng chung được type ở đây.
//
// Vì sao supersample: zoompan làm tròn toạ độ crop về số nguyên pixel, zoom chậm
// trên ảnh đúng kích thước đích sẽ giật từng nấc. Phóng canvas lên 2x rồi mới
// zoompan xuống kích thước đích → bước nhảy còn nửa pixel, mắt không thấy giật.

export type MotionType =
  | "none"
  | "push_in"    // đẩy máy vào — dồn nén, căng dần
  | "pull_out"   // lùi máy ra — hé lộ bối cảnh, hụt hẫng
  | "pan_left"
  | "pan_right"
  | "tilt_up"    // ngước lên — choáng ngợp
  | "tilt_down"  // cúi xuống — đè nén
  | "drift"      // trôi chéo rất nhẹ, cảnh nền/chuyển tiếp
  | "shake"      // rung tại chỗ — hoảng loạn
  | "pulse";     // phập phồng như nhịp thở

export type MotionAnchor = "center" | "face" | "top" | "bottom" | "left" | "right";

export interface SceneMotion {
  type: MotionType;
  /** 0..1 — mặc định 0.35. Cứ để thấp, chuyển động nhẹ mới sang. */
  intensity?: number;
  /** điểm neo khung hình */
  anchor?: MotionAnchor;
  /** 0..1 — rung chồng lên chuyển động chính (horror). Mặc định 0. */
  shake?: number;
}

export const MOTION_FPS = 30;

/** Hệ số supersample chống giật. 2 là đủ; cao hơn thì CPU gánh không nổi. */
const SS = 2;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

const ANCHOR_X: Record<MotionAnchor, number> = {
  center: 0.5, face: 0.5, top: 0.5, bottom: 0.5, left: 0.34, right: 0.66,
};
const ANCHOR_Y: Record<MotionAnchor, number> = {
  center: 0.5, face: 0.38, top: 0.32, bottom: 0.68, left: 0.5, right: 0.5,
};

function normalize(m?: SceneMotion): Required<SceneMotion> | null {
  if (!m || !m.type || m.type === "none") return null;
  return {
    type: m.type,
    intensity: m.intensity === undefined ? 0.35 : clamp01(m.intensity),
    anchor: m.anchor ?? "center",
    shake: clamp01(m.shake ?? 0),
  };
}

/** Biên độ zoom theo intensity — trần 26% để không bao giờ thành "zoom quảng cáo". */
const zoomAmp = (i: number) => 0.06 + 0.20 * i;
/** Pan cần zoom sẵn để có chỗ trượt. */
const panAmp = (i: number) => 0.08 + 0.22 * i;

/** Sinh biểu thức zoompan. `frames` là tổng số khung của scene. */
function zoompanExpr(m: Required<SceneMotion>, frames: number, w: number, h: number): string {
  const last = Math.max(1, frames - 1);
  // p chạy 0 → 1 theo tiến độ scene, kẹp lại phòng khi -t cắt lệch vài khung
  const p = `min(on/${last},1)`;
  const ax = ANCHOR_X[m.anchor] ?? 0.5;
  const ay = ANCHOR_Y[m.anchor] ?? 0.5;

  // Toạ độ góc trên-trái của khung crop, neo theo anchor
  const cx = `iw*${ax}-(iw/zoom/2)`;
  const cy = `ih*${ay}-(ih/zoom/2)`;

  let z: string, x: string, y: string;

  switch (m.type) {
    case "push_in": {
      const a = zoomAmp(m.intensity).toFixed(4);
      z = `1+${a}*${p}`; x = cx; y = cy; break;
    }
    case "pull_out": {
      const a = zoomAmp(m.intensity);
      z = `${(1 + a).toFixed(4)}-${a.toFixed(4)}*${p}`; x = cx; y = cy; break;
    }
    case "pan_right": {
      const a = panAmp(m.intensity);
      z = `${(1 + a).toFixed(4)}`; x = `(iw-iw/zoom)*${p}`; y = cy; break;
    }
    case "pan_left": {
      const a = panAmp(m.intensity);
      z = `${(1 + a).toFixed(4)}`; x = `(iw-iw/zoom)*(1-${p})`; y = cy; break;
    }
    case "tilt_down": {
      const a = panAmp(m.intensity);
      z = `${(1 + a).toFixed(4)}`; x = cx; y = `(ih-ih/zoom)*${p}`; break;
    }
    case "tilt_up": {
      const a = panAmp(m.intensity);
      z = `${(1 + a).toFixed(4)}`; x = cx; y = `(ih-ih/zoom)*(1-${p})`; break;
    }
    case "drift": {
      // trôi chéo cực nhẹ + zoom vào tí xíu — cảnh nền, cảnh chuyển
      const a = (zoomAmp(m.intensity) * 0.6).toFixed(4);
      z = `1+${a}*${p}`;
      x = `(iw-iw/zoom)*(0.38+0.24*${p})`;
      y = `(ih-ih/zoom)*(0.44+0.14*${p})`;
      break;
    }
    case "shake": {
      // giữ zoom cố định, rung quanh tâm — sin/cos lệch tần cho khỏi thành vòng tròn
      const a = panAmp(m.intensity);
      const s = Math.max(0.15, m.intensity) * 0.010;
      z = `${(1 + a).toFixed(4)}`;
      x = `${cx}+iw*${s.toFixed(5)}*sin(on*0.9)`;
      y = `${cy}+ih*${(s * 0.8).toFixed(5)}*cos(on*1.37)`;
      break;
    }
    case "pulse": {
      // nhịp thở: 2 chu kỳ mỗi scene, đi lên rồi về đúng chỗ cũ
      const a = (zoomAmp(m.intensity) * 0.45).toFixed(4);
      z = `1+${a}*(1-cos(6.28318*${p}*2))/2`; x = cx; y = cy; break;
    }
    default:
      z = "1"; x = cx; y = cy;
  }

  // Rung chồng lên chuyển động chính (dùng cho push_in + shake nhẹ kiểu horror)
  if (m.shake > 0 && m.type !== "shake") {
    const s = (m.shake * 0.006).toFixed(5);
    x = `${x}+iw*${s}*sin(on*1.1)`;
    y = `${y}+ih*${(m.shake * 0.005).toFixed(5)}*cos(on*1.6)`;
  }

  return `zoompan=z='${z}':x='${x}':y='${y}':d=1:s=${w}x${h}:fps=${MOTION_FPS}`;
}

/**
 * Trả về filtergraph dựng khung hình cho 1 scene, kết thúc ở nhãn [v].
 * Không có motion → giữ nguyên hành vi cũ (chỉ thêm setsar để concat khỏi lệch).
 */
export function buildSceneVideoFilter(
  w: number, h: number, is916: boolean,
  motion: SceneMotion | undefined, duration: number,
): string {
  const m = normalize(motion);

  const still = is916
    ? `[0:v]scale=${w}:${h},boxblur=20:5[bg];[0:v]scale=${w}:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[v]`
    : `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1[v]`;

  if (!m) return still;

  const bw = w * SS, bh = h * SS;
  const canvas = is916
    // Blur nền ở 480px rồi phóng lên: boxblur ở 4K là điểm nghẽn (17.9s → 3.8s/clip 3s,
    // đo trên i5-1145G7). Làm mờ rồi phóng to nhìn không khác làm mờ ở kích thước gốc.
    ? `[0:v]scale=-2:480,boxblur=6:2,scale=${bw}:${bh},setsar=1[bg];[0:v]scale=${bw}:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[canvas]`
    : `[0:v]scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh}[canvas]`;

  const frames = Math.max(2, Math.round(duration * MOTION_FPS));
  return `${canvas};[canvas]${zoompanExpr(m, frames, w, h)},setsar=1[v]`;
}

export function hasMotion(motion?: SceneMotion): boolean {
  return normalize(motion) !== null;
}
