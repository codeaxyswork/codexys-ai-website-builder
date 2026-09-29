-- Migration: 20261005_marketing_leads.sql
-- Description: Unified Lead Inbox persistence and Meta Webhook event tracking tables (Phase 5)

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
