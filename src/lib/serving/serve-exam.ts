// Never-repeat question serving for an exam instance.
//
// 1. Resolve the exam's concept scope (concept_ids, or all concepts in its
//    chapter_ids) and target difficulty bands.
// 2. Pull live questions matching scope + band, EXCLUDING anything already in
//    this student's questions_seen.
// 3. Select up to `count`, spread across concepts for variety.
// 4. Write the served question ids into questions_seen (append-only; the unique
//    (user_id, question_id) constraint plus ignoreDuplicates guards races).
//
// Runs server-side with the service-role client. The served payload omits
// rubric_components, so correct answers are never sent to the client here.

import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { Exam, ExamScope, DifficultyBand, QuestionFormat, Board } from "@/types/db";

export interface ServedQuestion {
  id: string;
  concept_id: string;
  board_style: Board;
  question_format: QuestionFormat;
  prompt: string;
  options: unknown | null;
  marks: number;
  keywords: string[];
  difficulty_band: DifficultyBand;
}

export interface ServeResult {
  exam: Exam;
  served: ServedQuestion[];
  requested: number; // how many the exam asked for
  available: number; // fresh (unseen) candidates that matched scope + band
  exhausted: boolean; // true if fewer fresh questions exist than requested
}

const SAFE_COLUMNS =
  "id, concept_id, board_style, question_format, prompt, options, marks, keywords, difficulty_band";

const ALL_BANDS: DifficultyBand[] = ["foundational", "board_level", "advanced"];

// Round-robin across concepts so a served set is not all from one concept.
function selectSpread(questions: ServedQuestion[], count: number): ServedQuestion[] {
  const byConcept = new Map<string, ServedQuestion[]>();
  for (const q of questions) {
    const list = byConcept.get(q.concept_id) ?? [];
    list.push(q);
    byConcept.set(q.concept_id, list);
  }
  const groups = [...byConcept.values()];
  const out: ServedQuestion[] = [];
  let i = 0;
  while (out.length < count && groups.some((g) => g.length > 0)) {
    const g = groups[i % groups.length];
    const q = g.shift();
    if (q) out.push(q);
    i++;
  }
  return out;
}

export async function serveExamInstance(params: {
  userId: string;
  examId: string;
  count?: number;
  bands?: DifficultyBand[];
}): Promise<ServeResult> {
  const db = createAdminClient();

  // 1a. Load the exam.
  const { data: exam, error: examErr } = await db
    .from("exams")
    .select("*")
    .eq("id", params.examId)
    .single<Exam>();
  if (examErr || !exam) throw new Error("Exam not found");

  const scope = (exam.scope ?? {}) as ExamScope;

  // 1b. Resolve concept ids: explicit concept_ids, else all concepts in scope chapters.
  let conceptIds = scope.concept_ids ?? [];
  if (conceptIds.length === 0 && (scope.chapter_ids?.length ?? 0) > 0) {
    const { data: concepts, error } = await db
      .from("concepts")
      .select("id")
      .in("chapter_id", scope.chapter_ids as string[]);
    if (error) throw error;
    conceptIds = (concepts ?? []).map((c) => c.id as string);
  }

  const bands = params.bands ?? scope.difficulty_bands ?? ALL_BANDS;
  const count = params.count ?? scope.question_count ?? 5;

  if (conceptIds.length === 0) {
    return { exam, served: [], requested: count, available: 0, exhausted: true };
  }

  // 2a. This student's already-seen question ids.
  const { data: seenRows, error: seenErr } = await db
    .from("questions_seen")
    .select("question_id")
    .eq("user_id", params.userId);
  if (seenErr) throw seenErr;
  const seen = new Set((seenRows ?? []).map((r) => r.question_id as string));

  // 2b. Live questions matching scope + band, then exclude seen.
  const { data: candidates, error: qErr } = await db
    .from("questions")
    .select(SAFE_COLUMNS)
    .in("concept_id", conceptIds)
    .in("difficulty_band", bands)
    .eq("status", "live");
  if (qErr) throw qErr;

  const fresh = ((candidates ?? []) as ServedQuestion[]).filter((q) => !seen.has(q.id));

  // 3. Select up to count, spread across concepts.
  const served = selectSpread(fresh, count);

  // 4. Record served questions as seen (never-repeat).
  if (served.length > 0) {
    const rows = served.map((q) => ({ user_id: params.userId, question_id: q.id }));
    const { error: insErr } = await db
      .from("questions_seen")
      .upsert(rows, { onConflict: "user_id,question_id", ignoreDuplicates: true });
    if (insErr) throw insErr;
  }

  return {
    exam,
    served,
    requested: count,
    available: fresh.length,
    exhausted: fresh.length < count,
  };
}
