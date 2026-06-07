import { NextResponse, NextRequest } from "next/server";
import fs from "fs";
import path from "path";

// Serve local file for image preview
export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path") ?? "";
  if (!filePath || !path.isAbsolute(filePath)) {
    return new NextResponse("Invalid path", { status: 400 });
  }
  // Security: must be inside project output folder
  const projectRoot = process.cwd();
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.join(projectRoot, "output"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!fs.existsSync(resolved)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const ext = path.extname(resolved).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "application/octet-stream";
  const buf = fs.readFileSync(resolved);
  return new NextResponse(buf, { headers: { "Content-Type": mime, "Cache-Control": "no-store" } });
}
