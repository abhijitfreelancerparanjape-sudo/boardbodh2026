import { NextResponse } from "next/server";
import { getStudentId } from "@/lib/auth/student";
import { submitAttempt } from "@/lib/attempts/attempt";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  const userId = await getStudentId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const result = await submitAttempt({ attemptId, userId });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
