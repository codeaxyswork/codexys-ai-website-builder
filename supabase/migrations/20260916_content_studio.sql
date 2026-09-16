-- =====================================================================
-- SEO PHASE 14 MIGRATION: CONTENT STUDIO + CONTENT REFRESH
-- Tables: public.content_briefs, public.content_revisions, public.content_refresh_runs
-- =====================================================================

-- 1. Table: public.content_briefs
CREATE TABLE IF NOT EXISTS public.content_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  primary_keyword TEXT,
  secondary_keywords TEXT[] DEFAULT '{}'::text[],
  search_intent TEXT DEFAULT 'informational',
  target_audience TEXT,
  content_type TEXT DEFAULT 'blog_post',
  topic_cluster TEXT,
  desired_tone TEXT DEFAULT 'professional',
  opportunity_id UUID,
  competitor_gap_context JSONB DEFAULT '{}'::jsonb,
  gsc_context JSONB DEFAULT '{}'::jsonb,
  brief_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  outline_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.content_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own content_briefs" ON public.content_briefs;
CREATE POLICY "Users can view own content_briefs" ON public.content_briefs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own content_briefs" ON public.content_briefs;
CREATE POLICY "Users can insert own content_briefs" ON public.content_briefs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own content_briefs" ON public.content_briefs;
CREATE POLICY "Users can update own content_briefs" ON public.content_briefs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own content_briefs" ON public.content_briefs;
CREATE POLICY "Users can delete own content_briefs" ON public.content_briefs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_content_briefs_website_id ON public.content_briefs(website_id);
CREATE INDEX IF NOT EXISTS idx_content_briefs_user_id ON public.content_briefs(user_id);


-- 2. Table: public.content_revisions
CREATE TABLE IF NOT EXISTS public.content_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'blog', -- 'blog' or 'page'
  version_number INT NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  seo_metadata JSONB DEFAULT '{}'::jsonb,
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.content_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own content_revisions" ON public.content_revisions;
CREATE POLICY "Users can view own content_revisions" ON public.content_revisions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own content_revisions" ON public.content_revisions;
CREATE POLICY "Users can insert own content_revisions" ON public.content_revisions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_content_revisions_website_id ON public.content_revisions(website_id);
CREATE INDEX IF NOT EXISTS idx_content_revisions_target_id ON public.content_revisions(target_id);


-- 3. Table: public.content_refresh_runs
CREATE TABLE IF NOT EXISTS public.content_refresh_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'blog', -- 'blog' or 'page'
  quality_score INT DEFAULT 0,
  analysis_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.content_refresh_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own content_refresh_runs" ON public.content_refresh_runs;
CREATE POLICY "Users can view own content_refresh_runs" ON public.content_refresh_runs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own content_refresh_runs" ON public.content_refresh_runs;
CREATE POLICY "Users can insert own content_refresh_runs" ON public.content_refresh_runs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_content_refresh_runs_website_id ON public.content_refresh_runs(website_id);
CREATE INDEX IF NOT EXISTS idx_content_refresh_runs_target_id ON public.content_refresh_runs(target_id);
