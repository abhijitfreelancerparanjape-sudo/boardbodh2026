-- Questions and their criticality-weighted rubric.
--
-- question_format collapses the old `type`. Objective formats
-- (mcq, fill_blank, true_false, two_tier, assertion_reason, numerical)
-- auto-score against the rubric_component holding the correct answer.
-- Free-text formats (short, long, compare_contrast) are self-assessed
-- against the rubric in Phase 0. (error_detection, diagram are carried
-- in the format set for later phases.)
--
-- difficulty_score is a float initialised from difficulty_band in Phase 0,
-- and recalculated from real attempt data in a later phase. The column
-- exists now so that switch is data-only, not a schema change.

-- ─── questions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id       UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  board_style      TEXT NOT NULL CHECK (board_style IN ('CBSE', 'Maharashtra')),
  question_format  TEXT NOT NULL CHECK (question_format IN (
                     'mcq', 'fill_blank', 'true_false', 'two_tier',
                     'assertion_reason', 'short', 'long', 'numerical',
                     'error_detection', 'compare_contrast', 'diagram')),
  prompt           TEXT NOT NULL,
  options          JSONB,                          -- mcq/objective choices; no correct flag (answer lives in rubric)
  marks            NUMERIC(5,2) NOT NULL,           -- equals SUM of rubric_components.marks
  keywords         TEXT[] NOT NULL DEFAULT '{}',    -- must-use scientific terms (facts, free to use)
  difficulty_band  TEXT NOT NULL CHECK (difficulty_band IN ('foundational', 'board_level', 'advanced')),
  difficulty_score DOUBLE PRECISION NOT NULL,       -- starts from band; recalculates from attempts later
  source           TEXT NOT NULL DEFAULT 'mock' CHECK (source IN ('mock', 'generated', 'official')),
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS questions_concept_id_idx ON questions (concept_id);
-- Selection path: live questions for a concept at a difficulty band.
CREATE INDEX IF NOT EXISTS questions_selection_idx
  ON questions (concept_id, difficulty_band, status);

-- ─── rubric_components (one question has many) ──────────
-- The rubric replaces a single model_answer. For objective questions a single
-- component holds the correct option/answer; free-text questions have several
-- weighted components. A question's marks = SUM(rubric_components.marks).
CREATE TABLE IF NOT EXISTS rubric_components (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,                        -- the scoring point, original prose (or correct answer for objective)
  criticality TEXT NOT NULL CHECK (criticality IN ('high', 'medium', 'low')),
  marks       NUMERIC(5,2) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,           -- stable display order for self-assessment UI
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rubric_components_question_id_idx ON rubric_components (question_id);

-- ─── RLS ────────────────────────────────────────────────
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_components ENABLE ROW LEVEL SECURITY;

-- Students may read only LIVE questions (prompt + options; the correct answer
-- is NOT here, it is in rubric_components).
CREATE POLICY "Authenticated can read live questions"
  ON questions FOR SELECT TO authenticated USING (status = 'live');

-- rubric_components has NO client read policy on purpose: it holds correct
-- answers and scoring points. The app reads it server-side with the service
-- role (e.g. to auto-score, or to show the rubric for self-assessment after
-- submission). RLS is enabled, so client keys cannot read it.
