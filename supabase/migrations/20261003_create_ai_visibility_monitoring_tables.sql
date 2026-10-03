-- ====================================================================
-- Phase 3: Additive Migration for Automated AI Visibility Monitoring
-- Safe, additive-only migration for configurations, runs, and alerts.
-- Zero changes to existing tables.
-- ====================================================================

-- 1. Website Monitoring Configuration Table
CREATE TABLE IF NOT EXISTS website_ai_visibility_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL UNIQUE REFERENCES websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  frequency VARCHAR(20) NOT NULL DEFAULT 'daily', -- 'daily', 'weekly'
  enabled_providers TEXT[] NOT NULL DEFAULT '{"openai","perplexity","gemini","claude"}',
  prompt_categories TEXT[] NOT NULL DEFAULT '{"buyer_intent","informational","commercial"}',
  brand_name VARCHAR(255) NOT NULL,
  custom_prompts TEXT[] DEFAULT '{}',
  max_probes_per_run INTEGER NOT NULL DEFAULT 4,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_website_ai_visibility_configs_website ON website_ai_visibility_configs(website_id);
CREATE INDEX IF NOT EXISTS idx_website_ai_visibility_configs_next_run ON website_ai_visibility_configs(next_run_at) WHERE is_enabled = TRUE;

ALTER TABLE website_ai_visibility_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view AI visibility config for owned websites"
  ON website_ai_visibility_configs FOR SELECT
  USING (EXISTS (SELECT 1 FROM websites WHERE websites.id = website_ai_visibility_configs.website_id AND websites.user_id = auth.uid()));

CREATE POLICY "Users can insert AI visibility config for owned websites"
  ON website_ai_visibility_configs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM websites WHERE websites.id = website_ai_visibility_configs.website_id AND websites.user_id = auth.uid()));

CREATE POLICY "Users can update AI visibility config for owned websites"
  ON website_ai_visibility_configs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM websites WHERE websites.id = website_ai_visibility_configs.website_id AND websites.user_id = auth.uid()));

CREATE POLICY "Users can delete AI visibility config for owned websites"
  ON website_ai_visibility_configs FOR DELETE
  USING (EXISTS (SELECT 1 FROM websites WHERE websites.id = website_ai_visibility_configs.website_id AND websites.user_id = auth.uid()));


-- 2. Monitoring Execution Runs Table
CREATE TABLE IF NOT EXISTS ai_visibility_monitoring_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'completed', -- 'running', 'completed', 'failed'
  total_probes INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  brand_mention_count INTEGER NOT NULL DEFAULT 0,
  brand_mention_rate INTEGER NOT NULL DEFAULT 0,
  citation_count INTEGER NOT NULL DEFAULT 0,
  unique_domains_count INTEGER NOT NULL DEFAULT 0,
  delta_mention_rate INTEGER DEFAULT 0,
  delta_citation_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_visibility_monitoring_runs_website_created ON ai_visibility_monitoring_runs(website_id, created_at DESC);

ALTER TABLE ai_visibility_monitoring_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view monitoring runs for owned websites"
  ON ai_visibility_monitoring_runs FOR SELECT
  USING (EXISTS (SELECT 1 FROM websites WHERE websites.id = ai_visibility_monitoring_runs.website_id AND websites.user_id = auth.uid()));

CREATE POLICY "Users can insert monitoring runs for owned websites"
  ON ai_visibility_monitoring_runs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM websites WHERE websites.id = ai_visibility_monitoring_runs.website_id AND websites.user_id = auth.uid()));


-- 3. Monitoring Alerts Table
CREATE TABLE IF NOT EXISTS ai_visibility_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL, -- 'mention_rate_drop', 'provider_failure', 'citation_drop'
  severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'info', 'medium', 'high', 'critical'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_visibility_alerts_website_created ON ai_visibility_alerts(website_id, created_at DESC);

ALTER TABLE ai_visibility_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view AI visibility alerts for owned websites"
  ON ai_visibility_alerts FOR SELECT
  USING (EXISTS (SELECT 1 FROM websites WHERE websites.id = ai_visibility_alerts.website_id AND websites.user_id = auth.uid()));

CREATE POLICY "Users can insert AI visibility alerts for owned websites"
  ON ai_visibility_alerts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM websites WHERE websites.id = ai_visibility_alerts.website_id AND websites.user_id = auth.uid()));

CREATE POLICY "Users can update AI visibility alerts for owned websites"
  ON ai_visibility_alerts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM websites WHERE websites.id = ai_visibility_alerts.website_id AND websites.user_id = auth.uid()));
