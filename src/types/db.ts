// Row types for the Phase 0 schema. Hand-written for now; can be replaced by
// generated Supabase types later.

export type Board = "CBSE" | "Maharashtra";
export type ExamKind = "chapter" | "unit_test" | "terminal";

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
