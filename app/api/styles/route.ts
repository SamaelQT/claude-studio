import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { StyleDNA, listStyles } from "@/lib/agent/json-runner";

const STYLES_ROOT = path.join(process.cwd(), "styles");

// GET /api/styles?channel=wansee  → list styles
// GET /api/styles?channel=wansee&id=manga-horror → single style
export async function GET(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get("channel");
  const id = req.nextUrl.searchParams.get("id");

  if (!channel) {
    // List all channels
    try {
      const channels = fs.readdirSync(STYLES_ROOT, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      return NextResponse.json({ channels });
    } catch {
      return NextResponse.json({ channels: [] });
    }
  }

  if (id) {
    const filePath = path.join(STYLES_ROOT, channel, `${id}.json`);
    try {
      const style = JSON.parse(fs.readFileSync(filePath, "utf-8")) as StyleDNA;
      return NextResponse.json({ style });
    } catch {
      return NextResponse.json({ error: "Style not found" }, { status: 404 });
    }
  }

  const styles = listStyles(channel);
  return NextResponse.json({ styles });
}

// POST /api/styles → create/update style
export async function POST(req: NextRequest) {
  const body = await req.json() as StyleDNA;
  if (!body.channel || !body.id) {
    return NextResponse.json({ error: "channel and id required" }, { status: 400 });
  }
  const dir = path.join(STYLES_ROOT, body.channel);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${body.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(body, null, 2), "utf-8");
  return NextResponse.json({ ok: true, path: filePath });
}

// DELETE /api/styles?channel=wansee&id=manga-horror
export async function DELETE(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get("channel");
  const id = req.nextUrl.searchParams.get("id");
  if (!channel || !id) return NextResponse.json({ error: "channel and id required" }, { status: 400 });
  const filePath = path.join(STYLES_ROOT, channel, `${id}.json`);
  try {
    fs.unlinkSync(filePath);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Style not found" }, { status: 404 });
  }
}
