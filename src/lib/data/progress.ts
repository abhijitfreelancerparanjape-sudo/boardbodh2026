// Per-student progression state. The fixed exam sequence advances as a student
// finishes exams: current_exam_index is a 0-based pointer into the ordered list.

import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

export async function getCurrentExamIndex(userId: string, subjectId: string): Promise<number> {
  const db = createAdminClient();
  const { data } = await db
    .from("student_progress")
    .select("current_exam_index")
    .eq("user_id", userId)
    .eq("subject_id", subjectId)
    .maybeSingle();
  return data?.current_exam_index ?? 0;
}

// Move the pointer past a just-completed exam. sequenceIndex is the exam's
// 1-based sequence_index; finishing it means the next pointer is that value.
export async function advanceProgress(
  userId: string,
  subjectId: string,
  sequenceIndex: number
): Promise<void> {
  const db = createAdminClient();
  const current = await getCurrentExamIndex(userId, subjectId);
  const next = Math.max(current, sequenceIndex);
  await db
    .from("student_progress")
    .upsert(
      { user_id: userId, subject_id: subjectId, current_exam_index: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id,subject_id" }
    );
}
