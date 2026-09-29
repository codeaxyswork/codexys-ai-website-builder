-- Migration: 20261006_marketing_analytics_optimization.sql
-- Description: Phase 6 Tables for Marketing Agent Campaign Analytics, Performance Snapshots, AI Optimization Recommendations, and Audit Action Logs

-- 1. marketing_insights
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

-- 2. marketing_optimization_recommendations
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

-- 3. marketing_action_logs
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
