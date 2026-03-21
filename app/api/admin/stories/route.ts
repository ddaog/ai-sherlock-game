import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

const storySchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  is_free: z.boolean(),
  config: z.unknown(),
  display: z.unknown(),
  evidence: z.unknown(),
  embeddings: z.unknown().nullable(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = storySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid story payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("stories").upsert({
    ...parsed.data,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
