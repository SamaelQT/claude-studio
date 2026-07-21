import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export interface CustomChannel {
  id: string;
  name: string;
  accent: string;
  icon: string;
  genreDescription: string;
  hasVoice: boolean;
  sceneCountHint: string;
  formats: string[];
  createdAt: number;
}

const BUILTIN_IDS = new Set(["wansee", "huong-noi", "psych2go"]);
const DATA_FILE = path.join(process.cwd(), "data", "channels.json");
const STYLES_ROOT = path.join(process.cwd(), "styles");

function readChannels(): CustomChannel[] {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeChannels(channels: CustomChannel[]) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(channels, null, 2), "utf-8");
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "kenh-moi";
}

export async function GET() {
  return NextResponse.json({ channels: readChannels() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = (body.name as string ?? "").trim();
  if (!name) return NextResponse.json({ error: "Thiếu tên kênh" }, { status: 400 });

  const channels = readChannels();
  let id = slugify(name);
  if (BUILTIN_IDS.has(id) || channels.some(c => c.id === id)) {
    id = `${id}-${Date.now().toString(36)}`;
  }

  const channel: CustomChannel = {
    id,
    name,
    accent: body.accent || "#e67e22",
    icon: body.icon || "✨",
    genreDescription: (body.genreDescription as string ?? "").trim(),
    hasVoice: body.hasVoice !== false,
    sceneCountHint: body.sceneCountHint || "10-15",
    formats: Array.isArray(body.formats) && body.formats.length > 0 ? body.formats : ["youtube"],
    createdAt: Date.now(),
  };

  channels.push(channel);
  writeChannels(channels);

  // Tạo folder style + 1 style mặc định dựa trên mô tả thể loại
  const styleDir = path.join(STYLES_ROOT, id);
  fs.mkdirSync(styleDir, { recursive: true });
  const defaultStyle = {
    id: "default",
    name: "Mặc định",
    channel: id,
    description: channel.genreDescription.slice(0, 100) || "Style mặc định",
    prompt_prefix: channel.genreDescription || "clean illustration style",
  };
  fs.writeFileSync(path.join(styleDir, "default.json"), JSON.stringify(defaultStyle, null, 2), "utf-8");

  return NextResponse.json({ ok: true, channel });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  if (BUILTIN_IDS.has(id)) return NextResponse.json({ error: "Không thể xoá kênh mặc định" }, { status: 400 });

  const channels = readChannels();
  const next = channels.filter(c => c.id !== id);
  if (next.length === channels.length) return NextResponse.json({ error: "Không tìm thấy kênh" }, { status: 404 });

  writeChannels(next);
  fs.rmSync(path.join(STYLES_ROOT, id), { recursive: true, force: true });
  return NextResponse.json({ ok: true });
}
