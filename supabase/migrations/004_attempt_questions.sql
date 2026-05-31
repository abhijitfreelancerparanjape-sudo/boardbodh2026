-- Per-attempt question detail: the served set for an attempt, the student's
-- answer, and (after submission) the self-assessment marks awarded per rubric
-- component. attempts already holds the aggregate scores; this is the detail.
--
-- The served set is recorded here when the attempt starts, so scoring and
-- weakness surfacing (next step) know exactly which questions this attempt had.

CREATE TABLE IF NOT EXISTS attempt_questions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id   UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,                 -- order within the attempt
  answer       TEXT,                             -- student's typed answer / selected option
  self_scores  JSONB NOT NULL DEFAULT '{}'::jsonb, -- { rubric_component_id: marks_awarded }
  self_score   NUMERIC(6,2),                     -- sum of self_scores for this question
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS attempt_questions_attempt_id_idx ON attempt_questions (attempt_id);

-- ─── RLS: a row is owned through its parent attempt ─────
ALTER TABLE attempt_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own attempt_questions"
  ON attempt_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid()));

CREATE POLICY "Users insert own attempt_questions"
  ON attempt_questions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid()));

CREATE POLICY "Users update own attempt_questions"
  ON attempt_questions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid()));
