import { NextResponse } from "next/server";
import { getStudentId } from "@/lib/auth/student";
import { saveAnswer } from "@/lib/attempts/attempt";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  const userId = await getStudentId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.questionId || typeof body.answer !== "string") {
    return NextResponse.json({ error: "questionId and answer required" }, { status: 400 });
  }
  try {
    await saveAnswer({ attemptId, userId, questionId: body.questionId, answer: body.answer });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
