-- Curriculum model: subject -> chapter -> concept.
-- A subject is per-board (Physics CBSE and Physics Maharashtra are separate rows).
-- Convention: TEXT + CHECK for closed value sets (matches existing products),
-- UUID PKs, RLS enabled. Curriculum is shared read-only content for students;
-- writes happen server-side with the service role (which bypasses RLS).

-- ─── subjects ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  board      TEXT NOT NULL CHECK (board IN ('CBSE', 'Maharashtra')),
  grade      TEXT NOT NULL DEFAULT 'XII',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, board, grade)
);

-- ─── chapters ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chapters (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id     UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  sequence_index INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_id, sequence_index)
);

CREATE INDEX IF NOT EXISTS chapters_subject_id_idx ON chapters (subject_id);

-- ─── concepts (micro-concepts within a chapter) ─────────
CREATE TABLE IF NOT EXISTS concepts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS concepts_chapter_id_idx ON concepts (chapter_id);

-- ─── RLS: authenticated users may read curriculum; no client writes ───
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read subjects"
  ON subjects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read chapters"
  ON chapters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read concepts"
  ON concepts FOR SELECT TO authenticated USING (true);
