-- =====================================================================
-- CODEAXYS AI WEBSITE BUILDER — SEO PHASE 1 MIGRATION
-- Migration: 20260913_seo_phase1.sql
-- Description: Multi-page SEO state, background jobs table, and site-level aggregate fields.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PAGE-LEVEL SEO STATE TABLE (website_page_seo)
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

CREATE INDEX IF NOT EXISTS idx_page_seo_website_id ON public.website_page_seo(website_id);
CREATE INDEX IF NOT EXISTS idx_page_seo_page_id ON public.website_page_seo(page_id);
CREATE INDEX IF NOT EXISTS idx_page_seo_user_id ON public.website_page_seo(user_id);

-- ---------------------------------------------------------------------
-- 2. EXTEND website_seo TABLE WITH SITE-LEVEL AGGREGATE & DIRTY STATE
-- ---------------------------------------------------------------------
ALTER TABLE public.website_seo
  ADD COLUMN IF NOT EXISTS is_dirty BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS analysis_status TEXT DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS critical_issues_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warnings_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opportunities_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passed_checks_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_analyzed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS analysis_version TEXT DEFAULT 'seo-v1';

-- ---------------------------------------------------------------------
-- 3. BACKGROUND SEO ANALYSIS JOBS TABLE (seo_analysis_jobs)
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

CREATE INDEX IF NOT EXISTS idx_seo_jobs_website_id ON public.seo_analysis_jobs(website_id);
CREATE INDEX IF NOT EXISTS idx_seo_jobs_user_id ON public.seo_analysis_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_seo_jobs_status ON public.seo_analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_seo_jobs_idempotency ON public.seo_analysis_jobs(idempotency_key);

-- ---------------------------------------------------------------------
-- 4. EXTEND seo_analysis_history TABLE
-- ---------------------------------------------------------------------
ALTER TABLE public.seo_analysis_history
  ADD COLUMN IF NOT EXISTS trigger_type TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS analysis_version TEXT DEFAULT 'seo-v1',
  ADD COLUMN IF NOT EXISTS critical_issues_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warnings_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opportunities_count INTEGER DEFAULT 0;
