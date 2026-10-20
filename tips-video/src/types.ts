export type Cau = { text: string; start: number; end: number };
export type SceneTiming = { index: number; start: number; end: number; caus: Cau[] };
export type Timeline = { fps: number; scenes: SceneTiming[]; total: number };

// Cảnh trong kịch bản: mỗi loại cảnh đọc các trường riêng của nó (xem src/scenes/*).
export type Scene = { type: string; vo: string; heading?: string; [k: string]: unknown };

export type Script = {
  id: string;
  series: string;
  title: string;
  author: string;
  voice?: string;
  rate?: string;
  tips?: { t: string; d: string }[];
  scenes: Scene[];
};

export type Props = { script: Script; timeline: Timeline };
