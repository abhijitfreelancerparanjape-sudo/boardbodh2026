// Prompt templates for server-side question generation.
//
// Generation is "conditioned on official past-paper patterns as reference": the
// per-board pattern blocks below describe the structure, mark weights, and house
// style of each board's Std 12 Physics paper, so generated questions match the
// real exam shape WITHOUT reproducing any past-paper question verbatim. When real
// papers are ingested (later), swap these descriptions for retrieved exemplars.

import type { Board, DifficultyBand } from "@/types/db";

// Reference patterns distilled from the official board paper formats.
export const BOARD_PATTERNS: Record<Board, string> = {
  CBSE: `CBSE Class XII Physics (theory paper, 70 marks) house style:
- Section A: 1-mark MCQs and assertion-reason items (an Assertion + Reason pair, options about which is true and whether the reason explains the assertion).
- Section B: 2-mark very-short answers.
- Section C: 3-mark short answers, often a definition plus a derivation step or a numerical.
- Section D: case/passage-based items.
- Section E: 5-mark long answers — full derivations from first principles, ray/circuit diagrams described in words, multi-step numericals.
- SI units throughout; numerical answers carry units; derivations state assumptions.`,
  Maharashtra: `Maharashtra State Board (HSC) Class XII Physics house style:
- Section A: 1-mark MCQs and very-short answers.
- Section B: 2-mark questions.
- Section C: 3-mark questions (state laws, short derivations, numericals).
- Section D: 4-mark long answers — derivations, diagrams described in words, applied numericals.
- SI units; emphasis on stating principles/laws precisely before applying them.`,
};

const BAND_GUIDANCE: Record<DifficultyBand, string> = {
  foundational: "Recall and direct single-step application. Test whether the student knows the core idea.",
  board_level: "Standard board-exam difficulty: multi-step reasoning, a short derivation, or an applied numerical.",
  advanced: "Challenging: multi-concept synthesis, full derivations, or non-routine numericals.",
};

export const SYSTEM_PROMPT = `You are an expert Std 12 (Class XII) Physics paper setter for Indian boards (CBSE and Maharashtra State Board). You write ORIGINAL, board-style exam questions and their marking schemes, matching the look and rigour of official board papers.

Hard rules:
- Write ORIGINAL questions in the requested board's style. NEVER copy a real past-paper question verbatim — use the official patterns only as a reference for structure, difficulty, and phrasing.
- The question's marks equal the SUM of its rubric component marks.
- For OBJECTIVE formats (mcq, true_false, numerical): exactly ONE rubric component whose "text" is the EXACT correct answer, so it can be auto-matched:
  - mcq: provide 4 options; "text" must equal the correct option string exactly, including its "A) " / "B) " prefix.
  - true_false: provide options ["True","False"]; "text" must be exactly "True" or "False".
  - numerical: "text" must be the exact expected numeric answer with its unit.
- For FREE-TEXT formats (short, long): multiple weighted rubric components, each a distinct scoring point with criticality high, medium, or low (a missed high-criticality point should cost more).
- keywords: the must-use scientific terms (facts) for the question.
- flag_reason: if you are uncertain about correctness, syllabus fit, or wording, briefly explain why so a human reviews it; otherwise return an empty string.
- Be scientifically correct. Use plain text for math (no LaTeX): use / for division and ^ for exponents. Describe any required diagram in words.`;

export function buildUserPrompt(params: {
  conceptName: string;
  chapterName: string;
  board: Board;
  band: DifficultyBand;
  count: number;
}): string {
  return `Generate ${params.count} original ${params.board} Std 12 Physics questions.

Concept: "${params.conceptName}" (chapter: "${params.chapterName}")
Difficulty band: ${params.band} — ${BAND_GUIDANCE[params.band]}

Reference pattern (match this board's structure and style, do not copy questions):
${BOARD_PATTERNS[params.board]}

Vary the formats sensibly for the band (e.g. an mcq or true_false at foundational; short/long/numerical at board_level and advanced). Return them in the required JSON structure.`;
}

// JSON schema for structured output (output_config.format). Avoids unsupported
// constraints (no min/max length); objects set additionalProperties:false.
export const OUTPUT_SCHEMA = {
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
} as const;
