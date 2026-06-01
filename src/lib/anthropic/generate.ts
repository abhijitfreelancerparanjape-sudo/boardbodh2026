// Server-side board-style question generation via the Claude API.
//
// Generated questions land as draft (status='draft', source='generated') with a
// rubric and a reviewer flag; nothing goes live without explicit approval.
// Every call is logged to ai_generation_usage with token counts + cost.
//
// Uses the official Anthropic SDK, model claude-opus-4-8 by default (override
// with ANTHROPIC_MODEL), adaptive thinking, structured JSON output, and prompt
// caching on the (stable) system prompt to cut cost on repeated generations.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/server";
import { computeCostUSD, type TokenUsage } from "./pricing";
import type { Board, DifficultyBand, QuestionFormat } from "@/types/db";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const USD_TO_INR = Number(process.env.USD_TO_INR || "88");

const BAND_SCORE: Record<DifficultyBand, number> = {
  foundational: 0.3,
  board_level: 0.6,
  advanced: 0.85,
};

const FREE_TEXT: QuestionFormat[] = ["short", "long", "compare_contrast"];

const SYSTEM_PROMPT = `You are an expert Std 12 (Class XII) Physics paper setter for Indian boards (CBSE and Maharashtra State Board). You write original, board-style exam questions and their marking schemes.

Rules:
- Write ORIGINAL questions in the style of the requested board. Never copy a real past-paper question verbatim.
- Match the requested difficulty band:
  - foundational: recall and direct single-step application.
  - board_level: standard board exam difficulty, multi-step.
  - advanced: challenging, multi-concept or derivation-heavy.
- Each question needs a criticality-weighted rubric (the marking scheme). The question's marks equal the sum of its rubric component marks.
- For OBJECTIVE formats (mcq, true_false, numerical): exactly ONE rubric component, and its "text" MUST be the exact correct answer so it can be auto-matched:
  - mcq: "text" must be exactly equal to the correct option string (including its "A) " / "B) " prefix). Provide 4 options.
  - true_false: "text" must be exactly "True" or "False". Provide options ["True","False"].
  - numerical: "text" must be the exact expected numeric answer with unit.
- For FREE-TEXT formats (short, long): multiple weighted rubric components, each a distinct scoring point with a criticality of high, medium, or low.
- keywords: the must-use scientific terms for the question (facts).
- flag_reason: if you are uncertain about correctness, syllabus fit, or wording, briefly explain why so a human reviews it. If the question is clean, return an empty string.
- Be scientifically correct. Use plain text for math (no LaTeX): use / for division and ^ for exponents.`;

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question_format: {
            type: "string",
            enum: ["mcq", "true_false", "numerical", "short", "long"],
          },
          prompt: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          keywords: { type: "array", items: { type: "string" } },
          rubric: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string" },
                criticality: { type: "string", enum: ["high", "medium", "low"] },
                marks: { type: "number" },
              },
              required: ["text", "criticality", "marks"],
            },
          },
          flag_reason: { type: "string" },
        },
        required: ["question_format", "prompt", "options", "keywords", "rubric", "flag_reason"],
      },
    },
  },
  required: ["questions"],
};

interface GenQuestion {
  question_format: QuestionFormat;
  prompt: string;
  options: string[];
  keywords: string[];
  rubric: { text: string; criticality: "high" | "medium" | "low"; marks: number }[];
  flag_reason: string;
}

export interface GenerateResult {
  generated: number;
  costUsd: number;
  costInr: number;
}

// Heuristic + model flag. Objective answer key must be present (and, for mcq,
// among the options) or it cannot auto-score.
function reviewFlag(q: GenQuestion, marks: number): { level: "warn"; reason: string } | null {
  if (q.flag_reason && q.flag_reason.trim()) {
    return { level: "warn", reason: q.flag_reason.trim() };
  }
  if (marks <= 0) return { level: "warn", reason: "Rubric marks sum to zero." };
  const isFree = FREE_TEXT.includes(q.question_format);
  if (!isFree) {
    const key = q.rubric[0]?.text?.trim();
    if (!key) return { level: "warn", reason: "Objective question has no answer-key rubric component." };
    if (q.question_format === "mcq" && !q.options.some((o) => o.trim() === key)) {
      return { level: "warn", reason: "MCQ answer key does not exactly match any option." };
    }
  }
  return null;
}

export async function generateQuestions(params: {
  conceptId: string;
  board: Board;
  band: DifficultyBand;
  count: number;
  userId: string | null;
}): Promise<GenerateResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");

  const db = createAdminClient();

  // Context: the concept and its chapter.
  const { data: concept, error: cErr } = await db
    .from("concepts")
    .select("id, name, chapter:chapters(name)")
    .eq("id", params.conceptId)
    .single();
  if (cErr || !concept) throw new Error("Concept not found");
  const chapterName = (Array.isArray(concept.chapter) ? concept.chapter[0] : concept.chapter)?.name ?? "";

  const count = Math.max(1, Math.min(10, params.count));
  const userPrompt = `Generate ${count} original ${params.board} Std 12 Physics questions for the concept "${concept.name}" (chapter: "${chapterName}") at the "${params.band}" difficulty band. Vary the formats sensibly for the band. Return them in the required JSON structure.`;

  const client = new Anthropic({ apiKey });

  let usage: TokenUsage | undefined;
  let parsed: { questions: GenQuestion[] } | null = null;
  let status: "success" | "error" = "success";
  let errorMsg: string | null = null;

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      messages: [{ role: "user", content: userPrompt }],
    });
    usage = resp.usage as TokenUsage;
    const textBlock = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) throw new Error("No content returned");
    parsed = JSON.parse(textBlock.text);
  } catch (e) {
    status = "error";
    errorMsg = (e as Error).message;
  }

  const costUsd = computeCostUSD(MODEL, usage);
  const generatedCount = parsed?.questions?.length ?? 0;

  // Log usage + cost regardless of outcome.
  await db.from("ai_generation_usage").insert({
    user_id: params.userId,
    model: MODEL,
    concept_id: params.conceptId,
    difficulty_band: params.band,
    board: params.board,
    requested: count,
    generated: generatedCount,
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    cache_creation_tokens: usage?.cache_creation_input_tokens ?? 0,
    cache_read_tokens: usage?.cache_read_input_tokens ?? 0,
    cost_usd: Number(costUsd.toFixed(6)),
    cost_inr: Number((costUsd * USD_TO_INR).toFixed(2)),
    status,
    error: errorMsg,
  });

  if (status === "error" || !parsed) {
    throw new Error(errorMsg ?? "Generation failed");
  }

  // Persist as drafts + rubric.
  for (const q of parsed.questions) {
    const marks = q.rubric.reduce((s, c) => s + Number(c.marks || 0), 0);
    const flag = reviewFlag(q, marks);
    const { data: qrow, error: qErr } = await db
      .from("questions")
      .insert({
        concept_id: params.conceptId,
        board_style: params.board,
        question_format: q.question_format,
        prompt: q.prompt,
        options: q.options.length ? q.options : null,
        marks,
        keywords: q.keywords ?? [],
        difficulty_band: params.band,
        difficulty_score: BAND_SCORE[params.band],
        source: "generated",
        status: "draft",
        review_flag: flag,
      })
      .select("id")
      .single();
    if (qErr || !qrow) throw qErr ?? new Error("Failed to insert question");

    const rubricRows = q.rubric.map((c, i) => ({
      question_id: qrow.id,
      text: c.text,
      criticality: c.criticality,
      marks: c.marks,
      sort_order: i,
    }));
    const { error: rErr } = await db.from("rubric_components").insert(rubricRows);
    if (rErr) throw rErr;
  }

  return { generated: generatedCount, costUsd, costInr: costUsd * USD_TO_INR };
}
