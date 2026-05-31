# Project context for Claude Code

This file is read on every session. Keep it accurate.

## What this is
A board-exam intelligence platform for Std 12 Physics (CBSE + Maharashtra). Students follow a guided year-long progression of exams (chapter exam -> unit test -> terminal), never see the same question twice, and learn which concepts they are weakest on. This repo is Phase 0: the engine running on mock Physics content. No AI generation, no real papers, no studio, no Gold tier yet.

Working name: BoardBodh (used as the internal/working name and for the repo/Vercel project). Still pending IP India trademark clearance, so treat it as the working name only and do not present it as a final, confirmed public brand until cleared. The in-app wordmark defaults to APP_NAME in code and is driven by NEXT_PUBLIC_APP_NAME.

## Stack (match my existing products Abhilekh and Saral Studio)
- Next.js 15 (App Router)
- Supabase (Postgres + Auth)
- Vercel (deploy)
- Claude API, server-side only (NOT used in Phase 0; arrives Phase 1)
- TypeScript throughout

## Accounts
All three services use the same account: abhijitfreelancerparanjape@gmail.com
- GitHub: owner abhijitfreelancerparanjape-sudo. Repo: https://github.com/abhijitfreelancerparanjape-sudo/boardbodh2026
- Vercel: team abhijitfreelancerparanjape-2749s-projects. Project: https://vercel.com/abhijitfreelancerparanjape-2749s-projects/boardbodh
- Supabase: under abhijitfreelancerparanjape@gmail.com

Note: pushing and deploying require being authenticated as the abhijitfreelancerparanjape-sudo GitHub account and the abhijitfreelancerparanjape-2749s-projects Vercel team. A machine logged into a different account (e.g. paranjapeabhijitashok) can read the public repo but cannot push or deploy.

## Style (Zenith system)
- Colors: Ink #181613, Bone #f3ede2, Terracotta #b8553a, Sage #6b7d5c
- Fonts: Newsreader (display), Geist (UI/body), Tiro Devanagari (Devanagari text)
- Tone: clean, calm, outcome-focused. No clutter.

## Formatting and working preferences
- No em dashes anywhere.
- INR currency with grouping (e.g. 2,499 not 2499) when money appears.
- Direct, no filler.
- Ask clarifying questions instead of assuming.

## Phase 0 scope (build exactly this, nothing more)
1. Scaffold matching the above stack and style.
2. Supabase schema + migration: subjects, chapters, concepts, questions, exams, student_progress, questions_seen, attempts.
3. Curriculum model (subject -> chapter -> concept), fixed exam sequence as ordered data, seeded with mock Physics.
4. Never-repeat question serving (exclude anything in questions_seen, then record served questions).
5. Timed attempt flow with server-authoritative timer and submission gate (port logic from the silver prototype reference).
6. Scoring: auto-score objective formats; rubric-based self-assessment for free-text answers; then surface the 2-3 weakest concepts (computed against rubric components).

## Out of scope for Phase 0 (do NOT build these yet)
- AI question generation / any Claude API calls
- AI scoring engine that grades free-text against the rubric (Phase 0 models the rubric and self-assesses against it, but builds NO AI grader)
- Real official papers ingestion
- Studio authoring + review UI
- Gold (human evaluation) tier
- Reorderable exam sequence (sequence is fixed in Phase 0)
- Historical-percentage difficulty (use a fixed three-band field now; design the schema so it can recalculate later)

## Key data model notes
- questions.difficulty_band: foundational | board_level | advanced (set at authoring time in Phase 0).
- questions.difficulty_score: float, initialised from the band; recalculated from attempt data in a later phase. Keep the field now.
- questions.question_format: mcq | fill_blank | true_false | two_tier | assertion_reason | short | long | numerical | error_detection | compare_contrast | diagram. Objective formats auto-score; free-text formats (short, long, compare_contrast) self-assess against the rubric in Phase 0.
- questions.keywords: array of must-use scientific terms (facts, free to use, kept separate from answer prose).
- rubric_components: a question has many. Each has text, criticality (high|medium|low), marks. Question marks = sum of component marks. Scoring is per-component coverage, not similarity to one model answer. There is no single model_answer string — the rubric replaces it. Seed these on mock questions in Phase 0 and use them for scoring + weakness surfacing.
- questions_seen: one row per (user, question) so a student never gets a repeat.
- exams.sequence_index: fixed order per subject for the progression.

## Definition of done for Phase 0
A working flow: student logs in -> sees the next exam in sequence -> attempts it under a timer -> never sees a repeated question -> objective parts auto-scored, free-text answers self-assessed against the criticality rubric -> sees their 2-3 weakest concepts. Running on mock Physics content.

## How to work with me
- Build in the order above; each step should run and be demoable before the next.
- Prefer small, reviewable commits.
- If a decision is ambiguous, ask rather than assume.
- Reference docs in /docs (build spec, prototypes) are the source of truth; the build spec is the contract, the prototypes are reference implementations to port from.
