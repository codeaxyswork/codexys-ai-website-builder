-- ==============================================================================
-- Migration: Phase 12 — AI Search / AEO + Topical Authority
-- Date: 2026-09-16
-- Description:
--   Creates website_aeo_analysis table, indexes, and strict RLS policies for:
--     1. Answer Readiness Score (0-100) & AEO category breakdown
--     2. Entity Clarity metrics (Business, Location, Contact, Brand, Products)
--     3. Questions Discovered & SERP answer readiness status
--     4. Topic Clusters, Topic Coverage Score (0-100), and Content Gaps
-- ==============================================================================

-- 1. Create website_aeo_analysis table
CREATE TABLE IF NOT EXISTS public.website_aeo_analysis (
  website_id UUID PRIMARY KEY REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer_readiness_score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  topic_coverage_score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  aeo_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  entity_clarity JSONB NOT NULL DEFAULT '{}'::jsonb,
  questions_discovered JSONB NOT NULL DEFAULT '[]'::jsonb,
  topic_clusters JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user/website lookup
CREATE INDEX IF NOT EXISTS idx_website_aeo_analysis_user ON public.website_aeo_analysis(user_id);

-- 2. Enable Row Level Security
ALTER TABLE public.website_aeo_analysis ENABLE ROW LEVEL SECURITY;

-- 3. Strict User Ownership RLS Policy
DROP POLICY IF EXISTS "Users can manage their own website AEO analysis" ON public.website_aeo_analysis;
CREATE POLICY "Users can manage their own website AEO analysis"
  ON public.website_aeo_analysis
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Trigger for automatic updated_at timestamp updates
CREATE OR REPLACE FUNCTION public.update_website_aeo_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_website_aeo_analysis_updated_at ON public.website_aeo_analysis;
CREATE TRIGGER trg_website_aeo_analysis_updated_at
  BEFORE UPDATE ON public.website_aeo_analysis
  FOR EACH ROW
  EXECUTE FUNCTION public.update_website_aeo_analysis_updated_at();
