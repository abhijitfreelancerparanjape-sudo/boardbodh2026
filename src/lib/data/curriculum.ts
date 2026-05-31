// Server-side reads of the curriculum and exam progression.
//
// Curriculum and exams are shared, non-sensitive content. We read them on the
// server with the service-role client so the page renders before per-student
// auth exists. When auth + per-student progress land, student-specific reads
// move to the user's RLS-scoped session; this shared content can stay here.

import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { Subject, Chapter, Concept, Exam } from "@/types/db";

// Phase 0 has a single seeded subject. Pick the first by creation order.
export async function getPrimarySubject(): Promise<Subject | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("subjects")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getExamById(examId: string): Promise<Exam | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("exams").select("*").eq("id", examId).maybeSingle();
  if (error) throw error;
  return data;
}

// The fixed exam progression for a subject, in sequence order.
export async function getExamSequence(subjectId: string): Promise<Exam[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("exams")
    .select("*")
    .eq("subject_id", subjectId)
    .order("sequence_index", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface ChapterWithConcepts extends Chapter {
  concepts: Concept[];
}

export async function getCurriculum(subjectId: string): Promise<ChapterWithConcepts[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("chapters")
    .select("*, concepts(*)")
    .eq("subject_id", subjectId)
    .order("sequence_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChapterWithConcepts[];
}

// The next exam in the fixed sequence. `currentExamIndex` is a 0-based pointer
// into the ordered list (student_progress.current_exam_index); a fresh student
// is at 0, so the next exam is the first one. Returns null once finished.
export function getNextExam(exams: Exam[], currentExamIndex = 0): Exam | null {
  return exams[currentExamIndex] ?? null;
}
