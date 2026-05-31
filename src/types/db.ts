// Row types for the Phase 0 schema. Hand-written for now; can be replaced by
// generated Supabase types later.

export type Board = "CBSE" | "Maharashtra";
export type ExamKind = "chapter" | "unit_test" | "terminal";
export type DifficultyBand = "foundational" | "board_level" | "advanced";
export type Criticality = "high" | "medium" | "low";
export type QuestionStatus = "draft" | "live";
export type QuestionSource = "mock" | "generated" | "official";

export type QuestionFormat =
  | "mcq"
  | "fill_blank"
  | "true_false"
  | "two_tier"
  | "assertion_reason"
  | "short"
  | "long"
  | "numerical"
  | "error_detection"
  | "compare_contrast"
  | "diagram";

export interface Subject {
  id: string;
  name: string;
  board: Board;
  grade: string;
  created_at: string;
}

export interface Chapter {
  id: string;
  subject_id: string;
  name: string;
  sequence_index: number;
  created_at: string;
}

export interface Concept {
  id: string;
  chapter_id: string;
  name: string;
  created_at: string;
}

export interface ExamScope {
  chapter_ids?: string[];
  concept_ids?: string[];
  difficulty_bands?: DifficultyBand[];
  question_count?: number;
}

export interface Exam {
  id: string;
  subject_id: string;
  kind: ExamKind;
  name: string;
  scope: ExamScope;
  sequence_index: number;
  duration_minutes: number;
  created_at: string;
}

export const EXAM_KIND_LABEL: Record<ExamKind, string> = {
  chapter: "Chapter Exam",
  unit_test: "Unit Test",
  terminal: "Terminal Exam",
};
