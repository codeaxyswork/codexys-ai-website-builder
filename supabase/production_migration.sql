-- =====================================================================
-- COMPLETE SUPABASE DATABASE MIGRATION SCRIPT
-- Target Project: https://yumsturujjjgdxsrqgbm.supabase.co
-- File: supabase/production_migration.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. ADMIN HELPER FUNCTION (Prevents RLS Infinite Recursion)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
  RETURN v_role IN ('admin', 'super_admin');
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ---------------------------------------------------------------------
-- 1. PROFILES TABLE & AUTH TRIGGER
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);


-- ---------------------------------------------------------------------
-- 1B. ADMIN AUDIT LOGS & PLATFORM SETTINGS TABLES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_user_id UUID,
  target_website_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.admin_audit_logs FOR SELECT USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.platform_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view platform settings" ON public.platform_settings;
CREATE POLICY "Anyone can view platform settings" ON public.platform_settings FOR SELECT USING (true);

INSERT INTO public.platform_settings (setting_key, setting_value)
VALUES 
  ('maintenance_mode', '{"enabled": false, "message": "We are currently performing scheduled maintenance. Please check back soon."}'::jsonb),
  ('registration_enabled', '{"enabled": true}'::jsonb),
  ('app_name', '{"name": "Codexys AI Website Builder"}'::jsonb),
  ('support_email', '{"email": "support@codexys.site"}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;


-- ---------------------------------------------------------------------
-- 2. PLANS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_ai_credits INTEGER NOT NULL,
  max_websites INTEGER NOT NULL,
  storage_limit_bytes BIGINT NOT NULL,
  allow_custom_domain BOOLEAN DEFAULT FALSE,
  allow_advanced_seo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view plans" ON public.plans;
CREATE POLICY "Anyone can view plans" ON public.plans FOR SELECT USING (true);

INSERT INTO public.plans (id, name, monthly_ai_credits, max_websites, storage_limit_bytes, allow_custom_domain, allow_advanced_seo)
VALUES 
  ('free', 'Free', 50, 1, 104857600, false, false),
  ('pro', 'Pro', 500, 10, 5368709120, true, true),
  ('agency', 'Agency', 2000, 50, 21474836480, true, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_ai_credits = EXCLUDED.monthly_ai_credits,
  max_websites = EXCLUDED.max_websites,
  storage_limit_bytes = EXCLUDED.storage_limit_bytes,
  allow_custom_domain = EXCLUDED.allow_custom_domain,
  allow_advanced_seo = EXCLUDED.allow_advanced_seo;


-- ---------------------------------------------------------------------
-- 3. SUBSCRIPTIONS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.plans(id) DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  billing_provider TEXT DEFAULT 'mock',
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
CREATE POLICY "Users can update own subscription" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 3B. BILLING TRANSACTIONS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'mock',
  provider_payment_id TEXT,
  transaction_type TEXT NOT NULL,
  plan_id TEXT REFERENCES public.plans(id),
  amount INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'completed',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own billing transactions" ON public.billing_transactions;
CREATE POLICY "Users can view own billing transactions" ON public.billing_transactions FOR SELECT USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 4. USER CREDITS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 50,
  lifetime_used INTEGER NOT NULL DEFAULT 0,
  monthly_used INTEGER NOT NULL DEFAULT 0,
  last_refreshed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;
CREATE POLICY "Users can view own credits" ON public.user_credits FOR SELECT USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 5. AI CREDIT TRANSACTIONS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  website_id UUID,
  credits_used INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credit transactions" ON public.ai_credit_transactions;
CREATE POLICY "Users can view own credit transactions" ON public.ai_credit_transactions FOR SELECT USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 6. WEBSITES TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  prompt TEXT,
  design_plan JSONB,
  is_published BOOLEAN DEFAULT false,
  published_slug TEXT UNIQUE,
  published_at TIMESTAMPTZ,
  custom_domain TEXT,
  custom_domain_verified BOOLEAN DEFAULT false,
  custom_domain_status TEXT DEFAULT 'none',
  custom_domain_verified_at TIMESTAMPTZ,
  domain_verification_token TEXT,
  www_domain_configured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own websites" ON public.websites;
CREATE POLICY "Users can view own websites" ON public.websites FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view published websites" ON public.websites;
CREATE POLICY "Anyone can view published websites" ON public.websites FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "Users can insert own websites" ON public.websites;
CREATE POLICY "Users can insert own websites" ON public.websites FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own websites" ON public.websites;
CREATE POLICY "Users can update own websites" ON public.websites FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own websites" ON public.websites;
CREATE POLICY "Users can delete own websites" ON public.websites FOR DELETE USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 7. WEBSITE PAGES TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path TEXT NOT NULL DEFAULT 'index.html',
  html_content TEXT,
  css_content TEXT,
  js_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own website_pages" ON public.website_pages;
CREATE POLICY "Users can view own website_pages" ON public.website_pages FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view published website_pages" ON public.website_pages;
CREATE POLICY "Anyone can view published website_pages" ON public.website_pages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_pages.website_id
    AND public.websites.is_published = true
  )
);

DROP POLICY IF EXISTS "Users can insert own website_pages" ON public.website_pages;
CREATE POLICY "Users can insert own website_pages" ON public.website_pages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own website_pages" ON public.website_pages;
CREATE POLICY "Users can update own website_pages" ON public.website_pages FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own website_pages" ON public.website_pages;
CREATE POLICY "Users can delete own website_pages" ON public.website_pages FOR DELETE USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 8. MEDIA ASSETS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own media_assets" ON public.media_assets;
CREATE POLICY "Users can view own media_assets" ON public.media_assets FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own media_assets" ON public.media_assets;
CREATE POLICY "Users can insert own media_assets" ON public.media_assets FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own media_assets" ON public.media_assets;
CREATE POLICY "Users can delete own media_assets" ON public.media_assets FOR DELETE USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 9. WEBSITE SEO SETTINGS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_seo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL UNIQUE REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seo_title TEXT,
  meta_description TEXT,
  focus_keywords TEXT[] DEFAULT '{}'::text[],
  canonical_url TEXT,
  robots_index BOOLEAN DEFAULT true,
  robots_follow BOOLEAN DEFAULT true,
  og_title TEXT,
  og_description TEXT,
  og_image_url TEXT,
  twitter_card TEXT DEFAULT 'summary_large_image',
  twitter_title TEXT,
  twitter_description TEXT,
  twitter_image_url TEXT,
  schema_markup JSONB DEFAULT '{}'::jsonb,
  google_analytics_id TEXT,
  google_tag_manager_id TEXT,
  google_site_verification_token TEXT,
  google_search_console_verified BOOLEAN DEFAULT false,
  seo_score INTEGER DEFAULT 0,
  seo_analysis JSONB DEFAULT '{}'::jsonb,
  is_dirty BOOLEAN DEFAULT false,
  analysis_status TEXT DEFAULT 'completed',
  critical_issues_count INTEGER DEFAULT 0,
  warnings_count INTEGER DEFAULT 0,
  opportunities_count INTEGER DEFAULT 0,
  passed_checks_count INTEGER DEFAULT 0,
  last_analyzed_at TIMESTAMPTZ,
  analysis_version TEXT DEFAULT 'seo-v1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.website_seo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own website_seo" ON public.website_seo;
CREATE POLICY "Users can view own website_seo" ON public.website_seo FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view published website_seo" ON public.website_seo;
CREATE POLICY "Anyone can view published website_seo" ON public.website_seo FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_seo.website_id
    AND public.websites.is_published = true
  )
);

DROP POLICY IF EXISTS "Users can insert own website_seo" ON public.website_seo;
CREATE POLICY "Users can insert own website_seo" ON public.website_seo FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own website_seo" ON public.website_seo;
CREATE POLICY "Users can update own website_seo" ON public.website_seo FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own website_seo" ON public.website_seo;
CREATE POLICY "Users can delete own website_seo" ON public.website_seo FOR DELETE USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 9B. PAGE-LEVEL SEO STATE TABLE (website_page_seo)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_page_seo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  page_id UUID NOT NULL UNIQUE REFERENCES public.website_pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path TEXT NOT NULL DEFAULT 'index.html',
  seo_title TEXT,
  meta_description TEXT,
  focus_keywords TEXT[] DEFAULT '{}'::text[],
  canonical_url TEXT,
  robots_index BOOLEAN DEFAULT true,
  robots_follow BOOLEAN DEFAULT true,
  og_title TEXT,
  og_description TEXT,
  og_image_url TEXT,
  twitter_card TEXT DEFAULT 'summary_large_image',
  twitter_title TEXT,
  twitter_description TEXT,
  twitter_image_url TEXT,
  schema_markup JSONB DEFAULT '{}'::jsonb,
  seo_score INTEGER DEFAULT 0,
  seo_analysis JSONB DEFAULT '{}'::jsonb,
  analysis_status TEXT DEFAULT 'pending',
  last_analyzed_at TIMESTAMPTZ,
  content_fingerprint TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.website_page_seo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own website_page_seo" ON public.website_page_seo;
CREATE POLICY "Users can view own website_page_seo" ON public.website_page_seo FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view published website_page_seo" ON public.website_page_seo;
CREATE POLICY "Anyone can view published website_page_seo" ON public.website_page_seo FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_page_seo.website_id
    AND public.websites.is_published = true
  )
);

DROP POLICY IF EXISTS "Users can insert own website_page_seo" ON public.website_page_seo;
CREATE POLICY "Users can insert own website_page_seo" ON public.website_page_seo FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own website_page_seo" ON public.website_page_seo;
CREATE POLICY "Users can update own website_page_seo" ON public.website_page_seo FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own website_page_seo" ON public.website_page_seo;
CREATE POLICY "Users can delete own website_page_seo" ON public.website_page_seo FOR DELETE USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 10. SEO ANALYSIS HISTORY TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seo_analysis_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seo_score INTEGER,
  analysis JSONB,
  recommendations JSONB,
  trigger_type TEXT DEFAULT 'manual',
  analysis_version TEXT DEFAULT 'seo-v1',
  critical_issues_count INTEGER DEFAULT 0,
  warnings_count INTEGER DEFAULT 0,
  opportunities_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.seo_analysis_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own seo_analysis_history" ON public.seo_analysis_history;
CREATE POLICY "Users can view own seo_analysis_history" ON public.seo_analysis_history FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own seo_analysis_history" ON public.seo_analysis_history;
CREATE POLICY "Users can insert own seo_analysis_history" ON public.seo_analysis_history FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own seo_analysis_history" ON public.seo_analysis_history;
CREATE POLICY "Users can delete own seo_analysis_history" ON public.seo_analysis_history FOR DELETE USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 10B. BACKGROUND SEO ANALYSIS JOBS TABLE (seo_analysis_jobs)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seo_analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.website_pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'queued',
  priority INTEGER DEFAULT 0,
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  available_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_code TEXT,
  error_message_safe TEXT,
  idempotency_key TEXT UNIQUE,
  analysis_version TEXT DEFAULT 'seo-v1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.seo_analysis_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own seo_analysis_jobs" ON public.seo_analysis_jobs;
CREATE POLICY "Users can view own seo_analysis_jobs" ON public.seo_analysis_jobs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own seo_analysis_jobs" ON public.seo_analysis_jobs;
CREATE POLICY "Users can insert own seo_analysis_jobs" ON public.seo_analysis_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own seo_analysis_jobs" ON public.seo_analysis_jobs;
CREATE POLICY "Users can update own seo_analysis_jobs" ON public.seo_analysis_jobs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own seo_analysis_jobs" ON public.seo_analysis_jobs;
CREATE POLICY "Users can delete own seo_analysis_jobs" ON public.seo_analysis_jobs FOR DELETE USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 11. SEO INTEGRATIONS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seo_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT DEFAULT 'disconnected',
  configuration JSONB DEFAULT '{}'::jsonb,
  connected_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(website_id, provider)
);

ALTER TABLE public.seo_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own seo_integrations" ON public.seo_integrations;
CREATE POLICY "Users can view own seo_integrations" ON public.seo_integrations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own seo_integrations" ON public.seo_integrations;
CREATE POLICY "Users can insert own seo_integrations" ON public.seo_integrations FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own seo_integrations" ON public.seo_integrations;
CREATE POLICY "Users can update own seo_integrations" ON public.seo_integrations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own seo_integrations" ON public.seo_integrations;
CREATE POLICY "Users can delete own seo_integrations" ON public.seo_integrations FOR DELETE USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 11B. SERVER-ONLY GSC OAUTH CREDENTIALS TABLE (gsc_oauth_credentials)
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

CREATE INDEX IF NOT EXISTS idx_gsc_credentials_website_id ON public.gsc_oauth_credentials(website_id);
CREATE INDEX IF NOT EXISTS idx_gsc_credentials_user_id ON public.gsc_oauth_credentials(user_id);


-- ---------------------------------------------------------------------
-- 11C. SEARCH ANALYTICS CACHE TABLE (gsc_search_analytics)
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




-- ---------------------------------------------------------------------
-- 12. SIGNUP TRIGGER & ATOMIC CREDIT DEDUCTION RPC
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();

  INSERT INTO public.subscriptions (user_id, plan_id, status, created_at, updated_at)
  VALUES (NEW.id, 'free', 'active', NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_credits (user_id, balance, lifetime_used, monthly_used, last_refreshed_at, created_at, updated_at)
  VALUES (NEW.id, 50, 0, 0, NOW(), NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


CREATE OR REPLACE FUNCTION public.deduct_user_credits(
  p_user_id UUID,
  p_credits INT,
  p_action_type TEXT,
  p_website_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_balance INT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized credit deduction attempt';
  END IF;

  IF p_credits IS NULL OR p_credits <= 0 THEN
    RETURN FALSE;
  END IF;

  SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = p_user_id FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_credits THEN
    RETURN FALSE;
  END IF;

  UPDATE public.user_credits
  SET balance = balance - p_credits,
      monthly_used = monthly_used + p_credits,
      lifetime_used = lifetime_used + p_credits,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO public.ai_credit_transactions (user_id, website_id, credits_used, action_type)
  VALUES (p_user_id, p_website_id, p_credits, p_action_type);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.deduct_user_credits(UUID, INT, TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.deduct_user_credits(UUID, INT, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.deduct_user_credits(UUID, INT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_user_credits(UUID, INT, TEXT, UUID) TO service_role;


-- ---------------------------------------------------------------------
-- 13. INDEXES FOR PERFORMANCE
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_websites_user_id ON public.websites(user_id);
CREATE INDEX IF NOT EXISTS idx_websites_published_slug ON public.websites(published_slug);
CREATE INDEX IF NOT EXISTS idx_websites_custom_domain ON public.websites(custom_domain);
CREATE INDEX IF NOT EXISTS idx_website_pages_website_id ON public.website_pages(website_id);
CREATE INDEX IF NOT EXISTS idx_website_pages_user_id ON public.website_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_trans_user_id ON public.ai_credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_user_id ON public.media_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_website_seo_website_id ON public.website_seo(website_id);
CREATE INDEX IF NOT EXISTS idx_website_seo_user_id ON public.website_seo(user_id);
CREATE INDEX IF NOT EXISTS idx_seo_history_website_id ON public.seo_analysis_history(website_id);
CREATE INDEX IF NOT EXISTS idx_seo_integrations_website_id ON public.seo_integrations(website_id);


-- ---------------------------------------------------------------------
-- 14. BLOG POSTS TABLE (Content Engine)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  featured_image TEXT,
  author TEXT DEFAULT 'Admin',
  category TEXT DEFAULT 'General',
  tags TEXT[] DEFAULT '{}'::text[],
  seo_title TEXT,
  meta_description TEXT,
  focus_keyword TEXT,
  canonical_url TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  robots_config TEXT DEFAULT 'index, follow',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT blog_posts_website_slug_uniq UNIQUE (website_id, slug)
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own blog_posts" ON public.blog_posts;
CREATE POLICY "Users can view own blog_posts" ON public.blog_posts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view published blog_posts" ON public.blog_posts;
CREATE POLICY "Anyone can view published blog_posts" ON public.blog_posts FOR SELECT USING (
  status = 'published' AND EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.blog_posts.website_id
    AND public.websites.is_published = true
  )
);

DROP POLICY IF EXISTS "Users can insert own blog_posts" ON public.blog_posts;
CREATE POLICY "Users can insert own blog_posts" ON public.blog_posts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own blog_posts" ON public.blog_posts;
CREATE POLICY "Users can update own blog_posts" ON public.blog_posts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own blog_posts" ON public.blog_posts;
CREATE POLICY "Users can delete own blog_posts" ON public.blog_posts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_blog_posts_website_id ON public.blog_posts(website_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_user_id ON public.blog_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON public.blog_posts(status);


-- ---------------------------------------------------------------------
-- 15. INTERNAL LINKING ENGINE TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_internal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  internal_link_score INTEGER DEFAULT 0,
  summary JSONB DEFAULT '{}'::jsonb,
  link_graph JSONB DEFAULT '{}'::jsonb,
  opportunities JSONB DEFAULT '[]'::jsonb,
  last_analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT website_internal_links_website_uniq UNIQUE (website_id)
);

ALTER TABLE public.website_internal_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own website_internal_links" ON public.website_internal_links;
CREATE POLICY "Users can view own website_internal_links" ON public.website_internal_links FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_internal_links.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert own website_internal_links" ON public.website_internal_links;
CREATE POLICY "Users can insert own website_internal_links" ON public.website_internal_links FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_internal_links.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own website_internal_links" ON public.website_internal_links;
CREATE POLICY "Users can update own website_internal_links" ON public.website_internal_links FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_internal_links.website_id
    AND public.websites.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_internal_links.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete own website_internal_links" ON public.website_internal_links;
CREATE POLICY "Users can delete own website_internal_links" ON public.website_internal_links FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_internal_links.website_id
    AND public.websites.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_website_internal_links_website ON public.website_internal_links(website_id);


-- ---------------------------------------------------------------------
-- 16. LOCAL SEO ENGINE TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_local_seo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  business_name TEXT,
  business_type TEXT DEFAULT 'LocalBusiness',
  primary_category TEXT,
  additional_categories TEXT[] DEFAULT '{}'::text[],
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state_region TEXT,
  postal_code TEXT,
  country TEXT,
  phone TEXT,
  website_url TEXT,
  business_description TEXT,
  service_area TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  opening_hours JSONB DEFAULT '[]'::jsonb,
  price_range TEXT,
  logo_url TEXT,
  image_url TEXT,
  social_profiles TEXT[] DEFAULT '{}'::text[],
  contact_url TEXT,
  appointment_url TEXT,
  gbp_profile_url TEXT,
  local_seo_score INTEGER DEFAULT 0,
  analysis_result JSONB DEFAULT '{}'::jsonb,
  last_analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT website_local_seo_website_uniq UNIQUE (website_id)
);

ALTER TABLE public.website_local_seo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own website_local_seo" ON public.website_local_seo;
CREATE POLICY "Users can view own website_local_seo" ON public.website_local_seo FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_local_seo.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert own website_local_seo" ON public.website_local_seo;
CREATE POLICY "Users can insert own website_local_seo" ON public.website_local_seo FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_local_seo.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own website_local_seo" ON public.website_local_seo;
CREATE POLICY "Users can update own website_local_seo" ON public.website_local_seo FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_local_seo.website_id
    AND public.websites.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_local_seo.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete own website_local_seo" ON public.website_local_seo;
CREATE POLICY "Users can delete own website_local_seo" ON public.website_local_seo FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_local_seo.website_id
    AND public.websites.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_website_local_seo_website ON public.website_local_seo(website_id);

-- ---------------------------------------------------------------------
-- 17. SEO PHASE 9: MONITORING & SCHEDULED SEO JOBS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_monitoring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  preferred_hour INTEGER DEFAULT 3,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ DEFAULT NOW(),
  last_successful_run_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_frequency CHECK (frequency IN ('manual', 'daily', 'weekly', 'monthly'))
);

ALTER TABLE public.website_monitoring_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own website_monitoring_schedules" ON public.website_monitoring_schedules;
CREATE POLICY "Users can view own website_monitoring_schedules" ON public.website_monitoring_schedules FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_monitoring_schedules.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert own website_monitoring_schedules" ON public.website_monitoring_schedules;
CREATE POLICY "Users can insert own website_monitoring_schedules" ON public.website_monitoring_schedules FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_monitoring_schedules.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own website_monitoring_schedules" ON public.website_monitoring_schedules;
CREATE POLICY "Users can update own website_monitoring_schedules" ON public.website_monitoring_schedules FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_monitoring_schedules.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete own website_monitoring_schedules" ON public.website_monitoring_schedules;
CREATE POLICY "Users can delete own website_monitoring_schedules" ON public.website_monitoring_schedules FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_monitoring_schedules.website_id
    AND public.websites.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_monitoring_schedules_next_run ON public.website_monitoring_schedules(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_schedules_website ON public.website_monitoring_schedules(website_id);

CREATE TABLE IF NOT EXISTS public.seo_monitoring_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  previous_value TEXT,
  current_value TEXT,
  affected_page TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_severity CHECK (severity IN ('critical', 'warning', 'info'))
);

ALTER TABLE public.seo_monitoring_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own seo_monitoring_events" ON public.seo_monitoring_events;
CREATE POLICY "Users can view own seo_monitoring_events" ON public.seo_monitoring_events FOR SELECT USING (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "Users can insert own seo_monitoring_events" ON public.seo_monitoring_events;
CREATE POLICY "Users can insert own seo_monitoring_events" ON public.seo_monitoring_events FOR INSERT WITH CHECK (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "Users can update own seo_monitoring_events" ON public.seo_monitoring_events;
CREATE POLICY "Users can update own seo_monitoring_events" ON public.seo_monitoring_events FOR UPDATE USING (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "Users can delete own seo_monitoring_events" ON public.seo_monitoring_events;
CREATE POLICY "Users can delete own seo_monitoring_events" ON public.seo_monitoring_events FOR DELETE USING (
  auth.uid() = user_id
);

CREATE INDEX IF NOT EXISTS idx_monitoring_events_website ON public.seo_monitoring_events(website_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_events_unread ON public.seo_monitoring_events(user_id, is_read);




