-- Official source registry ("link, don't host" per paper_sourcing.md).
--
-- We record LINKS to official CBSE / NCERT / Maharashtra material plus metadata
-- (board, kind, year, notes). We do NOT host the copyrighted PDFs. They are used
-- only as pattern/metadata reference; original questions + rubric are generated.

CREATE TABLE IF NOT EXISTS source_refs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board        TEXT NOT NULL CHECK (board IN ('CBSE', 'Maharashtra')),
  kind         TEXT NOT NULL CHECK (kind IN ('question_paper', 'marking_scheme', 'textbook', 'question_bank', 'model_answer')),
  subject      TEXT NOT NULL DEFAULT 'Physics',
  title        TEXT NOT NULL,
  official_url TEXT NOT NULL,            -- link to the official source (not hosted here)
  year         TEXT,                     -- e.g. "2024" or "2015-2025"
  notes        TEXT,                     -- IP/usage note; verify exact path at pull time
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS source_refs_board_idx ON source_refs (board, kind);

-- RLS on; read server-side with the service role (studio/admin). No client policy.
ALTER TABLE source_refs ENABLE ROW LEVEL SECURITY;
