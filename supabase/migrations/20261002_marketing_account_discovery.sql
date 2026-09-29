-- Migration: 20261002_marketing_account_discovery.sql
-- Description: Meta asset discovery & selection tables for Ad Accounts, Facebook Pages, and Instagram Professional Accounts

-- 1. Meta Ad Accounts Table
CREATE TABLE IF NOT EXISTS public.marketing_ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'meta',
  meta_ad_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  account_status INTEGER DEFAULT 1,
  currency TEXT DEFAULT 'USD',
  timezone TEXT DEFAULT 'UTC',
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT marketing_ad_accounts_uniq UNIQUE(website_id, meta_ad_account_id)
);

ALTER TABLE public.marketing_ad_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own marketing_ad_accounts" ON public.marketing_ad_accounts;
CREATE POLICY "Users can view own marketing_ad_accounts" ON public.marketing_ad_accounts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own marketing_ad_accounts" ON public.marketing_ad_accounts;
CREATE POLICY "Users can insert own marketing_ad_accounts" ON public.marketing_ad_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own marketing_ad_accounts" ON public.marketing_ad_accounts;
CREATE POLICY "Users can update own marketing_ad_accounts" ON public.marketing_ad_accounts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own marketing_ad_accounts" ON public.marketing_ad_accounts;
CREATE POLICY "Users can delete own marketing_ad_accounts" ON public.marketing_ad_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_marketing_ad_accounts_website ON public.marketing_ad_accounts(website_id);
CREATE INDEX IF NOT EXISTS idx_marketing_ad_accounts_user ON public.marketing_ad_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_ad_accounts_selected ON public.marketing_ad_accounts(website_id, is_selected);


-- 2. Facebook Pages Table
CREATE TABLE IF NOT EXISTS public.marketing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'meta',
  meta_page_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Business',
  access_status TEXT DEFAULT 'active',
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT marketing_pages_uniq UNIQUE(website_id, meta_page_id)
);

ALTER TABLE public.marketing_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own marketing_pages" ON public.marketing_pages;
CREATE POLICY "Users can view own marketing_pages" ON public.marketing_pages FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own marketing_pages" ON public.marketing_pages;
CREATE POLICY "Users can insert own marketing_pages" ON public.marketing_pages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own marketing_pages" ON public.marketing_pages;
CREATE POLICY "Users can update own marketing_pages" ON public.marketing_pages FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own marketing_pages" ON public.marketing_pages;
CREATE POLICY "Users can delete own marketing_pages" ON public.marketing_pages FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_marketing_pages_website ON public.marketing_pages(website_id);
CREATE INDEX IF NOT EXISTS idx_marketing_pages_user ON public.marketing_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_pages_selected ON public.marketing_pages(website_id, is_selected);


-- 3. Instagram Professional Accounts Table
CREATE TABLE IF NOT EXISTS public.marketing_instagram_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'meta',
  instagram_account_id TEXT NOT NULL,
  username TEXT NOT NULL,
  name TEXT,
  facebook_page_id TEXT,
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT marketing_instagram_accounts_uniq UNIQUE(website_id, instagram_account_id)
);

ALTER TABLE public.marketing_instagram_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own marketing_instagram_accounts" ON public.marketing_instagram_accounts;
CREATE POLICY "Users can view own marketing_instagram_accounts" ON public.marketing_instagram_accounts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own marketing_instagram_accounts" ON public.marketing_instagram_accounts;
CREATE POLICY "Users can insert own marketing_instagram_accounts" ON public.marketing_instagram_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own marketing_instagram_accounts" ON public.marketing_instagram_accounts;
CREATE POLICY "Users can update own marketing_instagram_accounts" ON public.marketing_instagram_accounts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own marketing_instagram_accounts" ON public.marketing_instagram_accounts;
CREATE POLICY "Users can delete own marketing_instagram_accounts" ON public.marketing_instagram_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_marketing_ig_website ON public.marketing_instagram_accounts(website_id);
CREATE INDEX IF NOT EXISTS idx_marketing_ig_user ON public.marketing_instagram_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_ig_selected ON public.marketing_instagram_accounts(website_id, is_selected);
