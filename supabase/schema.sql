-- =====================================================================
-- COMPLETE SUPABASE DATABASE MIGRATION SCRIPT (PHASE 1, 2, 3, 4 & 5)
-- Execute this SQL code inside your Supabase SQL Editor
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROFILES TABLE & AUTH TRIGGER
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
  )
);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);


-- ---------------------------------------------------------------------
-- 1B. ADMIN AUDIT LOGS & PLATFORM SETTINGS TABLES (SaaS Phase 8)
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
CREATE POLICY "Admins can view audit logs" ON public.admin_audit_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
  )
);

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
  id TEXT PRIMARY KEY, -- 'free', 'pro', 'agency'
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
  ('free', 'Free', 50, 1, 104857600, false, false),        -- 100 MB
  ('pro', 'Pro', 500, 10, 5368709120, true, true),          -- 5 GB
  ('agency', 'Agency', 2000, 50, 21474836480, true, true)   -- 20 GB
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS billing_provider TEXT DEFAULT 'mock';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days');
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
CREATE POLICY "Users can update own subscription" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 3B. BILLING TRANSACTIONS TABLE (SaaS Phase 7)
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS published_slug TEXT UNIQUE;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS custom_domain TEXT;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS custom_domain_verified BOOLEAN DEFAULT false;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS custom_domain_status TEXT DEFAULT 'none';
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS custom_domain_verified_at TIMESTAMPTZ;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS domain_verification_token TEXT;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS www_domain_configured BOOLEAN DEFAULT false;

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
-- 9. WEBSITE SEO SETTINGS TABLE (SaaS Phase 5)
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
  google_search_console_verified BOOLEAN DEFAULT false,
  seo_score INTEGER DEFAULT 0,
  seo_analysis JSONB DEFAULT '{}'::jsonb,
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
-- 10. SEO ANALYSIS HISTORY TABLE (SaaS Phase 5)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seo_analysis_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seo_score INTEGER,
  analysis JSONB,
  recommendations JSONB,
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
-- 11. SEO INTEGRATIONS TABLE (SaaS Phase 5)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seo_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'google_analytics', 'google_tag_manager', 'google_search_console', 'semrush', 'ahrefs'
  status TEXT DEFAULT 'disconnected', -- 'disconnected', 'connected', 'error'
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
-- 12. SIGNUP TRIGGER & ATOMIC CREDIT DEDUCTION
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = p_user_id FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_credits THEN
    RETURN FALSE;
  END IF;

  UPDATE public.user_credits
  SET balance = balance - p_credits, monthly_used = monthly_used + p_credits, lifetime_used = lifetime_used + p_credits, updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO public.ai_credit_transactions (user_id, website_id, credits_used, action_type)
  VALUES (p_user_id, p_website_id, p_credits, p_action_type);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


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
