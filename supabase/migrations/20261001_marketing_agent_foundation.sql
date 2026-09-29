-- Migration: 20261001_marketing_agent_foundation.sql
-- Description: Server-only marketing_connections table for Meta OAuth token vault & lifecycle tracking

CREATE TABLE IF NOT EXISTS public.marketing_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'meta',
  status TEXT NOT NULL DEFAULT 'connected', -- 'connected', 'error', 'reauth_required', 'disconnected'
  meta_user_id TEXT,
  meta_user_name TEXT,
  meta_user_email TEXT,
  encrypted_access_token TEXT,
  encrypted_refresh_token TEXT,
  token_expires_at BIGINT,
  granted_scopes TEXT[] DEFAULT '{}'::text[],
  metadata JSONB DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT marketing_connections_website_provider_uniq UNIQUE(website_id, provider)
);

-- Enable RLS and add strict tenant isolation policies
ALTER TABLE public.marketing_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own marketing_connections" ON public.marketing_connections;
CREATE POLICY "Users can view own marketing_connections" ON public.marketing_connections FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own marketing_connections" ON public.marketing_connections;
CREATE POLICY "Users can insert own marketing_connections" ON public.marketing_connections FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own marketing_connections" ON public.marketing_connections;
CREATE POLICY "Users can update own marketing_connections" ON public.marketing_connections FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own marketing_connections" ON public.marketing_connections;
CREATE POLICY "Users can delete own marketing_connections" ON public.marketing_connections FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_marketing_connections_website_id ON public.marketing_connections(website_id);
CREATE INDEX IF NOT EXISTS idx_marketing_connections_user_id ON public.marketing_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_connections_provider ON public.marketing_connections(provider);
