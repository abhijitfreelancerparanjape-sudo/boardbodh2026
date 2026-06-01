// Server-side reads for the studio (admin-only). Uses the service role.

import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { Criticality, DifficultyBand, QuestionFormat } from "@/types/db";

export interface ConceptOption {
  id: string;
  name: string;
  chapter: string;
  chapterSeq: number;
}

export async function getConceptOptions(): Promise<ConceptOption[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("concepts")
    .select("id, name, chapter:chapters(name, sequence_index)")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .map((c) => {
      const ch = Array.isArray(c.chapter) ? c.chapter[0] : c.chapter;
      return {
        id: c.id as string,
        name: c.name as string,
        chapter: ch?.name ?? "",
        chapterSeq: ch?.sequence_index ?? 0,
      };
    })
    .sort((a, b) => a.chapterSeq - b.chapterSeq);
}

export interface DraftQuestion {
  id: string;
  prompt: string;
  question_format: QuestionFormat;
  options: string[] | null;
  marks: number;
  difficulty_band: DifficultyBand;
  conceptName: string;
  flag: { level: string; reason: string } | null;
  rubric: { id: string; text: string; criticality: Criticality; marks: number }[];
}

export async function getDraftQuestions(): Promise<DraftQuestion[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("questions")
    .select(
      "id, prompt, question_format, options, marks, difficulty_band, review_flag, concept:concepts(name), rubric_components(id, text, criticality, marks, sort_order)"
    )
    .eq("status", "draft")
    .eq("source", "generated")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((q) => {
    const concept = Array.isArray(q.concept) ? q.concept[0] : q.concept;
    const rubric = ((q.rubric_components ?? []) as Record<string, unknown>[])
      .map((r) => ({
        id: r.id as string,
        text: r.text as string,
        criticality: r.criticality as Criticality,
        marks: Number(r.marks),
        sort_order: Number(r.sort_order),
      }))
      .sort((a, b) => a.sort_order - b.sort_order);
    return {
      id: q.id as string,
      prompt: q.prompt as string,
      question_format: q.question_format as QuestionFormat,
      options: (q.options as string[] | null) ?? null,
      marks: Number(q.marks),
      difficulty_band: q.difficulty_band as DifficultyBand,
      conceptName: concept?.name ?? "",
      flag: (q.review_flag as { level: string; reason: string } | null) ?? null,
      rubric,
    };
  });
}

export interface UsageRow {
  id: string;
  created_at: string;
  model: string;
  board: string | null;
  difficulty_band: string | null;
  requested: number;
  generated: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  cost_inr: number;
  status: string;
}

export interface UsageSummary {
  rows: UsageRow[];
  totalUsd: number;
  totalInr: number;
  totalGenerated: number;
  calls: number;
}

export async function getUsageSummary(limit = 50): Promise<UsageSummary> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("ai_generation_usage")
    .select(
      "id, created_at, model, board, difficulty_band, requested, generated, input_tokens, output_tokens, cost_usd, cost_inr, status"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as UsageRow[];
  // Totals across the returned window.
  let totalUsd = 0;
  let totalInr = 0;
  let totalGenerated = 0;
  for (const r of rows) {
    totalUsd += Number(r.cost_usd);
    totalInr += Number(r.cost_inr);
    totalGenerated += Number(r.generated);
  }
  return { rows, totalUsd, totalInr, totalGenerated, calls: rows.length };
}
