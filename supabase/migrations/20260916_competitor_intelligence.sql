-- ==============================================================================
-- Migration: Phase 13 — Competitor + Content Gap Intelligence
-- Date: 2026-09-16
-- Description:
--   Creates tables, indexes, and strict RLS policies for:
--     1. seo_competitors: Managed competitor domains per website.
--     2. competitor_analyses: Extracted competitor public page summaries, topics, and gaps.
-- ==============================================================================

-- 1. Create seo_competitors table
CREATE TABLE IF NOT EXISTS public.seo_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, analyzing, completed, failed
  last_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT seo_competitors_website_domain_uniq UNIQUE (website_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_seo_competitors_website ON public.seo_competitors(website_id);
CREATE INDEX IF NOT EXISTS idx_seo_competitors_user ON public.seo_competitors(user_id);

-- 2. Create competitor_analyses table
CREATE TABLE IF NOT EXISTS public.competitor_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES public.seo_competitors(id) ON DELETE CASCADE,
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scraped_pages JSONB DEFAULT '[]'::jsonb,
  extracted_topics JSONB DEFAULT '[]'::jsonb,
  content_gaps JSONB DEFAULT '[]'::jsonb,
  page_gaps JSONB DEFAULT '[]'::jsonb,
  data_source TEXT NOT NULL DEFAULT 'PUBLIC_SITE', -- PUBLIC_SITE, GSC, AHREFS, SEMRUSH, MOZ
  last_analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitor_analyses_competitor ON public.competitor_analyses(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_analyses_website ON public.competitor_analyses(website_id);

-- 3. Enable Row Level Security
ALTER TABLE public.seo_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_analyses ENABLE ROW LEVEL SECURITY;

-- 4. Strict User Ownership RLS Policies
DROP POLICY IF EXISTS "Users can manage their own website competitors" ON public.seo_competitors;
CREATE POLICY "Users can manage their own website competitors"
  ON public.seo_competitors
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own competitor analyses" ON public.competitor_analyses;
CREATE POLICY "Users can manage their own competitor analyses"
  ON public.competitor_analyses
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_seo_competitors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seo_competitors_updated_at ON public.seo_competitors;
CREATE TRIGGER trg_seo_competitors_updated_at
  BEFORE UPDATE ON public.seo_competitors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_seo_competitors_updated_at();
