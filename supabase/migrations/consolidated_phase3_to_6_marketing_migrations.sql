-- ============================================================================
-- CODEAXYS META MARKETING AGENT - CONSOLIDATED MIGRATIONS (PHASES 3 TO 6)
-- Target Project: yumsturujjjgdxsrqgbm
-- Run this complete file in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/yumsturujjjgdxsrqgbm/sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Phase 3: marketing_campaign_drafts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_campaign_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review_ready', 'approved', 'archived')),
  strategy_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.marketing_campaign_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own marketing_campaign_drafts" ON public.marketing_campaign_drafts;
CREATE POLICY "Users can view own marketing_campaign_drafts" ON public.marketing_campaign_drafts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own marketing_campaign_drafts" ON public.marketing_campaign_drafts;
CREATE POLICY "Users can insert own marketing_campaign_drafts" ON public.marketing_campaign_drafts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own marketing_campaign_drafts" ON public.marketing_campaign_drafts;
CREATE POLICY "Users can update own marketing_campaign_drafts" ON public.marketing_campaign_drafts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own marketing_campaign_drafts" ON public.marketing_campaign_drafts;
CREATE POLICY "Users can delete own marketing_campaign_drafts" ON public.marketing_campaign_drafts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_marketing_campaign_drafts_website ON public.marketing_campaign_drafts(website_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_drafts_user ON public.marketing_campaign_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_drafts_status ON public.marketing_campaign_drafts(website_id, status);


-- ----------------------------------------------------------------------------
-- 2. Phase 4: marketing_campaign_executions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_campaign_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.marketing_campaign_drafts(id) ON DELETE CASCADE,
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('approval_pending', 'approved', 'publishing', 'published', 'publish_failed', 'rejected', 'cancelled')),
  idempotency_key TEXT UNIQUE NOT NULL,
  approval_snapshot JSONB NOT NULL,
  meta_campaign_id TEXT NULL,
  meta_adset_id TEXT NULL,
  meta_creative_id TEXT NULL,
  meta_ad_id TEXT NULL,
  publishing_step TEXT DEFAULT 'pending',
  execution_trace JSONB DEFAULT '[]'::jsonb,
  error_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.marketing_campaign_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own marketing_campaign_executions" ON public.marketing_campaign_executions;
CREATE POLICY "Users can view own marketing_campaign_executions" ON public.marketing_campaign_executions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own marketing_campaign_executions" ON public.marketing_campaign_executions;
CREATE POLICY "Users can insert own marketing_campaign_executions" ON public.marketing_campaign_executions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own marketing_campaign_executions" ON public.marketing_campaign_executions;
CREATE POLICY "Users can update own marketing_campaign_executions" ON public.marketing_campaign_executions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own marketing_campaign_executions" ON public.marketing_campaign_executions;
CREATE POLICY "Users can delete own marketing_campaign_executions" ON public.marketing_campaign_executions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_marketing_campaign_executions_draft ON public.marketing_campaign_executions(draft_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_executions_website ON public.marketing_campaign_executions(website_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_executions_user ON public.marketing_campaign_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_executions_status ON public.marketing_campaign_executions(status);


-- ----------------------------------------------------------------------------
-- 3. Phase 5: marketing_leads & marketing_webhook_events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('website', 'meta')),
  source_lead_id TEXT NULL,
  name TEXT NULL,
  email TEXT NULL,
  phone TEXT NULL,
  message TEXT NULL,
  campaign_id TEXT NULL,
  campaign_name TEXT NULL,
  adset_id TEXT NULL,
  adset_name TEXT NULL,
  ad_id TEXT NULL,
  ad_name TEXT NULL,
  landing_page TEXT NULL,
  form_id TEXT NULL,
  form_name TEXT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'follow_up', 'converted', 'lost')),
  notes TEXT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_contacted_at TIMESTAMPTZ NULL,
  converted_at TIMESTAMPTZ NULL,
  CONSTRAINT unique_source_lead UNIQUE (website_id, source, source_lead_id)
);

CREATE TABLE IF NOT EXISTS public.marketing_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  raw_payload JSONB NULL,
  status TEXT NOT NULL CHECK (status IN ('processed', 'failed', 'dropped')),
  error_message TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ NULL
);

ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own marketing_leads" ON public.marketing_leads;
CREATE POLICY "Users can view own marketing_leads" ON public.marketing_leads FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own marketing_leads" ON public.marketing_leads;
CREATE POLICY "Users can insert own marketing_leads" ON public.marketing_leads FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own marketing_leads" ON public.marketing_leads;
CREATE POLICY "Users can update own marketing_leads" ON public.marketing_leads FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own marketing_leads" ON public.marketing_leads;
CREATE POLICY "Users can delete own marketing_leads" ON public.marketing_leads FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_website ON public.marketing_leads(website_id);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_user ON public.marketing_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_source ON public.marketing_leads(source);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_status ON public.marketing_leads(status);
CREATE INDEX IF NOT EXISTS idx_marketing_webhook_events_provider ON public.marketing_webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_marketing_webhook_events_hash ON public.marketing_webhook_events(payload_hash);


-- ----------------------------------------------------------------------------
-- 4. Phase 6: Analytics, Optimization & Action Logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  execution_id UUID NULL REFERENCES public.marketing_campaign_executions(id) ON DELETE SET NULL,
  meta_campaign_id TEXT NOT NULL,
  meta_adset_id TEXT NULL,
  meta_ad_id TEXT NULL,
  granularity TEXT NOT NULL CHECK (granularity IN ('daily', 'summary')),
  date_start DATE NOT NULL,
  date_stop DATE NOT NULL,
  spend NUMERIC(12,2) DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  link_clicks BIGINT DEFAULT 0,
  ctr NUMERIC(6,4) DEFAULT 0,
  cpc NUMERIC(10,2) DEFAULT 0,
  cpm NUMERIC(10,2) DEFAULT 0,
  meta_leads INT DEFAULT 0,
  website_leads INT DEFAULT 0,
  total_leads INT DEFAULT 0,
  cost_per_lead NUMERIC(10,2) DEFAULT 0,
  raw_metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (website_id, meta_campaign_id, date_start, date_stop, granularity)
);

ALTER TABLE public.marketing_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own marketing_insights" ON public.marketing_insights;
CREATE POLICY "Users can view own marketing_insights" ON public.marketing_insights FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own marketing_insights" ON public.marketing_insights;
CREATE POLICY "Users can insert own marketing_insights" ON public.marketing_insights FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own marketing_insights" ON public.marketing_insights;
CREATE POLICY "Users can update own marketing_insights" ON public.marketing_insights FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own marketing_insights" ON public.marketing_insights;
CREATE POLICY "Users can delete own marketing_insights" ON public.marketing_insights FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_marketing_insights_website ON public.marketing_insights(website_id);
CREATE INDEX IF NOT EXISTS idx_marketing_insights_user ON public.marketing_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_insights_campaign ON public.marketing_insights(meta_campaign_id);

CREATE TABLE IF NOT EXISTS public.marketing_optimization_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  execution_id UUID NULL REFERENCES public.marketing_campaign_executions(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('pause_ad', 'pause_campaign', 'update_budget')),
  target_object_type TEXT NOT NULL CHECK (target_object_type IN ('campaign', 'adset', 'ad')),
  target_object_id TEXT NOT NULL,
  target_object_name TEXT NULL,
  current_value TEXT NULL,
  proposed_value TEXT NULL,
  reason TEXT NULL,
  impact_explanation TEXT NULL,
  risk_level TEXT DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  metric_snapshot JSONB DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'executing', 'executed', 'failed', 'invalidated', 'rejected')),
  approved_at TIMESTAMPTZ NULL,
  approved_by UUID NULL,
  invalidated_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.marketing_optimization_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own marketing_optimization_recommendations" ON public.marketing_optimization_recommendations;
CREATE POLICY "Users can view own marketing_optimization_recommendations" ON public.marketing_optimization_recommendations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own marketing_optimization_recommendations" ON public.marketing_optimization_recommendations;
CREATE POLICY "Users can insert own marketing_optimization_recommendations" ON public.marketing_optimization_recommendations FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own marketing_optimization_recommendations" ON public.marketing_optimization_recommendations;
CREATE POLICY "Users can update own marketing_optimization_recommendations" ON public.marketing_optimization_recommendations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own marketing_optimization_recommendations" ON public.marketing_optimization_recommendations;
CREATE POLICY "Users can delete own marketing_optimization_recommendations" ON public.marketing_optimization_recommendations FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_marketing_recommendations_website ON public.marketing_optimization_recommendations(website_id);
CREATE INDEX IF NOT EXISTS idx_marketing_recommendations_user ON public.marketing_optimization_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_recommendations_status ON public.marketing_optimization_recommendations(status);

CREATE TABLE IF NOT EXISTS public.marketing_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NULL REFERENCES public.marketing_optimization_recommendations(id) ON DELETE SET NULL,
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  meta_object_id TEXT NOT NULL,
  previous_value TEXT NULL,
  new_value TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('executed', 'failed', 'cancelled')),
  error_message TEXT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.marketing_action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own marketing_action_logs" ON public.marketing_action_logs;
CREATE POLICY "Users can view own marketing_action_logs" ON public.marketing_action_logs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own marketing_action_logs" ON public.marketing_action_logs;
CREATE POLICY "Users can insert own marketing_action_logs" ON public.marketing_action_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own marketing_action_logs" ON public.marketing_action_logs;
CREATE POLICY "Users can update own marketing_action_logs" ON public.marketing_action_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own marketing_action_logs" ON public.marketing_action_logs;
CREATE POLICY "Users can delete own marketing_action_logs" ON public.marketing_action_logs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_marketing_action_logs_website ON public.marketing_action_logs(website_id);
CREATE INDEX IF NOT EXISTS idx_marketing_action_logs_user ON public.marketing_action_logs(user_id);

-- Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
