import { NextResponse } from "next/server";
import { getStudentId } from "@/lib/auth/student";
import { saveSelfAssessment } from "@/lib/attempts/attempt";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  const userId = await getStudentId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.awards || typeof body.awards !== "object") {
    return NextResponse.json({ error: "awards map required" }, { status: 400 });
  }
  try {
    const result = await saveSelfAssessment({ attemptId, userId, awards: body.awards });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
