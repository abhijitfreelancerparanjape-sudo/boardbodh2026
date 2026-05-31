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

export type AttemptStatus = "in_progress" | "submitted" | "expired";

export interface Attempt {
  id: string;
  user_id: string;
  exam_id: string;
  started_at: string;
  submitted_at: string | null;
  status: AttemptStatus;
  auto_score: number | null;
  self_score: number | null;
  weak_concepts: string[];
  created_at: string;
}

export interface Question {
  id: string;
  concept_id: string;
  board_style: Board;
  question_format: QuestionFormat;
  prompt: string;
  options: string[] | null;
  marks: number;
  keywords: string[];
  difficulty_band: DifficultyBand;
  difficulty_score: number;
  source: QuestionSource;
  status: QuestionStatus;
  created_at: string;
  updated_at: string;
}

export interface RubricComponent {
  id: string;
  question_id: string;
  text: string;
  criticality: Criticality;
  marks: number;
  sort_order: number;
}

export const CRITICALITY_LABEL: Record<Criticality, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const QUESTION_FORMAT_LABEL: Record<QuestionFormat, string> = {
  mcq: "Multiple choice",
  fill_blank: "Fill in the blank",
  true_false: "True / False",
  two_tier: "Two-tier",
  assertion_reason: "Assertion-Reason",
  short: "Short answer",
  long: "Long answer",
  numerical: "Numerical",
  error_detection: "Error detection",
  compare_contrast: "Compare and contrast",
  diagram: "Diagram",
};

// Objective formats auto-score against the correct-answer rubric component;
// free-text formats are self-assessed against the weighted rubric.
export const FREE_TEXT_FORMATS: QuestionFormat[] = ["short", "long", "compare_contrast"];
