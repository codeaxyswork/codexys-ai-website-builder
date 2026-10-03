-- ====================================================================
-- Phase 2A: Additive Migration for AI Visibility Logs
-- Safe, additive-only migration. Zero changes to existing tables.
-- ====================================================================

CREATE TABLE IF NOT EXISTS seo_ai_visibility_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'openai', 'perplexity', 'gemini', 'claude'
  model_name VARCHAR(100) NOT NULL, -- 'gpt-4o', 'sonar', etc.
  prompt TEXT NOT NULL,
  prompt_category VARCHAR(50) NOT NULL DEFAULT 'informational', -- 'informational', 'commercial', 'buyer_intent', 'local', 'competitor'
  brand_name VARCHAR(255) NOT NULL,
  brand_mentioned BOOLEAN NOT NULL DEFAULT FALSE,
  unprompted_mention BOOLEAN NOT NULL DEFAULT FALSE,
  sentiment VARCHAR(20) NOT NULL DEFAULT 'neutral', -- 'positive', 'neutral', 'negative'
  citation_urls TEXT[] DEFAULT '{}',
  citation_domains TEXT[] DEFAULT '{}',
  response_excerpt TEXT, -- Bounded response excerpt (max 300 chars) for storage efficiency
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'success', -- 'success', 'failed', 'timeout', 'rate_limited', 'auth_error'
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance & analytical querying
CREATE INDEX IF NOT EXISTS idx_seo_ai_visibility_logs_website_created ON seo_ai_visibility_logs(website_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_ai_visibility_logs_provider ON seo_ai_visibility_logs(provider);

-- Row Level Security (RLS) Policies
ALTER TABLE seo_ai_visibility_logs ENABLE ROW LEVEL SECURITY;

-- Select Policy: Users can view AI visibility logs for websites they own
CREATE POLICY "Users can view AI visibility logs for owned websites"
  ON seo_ai_visibility_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM websites
      WHERE websites.id = seo_ai_visibility_logs.website_id
      AND websites.user_id = auth.uid()
    )
  );

-- Insert Policy: Users can insert AI visibility logs for websites they own
CREATE POLICY "Users can insert AI visibility logs for owned websites"
  ON seo_ai_visibility_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM websites
      WHERE websites.id = seo_ai_visibility_logs.website_id
      AND websites.user_id = auth.uid()
    )
  );
