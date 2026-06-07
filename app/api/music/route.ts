import { NextResponse, NextRequest } from "next/server";
import fs from "fs";
import path from "path";

const MUSIC_DIR = path.join(process.cwd(), "music");

export async function GET() {
  if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
    return NextResponse.json({ files: [] });
  }
  const files = fs.readdirSync(MUSIC_DIR)
    .filter(f => /\.(mp3|wav|m4a|ogg|flac)$/i.test(f))
    .map(f => ({ name: f, path: path.join(MUSIC_DIR, f) }));
  return NextResponse.json({ files });
}

export async function POST(req: NextRequest) {
  fs.mkdirSync(MUSIC_DIR, { recursive: true });
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const safeName = file.name.replace(/[^a-zA-Z0-9_\-. ]/g, "_");
  const dest = path.join(MUSIC_DIR, safeName);
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return NextResponse.json({ name: safeName, path: dest });
}
