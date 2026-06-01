import { NextRequest, NextResponse } from "next/server";
import { executeTool, ToolName } from "@/lib/agent/executor";

export async function POST(req: NextRequest) {
  const { tool, input } = await req.json();
  const result = await executeTool(tool as ToolName, input);
  return NextResponse.json(result);
}
