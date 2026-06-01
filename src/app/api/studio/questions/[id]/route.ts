import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/server";

// Approve a draft (-> live) or discard it. Admin only.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const db = createAdminClient();
  // Only generated drafts can be approved here; clears the review flag on go-live.
  const { error } = await db
    .from("questions")
    .update({ status: "live", review_flag: null })
    .eq("id", id)
    .eq("status", "draft");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const db = createAdminClient();
  // Only allow discarding drafts (live questions are protected).
  const { error } = await db.from("questions").delete().eq("id", id).eq("status", "draft");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
