import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serveExamInstance } from "@/lib/serving/serve-exam";

// Build (and record) a never-repeat question instance for an exam.
// The student is the authenticated Supabase user. Until login exists, a
// `userId` may be passed in the body for local testing ONLY (non-production).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    // no session
  }

  // Dev-only fallback so serving can be exercised before auth is built.
  if (!userId && process.env.NODE_ENV !== "production") {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.userId === "string") userId = body.userId;
  }

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const result = await serveExamInstance({ userId, examId });
    return NextResponse.json({
      examId,
      examName: result.exam.name,
      requested: result.requested,
      available: result.available,
      exhausted: result.exhausted,
      count: result.served.length,
      questions: result.served,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
