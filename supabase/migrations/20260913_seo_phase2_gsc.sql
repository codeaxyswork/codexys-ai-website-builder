-- =====================================================================
-- CODEAXYS AI WEBSITE BUILDER — SEO PHASE 2 MIGRATION
-- Migration: 20260913_seo_phase2_gsc.sql
-- Description: Server-only GSC OAuth credentials table & Search Analytics performance cache.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SERVER-ONLY GSC OAUTH CREDENTIALS TABLE (gsc_oauth_credentials)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsc_oauth_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL UNIQUE REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google_search_console',
  encrypted_access_token TEXT,
  encrypted_refresh_token TEXT,
  token_expires_at BIGINT,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS with ZERO public/client policies (Server Service-Role access only)
ALTER TABLE public.gsc_oauth_credentials ENABLE ROW LEVEL SECURITY;

-- Explicitly drop any legacy policies if re-run
DROP POLICY IF EXISTS "No client access to gsc_oauth_credentials" ON public.gsc_oauth_credentials;

CREATE INDEX IF NOT EXISTS idx_gsc_credentials_website_id ON public.gsc_oauth_credentials(website_id);
CREATE INDEX IF NOT EXISTS idx_gsc_credentials_user_id ON public.gsc_oauth_credentials(user_id);

-- ---------------------------------------------------------------------
-- 2. SEARCH ANALYTICS CACHE TABLE (gsc_search_analytics)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsc_search_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gsc_property TEXT NOT NULL,
  date DATE NOT NULL,
  dimension_type TEXT NOT NULL CHECK (dimension_type IN ('overall', 'query', 'page', 'device', 'country')),
  dimension_value TEXT NOT NULL DEFAULT '',
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  ctr NUMERIC(7,4) NOT NULL DEFAULT 0.0000,
  position NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT gsc_analytics_uniq UNIQUE (website_id, gsc_property, date, dimension_type, dimension_value)
);

ALTER TABLE public.gsc_search_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own gsc_search_analytics" ON public.gsc_search_analytics;
CREATE POLICY "Users can view own gsc_search_analytics" ON public.gsc_search_analytics FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own gsc_search_analytics" ON public.gsc_search_analytics;
CREATE POLICY "Users can insert own gsc_search_analytics" ON public.gsc_search_analytics FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own gsc_search_analytics" ON public.gsc_search_analytics;
CREATE POLICY "Users can update own gsc_search_analytics" ON public.gsc_search_analytics FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own gsc_search_analytics" ON public.gsc_search_analytics;
CREATE POLICY "Users can delete own gsc_search_analytics" ON public.gsc_search_analytics FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gsc_analytics_website_id ON public.gsc_search_analytics(website_id);
CREATE INDEX IF NOT EXISTS idx_gsc_analytics_user_id ON public.gsc_search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_gsc_analytics_lookup ON public.gsc_search_analytics(website_id, dimension_type, date);
