-- =====================================================================
-- SEO PHASE 10 MIGRATION: GENERIC THIRD-PARTY SEO INTEGRATION FRAMEWORK
-- Tables: public.website_third_party_seo_integrations, public.seo_integration_requests
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. THIRD-PARTY SEO INTEGRATIONS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_third_party_seo_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected',
  credential_type TEXT NOT NULL DEFAULT 'api_key',
  encrypted_credentials TEXT NOT NULL,
  masked_credential TEXT,
  provider_account_id TEXT,
  provider_account_name TEXT,
  provider_project_id TEXT,
  provider_project_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  last_tested_at TIMESTAMPTZ DEFAULT NOW(),
  last_successful_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT website_provider_uniq UNIQUE (website_id, provider),
  CONSTRAINT chk_status CHECK (status IN ('connected', 'error', 'reauth_required'))
);

ALTER TABLE public.website_third_party_seo_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own website_third_party_seo_integrations" ON public.website_third_party_seo_integrations;
CREATE POLICY "Users can view own website_third_party_seo_integrations" ON public.website_third_party_seo_integrations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_third_party_seo_integrations.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert own website_third_party_seo_integrations" ON public.website_third_party_seo_integrations;
CREATE POLICY "Users can insert own website_third_party_seo_integrations" ON public.website_third_party_seo_integrations FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_third_party_seo_integrations.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own website_third_party_seo_integrations" ON public.website_third_party_seo_integrations;
CREATE POLICY "Users can update own website_third_party_seo_integrations" ON public.website_third_party_seo_integrations FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_third_party_seo_integrations.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete own website_third_party_seo_integrations" ON public.website_third_party_seo_integrations;
CREATE POLICY "Users can delete own website_third_party_seo_integrations" ON public.website_third_party_seo_integrations FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_third_party_seo_integrations.website_id
    AND public.websites.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_third_party_seo_website ON public.website_third_party_seo_integrations(website_id, provider);
CREATE INDEX IF NOT EXISTS idx_third_party_seo_user ON public.website_third_party_seo_integrations(user_id);

-- ---------------------------------------------------------------------
-- 2. SEO INTEGRATION REQUESTS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seo_integration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  website_id UUID REFERENCES public.websites(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  tool_website TEXT,
  api_docs_url TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.seo_integration_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own seo_integration_requests" ON public.seo_integration_requests;
CREATE POLICY "Users can view own seo_integration_requests" ON public.seo_integration_requests FOR SELECT USING (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "Users can insert own seo_integration_requests" ON public.seo_integration_requests;
CREATE POLICY "Users can insert own seo_integration_requests" ON public.seo_integration_requests FOR INSERT WITH CHECK (
  auth.uid() = user_id
);

CREATE INDEX IF NOT EXISTS idx_integration_requests_user ON public.seo_integration_requests(user_id);
