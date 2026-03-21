import { NextResponse } from "next/server";
import { getStoryDisplay } from "@/lib/stories/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const { storyId } = await params;
  const display = await getStoryDisplay(storyId);

  if (!display) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  return NextResponse.json(display);
}
