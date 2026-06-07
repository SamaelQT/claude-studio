import { NextResponse, NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const style = req.nextUrl.searchParams.get("style") ?? "";
  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) return NextResponse.json({ projects: [] });

  // scan output/{style}/ if style given, else scan all style subfolders
  const styleDirs = style
    ? [path.join(outDir, style)]
    : fs.readdirSync(outDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => path.join(outDir, d.name));

  const projects: { name: string; file: string; path: string; sizeMB: number; mtime: number; date: string }[] = [];

  for (const styleDir of styleDirs) {
    if (!fs.existsSync(styleDir)) continue;
    for (const entry of fs.readdirSync(styleDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const folder = path.join(styleDir, entry.name);
      const mp4s = fs.readdirSync(folder).filter(f => f.endsWith(".mp4"));
      if (!mp4s.length) continue;
      const mp4 = mp4s[0];
      const stat = fs.statSync(path.join(folder, mp4));
      projects.push({
        name: entry.name,
        file: mp4,
        path: path.join(folder, mp4),
        sizeMB: Math.round(stat.size / (1024 * 1024) * 10) / 10,
        mtime: stat.mtimeMs,
        date: stat.mtime.toLocaleDateString("vi-VN"),
      });
    }
  }

  projects.sort((a, b) => b.mtime - a.mtime);
  return NextResponse.json({ projects });
}
