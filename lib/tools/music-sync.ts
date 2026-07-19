// Music sync: 3 modes
// A) Lyric — parse LRC file hoặc manual timestamps
// B) Beat  — detect energy peaks từ audio via ffmpeg
// C) Auto  — Whisper AI transcribe → timestamps tự động

import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import ffmpegStatic from "ffmpeg-static";

const ffmpegPath = (ffmpegStatic as string).replace(/\\/g, "/");

export interface SyncPoint {
  time: number;   // giây từ đầu bài
  label?: string; // lời hoặc mô tả (optional)
}

export interface SyncResult {
  mode: "lyric" | "beat" | "whisper";
  points: SyncPoint[];
  totalDuration: number;
  sceneDurations: number[]; // giây cho mỗi scene tương ứng
}

// ── Lấy duration của audio file ───────────────────────────────────────────────
export function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const cmd = ffmpegPath;
    const args = ["-i", filePath, "-f", "null", "-"];
    execFile(cmd, args, (_err, _stdout, stderr) => {
      const match = stderr.match(/Duration:\s+(\d+):(\d+):([\d.]+)/);
      if (match) {
        const [, h, m, s] = match;
        resolve(parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s));
      } else {
        resolve(0);
      }
    });
  });
}

// ── MODE A: Lyric sync ────────────────────────────────────────────────────────
// LRC format: [00:10.50]Lyrics text
// Simple format: 00:10 - label  OR  10.5 - label
export function parseLyricSync(lrcText: string, audioDuration: number, numScenes: number): SyncResult {
  const lines = lrcText.split("\n").map(l => l.trim()).filter(Boolean);
  const points: SyncPoint[] = [];

  for (const line of lines) {
    // LRC format: [mm:ss.xx] or [mm:ss]
    const lrcMatch = line.match(/^\[(\d{1,2}):(\d{2})(?:[.:,](\d+))?\]\s*(.*)/);
    if (lrcMatch) {
      const [, mm, ss, frac, label] = lrcMatch;
      const time = parseInt(mm) * 60 + parseInt(ss) + (frac ? parseFloat(`0.${frac}`) : 0);
      points.push({ time, label: label.trim() || undefined });
      continue;
    }
    // Simple format: 10.5 - label OR 0:10 - label
    const simpleMatch = line.match(/^(\d+(?:\.\d+)?|\d+:\d+(?:\.\d+)?)\s*[-–]\s*(.*)/);
    if (simpleMatch) {
      const [, ts, label] = simpleMatch;
      let time: number;
      if (ts.includes(":")) {
        const [mm2, ss2] = ts.split(":");
        time = parseInt(mm2) * 60 + parseFloat(ss2);
      } else {
        time = parseFloat(ts);
      }
      points.push({ time, label: label.trim() || undefined });
    }
  }

  if (points.length === 0) {
    // Fallback: chia đều
    return equalDivision(audioDuration, numScenes, "lyric");
  }

  // Đảm bảo có điểm đầu
  if (points[0].time > 0.5) points.unshift({ time: 0 });

  const sceneDurations = computeSceneDurations(points, audioDuration, numScenes);
  return { mode: "lyric", points, totalDuration: audioDuration, sceneDurations };
}

// ── MODE B: Beat sync ─────────────────────────────────────────────────────────
// Phân tích energy level mỗi 100ms, tìm local maxima = beat points
export async function detectBeatSync(
  audioPath: string,
  numScenes: number,
  minIntervalSec = 3,
): Promise<SyncResult> {
  const duration = await getAudioDuration(audioPath);
  if (duration === 0) return equalDivision(duration || 60, numScenes, "beat");

  // Extract PCM mono 4000Hz (đủ để detect energy, nhẹ)
  const pcmData = await extractPCM(audioPath);
  if (!pcmData || pcmData.length === 0) return equalDivision(duration, numScenes, "beat");

  const sampleRate = 4000;
  const windowSize = Math.floor(sampleRate * 0.1); // 100ms window
  const energies: number[] = [];

  for (let i = 0; i < pcmData.length; i += windowSize) {
    let sum = 0;
    const end = Math.min(i + windowSize, pcmData.length);
    for (let j = i; j < end; j++) sum += pcmData[j] * pcmData[j];
    energies.push(sum / (end - i));
  }

  // Smooth với moving average
  const smoothed = smooth(energies, 5);

  // Tìm local maxima (peaks)
  const minWindowFrames = Math.floor(minIntervalSec * 10); // 10 frames/sec
  const peaks: number[] = [];
  const threshold = average(smoothed) * 1.3;

  for (let i = 1; i < smoothed.length - 1; i++) {
    if (smoothed[i] > threshold &&
        smoothed[i] >= smoothed[i - 1] &&
        smoothed[i] >= smoothed[i + 1]) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minWindowFrames) {
        peaks.push(i);
      }
    }
  }

  // Convert frame index → seconds
  let points: SyncPoint[] = peaks.map(p => ({ time: p * 0.1 }));
  if (points.length === 0 || points[0].time > 1) points.unshift({ time: 0 });

  // Nếu ít beats hơn scenes, bổ sung bằng chia đều
  while (points.length < numScenes) {
    const interval = duration / numScenes;
    const existingTimes = new Set(points.map(p => Math.round(p.time)));
    for (let t = interval; t < duration; t += interval) {
      const rounded = Math.round(t);
      if (!existingTimes.has(rounded)) {
        points.push({ time: parseFloat(t.toFixed(1)) });
        existingTimes.add(rounded);
      }
    }
    points.sort((a, b) => a.time - b.time);
    break;
  }

  // Giữ lại N điểm tốt nhất (số lượng = numScenes)
  if (points.length > numScenes) {
    // Giữ đều interval để video không bị chụp giật
    const step = Math.floor(points.length / numScenes);
    points = [points[0], ...Array.from({ length: numScenes - 1 }, (_, i) => points[Math.min((i + 1) * step, points.length - 1)])];
  }

  const sceneDurations = computeSceneDurations(points, duration, numScenes);
  return { mode: "beat", points, totalDuration: duration, sceneDurations };
}

// ── MODE C: Auto Whisper ──────────────────────────────────────────────────────
export async function detectWhisperSync(
  audioPath: string,
  numScenes: number,
): Promise<SyncResult> {
  const duration = await getAudioDuration(audioPath);
  const token = process.env.HF_TOKEN;

  if (!token) {
    console.warn("[whisper] HF_TOKEN not set, fallback to equal division");
    return equalDivision(duration, numScenes, "whisper");
  }

  try {
    const audioBuffer = fs.readFileSync(audioPath);
    const res = await fetch(
      "https://api-inference.huggingface.co/models/openai/whisper-large-v3",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "audio/mpeg",
        },
        body: audioBuffer,
        signal: AbortSignal.timeout(180_000),
      }
    );

    if (!res.ok) throw new Error(`Whisper API ${res.status}`);

    const json = await res.json() as {
      chunks?: Array<{ timestamp: [number, number | null]; text: string }>;
      text?: string;
    };

    if (!json.chunks || json.chunks.length === 0) {
      return equalDivision(duration, numScenes, "whisper");
    }

    // Group chunks thành N groups (= numScenes)
    const chunkSize = Math.max(1, Math.floor(json.chunks.length / numScenes));
    const points: SyncPoint[] = [];

    for (let i = 0; i < json.chunks.length; i += chunkSize) {
      const group = json.chunks.slice(i, i + chunkSize);
      const time = group[0].timestamp[0];
      const label = group.map(c => c.text.trim()).join(" ");
      points.push({ time, label });
    }

    if (points[0].time > 0.5) points.unshift({ time: 0 });
    const sceneDurations = computeSceneDurations(points, duration, numScenes);
    return { mode: "whisper", points, totalDuration: duration, sceneDurations };
  } catch (e) {
    console.warn("[whisper] failed:", e);
    return equalDivision(duration, numScenes, "whisper");
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function equalDivision(duration: number, numScenes: number, mode: SyncResult["mode"]): SyncResult {
  const interval = duration / numScenes;
  const points: SyncPoint[] = Array.from({ length: numScenes }, (_, i) => ({
    time: parseFloat((i * interval).toFixed(2)),
  }));
  const sceneDurations = Array(numScenes).fill(parseFloat(interval.toFixed(2)));
  return { mode, points, totalDuration: duration, sceneDurations };
}

function computeSceneDurations(points: SyncPoint[], totalDuration: number, numScenes: number): number[] {
  // Lấy đúng numScenes điểm đầu tiên
  const pts = points.slice(0, numScenes);
  return pts.map((p, i) => {
    const next = pts[i + 1]?.time ?? totalDuration;
    return parseFloat(Math.max(1, next - p.time).toFixed(2));
  });
}

function extractPCM(audioPath: string): Promise<Float32Array | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const proc = require("child_process").spawn(ffmpegPath, [
      "-i", audioPath,
      "-ar", "4000",
      "-ac", "1",
      "-f", "f32le",
      "pipe:1",
    ]);
    proc.stdout.on("data", (d: Buffer) => chunks.push(d));
    proc.on("close", () => {
      const buf = Buffer.concat(chunks);
      if (buf.length === 0) return resolve(null);
      const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
      resolve(arr);
    });
    proc.on("error", () => resolve(null));
  });
}

function smooth(arr: number[], windowSize: number): number[] {
  return arr.map((_, i) => {
    const start = Math.max(0, i - windowSize);
    const end = Math.min(arr.length, i + windowSize + 1);
    const slice = arr.slice(start, end);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function average(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
