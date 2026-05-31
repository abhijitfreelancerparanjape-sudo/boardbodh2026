# MVP Build Spec — Std 12 Physics Progression Engine

Supersedes the Class X Silver build spec. Same stack, bigger engine.

Stack: Next.js 15 · Supabase · Vercel · Claude API (server-side generation).

---

## Core principle

The product is a year-long guided progression, not a paper. A student is always told what to do next, never sees the same question twice, and learns where they are weak. Integrity on timed attempts still comes from a server-authoritative timer and submission gate (carried over from Silver), not DRM.

---

## Data model

**subjects**
- id, name (Physics), board (CBSE | Maharashtra), grade (XII)

**chapters**
- id, subject_id, name, sequence_index (ordered)

**concepts** (micro-concepts within a chapter)
- id, chapter_id, name

**questions**
- id, concept_id, board_style (CBSE | Maharashtra),
  question_format (mcq | fill_blank | true_false | two_tier | assertion_reason | short | long | numerical | error_detection | compare_contrast | diagram),
  prompt, options (mcq/objective), marks,
  keywords (array — must-use scientific terms; facts, free to use, separate from prose),
  difficulty_band (foundational | board_level | advanced),
  difficulty_score (float — starts from band, recalculates from attempts),
  source (generated), status (draft | live)

  Note: `type` collapsed into the richer `question_format`. Objective formats (mcq, fill_blank, true_false, two_tier, assertion_reason, numerical) auto-score. Free-text formats (short, long, compare_contrast) self-assess in Phase 0, AI-assisted + human in later phases.

**rubric_components** (the criticality-based rubric — one question has many)
- id, question_id, text (the scoring point, original prose), criticality (high | medium | low), marks (what this component is worth)
- A question's marks = sum of its rubric_components' marks. Scoring (later phases) is per-component coverage, not similarity to one model answer. In Phase 0, seed these on mock questions and use them for simple scoring + sharper weakness surfacing.
- For objective questions, a single component holds the correct option/answer. For free-text, multiple weighted components.

**exams** (the progression units)
- id, subject_id, kind (chapter | unit_test | terminal),
  scope (which chapters/concepts), sequence_index (fixed order for MVP),
  duration_minutes

**student_progress**
- id, user_id, subject_id, current_exam_index, chapters_completed

**questions_seen** (never-repeat)
- id, user_id, question_id, seen_at

**attempts**
- id, user_id, exam_id, started_at, submitted_at, status,
  auto_score (mcq + short), self_score (long), weak_concepts (array)

---

## Engine logic

### Progression
Exams are ordered data per subject. The student is shown the next exam in sequence (chapter → unit test → terminal). Sequence is fixed for MVP; reorder is a future permission flag, not a rewrite.

### Question selection (never-repeat + weakness)
When building an exam instance for a student:
- pull questions matching the exam's concept scope and difficulty band,
- exclude anything in that student's `questions_seen`,
- after MVP: bias selection toward the student's weak concepts.
Write selected questions into `questions_seen` on serve.

### Difficulty
- MVP: `difficulty_score` initialised from the authoring band.
- Post-MVP: recalculate `difficulty_score` from real attempt data (share of students who got it right) — this is Dhananjay's historical-percentage model, switched on automatically once volume exists.

### Scoring (Phase 0: rubric-aware but simple)
- Objective formats (mcq, fill_blank, true_false, two_tier, assertion_reason, numerical): auto-scored against the rubric_component holding the correct answer.
- Free-text formats (short, long, compare_contrast): in Phase 0 the student self-assesses against the question's rubric_components — they see each weighted scoring point (with its criticality) and award themselves marks per component. This is rubric-based self-assessment, not free guessing, and it teaches the marking scheme.
- Later phases: AI scores each rubric_component (present / partial / absent) as first marker, human validates borderline/high-stakes (Gold). The criticality weighting makes fair partial marking (3.5 vs 4 vs 4.5) defensible.

Phase 0 builds the rubric structure and self-assessment against it. It does NOT build the AI scoring engine — that is a later phase.

### Weakness surfacing
After each attempt, compute the 2-3 concepts with the lowest score and store on the attempt. With rubric_components, weakness is computed against weighted scoring points (a missed high-criticality point matters more), which is sharper than flat right/wrong. Show the student what to revisit.

---

## Generation (server-side)

Original board-style questions are generated per concept and band via a server-side `/api/generate` endpoint (prompt templates in `lib/anthropic/`), conditioned on the official past-paper patterns as reference. Generated questions land as `draft` and require studio approval before going `live`. Never client-side; the generation logic lives in the codebase and is reused.

---

## In scope for MVP
- Physics, both boards.
- Curriculum model (subject → chapter → concept), fixed exam sequence.
- Never-repeat question serving.
- Rubric structure on questions (criticality-weighted scoring components), seeded on mock content.
- Auto-score objective formats; rubric-based self-assessment for free-text.
- Post-attempt weakness surfacing (computed against rubric components).
- Studio review/approve for generated content.

## Out of scope for MVP (explicitly)
- AI scoring engine that evaluates free-text against the rubric (later phase — Phase 0 models the rubric and self-assesses against it, but builds no AI grader).
- Concept-mastery-vs-completeness two-dimension scoring (later).
- Full adaptive difficulty ramp and weakness-driven generation (Phase 2).
- Human (teacher) grading of free-text answers — Gold (later).
- Reorderable sequence (later).
- OSM / full online evaluation (Dhananjay's someday).
- Chemistry, Maths, Biology — clone after Physics proves the engine.

---

## Build sequence
1. Schema + curriculum model on mock Physics content.
2. Fixed progression + next-exam logic.
3. Never-repeat serving + attempt flow + timer/gate (from Silver).
4. Auto-score + self-assess + weakness surfacing.
5. Studio: generated-content review/approve.
6. Load real official Physics content; generate Maharashtra answers; generate board-style questions.
