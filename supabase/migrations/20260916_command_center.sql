-- =====================================================================
-- SEO PHASE 16 MIGRATION: SEO COMMAND CENTER + UNIFIED SCORING
-- Table: public.seo_unified_scores
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.seo_unified_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unified_score INT NOT NULL DEFAULT 0,
  confidence_level TEXT NOT NULL DEFAULT 'high', -- 'high', 'medium', 'limited'
  category_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_availability JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.seo_unified_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own seo_unified_scores" ON public.seo_unified_scores;
CREATE POLICY "Users can view own seo_unified_scores" ON public.seo_unified_scores FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own seo_unified_scores" ON public.seo_unified_scores;
CREATE POLICY "Users can insert own seo_unified_scores" ON public.seo_unified_scores FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own seo_unified_scores" ON public.seo_unified_scores;
CREATE POLICY "Users can delete own seo_unified_scores" ON public.seo_unified_scores FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_seo_unified_scores_website_id ON public.seo_unified_scores(website_id);
CREATE INDEX IF NOT EXISTS idx_seo_unified_scores_user_id ON public.seo_unified_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_seo_unified_scores_created_at ON public.seo_unified_scores(website_id, created_at DESC);
