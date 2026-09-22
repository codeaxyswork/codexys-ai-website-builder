-- =====================================================================
-- CODEAXYS AI WEBSITE BUILDER — GOOGLE ADS FOUNDATION MIGRATION
-- Migration: 20260922_google_ads_foundation.sql
-- Description: Server-only Google Ads OAuth credentials table & Keyword Cache table.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SERVER-ONLY GOOGLE ADS OAUTH CREDENTIALS TABLE (google_ads_oauth_credentials)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_ads_oauth_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL UNIQUE REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google_ads',
  encrypted_access_token TEXT,
  encrypted_refresh_token TEXT,
  token_expires_at BIGINT,
  scope TEXT,
  google_ads_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS with ZERO public/client policies (Server Service-Role access only)
ALTER TABLE public.google_ads_oauth_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access to google_ads_oauth_credentials" ON public.google_ads_oauth_credentials;

CREATE INDEX IF NOT EXISTS idx_google_ads_credentials_website_id ON public.google_ads_oauth_credentials(website_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_credentials_user_id ON public.google_ads_oauth_credentials(user_id);

-- ---------------------------------------------------------------------
-- 2. GOOGLE ADS KEYWORD CACHE TABLE (google_ads_keyword_cache)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_ads_keyword_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  seed_type TEXT NOT NULL DEFAULT 'keyword', -- 'keyword', 'url', 'keyword_url'
  seed_value TEXT NOT NULL DEFAULT '',
  keyword TEXT NOT NULL,
  avg_monthly_searches INTEGER DEFAULT 0,
  competition TEXT DEFAULT 'UNSPECIFIED', -- 'HIGH', 'MEDIUM', 'LOW', 'UNSPECIFIED'
  competition_index INTEGER DEFAULT 0, -- 0 to 100
  low_top_of_page_bid_micros BIGINT DEFAULT 0,
  high_top_of_page_bid_micros BIGINT DEFAULT 0,
  location_id TEXT DEFAULT '2840', -- Default US
  language_id TEXT DEFAULT '1000', -- Default English
  monthly_search_metrics JSONB DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'google_ads_api',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  CONSTRAINT google_ads_keyword_cache_uniq UNIQUE (website_id, customer_id, seed_type, seed_value, keyword)
);

ALTER TABLE public.google_ads_keyword_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own google_ads_keyword_cache" ON public.google_ads_keyword_cache;
CREATE POLICY "Users can view own google_ads_keyword_cache" ON public.google_ads_keyword_cache FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own google_ads_keyword_cache" ON public.google_ads_keyword_cache;
CREATE POLICY "Users can insert own google_ads_keyword_cache" ON public.google_ads_keyword_cache FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own google_ads_keyword_cache" ON public.google_ads_keyword_cache;
CREATE POLICY "Users can update own google_ads_keyword_cache" ON public.google_ads_keyword_cache FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own google_ads_keyword_cache" ON public.google_ads_keyword_cache;
CREATE POLICY "Users can delete own google_ads_keyword_cache" ON public.google_ads_keyword_cache FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_google_ads_keyword_cache_website ON public.google_ads_keyword_cache(website_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_keyword_cache_user ON public.google_ads_keyword_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_keyword_cache_lookup ON public.google_ads_keyword_cache(website_id, seed_type, seed_value);
