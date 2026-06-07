import { NextResponse, NextRequest } from "next/server";
import fs from "fs";
import path from "path";

// DELETE /api/cache?project=introvert_ep01&style=introvert
// Xóa ảnh + video cũ của project để force regenerate toàn bộ
export async function DELETE(req: NextRequest) {
  const project = req.nextUrl.searchParams.get("project") ?? "";
  const style = req.nextUrl.searchParams.get("style") ?? "";
  if (!project) return NextResponse.json({ error: "Missing project" }, { status: 400 });

  const base = path.join(process.cwd(), "output", style, project);
  if (!fs.existsSync(base)) return NextResponse.json({ deleted: 0 });

  let deleted = 0;

  // Xóa ảnh
  const imagesDir = path.join(base, "images");
  if (fs.existsSync(imagesDir)) {
    for (const f of fs.readdirSync(imagesDir)) {
      fs.unlinkSync(path.join(imagesDir, f));
      deleted++;
    }
  }

  // Xóa video mp4 trong project folder
  for (const f of fs.readdirSync(base)) {
    if (f.endsWith(".mp4")) {
      fs.unlinkSync(path.join(base, f));
      deleted++;
    }
  }

  return NextResponse.json({ deleted });
}
