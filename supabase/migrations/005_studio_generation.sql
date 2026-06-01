-- Phase 1: studio AI generation.
--
-- Generated questions land as draft (status='draft', source='generated') and
-- carry a review_flag for the reviewer. ai_generation_usage logs every Claude
-- API generation call with token counts and computed cost, so spend is
-- auditable (for client discussion).

-- Per-question reviewer flag: NULL = clean, else {level, reason}.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS review_flag JSONB;

-- Cost + usage log for AI generation. One row per /api/generate call.
CREATE TABLE IF NOT EXISTS ai_generation_usage (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  model                 TEXT NOT NULL,
  concept_id            UUID REFERENCES concepts(id) ON DELETE SET NULL,
  difficulty_band       TEXT,
  board                 TEXT,
  requested             INTEGER NOT NULL DEFAULT 0,
  generated             INTEGER NOT NULL DEFAULT 0,
  input_tokens          INTEGER NOT NULL DEFAULT 0,
  output_tokens         INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens     INTEGER NOT NULL DEFAULT 0,
  cost_usd              NUMERIC(10,6) NOT NULL DEFAULT 0,
  cost_inr              NUMERIC(12,2) NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  error                 TEXT
);

CREATE INDEX IF NOT EXISTS ai_generation_usage_created_at_idx ON ai_generation_usage (created_at DESC);

-- RLS on: the studio reads this server-side with the service role (admin only).
-- No client policies, so anon/authenticated keys cannot read cost data.
ALTER TABLE ai_generation_usage ENABLE ROW LEVEL SECURITY;
