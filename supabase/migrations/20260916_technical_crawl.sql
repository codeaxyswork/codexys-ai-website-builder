-- =====================================================================
-- SEO PHASE 15 MIGRATION: ADVANCED TECHNICAL SEO + CRAWL INTELLIGENCE
-- Tables: public.technical_crawl_runs, public.technical_crawl_issues
-- =====================================================================

-- 1. Table: public.technical_crawl_runs
CREATE TABLE IF NOT EXISTS public.technical_crawl_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  technical_score INT NOT NULL DEFAULT 0,
  total_urls_crawled INT NOT NULL DEFAULT 0,
  total_issues_count INT NOT NULL DEFAULT 0,
  summary_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  crawl_graph JSONB NOT NULL DEFAULT '{}'::jsonb,
  crawl_duration_ms INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.technical_crawl_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own technical_crawl_runs" ON public.technical_crawl_runs;
CREATE POLICY "Users can view own technical_crawl_runs" ON public.technical_crawl_runs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own technical_crawl_runs" ON public.technical_crawl_runs;
CREATE POLICY "Users can insert own technical_crawl_runs" ON public.technical_crawl_runs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own technical_crawl_runs" ON public.technical_crawl_runs;
CREATE POLICY "Users can delete own technical_crawl_runs" ON public.technical_crawl_runs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_technical_crawl_runs_website_id ON public.technical_crawl_runs(website_id);
CREATE INDEX IF NOT EXISTS idx_technical_crawl_runs_user_id ON public.technical_crawl_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_technical_crawl_runs_created_at ON public.technical_crawl_runs(website_id, created_at DESC);


-- 2. Table: public.technical_crawl_issues
CREATE TABLE IF NOT EXISTS public.technical_crawl_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id UUID NOT NULL REFERENCES public.technical_crawl_runs(id) ON DELETE CASCADE,
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'crawlability',
  severity TEXT NOT NULL DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'
  explanation TEXT NOT NULL,
  evidence TEXT,
  recommended_action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'resolved', 'ignored'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.technical_crawl_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own technical_crawl_issues" ON public.technical_crawl_issues;
CREATE POLICY "Users can view own technical_crawl_issues" ON public.technical_crawl_issues FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own technical_crawl_issues" ON public.technical_crawl_issues;
CREATE POLICY "Users can insert own technical_crawl_issues" ON public.technical_crawl_issues FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own technical_crawl_issues" ON public.technical_crawl_issues;
CREATE POLICY "Users can update own technical_crawl_issues" ON public.technical_crawl_issues FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own technical_crawl_issues" ON public.technical_crawl_issues;
CREATE POLICY "Users can delete own technical_crawl_issues" ON public.technical_crawl_issues FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_technical_crawl_issues_website_id ON public.technical_crawl_issues(website_id);
CREATE INDEX IF NOT EXISTS idx_technical_crawl_issues_crawl_id ON public.technical_crawl_issues(crawl_id);
CREATE INDEX IF NOT EXISTS idx_technical_crawl_issues_severity ON public.technical_crawl_issues(severity);
