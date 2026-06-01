# BoardBodh — build status

_Last updated: 2026-06-01_

- **Live:** https://boardbodh.vercel.app
- **Repo:** `abhijitfreelancerparanjape-sudo/boardbodh2026`
- **Total Claude spend to date:** ~$0.47 (~₹41) — itemized in `ai_generation_usage`.

Keep this file current as features land.

---

## Phase 0 — engine on mock Physics (complete, deployed)

1. **Scaffold & design system** — Next.js 15 + React 19 + TypeScript, Tailwind v4 with Zenith tokens (Ink/Bone/Terracotta/Sage) and fonts (Newsreader, Geist, Tiro Devanagari Marathi). `@supabase/ssr` browser/server/admin clients + session-refresh middleware.
2. **Database schema (migrations 001–004)** — `subjects, chapters, concepts, questions, rubric_components, exams, student_progress, questions_seen, attempts, attempt_questions`. TEXT+CHECK enums, UUID PKs, FKs to `auth.users`, RLS on every table. `questions` has `difficulty_band` + `difficulty_score` (float) and `keywords` kept separate from rubric prose.
3. **Curriculum + fixed progression** — seeded mock Physics (Physics CBSE, 3 chapters × 4 concepts, fixed 5-exam sequence: chapter exams → unit test → terminal). Dashboard shows the next exam in sequence per student.
4. **Never-repeat serving** — pulls by concept scope + difficulty band, excludes anything in `questions_seen`, records served questions. Format mix balanced (objective + free-text). Verified: two serves, zero overlap. (`npm run serve:demo`)
5. **Timed attempt flow** (ported from the Silver prototype) — server-authoritative timer from a single `started_at`, hard submission gate that locks answers; rubric revealed only after submit. Digital answer entry, autosave, auto-submit at zero. Verified incl. late/timeout. (`npm run attempt:demo`)
6. **Scoring + weakness surfacing** — objective formats (mcq, true/false) auto-scored against the answer-key rubric; free-text (short/long) self-assessed against the criticality rubric; 2–3 weakest concepts computed (criticality-weighted) and shown.
7. **Student auth & per-student progress** — email/password login + signup (admin-confirmed, no email step), route-protection middleware, sign-out. Finishing an exam advances the student's place in the sequence. Full logged-in journey verified.

**Definition of done (met):** student logs in → sees next exam in sequence → attempts under a server-authoritative timer → never sees a repeat → objective auto-scored, free-text self-assessed against the criticality rubric → sees 2–3 weakest concepts.

---

## Phase 1 — studio + Claude generation (in progress)

8. **AI-draft studio** at `/studio` (admin-gated via `ADMIN_EMAILS`) — generate panel (concept · board · band · count), per-question review queue with flags (⚠ needs a look / ✓ clean), Approve → live / Discard. Generated questions land as `source='generated'`, `status='draft'`.
9. **Real Claude generation** (`src/lib/anthropic/`) — official SDK, `claude-opus-4-8` (override via `ANTHROPIC_MODEL`), adaptive thinking, structured JSON output, prompt caching, and prompt templates conditioned on official CBSE/Maharashtra paper patterns (`prompts.ts`). Produces original board-style questions + a criticality rubric (= the model answer, incl. Maharashtra, which has no official marking scheme). Server-side only.
10. **Cost monitoring (migration 005)** — `ai_generation_usage` logs model, token counts, and cost (USD + approx INR) per call; studio shows a live cost log. `questions.review_flag` carries the reviewer flag.
11. **Source registry (migration 006)** — `source_refs` holds official source links (CBSE papers/marking-schemes/banks/NCERT, Maharashtra papers/MAA/Balbharati) with metadata. Link-only, nothing hosted, per the `paper_sourcing.md` IP rule. (`npm run seed:sources`)
12. **Pilot content** — 50 drafts (26 CBSE + 24 Maharashtra, board-level, all 12 concepts) in the studio review queue awaiting approval. Cost-capped batch (`npm run generate:batch`), fully logged.

---

## Not built yet

- **No admin account exists** — sign up once at `/signup` with the email in `ADMIN_EMAILS` to access the studio.
- **Gold tier** (human teacher grading of free-text for a fee) — out of scope.
- **AI free-text grader** — students still self-assess; no AI marker.
- **Full syllabus** — only the mock 3 chapters / 12 concepts (Electrostatics + Current Electricity), not the whole Std 12 course.
- **Real paper ingestion** — only the link registry; no hosting/parsing of past papers; no answers for verbatim past-paper questions (IP).
- **Reorderable exam sequence**; **Chemistry / Maths / Biology** — later phases.

---

## Operational notes

- **Migrations** (`supabase/migrations/`) are applied manually in the Supabase SQL editor (001–006 applied as of this date).
- **Env:** Supabase keys, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `USD_TO_INR`, `ADMIN_EMAILS` (see `.env.example`). Set on Vercel for production.
- **Helper scripts:** `npm run seed` (mock curriculum + questions), `seed:sources`, `serve:demo`, `attempt:demo`, `generate:test`, `generate:batch` (cost-capped via `GEN_CAP_INR`).
- **Cost:** every Claude call is logged to `ai_generation_usage`; the studio cost log is the billing source of truth.
