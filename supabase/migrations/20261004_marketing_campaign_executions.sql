-- Migration: 20261004_marketing_campaign_executions.sql
-- Description: Table for managing AI Marketing Agent campaign approval snapshots, publishing state machine, and Meta Graph API execution tracking (Phase 4)

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
