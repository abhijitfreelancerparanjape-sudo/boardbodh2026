import { NextResponse } from "next/server";
import { getStudentId } from "@/lib/auth/student";
import { startAttempt } from "@/lib/attempts/attempt";

// Start (or resume) a timed attempt for an exam.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
  const userId = await getStudentId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const result = await startAttempt({ userId, examId });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
