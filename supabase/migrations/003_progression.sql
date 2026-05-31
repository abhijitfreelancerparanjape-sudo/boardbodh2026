-- Progression units and per-student state.
--
-- Exams are ordered data per subject (chapter -> unit_test -> terminal).
-- The sequence is FIXED for Phase 0 (sequence_index); reorder is a future
-- permission flag, not a rewrite. questions_seen enforces never-repeat.

-- ─── exams (the progression units) ──────────────────────
CREATE TABLE IF NOT EXISTS exams (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id       UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('chapter', 'unit_test', 'terminal')),
  name             TEXT NOT NULL,                   -- display label, e.g. "Chapter 1: Electric Charges"
  scope            JSONB NOT NULL DEFAULT '{}'::jsonb, -- which chapters/concepts, e.g. {"chapter_ids":[...],"concept_ids":[...]}
  sequence_index   INTEGER NOT NULL,                -- fixed order per subject
  duration_minutes INTEGER NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_id, sequence_index)
);

CREATE INDEX IF NOT EXISTS exams_subject_id_idx ON exams (subject_id);

-- ─── student_progress (one row per user per subject) ────
CREATE TABLE IF NOT EXISTS student_progress (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id         UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  current_exam_index INTEGER NOT NULL DEFAULT 0,    -- pointer into the fixed exam sequence
  chapters_completed UUID[] NOT NULL DEFAULT '{}',  -- completed chapter ids
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject_id)
);

CREATE INDEX IF NOT EXISTS student_progress_user_id_idx ON student_progress (user_id);

-- ─── questions_seen (never-repeat) ──────────────────────
-- One row per (user, question). The UNIQUE constraint is the never-repeat
-- guarantee: a question is excluded from future selection once seen.
CREATE TABLE IF NOT EXISTS questions_seen (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS questions_seen_user_id_idx ON questions_seen (user_id);

-- ─── attempts ───────────────────────────────────────────
-- Server-authoritative timer/gate: started_at is set on serve, the server
-- decides submitted vs expired. auto_score = objective formats, self_score =
-- free-text self-assessment, weak_concepts = the 2-3 weakest after scoring.
CREATE TABLE IF NOT EXISTS attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id       UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at  TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'expired')),
  auto_score    NUMERIC(6,2),                       -- objective formats
  self_score    NUMERIC(6,2),                       -- free-text self-assessment
  weak_concepts UUID[] NOT NULL DEFAULT '{}',        -- 2-3 weakest concept ids for this attempt
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attempts_user_id_idx ON attempts (user_id);
CREATE INDEX IF NOT EXISTS attempts_exam_id_idx ON attempts (exam_id);

-- ─── RLS ────────────────────────────────────────────────
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions_seen ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;

-- Exams are shared read-only content.
CREATE POLICY "Authenticated can read exams"
  ON exams FOR SELECT TO authenticated USING (true);

-- Students manage only their own progress.
CREATE POLICY "Users read own progress"
  ON student_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own progress"
  ON student_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own progress"
  ON student_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Students see only their own seen-list. No update/delete: never-repeat is
-- append-only. (Serve-time inserts may also run server-side via service role.)
CREATE POLICY "Users read own seen questions"
  ON questions_seen FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own seen questions"
  ON questions_seen FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Students manage only their own attempts.
CREATE POLICY "Users read own attempts"
  ON attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own attempts"
  ON attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own attempts"
  ON attempts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
