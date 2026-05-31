// Timed attempt engine. Ported from the Silver prototype, adapted to Std 12.
//
// Server-authoritative timer: every attempt has a single started_at. Remaining
// time is ALWAYS derived as (started_at + window) - now on the server, never an
// accumulating client tick. The client only displays a countdown seeded from
// the server value.
//
// Submission gate: while in_progress, answers are editable and the rubric (our
// "model answers") is never sent. Submitting (or the server finding the window
// elapsed) locks the attempt; only then does getReview reveal the rubric.

import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { serveExamInstance } from "@/lib/serving/serve-exam";
import { advanceProgress } from "@/lib/data/progress";
import { FREE_TEXT_FORMATS } from "@/types/db";
import type {
  Attempt,
  Exam,
  Question,
  RubricComponent,
} from "@/types/db";

// Window length for an exam, in seconds. DEMO_FAST_SECONDS (non-production only)
// compresses the window so the timer and submission gate are easy to demo,
// exactly as the prototype's DEMO_FAST did.
function windowSeconds(exam: Exam): number {
  const fast = process.env.DEMO_FAST_SECONDS;
  if (fast && process.env.NODE_ENV !== "production") {
    const n = Number(fast);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return exam.duration_minutes * 60;
}

function deadlineMs(attempt: Attempt, exam: Exam): number {
  return new Date(attempt.started_at).getTime() + windowSeconds(exam) * 1000;
}

async function loadExam(db: ReturnType<typeof createAdminClient>, examId: string): Promise<Exam> {
  const { data, error } = await db.from("exams").select("*").eq("id", examId).single<Exam>();
  if (error || !data) throw new Error("Exam not found");
  return data;
}

// Loads an attempt and verifies it belongs to the student.
async function loadOwnedAttempt(
  db: ReturnType<typeof createAdminClient>,
  attemptId: string,
  userId: string
): Promise<Attempt> {
  const { data, error } = await db.from("attempts").select("*").eq("id", attemptId).single<Attempt>();
  if (error || !data) throw new Error("Attempt not found");
  if (data.user_id !== userId) throw new Error("Forbidden");
  return data;
}

export interface StartResult {
  attemptId: string;
  resumed: boolean;
}

// Start (or resume) an attempt for an exam. Resumes an in-progress attempt that
// is still within its window; otherwise expires a stale one and serves a fresh,
// never-repeat question set.
export async function startAttempt(params: {
  userId: string;
  examId: string;
}): Promise<StartResult> {
  const db = createAdminClient();
  const exam = await loadExam(db, params.examId);

  const { data: existing } = await db
    .from("attempts")
    .select("*")
    .eq("user_id", params.userId)
    .eq("exam_id", params.examId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<Attempt>();

  if (existing) {
    if (Date.now() < deadlineMs(existing, exam)) {
      return { attemptId: existing.id, resumed: true };
    }
    // Window elapsed without submission: lock it as expired and start fresh.
    await db
      .from("attempts")
      .update({ status: "expired", submitted_at: new Date(deadlineMs(existing, exam)).toISOString() })
      .eq("id", existing.id);
  }

  // Serve a never-repeat instance.
  const served = await serveExamInstance({ userId: params.userId, examId: params.examId });
  if (served.served.length === 0) {
    throw new Error("No fresh questions are available for this exam (all seen).");
  }

  const { data: attempt, error: insErr } = await db
    .from("attempts")
    .insert({ user_id: params.userId, exam_id: params.examId, status: "in_progress" })
    .select("*")
    .single<Attempt>();
  if (insErr || !attempt) throw new Error("Could not create attempt");

  const rows = served.served.map((q, i) => ({
    attempt_id: attempt.id,
    question_id: q.id,
    position: i,
  }));
  const { error: aqErr } = await db.from("attempt_questions").insert(rows);
  if (aqErr) throw aqErr;

  return { attemptId: attempt.id, resumed: false };
}

export interface AttemptQuestionView {
  id: string; // attempt_questions.id
  position: number;
  answer: string | null;
  question: Pick<
    Question,
    | "id"
    | "concept_id"
    | "board_style"
    | "question_format"
    | "prompt"
    | "options"
    | "marks"
    | "difficulty_band"
  >;
}

export interface AttemptState {
  attempt: Attempt;
  exam: Exam;
  locked: boolean;
  remainingSeconds: number;
  deadlineISO: string;
  questions: AttemptQuestionView[];
}

const QUESTION_FIELDS =
  "id, concept_id, board_style, question_format, prompt, options, marks, difficulty_band";

async function loadAttemptQuestions(
  db: ReturnType<typeof createAdminClient>,
  attemptId: string
): Promise<AttemptQuestionView[]> {
  const { data, error } = await db
    .from("attempt_questions")
    .select(`id, position, answer, question:questions(${QUESTION_FIELDS})`)
    .eq("attempt_id", attemptId)
    .order("position", { ascending: true });
  if (error) throw error;
  // supabase types the embedded relation as an array; normalize to one object.
  return (data ?? []).map((r) => ({
    id: r.id as string,
    position: r.position as number,
    answer: (r.answer as string | null) ?? null,
    question: (Array.isArray(r.question) ? r.question[0] : r.question) as AttemptQuestionView["question"],
  }));
}

// Server-authoritative state. Auto-expires an in-progress attempt whose window
// has elapsed. Never returns the rubric.
export async function getAttemptState(params: {
  attemptId: string;
  userId: string;
}): Promise<AttemptState> {
  const db = createAdminClient();
  let attempt = await loadOwnedAttempt(db, params.attemptId, params.userId);
  const exam = await loadExam(db, attempt.exam_id);
  const dl = deadlineMs(attempt, exam);

  if (attempt.status === "in_progress" && Date.now() >= dl) {
    const { data } = await db
      .from("attempts")
      .update({ status: "expired", submitted_at: new Date(dl).toISOString() })
      .eq("id", attempt.id)
      .select("*")
      .single<Attempt>();
    if (data) attempt = data;
  }

  const remainingSeconds = Math.max(0, Math.floor((dl - Date.now()) / 1000));
  const questions = await loadAttemptQuestions(db, attempt.id);

  return {
    attempt,
    exam,
    locked: attempt.status !== "in_progress",
    remainingSeconds,
    deadlineISO: new Date(dl).toISOString(),
    questions,
  };
}

// Save an answer. Rejected once the attempt is locked or the window has passed.
export async function saveAnswer(params: {
  attemptId: string;
  userId: string;
  questionId: string;
  answer: string;
}): Promise<void> {
  const db = createAdminClient();
  const attempt = await loadOwnedAttempt(db, params.attemptId, params.userId);
  const exam = await loadExam(db, attempt.exam_id);
  if (attempt.status !== "in_progress" || Date.now() >= deadlineMs(attempt, exam)) {
    throw new Error("Attempt is no longer open");
  }
  const { error } = await db
    .from("attempt_questions")
    .update({ answer: params.answer })
    .eq("attempt_id", params.attemptId)
    .eq("question_id", params.questionId);
  if (error) throw error;
}

// The submission gate. Idempotent: locks the attempt once. `late` is true when
// submitted after the window (e.g. a client auto-submit at timeout).
export async function submitAttempt(params: {
  attemptId: string;
  userId: string;
}): Promise<{ status: Attempt["status"]; late: boolean }> {
  const db = createAdminClient();
  const attempt = await loadOwnedAttempt(db, params.attemptId, params.userId);
  if (attempt.status !== "in_progress") {
    const exam = await loadExam(db, attempt.exam_id);
    const late = attempt.submitted_at
      ? new Date(attempt.submitted_at).getTime() > deadlineMs(attempt, exam)
      : false;
    return { status: attempt.status, late };
  }
  const exam = await loadExam(db, attempt.exam_id);
  const now = Date.now();
  const late = now > deadlineMs(attempt, exam);
  const { error } = await db
    .from("attempts")
    .update({ status: "submitted", submitted_at: new Date(now).toISOString() })
    .eq("id", attempt.id);
  if (error) throw error;
  return { status: "submitted", late };
}

function isFreeText(format: string): boolean {
  return (FREE_TEXT_FORMATS as string[]).includes(format);
}

const normalize = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// Objective questions auto-score: the single rubric component holds the exact
// correct answer, matched against the student's stored answer.
function objectiveVerdict(
  marks: number,
  rubric: RubricComponent[],
  answer: string | null
): { awarded: number; correct: boolean; key: string | null } {
  const key = rubric[0]?.text ?? null;
  const correct = key != null && answer != null && normalize(answer) === normalize(key);
  return { awarded: correct ? Number(marks) : 0, correct, key };
}

export interface ReviewQuestion {
  attemptQuestionId: string;
  position: number;
  answer: string | null;
  question: Question;
  rubric: RubricComponent[];
  isAuto: boolean; // objective formats are auto-scored
  correct: boolean | null; // objective verdict (null for free-text)
  correctAnswer: string | null; // objective answer key
  awarded: number; // marks awarded for this question
  max: number; // question max marks
  selfScores: Record<string, number>;
}

export interface WeakConcept {
  id: string;
  name: string;
  awarded: number;
  max: number;
  ratio: number;
}

export interface ReviewState {
  attempt: Attempt;
  exam: Exam;
  late: boolean;
  maxMarks: number;
  autoScoreTotal: number;
  selfScoreTotal: number | null;
  finalized: boolean;
  weakConcepts: WeakConcept[];
  questions: ReviewQuestion[];
}

// Per-concept awarded/max across the attempt. Marks already encode criticality
// (high-criticality components carry more marks), so the ratio is the weighted
// coverage the spec asks for.
function conceptBreakdown(questions: ReviewQuestion[]): Map<string, { awarded: number; max: number }> {
  const m = new Map<string, { awarded: number; max: number }>();
  for (const q of questions) {
    const e = m.get(q.question.concept_id) ?? { awarded: 0, max: 0 };
    e.awarded += q.awarded;
    e.max += q.max;
    m.set(q.question.concept_id, e);
  }
  return m;
}

// The 2-3 weakest concepts: lowest coverage ratio, only where marks were lost.
function weakestConceptIds(
  breakdown: Map<string, { awarded: number; max: number }>,
  limit = 3
): { id: string; awarded: number; max: number; ratio: number }[] {
  return [...breakdown.entries()]
    .map(([id, { awarded, max }]) => ({ id, awarded, max, ratio: max > 0 ? awarded / max : 1 }))
    .filter((x) => x.ratio < 1)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, limit);
}

async function resolveConceptNames(
  db: ReturnType<typeof createAdminClient>,
  ids: string[]
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await db.from("concepts").select("id, name").in("id", ids);
  return new Map((data ?? []).map((c) => [c.id as string, c.name as string]));
}

// The gated reveal. Only available once the attempt is locked (submitted or
// expired). This is where the rubric (marking scheme) is finally exposed.
export async function getReview(params: {
  attemptId: string;
  userId: string;
}): Promise<ReviewState> {
  const db = createAdminClient();
  let attempt = await loadOwnedAttempt(db, params.attemptId, params.userId);
  const exam = await loadExam(db, attempt.exam_id);
  const dl = deadlineMs(attempt, exam);

  if (attempt.status === "in_progress") {
    if (Date.now() < dl) throw new Error("Attempt not submitted yet");
    const { data } = await db
      .from("attempts")
      .update({ status: "expired", submitted_at: new Date(dl).toISOString() })
      .eq("id", attempt.id)
      .select("*")
      .single<Attempt>();
    if (data) attempt = data;
  }

  const { data: aqs, error: aqErr } = await db
    .from("attempt_questions")
    .select(`id, position, answer, self_scores, self_score, question:questions(*)`)
    .eq("attempt_id", attempt.id)
    .order("position", { ascending: true });
  if (aqErr) throw aqErr;

  const questionIds = (aqs ?? []).map((r) => (Array.isArray(r.question) ? r.question[0] : r.question).id);
  const { data: rubricRows, error: rErr } = await db
    .from("rubric_components")
    .select("*")
    .in("question_id", questionIds.length ? questionIds : ["00000000-0000-0000-0000-000000000000"])
    .order("sort_order", { ascending: true });
  if (rErr) throw rErr;
  const rubricByQuestion = new Map<string, RubricComponent[]>();
  for (const rc of (rubricRows ?? []) as RubricComponent[]) {
    const list = rubricByQuestion.get(rc.question_id) ?? [];
    list.push(rc);
    rubricByQuestion.set(rc.question_id, list);
  }

  const questions: ReviewQuestion[] = (aqs ?? []).map((r) => {
    const q = (Array.isArray(r.question) ? r.question[0] : r.question) as Question;
    const rubric = rubricByQuestion.get(q.id) ?? [];
    const answer = (r.answer as string | null) ?? null;
    const max = Number(q.marks);
    const auto = !isFreeText(q.question_format);
    if (auto) {
      const v = objectiveVerdict(max, rubric, answer);
      return {
        attemptQuestionId: r.id as string,
        position: r.position as number,
        answer,
        question: q,
        rubric,
        isAuto: true,
        correct: v.correct,
        correctAnswer: v.key,
        awarded: v.awarded,
        max,
        selfScores: {},
      };
    }
    return {
      attemptQuestionId: r.id as string,
      position: r.position as number,
      answer,
      question: q,
      rubric,
      isAuto: false,
      correct: null,
      correctAnswer: null,
      awarded: Number((r.self_score as number | null) ?? 0),
      max,
      selfScores: (r.self_scores as Record<string, number>) ?? {},
    };
  });

  const maxMarks = questions.reduce((s, q) => s + q.max, 0);
  const autoScoreTotal = questions.filter((q) => q.isAuto).reduce((s, q) => s + q.awarded, 0);
  const late = attempt.submitted_at ? new Date(attempt.submitted_at).getTime() > dl : false;

  // Persist the auto-score once (objective marking is deterministic).
  if (attempt.auto_score == null) {
    await db.from("attempts").update({ auto_score: autoScoreTotal }).eq("id", attempt.id);
    attempt.auto_score = autoScoreTotal;
  }

  const finalized = attempt.self_score != null;
  let weakConcepts: WeakConcept[] = [];
  if (finalized && attempt.weak_concepts?.length) {
    const breakdown = conceptBreakdown(questions);
    const names = await resolveConceptNames(db, attempt.weak_concepts);
    weakConcepts = attempt.weak_concepts.map((id) => {
      const b = breakdown.get(id) ?? { awarded: 0, max: 0 };
      return { id, name: names.get(id) ?? "Concept", awarded: b.awarded, max: b.max, ratio: b.max > 0 ? b.awarded / b.max : 1 };
    });
  }

  return {
    attempt,
    exam,
    late,
    maxMarks,
    autoScoreTotal,
    selfScoreTotal: attempt.self_score,
    finalized,
    weakConcepts,
    questions,
  };
}

export interface SelfAssessResult {
  autoScore: number;
  selfScore: number;
  total: number;
  maxMarks: number;
  weakConcepts: WeakConcept[];
}

// Finalizes scoring. Self-assessment applies only to FREE-TEXT questions (marks
// awarded per rubric component, clamped). Objective questions are auto-scored.
// Then the 2-3 weakest concepts are computed across the whole attempt and stored.
export async function saveSelfAssessment(params: {
  attemptId: string;
  userId: string;
  awards: Record<string, number>; // rubric_component_id -> marks (free-text only)
}): Promise<SelfAssessResult> {
  const db = createAdminClient();
  const attempt = await loadOwnedAttempt(db, params.attemptId, params.userId);
  if (attempt.status === "in_progress") throw new Error("Attempt not submitted yet");

  const { data: aqs, error: aqErr } = await db
    .from("attempt_questions")
    .select(`id, question_id, answer, question:questions(id, concept_id, question_format, marks)`)
    .eq("attempt_id", attempt.id);
  if (aqErr) throw aqErr;

  type Row = {
    id: string;
    answer: string | null;
    question: { id: string; concept_id: string; question_format: string; marks: number };
  };
  const rows: Row[] = (aqs ?? []).map((r) => ({
    id: r.id as string,
    answer: (r.answer as string | null) ?? null,
    question: (Array.isArray(r.question) ? r.question[0] : r.question) as Row["question"],
  }));

  const questionIds = rows.map((r) => r.question.id);
  const { data: rubricRows, error: rErr } = await db
    .from("rubric_components")
    .select("id, question_id, marks, text")
    .in("question_id", questionIds.length ? questionIds : ["00000000-0000-0000-0000-000000000000"]);
  if (rErr) throw rErr;
  const compsByQuestion = new Map<string, { id: string; marks: number; text: string }[]>();
  for (const rc of rubricRows ?? []) {
    const list = compsByQuestion.get(rc.question_id as string) ?? [];
    list.push({ id: rc.id as string, marks: Number(rc.marks), text: rc.text as string });
    compsByQuestion.set(rc.question_id as string, list);
  }

  // Per-concept awarded/max, and per-question scoring.
  const breakdown = new Map<string, { awarded: number; max: number }>();
  const addConcept = (cid: string, awarded: number, max: number) => {
    const e = breakdown.get(cid) ?? { awarded: 0, max: 0 };
    e.awarded += awarded;
    e.max += max;
    breakdown.set(cid, e);
  };

  let autoTotal = 0;
  let selfTotal = 0;

  for (const r of rows) {
    const comps = compsByQuestion.get(r.question.id) ?? [];
    const max = Number(r.question.marks);
    if (isFreeText(r.question.question_format)) {
      const selfScores: Record<string, number> = {};
      let qScore = 0;
      for (const c of comps) {
        const raw = Number(params.awards[c.id] ?? 0);
        const clamped = Math.max(0, Math.min(c.marks, Number.isFinite(raw) ? raw : 0));
        selfScores[c.id] = clamped;
        qScore += clamped;
      }
      selfTotal += qScore;
      addConcept(r.question.concept_id, qScore, max);
      const { error } = await db
        .from("attempt_questions")
        .update({ self_scores: selfScores, self_score: qScore })
        .eq("id", r.id);
      if (error) throw error;
    } else {
      // Objective: auto-score against the answer-key component.
      const key = comps[0]?.text ?? null;
      const correct = key != null && r.answer != null && normalize(r.answer) === normalize(key);
      const awarded = correct ? max : 0;
      autoTotal += awarded;
      addConcept(r.question.concept_id, awarded, max);
    }
  }

  const weak = weakestConceptIds(breakdown, 3);
  const names = await resolveConceptNames(db, weak.map((w) => w.id));

  const { error: upErr } = await db
    .from("attempts")
    .update({
      auto_score: autoTotal,
      self_score: selfTotal,
      weak_concepts: weak.map((w) => w.id),
    })
    .eq("id", attempt.id);
  if (upErr) throw upErr;

  // Finishing this exam advances the student's place in the fixed sequence.
  const exam = await loadExam(db, attempt.exam_id);
  await advanceProgress(params.userId, exam.subject_id, exam.sequence_index);

  const maxMarks = [...breakdown.values()].reduce((s, b) => s + b.max, 0);
  return {
    autoScore: autoTotal,
    selfScore: selfTotal,
    total: autoTotal + selfTotal,
    maxMarks,
    weakConcepts: weak.map((w) => ({ id: w.id, name: names.get(w.id) ?? "Concept", awarded: w.awarded, max: w.max, ratio: w.ratio })),
  };
}
