-- Migration: 20261003_marketing_campaign_drafts.sql
-- Description: Table for storing AI Marketing Agent draft campaign strategies & creative plans (Phase 3)

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
