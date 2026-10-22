import { NextRequest, NextResponse } from "next/server";
import { FPT_VOICES, VOICE_STYLES, generateVoice, voiceFileTag } from "@/lib/tools/voice";
import fs from "fs";
import path from "path";

// GET /api/voices → danh sách giọng + preset mặc định theo channel
export async function GET(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get("channel") ?? "default";
  const preset = VOICE_STYLES[channel] ?? VOICE_STYLES.default;
  return NextResponse.json({ voices: FPT_VOICES, preset });
}

// POST /api/voices → tạo file nghe thử 1 giọng
export async function POST(req: NextRequest) {
  const { voice, speed, text } = (await req.json()) as {
    voice: string;
    speed?: number;
    text?: string;
  };
  if (!voice) return NextResponse.json({ error: "Thiếu voice" }, { status: 400 });

  const sample = text?.trim() || "Đêm hôm đó... tôi đứng một mình ngoài ban công, nhìn xuống khu nhà tối om phía dưới.";
  const spd = speed ?? 0;
  const outDir = path.join(process.cwd(), "output", "_voice_previews");
  fs.mkdirSync(outDir, { recursive: true });

  // voiceFileTag: id VieNeu có dấu ':' và dấu tiếng Việt — Windows không nhận
  const filename = `preview_${voiceFileTag(voice)}_s${spd}`;
  const cached = path.join(outDir, `${filename}.mp3`);
  if (fs.existsSync(cached)) {
    return NextResponse.json({ ok: true, filePath: cached, cached: true });
  }

  try {
    const filePath = await generateVoice(sample, filename, "default", outDir, { voice, speed: spd });
    return NextResponse.json({ ok: true, filePath, cached: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
