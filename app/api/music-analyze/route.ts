import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { parseLyricSync, detectBeatSync, detectWhisperSync, getAudioDuration } from "@/lib/tools/music-sync";

// POST /api/music-analyze
// body: { mode: "lyric"|"beat"|"whisper", musicPath, numScenes, lrcText? }
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    mode: "lyric" | "beat" | "whisper";
    musicPath: string;
    numScenes: number;
    lrcText?: string;
  };

  const { mode, musicPath, numScenes, lrcText } = body;

  if (!musicPath || !fs.existsSync(musicPath)) {
    return NextResponse.json({ error: "musicPath không tồn tại" }, { status: 400 });
  }

  try {
    if (mode === "lyric") {
      if (!lrcText?.trim()) {
        return NextResponse.json({ error: "lrcText required cho lyric mode" }, { status: 400 });
      }
      const duration = await getAudioDuration(musicPath);
      const result = parseLyricSync(lrcText, duration, numScenes);
      return NextResponse.json({ result });
    }

    if (mode === "beat") {
      const result = await detectBeatSync(musicPath, numScenes);
      return NextResponse.json({ result });
    }

    if (mode === "whisper") {
      const result = await detectWhisperSync(musicPath, numScenes);
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: "mode không hợp lệ" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// GET /api/music-analyze?path=... → duration only
export async function GET(req: NextRequest) {
  const musicPath = req.nextUrl.searchParams.get("path");
  if (!musicPath || !fs.existsSync(musicPath)) {
    return NextResponse.json({ error: "path không tồn tại" }, { status: 400 });
  }
  const duration = await getAudioDuration(musicPath);
  return NextResponse.json({ duration });
}
